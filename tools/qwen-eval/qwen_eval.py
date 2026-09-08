#!/usr/bin/env python3
"""
qwen_eval.py - use a Qwen Max model as a programmatic evaluator.

The Qwen web chat has no code-assessment mode for .py files. The API does not
need one: a "file upload" is just text inside a message. This script reads your
source files (or runs your program and captures its output), sends them with a
rubric, and forces the model to reply as validated JSON so the result can gate
CI instead of being read by a human.

Two modes:

  review  - static assessment of source files against a rubric
  judge   - run a command, then grade its actual output against a spec

No required dependencies. Uses the `openai` SDK when installed, otherwise plain
urllib against the same OpenAI-compatible endpoint.
"""

from __future__ import annotations

import argparse
import glob as globlib
import json
import os
import subprocess
import sys
import textwrap
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

API_KEY_ENV = "DASHSCOPE_API_KEY"
DEFAULT_MODEL = os.environ.get("QWEN_MODEL", "qwen3.8-max")
# Singapore / international. Use https://dashscope.aliyuncs.com/compatible-mode/v1
# for the Beijing region, or your workspace-scoped *.maas.aliyuncs.com URL.
DEFAULT_BASE_URL = os.environ.get(
    "QWEN_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)

# Cost per 1M tokens, USD. Override with QWEN_PRICE_IN / QWEN_PRICE_OUT.
PRICE_IN = float(os.environ.get("QWEN_PRICE_IN", "2.00"))
PRICE_OUT = float(os.environ.get("QWEN_PRICE_OUT", "6.00"))

SEVERITIES = ["critical", "high", "medium", "low", "info"]

CHARS_PER_TOKEN = 3.6  # deliberately conservative for source code


# --------------------------------------------------------------------------
# Rubrics (defaults; override any of these with --rubric FILE)
# --------------------------------------------------------------------------

REVIEW_RUBRIC = """\
Assess the code on these dimensions, in this priority order:

1. Correctness - logic errors, off-by-one, wrong operator, unhandled None,
   mutable default args, resource leaks, race conditions, incorrect error
   handling, silent exception swallowing.
2. Contract violations - the code does not do what its docstring, type hints,
   or call sites say it does.
3. Security - injection, unsafe deserialization, path traversal, hardcoded
   secrets, unvalidated external input, unsafe subprocess use.
4. Robustness - crashes on empty/large/malformed input, missing boundary checks.
5. Maintainability - dead code, duplicated logic, misleading names.

Rules for findings:
- Report only defects you can point at a specific line for.
- Every finding must include a concrete failure scenario: the input or state
  that triggers it and the wrong behaviour that results.
- Do NOT report style preferences, formatting, or missing type hints unless
  they cause a real defect.
- Do NOT invent code that is not in the excerpt. If a symbol is defined
  elsewhere and you cannot see it, say so in `detail` and lower `confidence`.
- If the file is fine, return an empty findings list. An empty list is a valid
  and expected answer.
"""

JUDGE_RUBRIC = """\
Grade the observed output against the specification on these dimensions
(each scored 0-10):

- correctness:  does the output match what the spec requires?
- completeness: is anything the spec asks for missing?
- format:       does it match the required shape/format/schema exactly?
- robustness:   did it exit cleanly, and is stderr free of warnings or traces?

Rules:
- Judge ONLY the observed output. Do not speculate about the source code.
- A non-zero exit code, an unhandled traceback, or empty output when output was
  required is an automatic verdict of "fail".
- Quote the exact offending substring in each failure you list.
- If expected output is supplied, treat any semantic difference as a failure,
  but ignore trailing whitespace and key ordering in JSON.
"""


# --------------------------------------------------------------------------
# JSON schemas the model must satisfy
# --------------------------------------------------------------------------

REVIEW_SCHEMA = {
    "type": "object",
    "required": ["summary", "score", "findings"],
    "properties": {
        "summary": {"type": "string"},
        "score": {"type": "number", "minimum": 0, "maximum": 10},
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "required": [
                    "file", "line", "severity", "category",
                    "title", "detail", "failure_scenario", "confidence",
                ],
                "properties": {
                    "file": {"type": "string"},
                    "line": {"type": "integer"},
                    "severity": {"type": "string", "enum": SEVERITIES},
                    "category": {"type": "string"},
                    "title": {"type": "string"},
                    "detail": {"type": "string"},
                    "failure_scenario": {"type": "string"},
                    "suggested_fix": {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        },
    },
}

JUDGE_SCHEMA = {
    "type": "object",
    "required": ["verdict", "score", "dimensions", "failures", "summary"],
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "fail"]},
        "score": {"type": "number", "minimum": 0, "maximum": 10},
        "dimensions": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "score", "rationale"],
                "properties": {
                    "name": {"type": "string"},
                    "score": {"type": "number"},
                    "rationale": {"type": "string"},
                },
            },
        },
        "failures": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": "string"},
    },
}


