"""Command-line interface: `python -m rinn` or `rinn` after installation."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Sequence, TextIO

from . import __version__
from .assistant import Answer, ContextDoc, RinnAssistant
from .config import ConfigError, Settings
from .export import save_markdown
from .llm import Chunk, LLMError, ModelNotAvailable, OllamaLLM, OllamaUnavailable
from .persona import build_system_prompt

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_OLLAMA_UNAVAILABLE = 2
EXIT_MODEL_MISSING = 3

HELP_TEXT = """Commands:
  /help              show this help
  /context PATH      attach a text file as context for the next questions
  /clear-context     drop attached context
  /export PATH       save the last answer as a Markdown report
  /reset             forget the conversation
  /quit              exit
"""


class StreamPrinter:
    """Writes streamed chunks to ``out``, optionally including thinking."""

    def __init__(self, out: TextIO, show_thinking: bool) -> None:
        self.out = out
        self.show_thinking = show_thinking
        self._in_thinking = False

    def __call__(self, chunk: Chunk) -> None:
        if chunk.kind == "thinking":
            if not self.show_thinking:
                return
            if not self._in_thinking:
                self.out.write("[thinking]\n")
                self._in_thinking = True
            self.out.write(chunk.text)
        else:
            if self._in_thinking:
                self.out.write("\n[/thinking]\n\n")
                self._in_thinking = False
            self.out.write(chunk.text)
        self.out.flush()

    def finish(self) -> None:
        if self._in_thinking:
            self.out.write("\n[/thinking]\n")
            self._in_thinking = False
        self.out.write("\n")
        self.out.flush()


def load_context_files(paths: Sequence[str]) -> list[ContextDoc]:
    """Read plain-text files as context documents (source = file name)."""
    docs: list[ContextDoc] = []
    for raw in paths:
        path = Path(raw)
        text = path.read_text(encoding="utf-8", errors="replace")
        docs.append(ContextDoc(source=path.name, text=text, kind="file"))
    return docs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rinn",
        description="RINN (Regulatory Intelligence Neural Network) on a local Ollama model.",
    )
    parser.add_argument("--ask", metavar="QUESTION", help="ask one question and exit (default: interactive session)")
    parser.add_argument(
        "--context", metavar="PATH", action="append", default=[], help="text file to ground the answer in (repeatable)"
    )
    parser.add_argument("--export", metavar="PATH", help="with --ask: write the answer as a Markdown report")
    parser.add_argument("--model", help="Ollama model tag (default: RINN_MODEL or qwen3.8:27b)")
    parser.add_argument("--host", help="Ollama server URL (default: OLLAMA_HOST or http://localhost:11434)")
    parser.add_argument("--temperature", type=float, help="sampling temperature")
    parser.add_argument("--num-ctx", type=int, dest="num_ctx", help="context window in tokens")
    parser.add_argument("--no-think", action="store_true", help="disable the model's thinking mode")
    parser.add_argument("--show-thinking", action="store_true", help="print the model's reasoning while streaming")
    parser.add_argument("--check", action="store_true", help="verify the Ollama server and model, then exit")
    parser.add_argument("--print-system-prompt", action="store_true", help="print the RINN system prompt and exit")
    parser.add_argument("--version", action="version", version=f"rinn-ollama {__version__}")
    return parser


def settings_from_args(args: argparse.Namespace) -> Settings:
    return Settings.from_env().with_overrides(
        model=args.model,
        host=args.host,
        temperature=args.temperature,
        num_ctx=args.num_ctx,
        think=False if args.no_think else None,
        show_thinking=True if args.show_thinking else None,
    )


def run_check(llm: OllamaLLM, out: TextIO, err: TextIO) -> int:
    try:
        models = llm.available_models()
        llm.ensure_model()
    except OllamaUnavailable as exc:
        print(f"FAIL: {exc}", file=err)
        return EXIT_OLLAMA_UNAVAILABLE
    except ModelNotAvailable as exc:
        print(f"FAIL: {exc}", file=err)
        return EXIT_MODEL_MISSING
    except LLMError as exc:
        print(f"FAIL: {exc}", file=err)
        return EXIT_ERROR
    print(f"OK: Ollama at {llm.settings.host} has model {llm.model}", file=out)
    print(f"Models on server: {', '.join(models) if models else '(none)'}", file=out)
    return EXIT_OK


def ask_and_print(assistant: RinnAssistant, question: str, docs: list[ContextDoc], out: TextIO) -> Answer:
    printer = StreamPrinter(out, assistant.settings.show_thinking)
    try:
        answer = assistant.ask(question, context=docs, on_chunk=printer)
    finally:
        printer.finish()
    return answer


def run_once(assistant: RinnAssistant, question: str, docs: list[ContextDoc], export: str | None, out: TextIO, err: TextIO) -> int:
    try:
        answer = ask_and_print(assistant, question, docs, out)
    except LLMError as exc:
        print(f"error: {exc}", file=err)
        return _exit_code_for(exc)
    if export:
        path = save_markdown(answer, export, include_thinking=assistant.settings.show_thinking)
        print(f"saved report to {path}", file=err)
    return EXIT_OK


def run_repl(assistant: RinnAssistant, docs: list[ContextDoc], out: TextIO, err: TextIO) -> int:
    print(f"RINN ({assistant.llm.model}) ready. Type /help for commands, /quit to exit.", file=out)
    last_answer: Answer | None = None
    while True:
        try:
            line = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print(file=out)
            return EXIT_OK
        if not line:
            continue
        if line.startswith("/"):
            command, _, argument = line.partition(" ")
            argument = argument.strip()
            if command in ("/quit", "/exit"):
                return EXIT_OK
            if command == "/help":
                print(HELP_TEXT, file=out)
            elif command == "/reset":
                assistant.reset()
                print("conversation cleared", file=out)
            elif command == "/context":
                if not argument:
                    print("usage: /context PATH", file=err)
                    continue
                try:
                    docs.extend(load_context_files([argument]))
                except OSError as exc:
                    print(f"cannot read {argument}: {exc}", file=err)
                    continue
                print(f"attached {argument} ({len(docs)} context document(s))", file=out)
            elif command == "/clear-context":
                docs.clear()
                print("context cleared", file=out)
            elif command == "/export":
                if last_answer is None:
                    print("nothing to export yet", file=err)
                elif not argument:
                    print("usage: /export PATH", file=err)
                else:
                    path = save_markdown(last_answer, argument, include_thinking=assistant.settings.show_thinking)
                    print(f"saved report to {path}", file=out)
            else:
                print(f"unknown command {command}; type /help", file=err)
            continue

        print("rinn> ", end="", file=out, flush=True)
        try:
            last_answer = ask_and_print(assistant, line, docs, out)
        except LLMError as exc:
            print(f"error: {exc}", file=err)
            if isinstance(exc, (OllamaUnavailable, ModelNotAvailable)):
                return _exit_code_for(exc)


def _exit_code_for(exc: LLMError) -> int:
    if isinstance(exc, OllamaUnavailable):
        return EXIT_OLLAMA_UNAVAILABLE
    if isinstance(exc, ModelNotAvailable):
        return EXIT_MODEL_MISSING
    return EXIT_ERROR


def main(argv: Sequence[str] | None = None, out: TextIO = sys.stdout, err: TextIO = sys.stderr) -> int:
    args = build_parser().parse_args(argv)

    try:
        settings = settings_from_args(args)
    except ConfigError as exc:
        print(f"configuration error: {exc}", file=err)
        return EXIT_ERROR

    if args.print_system_prompt:
        print(build_system_prompt(settings.extra_instructions), file=out)
        return EXIT_OK

    llm = OllamaLLM(settings)
    if args.check:
        return run_check(llm, out, err)

    try:
        docs = load_context_files(args.context)
    except OSError as exc:
        print(f"cannot read context file: {exc}", file=err)
        return EXIT_ERROR

    try:
        llm.ensure_model()
    except LLMError as exc:
        print(f"error: {exc}", file=err)
        return _exit_code_for(exc)

    assistant = RinnAssistant(llm, settings)

    if args.ask is not None:
        return run_once(assistant, args.ask, docs, args.export, out, err)
    if not sys.stdin.isatty():
        question = sys.stdin.read()
        if not question.strip():
            print("no question given (use --ask or pipe text on stdin)", file=err)
            return EXIT_ERROR
        return run_once(assistant, question, docs, args.export, out, err)
    return run_repl(assistant, docs, out, err)
