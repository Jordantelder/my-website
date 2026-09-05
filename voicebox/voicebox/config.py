"""Settings for the Voicebox server, read from VOICEBOX_* environment variables and .env."""
from __future__ import annotations

import os
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Mapping, Optional

from dotenv import dotenv_values
from rinn.config import ConfigError, Settings as EngineSettings

_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


def _bool(raw: str, key: str) -> bool:
    value = raw.strip().lower()
    if value in _TRUE:
        return True
    if value in _FALSE:
        return False
    raise ConfigError(f"{key}={raw!r} is not a boolean (use true/false)")


@dataclass(frozen=True)
class VoiceboxSettings:
    model: str = "qwen3.8:27b"
    ollama_host: str = "http://127.0.0.1:11434"
    think: bool = False
    speech_url: str = "http://127.0.0.1:8880/v1"
    speech_api_key: str = "not-needed"
    voice: str = "af_heart"
    tts_model: str = "voicebox"
    embed_model: str = "nomic-embed-text"  # empty string = keyword-only search
    knowledge_dir: Path = Path("knowledge")
    data_dir: Path = Path("data")
    persona_file: Path = Path("persona.md")
    top_k: int = 4
    max_history_turns: int = 10
    host: str = "127.0.0.1"
    port: int = 8800
    api_key: str = ""
    speech_timeout: float = 120.0
    keep_alive: str = "30m"  # how long Ollama keeps the model loaded after a question

    def __post_init__(self) -> None:
        if not 1 <= self.top_k <= 20:
            raise ConfigError("VOICEBOX_TOP_K must be between 1 and 20")
        if self.max_history_turns < 0:
            raise ConfigError("VOICEBOX_MAX_HISTORY_TURNS must be 0 or more")
        if not 1 <= self.port <= 65535:
            raise ConfigError("VOICEBOX_PORT must be a valid port")
        for name in ("knowledge_dir", "data_dir", "persona_file"):
            value = getattr(self, name)
            if not isinstance(value, Path):
                object.__setattr__(self, name, Path(value))

    def engine_settings(self) -> EngineSettings:
        """Settings for the shared Ollama wrapper (validates model tag and host)."""
        return EngineSettings(model=self.model, host=self.ollama_host, think=self.think, max_history_turns=self.max_history_turns, keep_alive=self.keep_alive)

    def with_overrides(self, **changes: Any) -> "VoiceboxSettings":
        applied = {k: v for k, v in changes.items() if v is not None}
        return replace(self, **applied) if applied else self

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None, dotenv_path: str | Path | None = None, load_dotenv_file: bool = True) -> "VoiceboxSettings":
        values: dict[str, str] = {}
        if load_dotenv_file:
            path = Path(dotenv_path) if dotenv_path is not None else Path.cwd() / ".env"
            if path.is_file():
                values.update({k: v for k, v in dotenv_values(path).items() if v is not None})
        values.update(os.environ if env is None else env)

        def get(key: str) -> str:
            return values.get(key, "").strip()

        kwargs: dict[str, Any] = {}
        if get("VOICEBOX_MODEL"):
            kwargs["model"] = get("VOICEBOX_MODEL")
        host = get("VOICEBOX_OLLAMA_HOST") or get("OLLAMA_HOST")
        if host:
            kwargs["ollama_host"] = host
        if get("VOICEBOX_THINK"):
            kwargs["think"] = _bool(get("VOICEBOX_THINK"), "VOICEBOX_THINK")
        if get("VOICEBOX_SPEECH_URL"):
            kwargs["speech_url"] = get("VOICEBOX_SPEECH_URL").rstrip("/")
        if get("VOICEBOX_SPEECH_API_KEY"):
            kwargs["speech_api_key"] = get("VOICEBOX_SPEECH_API_KEY")
        if get("VOICEBOX_VOICE"):
            kwargs["voice"] = get("VOICEBOX_VOICE")
        if get("VOICEBOX_TTS_MODEL"):
            kwargs["tts_model"] = get("VOICEBOX_TTS_MODEL")
        if "VOICEBOX_EMBED_MODEL" in values:
            kwargs["embed_model"] = get("VOICEBOX_EMBED_MODEL")  # may be blank on purpose
        for key, name in (("VOICEBOX_KNOWLEDGE_DIR", "knowledge_dir"), ("VOICEBOX_DATA_DIR", "data_dir"), ("VOICEBOX_PERSONA_FILE", "persona_file")):
            if get(key):
                kwargs[name] = Path(get(key)).expanduser()
        for key, name in (("VOICEBOX_TOP_K", "top_k"), ("VOICEBOX_MAX_HISTORY_TURNS", "max_history_turns"), ("VOICEBOX_PORT", "port")):
            if get(key):
                try:
                    kwargs[name] = int(get(key))
                except ValueError as exc:
                    raise ConfigError(f"{key}={get(key)!r} is not an integer") from exc
        if get("VOICEBOX_HOST"):
            kwargs["host"] = get("VOICEBOX_HOST")
        if get("VOICEBOX_API_KEY"):
            kwargs["api_key"] = get("VOICEBOX_API_KEY")
        if get("VOICEBOX_SPEECH_TIMEOUT"):
            kwargs["speech_timeout"] = float(get("VOICEBOX_SPEECH_TIMEOUT"))
        if get("VOICEBOX_KEEP_ALIVE"):
            kwargs["keep_alive"] = get("VOICEBOX_KEEP_ALIVE")
        settings = cls(**kwargs)
        settings.engine_settings()  # validate model tag and host early
        return settings
