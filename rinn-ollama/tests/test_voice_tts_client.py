from __future__ import annotations

import json

import httpx
import numpy as np
import pytest

from rinn.voice.audio import AudioClip, clip_to_wav_bytes
from rinn.voice.tts_client import TTSClient, TTSError, TTSSettings


def make_client(handler) -> tuple[TTSClient, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    return TTSClient(TTSSettings(), transport=httpx.MockTransport(wrapped)), seen


def test_settings_from_env_and_overrides():
    settings = TTSSettings.from_env({"RINN_TTS_URL": "http://gpu-box:8880/v1/", "RINN_TTS_VOICE": "af_heart", "RINN_TTS_SPEED": "1.1"})
    assert settings.base_url == "http://gpu-box:8880/v1" and settings.voice == "af_heart" and settings.speed == 1.1
    assert settings.with_overrides(voice=None, model="kokoro").model == "kokoro"
    assert TTSSettings.from_env({}) == TTSSettings()


def test_synthesize_requests_wav_and_decodes_it():
    wav = clip_to_wav_bytes(AudioClip(np.full(2400, 0.2, dtype=np.float32), 24000))

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/audio/speech"
        assert request.headers["authorization"] == "Bearer not-needed"
        body = json.loads(request.content)
        assert body == {"model": "rinn", "input": "Hello there.", "voice": "af_bella", "response_format": "wav", "speed": 1.0}
        return httpx.Response(200, content=wav, headers={"content-type": "audio/wav"})

    client, seen = make_client(handler)
    clip = client.synthesize("  Hello there. ")
    assert clip.sample_rate == 24000 and len(clip.samples) == 2400 and abs(float(clip.samples[0]) - 0.2) < 1e-3
    assert len(seen) == 1
    with pytest.raises(ValueError):
        client.synthesize("   ")


def test_voices_and_health():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/audio/voices"
        return httpx.Response(200, json={"voices": ["af_bella", {"id": "clone"}]})

    client, _ = make_client(handler)
    assert client.voices() == ["af_bella", "clone"]
    assert client.health() is True


def test_server_errors_are_reported():
    client, _ = make_client(lambda request: httpx.Response(500, text="boom"))
    with pytest.raises(TTSError) as excinfo:
        client.synthesize("hi")
    assert "500" in str(excinfo.value) and "boom" in str(excinfo.value)


def test_connection_failure_gives_start_hint():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    client, _ = make_client(handler)
    assert client.health() is False
    with pytest.raises(TTSError) as excinfo:
        client.synthesize("hi")
    assert "rinn-voice-server --backend kokoro" in str(excinfo.value)


def test_non_wav_body_is_rejected():
    client, _ = make_client(lambda request: httpx.Response(200, content=b"ID3\x04mp3 bytes", headers={"content-type": "audio/mpeg"}))
    with pytest.raises(TTSError) as excinfo:
        client.synthesize("hi")
    assert "response_format=wav" in str(excinfo.value)
