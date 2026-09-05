from __future__ import annotations

from typing import Any, Iterable

import ollama
import pytest

from rinn.config import Settings
from rinn.llm import OllamaLLM


class FakeOllamaClient:
    """Stand-in for ollama.Client that never touches the network.

    Mirrors the real client's timing: for ``stream=True`` nothing happens until
    the caller iterates, so request errors surface on the first ``next()``.
    ``stream_error`` is raised after the first content chunk has been yielded.
    """

    def __init__(
        self,
        replies: Iterable[str] = ("stub answer",),
        models: Iterable[str] = ("qwen3.8:27b",),
        thinking: str | None = "thinking about it",
        chat_errors: Iterable[BaseException] = (),
        stream_error: BaseException | None = None,
        show_error: BaseException | None = None,
        list_error: BaseException | None = None,
        piece_size: int | None = None,
    ) -> None:
        self.piece_size = piece_size
        self.replies = list(replies)
        self.models = list(models)
        self.thinking = thinking
        self.chat_errors = list(chat_errors)
        self.stream_error = stream_error
        self.show_error = show_error
        self.list_error = list_error
        self.calls: list[dict[str, Any]] = []

    def show(self, model: str) -> ollama.ShowResponse:
        if self.show_error is not None:
            raise self.show_error
        if model not in self.models:
            raise ollama.ResponseError(f"model '{model}' not found", 404)
        return ollama.ShowResponse(model_info={}, capabilities=["completion", "thinking"])

    def list(self) -> ollama.ListResponse:
        if self.list_error is not None:
            raise self.list_error
        return ollama.ListResponse(models=[ollama.ListResponse.Model(model=name) for name in self.models])

    def chat(self, **kwargs: Any):
        self.calls.append(kwargs)
        if kwargs.get("stream"):
            return self._stream(kwargs["model"])  # generator: runs on first next(), like ollama.Client
        if self.chat_errors:
            raise self.chat_errors.pop(0)
        return ollama.ChatResponse(
            model=kwargs["model"],
            done=True,
            done_reason="stop",
            prompt_eval_count=11,
            eval_count=7,
            total_duration=1234,
            message=ollama.Message(role="assistant", content=self._next_reply(), thinking=self.thinking),
        )

    def _next_reply(self) -> str:
        return self.replies.pop(0) if self.replies else "stub answer"

    def _stream(self, model: str):
        if self.chat_errors:
            raise self.chat_errors.pop(0)
        text = self._next_reply()
        if self.thinking:
            yield ollama.ChatResponse(model=model, message=ollama.Message(role="assistant", thinking=self.thinking))
        if self.piece_size:
            for start in range(0, len(text) - self.piece_size, self.piece_size):
                yield ollama.ChatResponse(model=model, message=ollama.Message(role="assistant", content=text[start : start + self.piece_size]))
            text = text[max(0, ((len(text) - 1) // self.piece_size) * self.piece_size):]
            half = 0
        else:
            half = max(1, len(text) // 2)
            yield ollama.ChatResponse(model=model, message=ollama.Message(role="assistant", content=text[:half]))
        if self.stream_error is not None:
            raise self.stream_error
        yield ollama.ChatResponse(
            model=model,
            done=True,
            done_reason="stop",
            prompt_eval_count=11,
            eval_count=7,
            total_duration=1234,
            message=ollama.Message(role="assistant", content=text[half:]),
        )


@pytest.fixture
def settings() -> Settings:
    return Settings()


@pytest.fixture
def fake_client() -> FakeOllamaClient:
    return FakeOllamaClient()


@pytest.fixture
def llm(settings: Settings, fake_client: FakeOllamaClient) -> OllamaLLM:
    return OllamaLLM(settings, client=fake_client)


# ---------------------------------------------------------------------------
# Voice-layer fakes (no microphone, speaker, TTS server, or Whisper model needed)
# ---------------------------------------------------------------------------
import threading
import time

import numpy as np

from rinn.voice.audio import AudioClip
from rinn.voice.tts_client import TTSError


class FakeTTSClient:
    """Stands in for TTSClient: records requested sentences, returns short clips."""

    def __init__(self, fail_on: Iterable[str] = (), healthy: bool = True, voices: Iterable[str] = ("af_bella", "af_heart")):
        self.requests: list[str] = []
        self.fail_on = set(fail_on)
        self.healthy = healthy
        self._voices = list(voices)
        self.closed = False

    def health(self) -> bool:
        return self.healthy

    def voices(self) -> list[str]:
        return list(self._voices)

    def synthesize(self, text: str, voice=None, speed=None) -> AudioClip:
        self.requests.append(text)
        if text in self.fail_on:
            raise TTSError(f"synthesis failed for {text!r}")
        samples = np.full(int(0.01 * len(text) * 24000), 0.1, dtype=np.float32)
        return AudioClip(samples, 24000)

    def close(self) -> None:
        self.closed = True


class FakePlayer:
    """Stands in for Player: records clips in order."""

    def __init__(self):
        self.clips: list[AudioClip] = []
        self.errors: list[str] = []
        self.stopped = 0
        self.closed = False

    def enqueue(self, clip: AudioClip) -> None:
        self.clips.append(clip)

    def wait(self, timeout=None) -> bool:
        return True

    def stop(self) -> None:
        self.stopped += 1

    def close(self) -> None:
        self.closed = True


class FakeTranscriber:
    def __init__(self, text: str = "what testing does a single-use endoscope need"):
        self.text = text
        self.calls: list[tuple[int, int]] = []

    def transcribe(self, samples, sample_rate) -> str:
        self.calls.append((len(samples), sample_rate))
        return self.text


class FakeRecorder:
    def __init__(self, seconds: float = 2.0, sample_rate: int = 16000):
        self.seconds = seconds
        self.sample_rate = sample_rate
        self.calls = 0

    def record_utterance(self, stop_event=None, on_state=None) -> AudioClip:
        self.calls += 1
        if on_state:
            on_state("listening")
            on_state("speech")
        return AudioClip(np.zeros(int(self.seconds * self.sample_rate), dtype=np.float32), self.sample_rate)


class FakeInputStream:
    """Feeds scripted blocks to the sounddevice-style callback on a background thread."""

    def __init__(self, blocks, **kwargs):
        self.callback = kwargs["callback"]
        self.kwargs = kwargs
        self.blocks = list(blocks)
        self._stop = threading.Event()
        self._thread = None

    def __enter__(self):
        self._thread = threading.Thread(target=self._feed, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *exc):
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)

    def _feed(self):
        index = 0
        template = self.blocks[-1] if self.blocks else np.zeros((480, 1), dtype=np.float32)
        while not self._stop.is_set():
            block = self.blocks[index] if index < len(self.blocks) else np.zeros_like(template)
            index += 1
            self.callback(block, len(block), None, None)
            time.sleep(0.0005)


class FakeOutputStream:
    def __init__(self, sink, write_delay=0.0, **kwargs):
        self.sink = sink
        self.write_delay = write_delay
        self.kwargs = kwargs
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.closed = True
        return False

    def write(self, data):
        if self.write_delay:
            time.sleep(self.write_delay)
        self.sink.append(np.array(data, copy=True).reshape(-1))


class FakeSoundDevice:
    """Minimal stand-in for the sounddevice module."""

    def __init__(self, input_blocks=(), output_sink=None, write_delay=0.0):
        self.input_blocks = list(input_blocks)
        self.output_sink = output_sink if output_sink is not None else []
        self.write_delay = write_delay
        self.input_kwargs = None
        self.output_kwargs = None
        self.streams = []

    def InputStream(self, **kwargs):  # noqa: N802 - mirrors sounddevice
        self.input_kwargs = kwargs
        return FakeInputStream(self.input_blocks, **kwargs)

    def OutputStream(self, **kwargs):  # noqa: N802
        self.output_kwargs = kwargs
        stream = FakeOutputStream(self.output_sink, write_delay=self.write_delay, **kwargs)
        self.streams.append(stream)
        return stream

    def query_devices(self):
        return "  0 Fake Microphone, 1 in\n  1 Fake Speakers, 0 in 2 out"
