# qwen-eval

Use a Qwen Max model as a **programmatic evaluator** for source files and for
program output.

The Qwen web chat has no code-assessment mode for `.py` files. The API doesn't
need one — a "file upload" is just text inside a message. This harness reads
your files (or runs your program and captures its output), sends them with a
rubric, and forces the model to reply as **schema-validated JSON**, so the
result can gate CI rather than be read by a human.

No dependencies beyond the Python 3.9+ standard library.

## Setup

```bash
export DASHSCOPE_API_KEY=sk-...          # Alibaba Cloud Model Studio console
export QWEN_MODEL=qwen3.8-max            # optional; this is the default
export QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

Base URL by region:

| Region | Base URL |
| --- | --- |
| Singapore / international | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| Beijing | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| Workspace-scoped | `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` |

Confirm which one your key is issued against in the console — a key from one
region returns `InvalidApiKey` on another.

## review — assess source files

```bash
# fails the build on any critical/high finding
python3 qwen_eval.py review 'src/**/*.py' --fail-on critical,high

# human-readable report
python3 qwen_eval.py review app.py --format md --out review.md

# review only what a PR changed
python3 qwen_eval.py review $(git diff --name-only origin/main... -- '*.py') \
    --context "$(git log -1 --format=%B)"

# see the batching and token estimate without spending anything
python3 qwen_eval.py review 'src/**/*.py' --dry-run
```

Source is sent with line numbers attached so the model cites lines that
actually exist. Files are batched to fit `--max-input-tokens` (default 120k,
well under the model's 1M window — smaller requests give sharper findings and
cheaper retries).

## judge — grade real program output

Static review can't tell you whether the code *works*. Run it, then have the
model grade the observed output against a spec:

```bash
python3 qwen_eval.py judge \
    --cmd 'python3 app.py --demo' \
    --spec SPEC.md \
    --expected fixtures/expected.txt \
    --format md
```

The model sees the exit code, stdout, and stderr — it grades what actually
happened rather than guessing from source.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | passed the configured thresholds |
| 1 | blocking findings, score below `--fail-under`, or `verdict: fail` |
| 2 | bad usage (no files matched, missing spec) |
| 3 | model returned unusable JSON twice |

## CI

```yaml
- name: LLM code review
  env:
    DASHSCOPE_API_KEY: ${{ secrets.DASHSCOPE_API_KEY }}
  run: |
    python3 tools/qwen-eval/qwen_eval.py review \
      $(git diff --name-only ${{ github.event.pull_request.base.sha }}... -- '*.py') \
      --fail-on critical --format md --out review.md
- run: cat review.md >> $GITHUB_STEP_SUMMARY
  if: always()
```

Start with `--fail-on critical` only. Widen it once you've seen a few weeks of
findings and know the false-positive rate.

## Notes and limits

- **Determinism.** `temperature=0`, `top_p=1`, `seed=42` make runs repeatable in
  practice, not guaranteed. Don't treat a score change of ±1 as signal.
- **Reasoning.** Qwen3 models reason by default; the harness sends
  `enable_thinking: false` for cheaper, simpler non-streaming calls. Pass
  `--thinking` to turn it back on for hard reviews.
- **Structured output.** Defaults to `response_format={"type":"json_object"}`
  plus local schema validation and one repair round. `--strict-schema` switches
  to `json_schema` if your region exposes it.
- **Prompt injection.** The model reads code and program output, which are
  untrusted input. Findings are advisory; never let this harness perform
  actions, only report.
- **Cost.** Estimated per run in the report's `usage` block, at $2/$6 per 1M
  input/output tokens. Override with `QWEN_PRICE_IN` / `QWEN_PRICE_OUT`.

## Offline check

`examples/buggy.py` carries deliberate defects (a `ZeroDivisionError` the
docstring denies, a mutable default cache, a leaked file handle, and a shell
injection) — useful for confirming the pipeline reports what you expect.
