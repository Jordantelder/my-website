"""Speech in and out via the speech server's OpenAI-compatible endpoints."""
from __future__ import annotations

from typing import Optional

import httpx
from rinn.voice.audio import AudioClip, clip_to_wav_bytes
from rinn.voice.tts_client import TTSClient, TTSError, TTSSettings


class SpeechError(RuntimeError):
    """The speech server is unreachable or failed."""


class RemoteTranscriber:
    """POST audio to ``/audio/transcriptions`` on the speech server."""

    def __init__(self, base_url: str, api_key: str = "not-needed", timeout: float = 120.0, transport: httpx.BaseTransport | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(base_url=self.base_url, timeout=httpx.Timeout(timeout, connect=5.0), headers={"Authorization": f"Bearer {api_key}"}, transport=transport)

    def transcribe(self, clip: AudioClip) -> str:
        wav = clip_to_wav_bytes(clip)
        try:
            response = self._client.post("/audio/transcriptions", files={"file": ("turn.wav", wav, "audio/wav")}, data={"model": "whisper-1"})
        except httpx.HTTPError as exc:
            raise SpeechError(f"cannot reach the speech server at {self.base_url} ({exc.__class__.__name__}: {exc})") from exc
        if response.status_code >= 400:
            raise SpeechError(f"transcription failed ({response.status_code}): {response.text[:300]}")
        try:
            return str(response.json().get("text", "")).strip()
        except ValueError as exc:
            raise SpeechError("transcription endpoint returned non-JSON") from exc

    def close(self) -> None:
        self._client.close()


class Speaker:
    """Text to audio through the speech server."""

    def __init__(self, base_url: str, voice: str, model: str = "voicebox", api_key: str = "not-needed", timeout: float = 120.0, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = TTSSettings(base_url=base_url.rstrip("/"), api_key=api_key, model=model, voice=voice, timeout=timeout)
        self._client = TTSClient(self.settings, transport=transport)

    def health(self) -> bool:
        return self._client.health()

    def synthesize(self, text: str, voice: Optional[str] = None) -> AudioClip:
        try:
            return self._client.synthesize(text, voice=voice)
        except TTSError as exc:
            raise SpeechError(str(exc)) from exc

    def close(self) -> None:
        self._client.close()
