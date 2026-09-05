from __future__ import annotations

from types import SimpleNamespace

import numpy as np
import pytest

from rinn.voice.stt import REGULATORY_PROMPT, FasterWhisperTranscriber, STTError


class FakeWhisper:
    def __init__(self, texts=("  What testing ", "does a 510(k) need?  "), fail=False):
        self.texts = texts
        self.fail = fail
        self.calls = []

    def transcribe(self, audio, **kwargs):
        self.calls.append((audio, kwargs))
        if self.fail:
            raise RuntimeError("CUDA out of memory")
        return ([SimpleNamespace(text=t) for t in self.texts], SimpleNamespace(language="en"))


def test_transcribe_resamples_to_16k_and_joins_segments():
    fake = FakeWhisper()
    stt = FasterWhisperTranscriber(whisper_model=fake)
    text = stt.transcribe(np.zeros(48000, dtype=np.float32), 48000)  # 1 s at 48 kHz
    assert text == "What testing does a 510(k) need?"
    audio, kwargs = fake.calls[0]
    assert abs(len(audio) - 16000) <= 1
    assert kwargs["language"] == "en" and kwargs["vad_filter"] is True and kwargs["beam_size"] == 5
    assert kwargs["initial_prompt"] == REGULATORY_PROMPT


def test_very_short_audio_is_ignored():
    fake = FakeWhisper()
    assert FasterWhisperTranscriber(whisper_model=fake).transcribe(np.zeros(800, dtype=np.float32), 16000) == ""
    assert fake.calls == []


def test_model_failures_become_stt_error():
    with pytest.raises(STTError) as excinfo:
        FasterWhisperTranscriber(whisper_model=FakeWhisper(fail=True)).transcribe(np.zeros(16000, dtype=np.float32), 16000)
    assert "transcription failed" in str(excinfo.value)