# --------------------------------------------------------------------------
# Minimal schema validation (no jsonschema dependency)
# --------------------------------------------------------------------------

def validate(obj, schema, path="$") -> list[str]:
    """Return a list of human-readable violations. Empty list == valid."""
    errs: list[str] = []
    t = schema.get("type")

    if t == "object":
        if not isinstance(obj, dict):
            return [f"{path}: expected object, got {type(obj).__name__}"]
        for key in schema.get("required", []):
            if key not in obj:
                errs.append(f"{path}.{key}: required field missing")
        for key, sub in schema.get("properties", {}).items():
            if key in obj:
                errs += validate(obj[key], sub, f"{path}.{key}")

    elif t == "array":
        if not isinstance(obj, list):
            return [f"{path}: expected array, got {type(obj).__name__}"]
        for i, item in enumerate(obj):
            errs += validate(item, schema.get("items", {}), f"{path}[{i}]")

    elif t == "string":
        if not isinstance(obj, str):
            errs.append(f"{path}: expected string, got {type(obj).__name__}")
        elif "enum" in schema and obj not in schema["enum"]:
            errs.append(f"{path}: {obj!r} not one of {schema['enum']}")

    elif t in ("number", "integer"):
        if isinstance(obj, bool) or not isinstance(obj, (int, float)):
            errs.append(f"{path}: expected {t}, got {type(obj).__name__}")
        else:
            if t == "integer" and not float(obj).is_integer():
                errs.append(f"{path}: expected integer, got {obj}")
            if "minimum" in schema and obj < schema["minimum"]:
                errs.append(f"{path}: {obj} below minimum {schema['minimum']}")
            if "maximum" in schema and obj > schema["maximum"]:
                errs.append(f"{path}: {obj} above maximum {schema['maximum']}")

    return errs


# --------------------------------------------------------------------------
# Transport
# --------------------------------------------------------------------------

@dataclass
class Usage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cached_tokens: int = 0
    requests: int = 0

    def add(self, u: dict) -> None:
        self.requests += 1
        self.prompt_tokens += u.get("prompt_tokens", 0) or 0
        self.completion_tokens += u.get("completion_tokens", 0) or 0
        details = u.get("prompt_tokens_details") or {}
        self.cached_tokens += details.get("cached_tokens", 0) or 0

    @property
    def cost_usd(self) -> float:
        return (self.prompt_tokens * PRICE_IN
                + self.completion_tokens * PRICE_OUT) / 1_000_000


