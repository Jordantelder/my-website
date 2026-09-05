from __future__ import annotations

import json

import httpx
import numpy as np
import pytest
from rinn.voice.audio import AudioClip, clip_to_wav_bytes

from voicebox.speech import RemoteTranscriber, Speaker, SpeechError

from .conftest import tone


def test_remote_transcriber_posts_wav_and_returns_text():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["content_type"] = request.headers.get("content-type", "")
        seen["body"] = request.read()
        return httpx.Response(200, json={"text": "  hello there  "})

    stt = RemoteTranscriber("http://speech:8880/v1/", api_key="abc", transport=httpx.MockTransport(handler))
    assert stt.transcribe(tone(0.5)) == "hello there"
    assert seen["url"] == "http://speech:8880/v1/audio/transcriptions"
    assert seen["auth"] == "Bearer abc"
    assert seen["content_type"].startswith("multipart/form-data")
    assert b"RIFF" in seen["body"] and b'name="model"' in seen["body"]
    stt.close()


def test_remote_transcriber_errors():
    down = RemoteTranscriber("http://speech:8880/v1", transport=httpx.MockTransport(lambda r: (_ for _ in ()).throw(httpx.ConnectError("refused"))))
    with pytest.raises(SpeechError, match="cannot reach the speech server"):
        down.transcribe(tone(0.2))
    bad = RemoteTranscriber("http://speech:8880/v1", transport=httpx.MockTransport(lambda r: httpx.Response(500, text="model exploded")))
    with pytest.raises(SpeechError, match="transcription failed \\(500\\)"):
        bad.transcribe(tone(0.2))
    html = RemoteTranscriber("http://speech:8880/v1", transport=httpx.MockTransport(lambda r: httpx.Response(200, text="<html>")))
    with pytest.raises(SpeechError, match="non-JSON"):
        html.transcribe(tone(0.2))
    slow = RemoteTranscriber("http://speech:8880/v1", timeout=30, transport=httpx.MockTransport(lambda r: (_ for _ in ()).throw(httpx.ReadTimeout("timed out", request=r))))
    assert slow._client.timeout == httpx.Timeout(30, connect=5.0)  # VOICEBOX_SPEECH_TIMEOUT reaches httpx
    with pytest.raises(SpeechError, match="ReadTimeout"):
        slow.transcribe(tone(0.2))


def test_speaker_requests_wav_with_voice_and_model():
    seen: dict = {}
    wav = clip_to_wav_bytes(AudioClip(np.zeros(2400, dtype=np.float32), 24000))

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/audio/voices"):
            return httpx.Response(200, json={"voices": ["af_heart"]})
        seen["body"] = json.loads(request.read())
        return httpx.Response(200, content=wav, headers={"content-type": "audio/wav"})

    speaker = Speaker("http://speech:8880/v1", "af_heart", transport=httpx.MockTransport(handler))
    assert speaker.health() is True
    clip = speaker.synthesize("Hello.")
    assert clip.sample_rate == 24000 and len(clip.samples) == 2400
    assert seen["body"] == {"model": "voicebox", "input": "Hello.", "voice": "af_heart", "response_format": "wav", "speed": 1.0}
    speaker.synthesize("Again.", voice="clone")
    assert seen["body"]["voice"] == "clone"
    speaker.close()


def test_speaker_failure_is_speech_error():
    speaker = Speaker("http://speech:8880/v1", "af_heart", transport=httpx.MockTransport(lambda r: httpx.Response(503, text="loading")))
    assert speaker.health() is False
    with pytest.raises(SpeechError, match="503"):
        speaker.synthesize("Hello.")
