from __future__ import annotations

from pathlib import Path

import pytest
from rinn.config import ConfigError

from voicebox.config import VoiceboxSettings
from voicebox.persona import DEFAULT_PERSONA, ensure_persona_file, load_persona


def test_defaults_are_sensible_for_voice():
    s = VoiceboxSettings()
    assert s.model == "qwen3.8:27b" and s.think is False
    assert s.speech_url.endswith("/v1") and s.voice == "af_heart"
    assert s.host == "127.0.0.1" and s.port == 8800 and s.api_key == ""
    engine = s.engine_settings()
    assert engine.model == "qwen3.8:27b" and engine.think is False and engine.host == "http://127.0.0.1:11434"
    assert engine.keep_alive == "30m"  # a voice assistant keeps the model warm between questions


def test_from_env_reads_everything(tmp_path: Path):
    env = {
        "VOICEBOX_MODEL": "llama3.2:3b",
        "OLLAMA_HOST": "0.0.0.0:11434",
        "VOICEBOX_THINK": "yes",
        "VOICEBOX_SPEECH_URL": "http://10.0.0.5:8880/v1/",
        "VOICEBOX_SPEECH_API_KEY": "k",
        "VOICEBOX_VOICE": "clone",
        "VOICEBOX_EMBED_MODEL": "",
        "VOICEBOX_KNOWLEDGE_DIR": str(tmp_path / "kn"),
        "VOICEBOX_DATA_DIR": str(tmp_path / "d"),
        "VOICEBOX_PERSONA_FILE": str(tmp_path / "p.md"),
        "VOICEBOX_TOP_K": "6",
        "VOICEBOX_MAX_HISTORY_TURNS": "0",
        "VOICEBOX_HOST": "0.0.0.0",
        "VOICEBOX_PORT": "9000",
        "VOICEBOX_API_KEY": " secret ",
        "VOICEBOX_SPEECH_TIMEOUT": "30",
        "VOICEBOX_KEEP_ALIVE": "2h",
    }
    s = VoiceboxSettings.from_env(env, load_dotenv_file=False)
    assert s.model == "llama3.2:3b" and s.think is True
    assert s.speech_url == "http://10.0.0.5:8880/v1" and s.speech_api_key == "k" and s.voice == "clone"
    assert s.embed_model == ""  # blank on purpose = keyword-only search
    assert s.knowledge_dir == tmp_path / "kn" and s.data_dir == tmp_path / "d" and s.persona_file == tmp_path / "p.md"
    assert s.top_k == 6 and s.max_history_turns == 0 and s.host == "0.0.0.0" and s.port == 9000
    assert s.api_key == "secret" and s.speech_timeout == 30.0
    assert s.keep_alive == "2h" and s.engine_settings().keep_alive == "2h"
    # 0.0.0.0 is a listen address, not a connect address: the engine maps it to loopback
    assert s.engine_settings().host == "http://127.0.0.1:11434"


def test_voicebox_ollama_host_wins_over_ollama_host():
    s = VoiceboxSettings.from_env({"OLLAMA_HOST": "http://a:11434", "VOICEBOX_OLLAMA_HOST": "http://b:11434"}, load_dotenv_file=False)
    assert s.ollama_host == "http://b:11434"


def test_dotenv_file_is_read_but_environment_wins(tmp_path: Path):
    dotenv = tmp_path / ".env"
    dotenv.write_text("VOICEBOX_PORT=9100\nVOICEBOX_VOICE=af_bella\n", encoding="utf-8")
    s = VoiceboxSettings.from_env({"VOICEBOX_VOICE": "am_adam"}, dotenv_path=dotenv)
    assert s.port == 9100 and s.voice == "am_adam"
    assert VoiceboxSettings.from_env({}, dotenv_path=dotenv, load_dotenv_file=False).port == 8800


@pytest.mark.parametrize(
    "env, message",
    [
        ({"VOICEBOX_THINK": "maybe"}, "not a boolean"),
        ({"VOICEBOX_PORT": "eighty"}, "not an integer"),
        ({"VOICEBOX_PORT": "70000"}, "valid port"),
        ({"VOICEBOX_TOP_K": "0"}, "TOP_K"),
        ({"VOICEBOX_MAX_HISTORY_TURNS": "-1"}, "HISTORY"),
        ({"VOICEBOX_MODEL": "not a tag!"}, "invalid model tag"),
    ],
)
def test_bad_values_are_config_errors(env: dict, message: str):
    with pytest.raises(ConfigError, match=message):
        VoiceboxSettings.from_env(env, load_dotenv_file=False)


def test_with_overrides_ignores_none():
    s = VoiceboxSettings()
    assert s.with_overrides(voice=None, port=None) is s
    assert s.with_overrides(voice="x").voice == "x"


def test_persona_file_created_once_and_editable(tmp_path: Path):
    path = tmp_path / "cfg" / "persona.md"
    assert ensure_persona_file(path) == path
    assert path.read_text(encoding="utf-8") == DEFAULT_PERSONA
    path.write_text("# Mine\n\nBe terse.\n", encoding="utf-8")
    ensure_persona_file(path)  # must not overwrite the owner's edits
    assert load_persona(path) == "# Mine\n\nBe terse."


def test_load_persona_falls_back_to_default(tmp_path: Path):
    assert load_persona(tmp_path / "missing.md") == DEFAULT_PERSONA.strip()
    empty = tmp_path / "empty.md"
    empty.write_text("  \n", encoding="utf-8")
    assert load_persona(empty) == DEFAULT_PERSONA.strip()


def test_default_persona_is_generic_and_speech_friendly():
    lowered = DEFAULT_PERSONA.lower()
    for banned in ("regulatory", "medical", "fda", "rinn", "device"):
        assert banned not in lowered
    assert "Notes" in DEFAULT_PERSONA and "short" in lowered
