"""Fakes so the whole Voicebox stack runs without Ollama, a speech server, PortAudio, or ffmpeg."""
from __future__ import annotations

import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Iterable, Optional

import numpy as np
import pytest
from rinn.llm import Chunk, LLMError, Reply
from rinn.voice.audio import AudioClip

from voicebox.assistant import SessionStore, Voicebox
from voicebox.knowledge import HashEmbedder, KnowledgeBase
from voicebox.speech import SpeechError


class FakeLLM:
    """Stands in for rinn.llm.OllamaLLM: streams a scripted reply through on_chunk."""

    def __init__(self, replies: Iterable[str] = ("The answer is forty-two. Anything else?",), piece_size: int = 7, thinking: str = "hmm", error: BaseException | None = None, delay: float = 0.0) -> None:
        self.replies = list(replies)
        self.piece_size = piece_size
        self.thinking = thinking
        self.error = error
        self.delay = delay
        self.calls: list[list[dict[str, Any]]] = []
        self.pieces_sent = 0  # content chunks delivered so far (all replies)
        self.aborted = False  # on_chunk raised: the consumer cancelled the turn

    def ensure_model(self) -> None:
        return None

    def chat(self, messages, on_chunk: Callable[[Chunk], None] | None = None) -> Reply:
        self.calls.append([dict(m) for m in messages])
        if self.error is not None:
            raise self.error
        text = self.replies.pop(0) if self.replies else "stub answer."
        if on_chunk is not None:
            try:
                if self.thinking:
                    on_chunk(Chunk("thinking", self.thinking))
                for start in range(0, len(text), self.piece_size):
                    if self.delay:
                        time.sleep(self.delay)
                    on_chunk(Chunk("content", text[start : start + self.piece_size]))
                    self.pieces_sent += 1
            except Exception:
                self.aborted = True
                raise
        return Reply(content=text, thinking=self.thinking or None, model="fake")


class FakeSpeaker:
    def __init__(self, fail_on: Iterable[str] = (), healthy: bool = True, sample_rate: int = 24000) -> None:
        self.requests: list[tuple[str, Optional[str]]] = []
        self.fail_on = set(fail_on)
        self.healthy = healthy
        self.sample_rate = sample_rate
        self.closed = False

    def health(self) -> bool:
        return self.healthy

    def synthesize(self, text: str, voice: Optional[str] = None) -> AudioClip:
        self.requests.append((text, voice))
        if text in self.fail_on:
            raise SpeechError(f"synthesis failed for {text!r}")
        n = max(1, int(0.005 * len(text) * self.sample_rate))
        return AudioClip(np.linspace(-0.5, 0.5, n, dtype=np.float32), self.sample_rate)

    def close(self) -> None:
        self.closed = True


class FakeTranscriber:
    def __init__(self, text: str = "what is the wifi password", error: BaseException | None = None) -> None:
        self.text = text
        self.error = error
        self.clips: list[AudioClip] = []

    def transcribe(self, clip: AudioClip) -> str:
        self.clips.append(clip)
        if self.error is not None:
            raise self.error
        return self.text


class FakeInputStream:
    """sounddevice.InputStream look-alike: feeds blocks to the callback while started."""

    def __init__(self, blocks: list[np.ndarray], fail: bool = False, **kwargs: Any) -> None:
        if fail:
            raise RuntimeError("no such device")
        self.kwargs = kwargs
        self.callback = kwargs["callback"]
        self.blocks = blocks
        # Like PortAudio, hand the callback a view onto ONE buffer that is overwritten by the next block.
        self.buffer = np.zeros_like(blocks[0]) if blocks else None
        self.started = False
        self.closed = False
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

    def start(self) -> None:
        self.started = True
        self._thread = threading.Thread(target=self._feed, daemon=True)
        self._thread.start()

    def _feed(self) -> None:
        for block in self.blocks:
            if self._stop.is_set():
                return
            self.buffer[...] = block
            self.callback(self.buffer, len(block), None, None)
            time.sleep(0.001)
        if self.buffer is not None:
            self.buffer[...] = 0.0  # a recorder that kept references instead of copies now sees zeros

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)

    def close(self) -> None:
        self.closed = True


class FakeSoundDevice:
    def __init__(self, blocks: Iterable[np.ndarray] = (), fail: bool = False) -> None:
        self.blocks = list(blocks)
        self.fail = fail
        self.streams: list[FakeInputStream] = []

    def InputStream(self, **kwargs: Any) -> FakeInputStream:  # noqa: N802 - mirrors sounddevice
        stream = FakeInputStream(self.blocks, fail=self.fail, **kwargs)
        self.streams.append(stream)
        return stream


class FakePlayer:
    def __init__(self) -> None:
        self.clips: list[AudioClip] = []
        self.stopped = 0
        self.waited = 0
        self.closed = False
        self.errors: list[str] = []

    def enqueue(self, clip: AudioClip) -> None:
        self.clips.append(clip)

    def wait(self, timeout: float | None = None) -> bool:
        self.waited += 1
        return True

    def stop(self) -> None:
        self.stopped += 1

    def close(self) -> None:
        self.closed = True


class FakeLED:
    def __init__(self) -> None:
        self.states: list[str] = []

    def on(self) -> None:
        self.states.append("on")

    def off(self) -> None:
        self.states.append("off")

    def blink(self, on_time: float = 1.0, off_time: float = 1.0) -> None:
        self.states.append(f"blink:{on_time}")


def fixed_clock(stamp: str = "2026-09-05 10:15:30") -> Callable[[], datetime]:
    when = datetime.strptime(stamp, "%Y-%m-%d %H:%M:%S")
    return lambda: when


def tone(seconds: float = 1.0, sample_rate: int = 16000) -> AudioClip:
    t = np.arange(int(seconds * sample_rate)) / sample_rate
    return AudioClip((0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32), sample_rate)


@pytest.fixture
def kb(tmp_path: Path) -> KnowledgeBase:
    base = KnowledgeBase(tmp_path / "knowledge", tmp_path / "data" / "knowledge.db", HashEmbedder(dim=256))
    yield base
    base.close()


@pytest.fixture
def llm() -> FakeLLM:
    return FakeLLM()


@pytest.fixture
def speaker() -> FakeSpeaker:
    return FakeSpeaker()


@pytest.fixture
def transcriber() -> FakeTranscriber:
    return FakeTranscriber()


@pytest.fixture
def sessions(tmp_path: Path) -> SessionStore:
    return SessionStore(tmp_path / "data" / "sessions.json", max_turns=3)


@pytest.fixture
def box(llm: FakeLLM, kb: KnowledgeBase, speaker: FakeSpeaker, transcriber: FakeTranscriber, sessions: SessionStore) -> Voicebox:
    return Voicebox(llm, "You are a test persona.", kb, speaker, transcriber, sessions, top_k=3, voice="af_heart", clock=fixed_clock())


__all__ = ["FakeLLM", "FakeSpeaker", "FakeTranscriber", "FakeSoundDevice", "FakePlayer", "FakeLED", "fixed_clock", "tone", "LLMError"]
