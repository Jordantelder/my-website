from __future__ import annotations

import io

import pytest

from rinn.llm import OllamaLLM
from rinn.voice import cli

from rinn.voice.audio import AudioError

from conftest import FakeOllamaClient, FakePlayer, FakeTTSClient, FakeTranscriber


@pytest.fixture
def isolated_env(monkeypatch, tmp_path):
    import os

    for key in list(os.environ):
        if key.startswith("RINN_") or key == "OLLAMA_HOST":
            monkeypatch.delenv(key, raising=False)
    monkeypatch.chdir(tmp_path)
    return tmp_path


def run(argv, monkeypatch, ollama_client=None, tts=None, player=None, transcriber=None):
    ollama_client = ollama_client or FakeOllamaClient(replies=["Spoken answer. Second sentence here."], thinking=None)
    monkeypatch.setattr(cli, "OllamaLLM", lambda settings: OllamaLLM(settings, client=ollama_client))
    tts = tts if tts is not None else FakeTTSClient()
    monkeypatch.setattr(cli, "TTSClient", lambda settings: tts)
    player = player if player is not None else FakePlayer()
    monkeypatch.setattr(cli, "Player", lambda device=None: player)
    out, err = io.StringIO(), io.StringIO()
    code = cli.main(argv, out=out, err=err, transcriber=transcriber)
    return code, out.getvalue(), err.getvalue(), ollama_client, tts, player


def test_list_devices(isolated_env, monkeypatch):
    monkeypatch.setattr(cli, "list_devices", lambda: "0 Fake Mic\n1 Fake Speakers")
    code, out, _, *_ = run(["--list-devices"], monkeypatch)
    assert code == 0 and "Fake Mic" in out


def test_ask_speaks_answer_and_defaults_thinking_off(isolated_env, monkeypatch):
    code, out, err, client, tts, player = run(["--ask", "What is a predicate?"], monkeypatch)
    assert code == 0 and "Spoken answer." in out
    assert tts.requests == ["Spoken answer. Second sentence here."]
    assert len(player.clips) == len(tts.requests)
    assert client.calls[0]["think"] is False
    assert player.closed and tts.closed


def test_think_flag_and_no_speak(isolated_env, monkeypatch):
    code, out, _, client, tts, player = run(["--ask", "hi", "--think", "--no-speak"], monkeypatch)
    assert code == 0 and client.calls[0]["think"] is True
    assert tts.requests == [] and player.clips == []


def test_tts_server_down_is_reported(isolated_env, monkeypatch):
    code, _, err, *_ = run(["--ask", "hi"], monkeypatch, tts=FakeTTSClient(healthy=False))
    assert code == cli.EXIT_TTS and "rinn-voice-server --backend kokoro" in err


def test_unknown_voice_is_noted_but_allowed(isolated_env, monkeypatch):
    code, _, err, *_ = run(["--ask", "hi", "--tts-voice", "zz_nobody"], monkeypatch)
    assert code == 0 and "not in the server's list" in err


def test_missing_model_exit_code(isolated_env, monkeypatch):
    code, _, err, *_ = run(["--ask", "hi", "--model", "qwen3.8:27b-q8_0"], monkeypatch, ollama_client=FakeOllamaClient(models=["qwen3.8:27b"]))
    assert code == cli.EXIT_MODEL and "ollama pull" in err


def test_interactive_text_only_session(isolated_env, monkeypatch):
    lines = iter(["typed question", "/quit"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(lines))
    code, out, _, client, tts, _ = run(["--text-only"], monkeypatch)
    assert code == 0 and "Type a question." in out
    assert client.calls[0]["messages"][-1]["content"] == "typed question"


def test_interactive_voice_session_with_injected_transcriber(isolated_env, monkeypatch):
    lines = iter(["", "/quit"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(lines))
    monkeypatch.setattr(cli, "Recorder", lambda device=None, silence_seconds=1.2: __import__("conftest").FakeRecorder())
    code, out, _, client, *_ = run([], monkeypatch, transcriber=FakeTranscriber("spoken question"))
    assert code == 0 and "you (heard): spoken question" in out
    assert client.calls[0]["messages"][-1]["content"] == "spoken question"


def test_empty_ask(isolated_env, monkeypatch):
    code, _, err, *_ = run(["--ask", "  "], monkeypatch)
    assert code == cli.EXIT_ERROR and "no question given" in err


def test_missing_portaudio_exits_cleanly(isolated_env, monkeypatch):
    client = FakeOllamaClient()
    monkeypatch.setattr(cli, "OllamaLLM", lambda settings: OllamaLLM(settings, client=client))
    monkeypatch.setattr(cli, "TTSClient", lambda settings: FakeTTSClient())

    def broken_player(device=None):
        raise AudioError("PortAudio library not found")

    monkeypatch.setattr(cli, "Player", broken_player)
    out, err = io.StringIO(), io.StringIO()
    code = cli.main(["--ask", "hi"], out=out, err=err)
    assert code == cli.EXIT_AUDIO and "PortAudio" in err.getvalue() and "--no-speak" in err.getvalue()


def test_tts_api_key_flag_reaches_settings(isolated_env, monkeypatch):
    captured = {}

    def fake_tts(settings):
        captured["settings"] = settings
        return FakeTTSClient()

    client = FakeOllamaClient()
    monkeypatch.setattr(cli, "OllamaLLM", lambda settings: OllamaLLM(settings, client=client))
    monkeypatch.setattr(cli, "TTSClient", fake_tts)
    monkeypatch.setattr(cli, "Player", lambda device=None: FakePlayer())
    code = cli.main(["--ask", "hi", "--tts-api-key", "s3cret", "--tts-url", "http://gpu-box:8880/v1/"], out=io.StringIO(), err=io.StringIO())
    assert code == 0 and captured["settings"].api_key == "s3cret" and captured["settings"].base_url == "http://gpu-box:8880/v1"
