"""Runtime settings for the RINN Ollama model layer.

Values come from (lowest to highest priority): dataclass defaults, a ``.env``
file in the working directory, process environment variables, and explicit
overrides such as CLI flags. Every variable is optional.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Callable, Mapping, Optional
from urllib.parse import urlsplit

from dotenv import dotenv_values

DEFAULT_MODEL = "qwen3.8:27b"
DEFAULT_HOST = "http://localhost:11434"
DEFAULT_PORT = 11434

_MODEL_TAG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\-/]*(:[A-Za-z0-9._\-]+)?$")
_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


class ConfigError(ValueError):
    """Raised when a setting is malformed or out of range."""


def _parse_bool(raw: str, key: str) -> bool:
    value = raw.strip().lower()
    if value in _TRUE:
        return True
    if value in _FALSE:
        return False
    raise ConfigError(f"{key}={raw!r} is not a boolean (use true/false)")


def _normalize_host(raw: str) -> str:
    """Return ``raw`` as a full ``scheme://host[:port]`` URL.

    Mirrors :class:`ollama.Client`: a value without a scheme gets ``http://``
    and, when it also lacks a port, Ollama's default port 11434 (so
    ``OLLAMA_HOST=0.0.0.0`` works). Values with an explicit scheme are kept as
    given, so ``https://ollama.example.com`` stays on port 443.
    """
    host = raw.strip()
    scheme, separator, rest = host.partition("://")
    if separator:
        if scheme.lower() not in ("http", "https"):
            raise ConfigError(f"unsupported scheme {scheme!r} in host {raw!r}; use http:// or https://")
        rest = rest.rstrip("/")
        if not rest:
            raise ConfigError(f"invalid host {raw!r}")
        host = f"{scheme.lower()}://{rest}"
        had_scheme = True
    else:
        host = host.rstrip("/")
        if not host:
            raise ConfigError("host must not be empty")
        host = f"http://{host}"
        had_scheme = False
    parts = urlsplit(host)
    try:
        port = parts.port
    except ValueError as exc:
        raise ConfigError(f"invalid port in host {raw!r}") from exc
    if not parts.hostname or parts.netloc.endswith(":"):
        raise ConfigError(f"invalid host {raw!r}")
    if port is None and not had_scheme:
        host = f"{parts.scheme}://{parts.netloc}:{DEFAULT_PORT}{parts.path}"
    return host


@dataclass(frozen=True)
class Settings:
    """Everything needed to talk to Ollama as RINN."""

    model: str = DEFAULT_MODEL
    host: str = DEFAULT_HOST  # normalized to scheme://host:port on construction
    temperature: float = 0.4
    top_p: float = 0.9
    num_ctx: int = 32768
    num_predict: int = -1
    repeat_penalty: float = 1.05
    seed: Optional[int] = None
    think: bool = True
    show_thinking: bool = False
    keep_alive: str = "10m"
    timeout: float = 600.0
    max_history_turns: int = 20
    extra_instructions: Optional[str] = None

    def __post_init__(self) -> None:
        if not self.model or not _MODEL_TAG_RE.match(self.model):
            raise ConfigError(f"invalid model tag {self.model!r}; expected something like 'qwen3.8:27b'")
        object.__setattr__(self, "host", _normalize_host(self.host))
        if not 0.0 <= self.temperature <= 2.0:
            raise ConfigError(f"temperature must be between 0.0 and 2.0, got {self.temperature}")
        if not 0.0 < self.top_p <= 1.0:
            raise ConfigError(f"top_p must be greater than 0 and at most 1, got {self.top_p}")
        if self.num_ctx < 512:
            raise ConfigError(f"num_ctx must be at least 512, got {self.num_ctx}")
        if self.num_predict == 0 or self.num_predict < -2:
            raise ConfigError(f"num_predict must be -2, -1, or a positive integer, got {self.num_predict}")
        if self.repeat_penalty <= 0:
            raise ConfigError(f"repeat_penalty must be positive, got {self.repeat_penalty}")
        if self.timeout <= 0:
            raise ConfigError(f"timeout must be positive, got {self.timeout}")
        if self.max_history_turns < 0:
            raise ConfigError(f"max_history_turns must be 0 or more, got {self.max_history_turns}")
        if not self.keep_alive.strip():
            raise ConfigError("keep_alive must not be empty")

    def ollama_options(self) -> dict[str, Any]:
        """Sampling options in the shape Ollama's ``options`` field expects."""
        options: dict[str, Any] = {
            "temperature": self.temperature,
            "top_p": self.top_p,
            "num_ctx": self.num_ctx,
            "repeat_penalty": self.repeat_penalty,
        }
        if self.num_predict != -1:
            options["num_predict"] = self.num_predict
        if self.seed is not None:
            options["seed"] = self.seed
        return options

    def with_overrides(self, **changes: Any) -> "Settings":
        """Return a copy with the non-None values in ``changes`` applied."""
        applied = {key: value for key, value in changes.items() if value is not None}
        return replace(self, **applied) if applied else self

    @classmethod
    def from_env(
        cls,
        env: Mapping[str, str] | None = None,
        dotenv_path: str | Path | None = None,
        load_dotenv_file: bool = True,
    ) -> "Settings":
        """Build settings from a ``.env`` file plus environment variables.

        ``env`` defaults to ``os.environ``; pass a mapping to make the result
        independent of the process environment (useful in tests).
        """
        values: dict[str, str] = {}
        if load_dotenv_file:
            path = Path(dotenv_path) if dotenv_path is not None else Path.cwd() / ".env"
            if path.is_file():
                values.update({k: v for k, v in dotenv_values(path).items() if v is not None})
        values.update(os.environ if env is None else env)

        kwargs: dict[str, Any] = {}

        model = values.get("RINN_MODEL", "").strip()
        if model:
            kwargs["model"] = model

        host = (values.get("OLLAMA_HOST") or values.get("RINN_OLLAMA_HOST") or "").strip()
        if host:
            kwargs["host"] = host  # normalized in __post_init__

        numeric: tuple[tuple[str, str, Callable[[str], Any]], ...] = (
            ("RINN_TEMPERATURE", "temperature", float),
            ("RINN_TOP_P", "top_p", float),
            ("RINN_NUM_CTX", "num_ctx", int),
            ("RINN_NUM_PREDICT", "num_predict", int),
            ("RINN_REPEAT_PENALTY", "repeat_penalty", float),
            ("RINN_SEED", "seed", int),
            ("RINN_TIMEOUT", "timeout", float),
            ("RINN_MAX_HISTORY_TURNS", "max_history_turns", int),
        )
        for key, field_name, convert in numeric:
            raw = values.get(key, "").strip()
            if not raw:
                continue
            try:
                kwargs[field_name] = convert(raw)
            except ValueError as exc:
                raise ConfigError(f"{key}={raw!r} is not a valid {convert.__name__}") from exc

        for key, field_name in (("RINN_THINK", "think"), ("RINN_SHOW_THINKING", "show_thinking")):
            raw = values.get(key, "").strip()
            if raw:
                kwargs[field_name] = _parse_bool(raw, key)

        keep_alive = values.get("RINN_KEEP_ALIVE", "").strip()
        if keep_alive:
            kwargs["keep_alive"] = keep_alive

        extra = values.get("RINN_EXTRA_INSTRUCTIONS", "").strip()
        if extra:
            kwargs["extra_instructions"] = extra

        return cls(**kwargs)
