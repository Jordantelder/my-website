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
    client = FakeOllamaClient(list_error=ConnectionError("Failed to connect to Ollama."))
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


def test_empty_ask_is_rejected_before_contacting_the_server(isolated_env, monkeypatch):
    client = FakeOllamaClient()
    code, _, err = run(["--ask", "   "], client, monkeypatch)
    assert code == cli.EXIT_ERROR and "no question given" in err
    assert client.calls == []


def test_host_flag_accepts_host_port_like_the_env_var(isolated_env, monkeypatch):
    code, out, _ = run(["--check", "--host", "gpu-box:11434"], FakeOllamaClient(), monkeypatch)
    assert code == 0 and "OK: Ollama at http://gpu-box:11434 has model" in out
    code, out, _ = run(["--check", "--host", "gpu-box"], FakeOllamaClient(), monkeypatch)
    assert code == 0 and "http://gpu-box:11434" in out


def test_export_failure_is_reported_not_raised(isolated_env, monkeypatch):
    target_dir = isolated_env / "adir"
    target_dir.mkdir()
    code, out, err = run(["--ask", "hi", "--export", str(target_dir)], FakeOllamaClient(), monkeypatch)
    assert code == cli.EXIT_ERROR
    assert "stub answer" in out and "cannot write" in err


def test_export_expands_tilde_and_notes_overwrites(isolated_env, monkeypatch):
    monkeypatch.setenv("HOME", str(isolated_env))
    code, _, err = run(["--ask", "hi", "--export", "~/r.md"], FakeOllamaClient(), monkeypatch)
    assert code == 0 and (isolated_env / "r.md").exists()
    assert not (isolated_env / "~").exists()
    code, _, err = run(["--ask", "hi", "--export", "~/r.md"], FakeOllamaClient(), monkeypatch)
    assert code == 0 and "replaced existing file" in err


def test_show_thinking_export_includes_model_reasoning(isolated_env, monkeypatch):
    report = isolated_env / "with.md"
    code, _, _ = run(["--ask", "hi", "--show-thinking", "--export", str(report)], FakeOllamaClient(), monkeypatch)
    assert code == 0
    assert "## Model reasoning\n\nthinking about it" in report.read_text(encoding="utf-8")


def test_export_omits_reasoning_unless_show_thinking(isolated_env, monkeypatch):
    report = isolated_env / "without.md"
    run(["--ask", "hi", "--export", str(report)], FakeOllamaClient(), monkeypatch)
    assert "Model reasoning" not in report.read_text(encoding="utf-8")


def test_ctrl_c_during_one_shot_answer(isolated_env, monkeypatch):
    code, out, err = run(["--ask", "hi", "--no-think"], FakeOllamaClient(stream_error=KeyboardInterrupt()), monkeypatch)
    assert code == cli.EXIT_INTERRUPTED and "(interrupted)" in err
    assert out.endswith("\n")  # StreamPrinter.finish() still ran


def test_ctrl_c_during_repl_answer_returns_to_prompt(isolated_env, monkeypatch):
    client = FakeOllamaClient(replies=["aborted answer", "full answer"], stream_error=KeyboardInterrupt(), thinking=None)
    lines = iter(["first?", "second?", "/quit"])

    def fake_input(prompt=""):
        client.stream_error = None if client.calls else client.stream_error  # only the first answer is interrupted
        return next(lines)

    monkeypatch.setattr("builtins.input", fake_input)
    code, out, err = run([], client, monkeypatch, stdin=_TTY())
    assert code == 0
    assert "interrupted" in err
    assert "full answer" in out
    # the interrupted exchange was not remembered: second question sees no prior turns
    assert [m["role"] for m in client.calls[1]["messages"]] == ["system", "user"]


def test_repl_context_commands(isolated_env, monkeypatch):
    ctx = isolated_env / "K183256.txt"
    ctx.write_text("510(k) summary text", encoding="utf-8")
    client = FakeOllamaClient(replies=["a1", "a2"])
    lines = iter(["/context", "/context nope.txt", f"/context {ctx}", "q1", "/clear-context", "q2", "/quit"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(lines))
    code, out, err = run([], client, monkeypatch, stdin=_TTY())
    assert code == 0
    assert "usage: /context PATH" in err and "cannot read nope.txt" in err
    assert f"attached {ctx} (1 context document(s))" in out and "context cleared" in out
    assert "510(k) summary text" in client.calls[0]["messages"][-1]["content"]  # q1 is grounded
    assert client.calls[1]["messages"][-1]["content"] == "q2"  # q2 is bare after /clear-context


def test_repl_export_to_bad_path_keeps_session_alive(isolated_env, monkeypatch):
    (isolated_env / "adir").mkdir()
    client = FakeOllamaClient(replies=["one", "two"])
    lines = iter(["q1", "/export adir", "q2", "/quit"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(lines))
    code, out, err = run([], client, monkeypatch, stdin=_TTY())
    assert code == 0 and "cannot write" in err and "two" in out


def test_dotenv_in_cwd_is_read_and_environment_wins(isolated_env, monkeypatch):
    (isolated_env / ".env").write_text("RINN_MODEL=llama3:8b\nRINN_THINK=false\nRINN_TEMPERATURE=0.9\n", encoding="utf-8")
    monkeypatch.setenv("RINN_TEMPERATURE", "0.1")
    client = FakeOllamaClient(models=["llama3:8b"])
    code, _, _ = run(["--ask", "hi"], client, monkeypatch)
    call = client.calls[0]
    assert code == 0 and call["model"] == "llama3:8b" and call["think"] is False
    assert call["options"]["temperature"] == 0.1  # process environment beats .env
