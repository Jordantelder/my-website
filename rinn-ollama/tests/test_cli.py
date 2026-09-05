from __future__ import annotations

import io

import ollama
import pytest

from rinn import cli
from rinn.llm import OllamaLLM
from rinn.persona import SYSTEM_PROMPT

from conftest import FakeOllamaClient


@pytest.fixture
def isolated_env(monkeypatch, tmp_path):
    """No .env, no RINN_* variables leaking in from the developer's shell."""
    for key in list(__import__("os").environ):
        if key.startswith("RINN_") or key == "OLLAMA_HOST":
            monkeypatch.delenv(key, raising=False)
    monkeypatch.chdir(tmp_path)
    return tmp_path


class _TTY(io.StringIO):
    """stdin stand-in that claims to be a terminal so main() starts the REPL."""

    def isatty(self) -> bool:
        return True


def run(argv, client, monkeypatch, stdin=None):
    """Run cli.main with OllamaLLM bound to the fake client; return (code, stdout, stderr)."""
    monkeypatch.setattr(cli, "OllamaLLM", lambda settings: OllamaLLM(settings, client=client))
    if stdin is not None:
        monkeypatch.setattr("sys.stdin", stdin)
    out, err = io.StringIO(), io.StringIO()
    code = cli.main(argv, out=out, err=err)
    return code, out.getvalue(), err.getvalue()


def test_print_system_prompt(isolated_env, monkeypatch):
    code, out, _ = run(["--print-system-prompt"], FakeOllamaClient(), monkeypatch)
    assert code == 0 and out.strip() == SYSTEM_PROMPT


def test_check_ok(isolated_env, monkeypatch):
    code, out, err = run(["--check"], FakeOllamaClient(), monkeypatch)
    assert code == cli.EXIT_OK
    assert "OK: Ollama at http://localhost:11434 has model qwen3.8:27b" in out
    assert "qwen3.8:27b" in out


def test_check_missing_model(isolated_env, monkeypatch):
    code, _, err = run(["--check", "--model", "qwen3.8:27b-q8_0"], FakeOllamaClient(models=["qwen3.8:27b"]), monkeypatch)
    assert code == cli.EXIT_MODEL_MISSING
    assert "ollama pull qwen3.8:27b-q8_0" in err


def test_check_unreachable(isolated_env, monkeypatch):
    import httpx

    client = FakeOllamaClient(list_error=httpx.ConnectError("refused"))
    code, _, err = run(["--check"], client, monkeypatch)
    assert code == cli.EXIT_OLLAMA_UNAVAILABLE and "ollama serve" in err


def test_ask_streams_answer_and_exports(isolated_env, monkeypatch):
    client = FakeOllamaClient(replies=["Endoscopes need ... [K183256.pdf]"])
    context = isolated_env / "K183256.pdf.txt"
    context.write_text("510(k) summary text", encoding="utf-8")
    report = isolated_env / "out" / "report.md"
    code, out, err = run(
        ["--ask", "What testing is required?", "--context", str(context), "--export", str(report), "--no-think"],
        client,
        monkeypatch,
    )
    assert code == 0
    assert "Endoscopes need ... [K183256.pdf]" in out
    assert "[thinking]" not in out
    assert report.exists() and "## Sources\n\n- K183256.pdf.txt" in report.read_text(encoding="utf-8")
    assert client.calls[0]["think"] is False
    assert "510(k) summary text" in client.calls[0]["messages"][-1]["content"]


def test_show_thinking_prints_reasoning(isolated_env, monkeypatch):
    code, out, _ = run(["--ask", "hi", "--show-thinking"], FakeOllamaClient(), monkeypatch)
    assert code == 0
    assert "[thinking]\nthinking about it\n[/thinking]" in out
    assert out.rstrip().endswith("stub answer")


def test_cli_overrides_reach_settings(isolated_env, monkeypatch):
    client = FakeOllamaClient(models=["qwen3.8:27b-q8_0"])
    code, _, _ = run(
        ["--ask", "hi", "--model", "qwen3.8:27b-q8_0", "--host", "http://gpu-box:11434", "--temperature", "0.1", "--num-ctx", "8192"],
        client,
        monkeypatch,
    )
    assert code == 0
    call = client.calls[0]
    assert call["model"] == "qwen3.8:27b-q8_0"
    assert call["options"]["temperature"] == 0.1 and call["options"]["num_ctx"] == 8192


def test_configuration_error_is_reported(isolated_env, monkeypatch):
    code, _, err = run(["--ask", "hi", "--temperature", "9"], FakeOllamaClient(), monkeypatch)
    assert code == cli.EXIT_ERROR and "temperature" in err


def test_missing_context_file(isolated_env, monkeypatch):
    code, _, err = run(["--ask", "hi", "--context", "nope.txt"], FakeOllamaClient(), monkeypatch)
    assert code == cli.EXIT_ERROR and "cannot read context file" in err


def test_ask_reports_llm_error_exit_code(isolated_env, monkeypatch):
    client = FakeOllamaClient(chat_errors=[ollama.ResponseError("boom", 500)])
    code, _, err = run(["--ask", "hi"], client, monkeypatch)
    assert code == cli.EXIT_ERROR and "boom" in err


def test_repl_commands(isolated_env, monkeypatch):
    client = FakeOllamaClient(replies=["first answer", "second answer"])
    report = isolated_env / "r.md"
    lines = iter(["/help", "what?", "/export " + str(report), "/reset", "/unknown", "again?", "/quit"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(lines))
    code, out, err = run([], client, monkeypatch, stdin=_TTY())
    assert code == 0
    assert "Commands:" in out
    assert "first answer" in out and "second answer" in out
    assert report.read_text(encoding="utf-8").count("first answer") == 1
    assert "conversation cleared" in out
    assert "unknown command /unknown" in err
    # after /reset the second question starts a fresh history
    assert [m["role"] for m in client.calls[1]["messages"]] == ["system", "user"]


def test_piped_stdin_is_treated_as_one_question(isolated_env, monkeypatch):
    client = FakeOllamaClient(replies=["piped answer"])
    code, out, _ = run([], client, monkeypatch, stdin=io.StringIO("what about IEC 60601-1?\n"))
    assert code == 0 and "piped answer" in out
    assert client.calls[0]["messages"][-1]["content"] == "what about IEC 60601-1?"


def test_empty_piped_stdin_is_an_error(isolated_env, monkeypatch):
    code, _, err = run([], FakeOllamaClient(), monkeypatch, stdin=io.StringIO("   "))
    assert code == cli.EXIT_ERROR and "no question given" in err
