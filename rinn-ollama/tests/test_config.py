from __future__ import annotations

import pytest

from rinn.config import ConfigError, Settings


def test_defaults_match_rinn_model():
    settings = Settings()
    assert settings.model == "qwen3.8:27b"
    assert settings.host == "http://localhost:11434"
    assert settings.temperature == 0.4
    assert settings.think is True


def test_from_env_reads_overrides_without_dotenv():
    env = {
        "RINN_MODEL": "qwen3.8:27b-q8_0",
        "OLLAMA_HOST": "192.168.1.20:11434",
        "RINN_TEMPERATURE": "0.2",
        "RINN_NUM_CTX": "16384",
        "RINN_THINK": "false",
        "RINN_SHOW_THINKING": "yes",
        "RINN_SEED": "7",
        "RINN_NUM_PREDICT": "-2",
        "RINN_EXTRA_INSTRUCTIONS": "Focus on CDRH devices.",
    }
    settings = Settings.from_env(env=env, load_dotenv_file=False)
    assert settings.model == "qwen3.8:27b-q8_0"
    assert settings.host == "http://192.168.1.20:11434"
    assert settings.temperature == 0.2
    assert settings.num_ctx == 16384
    assert settings.think is False
    assert settings.show_thinking is True
    assert settings.seed == 7
    assert settings.num_predict == -2
    assert settings.extra_instructions == "Focus on CDRH devices."


def test_from_env_reads_dotenv_file_but_environment_wins(tmp_path):
    dotenv = tmp_path / ".env"
    dotenv.write_text("RINN_MODEL=qwen3.8:27b\nRINN_TEMPERATURE=0.9\n", encoding="utf-8")
    settings = Settings.from_env(env={"RINN_TEMPERATURE": "0.1"}, dotenv_path=dotenv)
    assert settings.model == "qwen3.8:27b"
    assert settings.temperature == 0.1


def test_ignores_blank_values():
    settings = Settings.from_env(env={"RINN_MODEL": "", "RINN_NUM_CTX": "  "}, load_dotenv_file=False)
    assert settings == Settings()


@pytest.mark.parametrize(
    "env, fragment",
    [
        ({"RINN_TEMPERATURE": "hot"}, "RINN_TEMPERATURE"),
        ({"RINN_THINK": "maybe"}, "RINN_THINK"),
        ({"RINN_NUM_CTX": "12"}, "num_ctx"),
        ({"RINN_MODEL": "bad tag!"}, "model tag"),
        ({"RINN_TOP_P": "0"}, "top_p"),
        ({"RINN_NUM_PREDICT": "0"}, "num_predict"),
    ],
)
def test_invalid_values_raise_config_error(env, fragment):
    with pytest.raises(ConfigError) as excinfo:
        Settings.from_env(env=env, load_dotenv_file=False)
    assert fragment in str(excinfo.value)


def test_ollama_options_only_include_meaningful_values():
    assert Settings().ollama_options() == {"temperature": 0.4, "top_p": 0.9, "num_ctx": 32768, "repeat_penalty": 1.05}
    options = Settings(num_predict=512, seed=3).ollama_options()
    assert options["num_predict"] == 512 and options["seed"] == 3


def test_with_overrides_skips_none():
    base = Settings()
    assert base.with_overrides(model=None, temperature=None) is base
    changed = base.with_overrides(model="qwen3.8:27b-q8_0", think=False)
    assert changed.model == "qwen3.8:27b-q8_0" and changed.think is False and changed.temperature == 0.4
