"""Client for any OpenAI-compatible text-to-speech server (POST /v1/audio/speech).

Works with ``rinn-voice-server`` (this package), Kokoro-FastAPI, and similar servers.
Audio is requested as WAV so it can be decoded with the standard library.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, replace
from typing import Any, Optional

import httpx

from .audio import AudioClip, AudioError, wav_bytes_to_clip


class TTSError(RuntimeError):
    """The TTS server is unreachable or returned an error."""


@dataclass(frozen=True)
class TTSSettings:
    base_url: str = "http://127.0.0.1:8880/v1"
    api_key: str = "not-needed"
    model: str = "rinn"
    voice: str = "af_bella"
    speed: float = 1.0
    timeout: float = 120.0

    @classmethod
    def from_env(cls, env: Optional[dict[str, str]] = None) -> "TTSSettings":
        values = os.environ if env is None else env
        settings = cls()
        overrides: dict[str, Any] = {}
        if values.get("RINN_TTS_URL"):
            overrides["base_url"] = values["RINN_TTS_URL"].rstrip("/")
        if values.get("RINN_TTS_API_KEY"):
            overrides["api_key"] = values["RINN_TTS_API_KEY"]
        if values.get("RINN_TTS_MODEL"):
            overrides["model"] = values["RINN_TTS_MODEL"]
        if values.get("RINN_TTS_VOICE"):
            overrides["voice"] = values["RINN_TTS_VOICE"]
        if values.get("RINN_TTS_SPEED"):
            overrides["speed"] = float(values["RINN_TTS_SPEED"])
        if values.get("RINN_TTS_TIMEOUT"):
            overrides["timeout"] = float(values["RINN_TTS_TIMEOUT"])
        return replace(settings, **overrides) if overrides else settings

    def with_overrides(self, **changes: Any) -> "TTSSettings":
        applied = {k: v for k, v in changes.items() if v is not None}
        return replace(self, **applied) if applied else self


class TTSClient:
    def __init__(self, settings: TTSSettings, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = settings
        self._client = httpx.Client(
            base_url=settings.base_url,
            timeout=httpx.Timeout(settings.timeout, connect=5.0),
            headers={"Authorization": f"Bearer {settings.api_key}"},
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def health(self) -> bool:
        """True when the server answers; False when it is down."""
        try:
            response = self._client.get("/audio/voices")
        except httpx.HTTPError:
            return False
        return response.status_code < 500

    def voices(self) -> list[str]:
        try:
            response = self._client.get("/audio/voices")
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise TTSError(self._describe(exc)) from exc
        try:
            payload = response.json()
        except ValueError as exc:
            raise TTSError(f"TTS server at {self.settings.base_url} returned non-JSON voices list") from exc
        voices = payload.get("voices", payload) if isinstance(payload, dict) else payload
        return [v if isinstance(v, str) else str(v.get("id") or v.get("name")) for v in voices]

    def synthesize(self, text: str, voice: str | None = None, speed: float | None = None) -> AudioClip:
        text = text.strip()
        if not text:
            raise ValueError("text must not be empty")
        body = {
            "model": self.settings.model,
            "input": text,
            "voice": voice or self.settings.voice,
            "response_format": "wav",
            "speed": speed if speed is not None else self.settings.speed,
        }
        try:
            response = self._client.post("/audio/speech", json=body)
        except httpx.HTTPError as exc:
            raise TTSError(self._describe(exc)) from exc
        if response.status_code >= 400:
            detail = response.text[:300]
            raise TTSError(f"TTS server returned {response.status_code} for voice {body['voice']!r}: {detail}")
        try:
            return wav_bytes_to_clip(response.content)
        except AudioError as exc:
            raise TTSError(f"TTS server did not return WAV audio ({exc}); does it support response_format=wav?") from exc

    def _describe(self, exc: httpx.HTTPError) -> str:
        return (
            f"cannot reach the TTS server at {self.settings.base_url} ({exc.__class__.__name__}: {exc}). "
            "Start it with:  rinn-voice-server --backend kokoro"
        )
