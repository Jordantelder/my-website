from __future__ import annotations

import io

import numpy as np
import pytest
from fastapi.testclient import TestClient

from rinn.voice.audio import AudioClip, clip_to_wav_bytes, wav_bytes_to_clip
from rinn.voice.server import apply_args_to_env, build_parser, create_app
from rinn.voice.tts_backends import BackendError, SilenceBackend, build_backend

from conftest import FakeTranscriber


@pytest.fixture
def client() -> TestClient:
    app = create_app(backend=SilenceBackend(), transcriber=FakeTranscriber("hello from whisper"), load_on_startup=False)
    return TestClient(app)


def test_health_models_and_voices(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["tts_backend"] == "silence" and health.json()["stt"] is True
    assert client.get("/v1/audio/voices").json() == {"voices": ["silence"]}
    assert [m["id"] for m in client.get("/v1/models").json()["data"]] == ["rinn", "whisper-1"]


def test_speech_returns_wav_with_markdown_stripped(client):
    plain = client.post("/v1/audio/speech", json={"input": "Hello regulatory world.", "response_format": "wav"})
    assert plain.status_code == 200 and plain.headers["content-type"].startswith("audio/wav")
    clip = wav_bytes_to_clip(plain.content)
    assert clip.sample_rate == 24000 and abs(clip.duration - len("Hello regulatory world.") * 0.06) < 0.01

    markdown = client.post("/v1/audio/speech", json={"input": "**Hello** regulatory world. [K183256.pdf]", "response_format": "wav"})
    assert len(markdown.content) == len(plain.content)  # same spoken text once formatting and tags are removed


def test_speech_pcm_and_speed(client):
    response = client.post("/v1/audio/speech", json={"input": "abcdefghij", "response_format": "pcm", "speed": 2.0})
    assert response.status_code == 200 and response.headers["content-type"].startswith("audio/pcm")
    assert len(response.content) == int(max(0.2, 10 * 0.06 / 2.0) * 24000) * 2


def test_speech_validation_errors(client):
    assert client.post("/v1/audio/speech", json={"input": "[K183256.pdf]", "response_format": "wav"}).status_code == 400
    assert client.post("/v1/audio/speech", json={"input": "hi", "response_format": "aiff"}).status_code == 400
    assert client.post("/v1/audio/speech", json={"input": "hi", "response_format": "wav", "speed": 9}).status_code == 400
    assert client.post("/v1/audio/speech", json={"input": "x" * 5000, "response_format": "wav"}).status_code == 413


def test_speech_mp3_encoding_when_soundfile_available(client):
    pytest.importorskip("soundfile")
    response = client.post("/v1/audio/speech", json={"input": "Hello there, this is a test."})  # default format is mp3
    assert response.status_code == 200 and response.headers["content-type"] == "audio/mpeg"
    assert response.content[:3] == b"ID3" or response.content[0] == 0xFF


def test_transcriptions_endpoint(client):
    wav = clip_to_wav_bytes(AudioClip(np.zeros(16000, dtype=np.float32), 16000))
    response = client.post("/v1/audio/transcriptions", files={"file": ("q.wav", wav, "audio/wav")}, data={"model": "whisper-1"})
    assert response.status_code == 200 and response.json() == {"text": "hello from whisper"}
    plain = client.post("/v1/audio/transcriptions", files={"file": ("q.wav", wav, "audio/wav")}, data={"response_format": "text"})
    assert plain.text == "hello from whisper"
    assert client.post("/v1/audio/transcriptions", files={"file": ("q.wav", b"", "audio/wav")}).status_code == 400


def test_without_backend_or_stt_the_endpoints_explain():
    app = create_app(backend=None, transcriber=None, load_on_startup=False)
    with TestClient(app) as bare:
        assert bare.get("/health").status_code == 503
        assert bare.post("/v1/audio/speech", json={"input": "hi"}).status_code == 503
        wav = clip_to_wav_bytes(AudioClip(np.zeros(16000, dtype=np.float32), 16000))
        response = bare.post("/v1/audio/transcriptions", files={"file": ("q.wav", wav, "audio/wav")})
        assert response.status_code == 501 and "--stt" in response.json()["detail"]


def test_build_backend_names_and_missing_libraries():
    assert build_backend("silence").name == "silence"
    with pytest.raises(BackendError):
        build_backend("nope")
    with pytest.raises(BackendError) as excinfo:  # the F5 backend validates its inputs before importing the library
        build_backend("f5tts", env={"RINN_F5_REF_AUDIO": "/definitely/missing.wav", "RINN_F5_REF_TEXT": "hi"})
    assert "RINN_F5_REF_AUDIO" in str(excinfo.value)
    with pytest.raises(BackendError) as excinfo:
        build_backend("qwen3tts", env={})
    assert "RINN_QWEN_TTS_SPEAKER" in str(excinfo.value)


def test_cli_args_map_to_environment():
    args = build_parser().parse_args(["--backend", "f5tts", "--f5-ckpt", "C:/rinn/model_1200.pt", "--ref-audio", "ref.wav", "--ref-text", "Hello.", "--stt", "large-v3-turbo", "--port", "8880"])
    env: dict[str, str] = {}
    apply_args_to_env(args, env)
    assert env["RINN_TTS_BACKEND"] == "f5tts" and env["RINN_F5_CKPT"] == "C:/rinn/model_1200.pt"
    assert env["RINN_F5_REF_AUDIO"] == "ref.wav" and env["RINN_F5_REF_TEXT"] == "Hello." and env["RINN_QWEN_TTS_REF_AUDIO"] == "ref.wav"
    assert env["RINN_STT_MODEL"] == "large-v3-turbo"
    assert build_parser().parse_args([]).backend == "kokoro"