@dataclass
class Client:
    api_key: str
    base_url: str = DEFAULT_BASE_URL
    model: str = DEFAULT_MODEL
    timeout: int = 300
    thinking: bool = False
    retries: int = 4
    usage: Usage = field(default_factory=Usage)

    def complete(self, system: str, user: str, schema: dict | None = None,
                 strict_schema: bool = False, max_tokens: int = 8192) -> str:
        body: dict = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            # Evaluation wants repeatability, not creativity.
            "temperature": 0,
            "top_p": 1,
            "seed": 42,
            "max_tokens": max_tokens,
        }

        if schema is not None:
            if strict_schema:
                # Only if your account/region exposes strict JSON Schema.
                body["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {"name": "report", "strict": True,
                                    "schema": schema},
                }
            else:
                body["response_format"] = {"type": "json_object"}

        if not self.thinking:
            # Qwen3 models reason by default; non-streaming calls are simpler
            # (and cheaper) with it off. Drop this if you want the reasoning.
            body["enable_thinking"] = False

        data = self._post("/chat/completions", body)
        self.usage.add(data.get("usage") or {})
        return data["choices"][0]["message"]["content"] or ""

    def _post(self, path: str, body: dict) -> dict:
        url = self.base_url.rstrip("/") + path
        payload = json.dumps(body).encode()
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        last: Exception | None = None

        for attempt in range(self.retries):
            try:
                req = urllib.request.Request(url, data=payload,
                                             headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    return json.loads(resp.read().decode())
            except urllib.error.HTTPError as e:
                detail = e.read().decode(errors="replace")[:600]
                # 4xx other than rate-limit will not fix themselves.
                if e.code not in (408, 429) and e.code < 500:
                    raise RuntimeError(
                        f"HTTP {e.code} from {url}\n{detail}") from None
                last = RuntimeError(f"HTTP {e.code}: {detail}")
            except (urllib.error.URLError, TimeoutError) as e:
                last = e
            sleep = 2 ** (attempt + 1)
            print(f"  request failed ({last}); retry in {sleep}s",
                  file=sys.stderr)
            time.sleep(sleep)

        raise RuntimeError(f"giving up after {self.retries} attempts: {last}")


def extract_json(text: str) -> dict:
    """Pull a JSON object out of a model reply that may be fenced or prefaced."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, depth, in_str, esc = text.find("{"), 0, False, False
        if start < 0:
            raise
        for i in range(start, len(text)):
            c = text[i]
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = not in_str
            elif not in_str:
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        return json.loads(text[start:i + 1])
        raise


def ask_json(client: Client, system: str, user: str, schema: dict,
             strict_schema: bool = False, max_tokens: int = 8192) -> dict:
    """Call the model and insist on schema-valid JSON, with one repair round."""
    raw = client.complete(system, user, schema, strict_schema, max_tokens)
    try:
        obj = extract_json(raw)
        errs = validate(obj, schema)
        if not errs:
            return obj
        problem = "Your JSON failed validation:\n- " + "\n- ".join(errs[:10])
    except json.JSONDecodeError as e:
        problem = f"Your reply was not parseable JSON: {e}"

    repair = (f"{user}\n\n---\nYour previous reply was rejected.\n{problem}\n"
              f"Return the corrected JSON object only. No prose, no code fences.")
    raw = client.complete(system, repair, schema, strict_schema, max_tokens)
    obj = extract_json(raw)
    errs = validate(obj, schema)
    if errs:
        raise RuntimeError("model returned invalid JSON twice:\n  "
                           + "\n  ".join(errs[:10]))
    return obj


# --------------------------------------------------------------------------
# review mode
# --------------------------------------------------------------------------

REVIEW_SYSTEM = """\
You are a rigorous static code reviewer. You are being called through an API by
an automated pipeline. Your output is parsed by a machine, not read by a human.

Return exactly one JSON object matching this schema, and nothing else:

{schema}

Score meaning: 10 = no defects found; 7-9 = minor issues only; 4-6 = at least
one real bug; 0-3 = severe or numerous defects. Base the score on what you
actually found, not on general impressions.
"""


def collect_files(patterns: list[str], max_bytes: int) -> list[Path]:
    """Expand globs into an ordered, de-duplicated list of readable files."""
    seen: dict[Path, None] = {}
    for pat in patterns:
        p = Path(pat)
        matches = ([p] if p.is_file()
                   else sorted(Path(m) for m in globlib.glob(pat, recursive=True)))
        if not matches and not p.exists():
            print(f"warning: no match for {pat!r}", file=sys.stderr)
        for m in matches:
            if not m.is_file():
                continue
            if m.stat().st_size > max_bytes:
                print(f"warning: skipping {m} ({m.stat().st_size} bytes "
                      f"> --max-file-bytes {max_bytes})", file=sys.stderr)
                continue
            seen[m.resolve()] = None
    return list(seen)


def render_file(path: Path) -> str:
    """Numbered source, so the model can cite lines that actually exist."""
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="utf-8", errors="replace")
    body = "\n".join(f"{i:5d} | {ln}"
                     for i, ln in enumerate(text.splitlines(), 1))
    rel = os.path.relpath(path)
    return f"### FILE: {rel}\n```\n{body}\n```\n"


def batch_files(paths: list[Path], budget_tokens: int) -> list[list[Path]]:
    """Group files into request-sized batches, keeping each file whole."""
    budget_chars = int(budget_tokens * CHARS_PER_TOKEN)
    batches: list[list[Path]] = []
    cur: list[Path] = []
    size = 0
    for p in paths:
        n = p.stat().st_size
        if cur and size + n > budget_chars:
            batches.append(cur)
            cur, size = [], 0
        cur.append(p)
        size += n
    if cur:
        batches.append(cur)
    return batches


def cmd_review(args: argparse.Namespace) -> int:
    paths = collect_files(args.paths, args.max_file_bytes)
    if not paths:
        print("error: no files to review", file=sys.stderr)
        return 2

    rubric = Path(args.rubric).read_text() if args.rubric else REVIEW_RUBRIC
    system = REVIEW_SYSTEM.format(schema=json.dumps(REVIEW_SCHEMA, indent=2))
    batches = batch_files(paths, args.max_input_tokens)

    print(f"reviewing {len(paths)} file(s) in {len(batches)} request(s) "
          f"with {args.model}", file=sys.stderr)

    if args.dry_run:
        for i, b in enumerate(batches, 1):
            chars = sum(p.stat().st_size for p in b)
            print(f"  batch {i}: {len(b)} file(s), ~{int(chars/CHARS_PER_TOKEN)} "
                  f"tokens: {', '.join(os.path.relpath(p) for p in b)}")
        return 0

    client = make_client(args)
    findings: list[dict] = []
    summaries: list[str] = []
    scores: list[float] = []

    for i, batch in enumerate(batches, 1):
        print(f"  [{i}/{len(batches)}] "
              f"{', '.join(os.path.relpath(p) for p in batch)}", file=sys.stderr)
        user = (f"{rubric}\n\n"
                f"{args.context + chr(10) + chr(10) if args.context else ''}"
                f"Review the following file(s). Line numbers are shown to the "
                f"left of a `|`; cite those numbers in `line`.\n\n"
                + "\n".join(render_file(p) for p in batch))
        report = ask_json(client, system, user, REVIEW_SCHEMA,
                          args.strict_schema, args.max_output_tokens)
        findings += report.get("findings", [])
        summaries.append(report.get("summary", ""))
        scores.append(float(report.get("score", 0)))

    order = {s: i for i, s in enumerate(SEVERITIES)}
    findings.sort(key=lambda f: (order.get(f.get("severity", "info"), 9),
                                 -float(f.get("confidence", 0))))
    findings = [f for f in findings
                if float(f.get("confidence", 1)) >= args.min_confidence]

    result = {
        "mode": "review",
        "model": args.model,
        "files": [os.path.relpath(p) for p in paths],
        "score": round(sum(scores) / len(scores), 2) if scores else 0.0,
        "summary": " ".join(s for s in summaries if s),
        "findings": findings,
        "usage": {
            "requests": client.usage.requests,
            "prompt_tokens": client.usage.prompt_tokens,
            "completion_tokens": client.usage.completion_tokens,
            "cached_tokens": client.usage.cached_tokens,
            "estimated_cost_usd": round(client.usage.cost_usd, 4),
        },
    }

    emit(result, args)

    blocking = {s.strip() for s in args.fail_on.split(",") if s.strip()}
    hits = [f for f in findings if f.get("severity") in blocking]
    if hits:
        print(f"\nFAIL: {len(hits)} finding(s) at severity "
              f"{sorted(blocking)}", file=sys.stderr)
        return 1
    if args.fail_under is not None and result["score"] < args.fail_under:
        print(f"\nFAIL: score {result['score']} < --fail-under "
              f"{args.fail_under}", file=sys.stderr)
        return 1
    return 0


# --------------------------------------------------------------------------
# judge mode
# --------------------------------------------------------------------------

JUDGE_SYSTEM = """\
You are an impartial evaluator of program output. You are being called through
an API by an automated pipeline. Your output is parsed by a machine.

Return exactly one JSON object matching this schema, and nothing else:

{schema}

Be strict. Grade what was actually produced, not what was probably intended.
"""


def cmd_judge(args: argparse.Namespace) -> int:
    spec = Path(args.spec).read_text() if args.spec else args.spec_text
    if not spec:
        print("error: pass --spec FILE or --spec-text", file=sys.stderr)
        return 2

    print(f"running: {args.cmd}", file=sys.stderr)
    started = time.time()
    try:
        proc = subprocess.run(args.cmd, shell=True, capture_output=True,
                              text=True, timeout=args.run_timeout)
        stdout, stderr, code = proc.stdout, proc.stderr, proc.returncode
    except subprocess.TimeoutExpired as e:
        stdout = e.stdout or ""
        stderr = (e.stderr or "") + f"\n[timed out after {args.run_timeout}s]"
        code = -1
    elapsed = round(time.time() - started, 2)
    print(f"  exit={code} in {elapsed}s", file=sys.stderr)

    def clip(s: str) -> str:
        limit = args.max_output_chars
        return s if len(s) <= limit else s[:limit] + f"\n[...truncated to {limit} chars]"

    rubric = Path(args.rubric).read_text() if args.rubric else JUDGE_RUBRIC
    parts = [
        rubric,
        "\n## SPECIFICATION (what the program was required to do)\n",
        spec,
        f"\n## COMMAND\n```\n{args.cmd}\n```",
        f"\n## EXIT CODE\n{code}",
        f"\n## STDOUT\n```\n{clip(stdout)}\n```",
        f"\n## STDERR\n```\n{clip(stderr)}\n```",
    ]
    if args.expected:
        parts.append("\n## EXPECTED OUTPUT\n```\n"
                     + clip(Path(args.expected).read_text()) + "\n```")
    user = "\n".join(parts)

    if args.dry_run:
        print(user)
        return 0

    client = make_client(args)
    system = JUDGE_SYSTEM.format(schema=json.dumps(JUDGE_SCHEMA, indent=2))
    report = ask_json(client, system, user, JUDGE_SCHEMA,
                      args.strict_schema, args.max_output_tokens)

    result = {
        "mode": "judge",
        "model": args.model,
        "command": args.cmd,
        "exit_code": code,
        "elapsed_s": elapsed,
        **report,
        "usage": {
            "requests": client.usage.requests,
            "prompt_tokens": client.usage.prompt_tokens,
            "completion_tokens": client.usage.completion_tokens,
            "estimated_cost_usd": round(client.usage.cost_usd, 4),
        },
    }
    emit(result, args)

    if report.get("verdict") != "pass":
        return 1
    if args.fail_under is not None and float(report["score"]) < args.fail_under:
        return 1
    return 0


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------

def to_markdown(r: dict) -> str:
    out = []
    if r["mode"] == "review":
        out.append(f"# Code review - {r['model']}\n")
        out.append(f"**Score:** {r['score']}/10 - "
                   f"{len(r['findings'])} finding(s) across "
                   f"{len(r['files'])} file(s)\n")
        out.append(f"{r['summary']}\n")
        if not r["findings"]:
            out.append("No defects reported.\n")
        for f in r["findings"]:
            out.append(f"## [{f['severity'].upper()}] {f['title']}")
            out.append(f"`{f['file']}:{f['line']}` - {f['category']} "
                       f"(confidence {f.get('confidence', '?')})\n")
            out.append(f"{f['detail']}\n")
            out.append(f"**Fails when:** {f['failure_scenario']}\n")
            if f.get("suggested_fix"):
                out.append(f"**Fix:**\n```\n{f['suggested_fix']}\n```\n")
    else:
        out.append(f"# Output evaluation - {r['model']}\n")
        out.append(f"**Verdict:** {r['verdict'].upper()} - "
                   f"{r['score']}/10 (exit {r['exit_code']})\n")
        out.append(f"{r['summary']}\n")
        out.append("| Dimension | Score | Rationale |")
        out.append("| --- | --- | --- |")
        for d in r["dimensions"]:
            rationale = d["rationale"].replace("|", "\\|").replace("\n", " ")
            out.append(f"| {d['name']} | {d['score']} | {rationale} |")
        out.append("")
        if r["failures"]:
            out.append("## Failures")
            out += [f"- {x}" for x in r["failures"]]
    u = r["usage"]
    out.append(f"\n---\n_{u['prompt_tokens']} in / {u['completion_tokens']} out "
               f"tokens, ~${u['estimated_cost_usd']}_")
    return "\n".join(out)


def emit(result: dict, args: argparse.Namespace) -> None:
    text = (json.dumps(result, indent=2) if args.format == "json"
            else to_markdown(result))
    if args.out:
        Path(args.out).write_text(text)
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(text)


def make_client(args: argparse.Namespace) -> Client:
    key = os.environ.get(API_KEY_ENV)
    if not key:
        sys.exit(f"error: set {API_KEY_ENV} (get one from the Alibaba Cloud "
                 f"Model Studio console)")
    return Client(api_key=key, base_url=args.base_url, model=args.model,
                  timeout=args.timeout, thinking=args.thinking)


# --------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="qwen_eval",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            examples:
              qwen_eval.py review 'src/**/*.py' --fail-on critical,high
              qwen_eval.py review app.py --format md --out review.md
              qwen_eval.py judge --cmd 'python app.py --demo' --spec SPEC.md
              qwen_eval.py review 'src/**/*.py' --dry-run   # no API call
        """))
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--model", default=DEFAULT_MODEL)
        sp.add_argument("--base-url", default=DEFAULT_BASE_URL)
        sp.add_argument("--rubric", help="file overriding the built-in rubric")
        sp.add_argument("--format", choices=["json", "md"], default="json")
        sp.add_argument("--out", help="write report here instead of stdout")
        sp.add_argument("--fail-under", type=float,
                        help="exit 1 if score is below this")
        sp.add_argument("--max-output-tokens", type=int, default=8192)
        sp.add_argument("--timeout", type=int, default=300,
                        help="HTTP timeout per API request")
        sp.add_argument("--thinking", action="store_true",
                        help="let the model reason before answering")
        sp.add_argument("--strict-schema", action="store_true",
                        help="use response_format=json_schema (needs support)")
        sp.add_argument("--dry-run", action="store_true",
                        help="show what would be sent; make no API call")

    r = sub.add_parser("review", help="assess source files against a rubric")
    r.add_argument("paths", nargs="+", help="files or globs")
    r.add_argument("--context", help="extra context, e.g. the PR description")
    r.add_argument("--fail-on", default="critical,high",
                   help="comma-separated severities that fail the run")
    r.add_argument("--min-confidence", type=float, default=0.0)
    r.add_argument("--max-input-tokens", type=int, default=120_000,
                   help="per-request budget; files are batched to fit")
    r.add_argument("--max-file-bytes", type=int, default=400_000)
    common(r)
    r.set_defaults(func=cmd_review)

    j = sub.add_parser("judge", help="run a command and grade its output")
    j.add_argument("--cmd", required=True, help="shell command to run")
    j.add_argument("--spec", help="file describing required behaviour")
    j.add_argument("--spec-text", help="inline spec instead of --spec")
    j.add_argument("--expected", help="file with expected output")
    j.add_argument("--run-timeout", type=int, default=120,
                   help="seconds to let the command run")
    j.add_argument("--max-output-chars", type=int, default=100_000)
    common(j)
    j.set_defaults(func=cmd_judge)

    args = p.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
