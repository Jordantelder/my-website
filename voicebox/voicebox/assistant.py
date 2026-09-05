"""One voice turn: transcript -> notes lookup -> streamed answer -> spoken sentences.

``Voicebox.turn`` is a generator of ``TurnEvent`` objects so a server can stream them to a
thin client as they happen: the transcript first, then text as it is written, then one audio
event per sentence, then ``done``. Model generation and speech synthesis overlap.
"""
from __future__ import annotations

import base64
import json
import queue
import re
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Iterator, Optional, Protocol

import numpy as np
from rinn.llm import Chunk, LLMError, OllamaLLM
from rinn.voice.audio import AudioClip
from rinn.voice.chunker import SentenceChunker, strip_markdown_for_speech

from .knowledge import Hit, KnowledgeBase, KnowledgeError, format_notes

# A note needs the connector ("remember that", "note:", "take a note,") and must not be a question:
# "Remember what the garage code is?" goes to the model, "Remember that the garage code is 4321" is saved.
# If nobody reads a turn's events for this long, the client is gone: stop generating.
STALL_SECONDS = 30.0

REMEMBER_RE = re.compile(
    r"^\s*(?:hey[,\s]+)?(?:please\s+)?(?:remember|note|save a note|make a note|take a note)\s*(?:that|:|,)\s+"
    r"(?!(?:what|when|where|who|whom|whose|which|how|why|if|whether|do|does|did|is|are|was|were|can|could|will|would|should)\b)(.+?)\s*$",
    re.IGNORECASE | re.DOTALL,
)
FORGET_RE = re.compile(r"^\s*(?:please\s+)?(?:forget|clear|reset)\s+(?:the\s+|our\s+)?(?:conversation|chat|context|history)\s*[.!]?\s*$", re.IGNORECASE)


class _Cancelled(Exception):
    """Raised inside the model callback when the client has gone away."""


class Transcriber(Protocol):
    def transcribe(self, clip: AudioClip) -> str: ...


class Synthesizer(Protocol):
    def synthesize(self, text: str, voice: Optional[str] = None) -> AudioClip: ...


@dataclass
class TurnEvent:
    type: str  # transcript | text | audio | note_saved | error | done
    text: str = ""
    sample_rate: int = 0
    pcm16: str = ""  # base64 little-endian 16-bit mono
    answer: str = ""
    sources: list[str] = field(default_factory=list)
    seconds: float = 0.0
    detail: str = ""

    def to_json(self) -> str:
        data = {k: v for k, v in asdict(self).items() if v not in ("", 0, 0.0, [], None) or k == "type"}
        return json.dumps(data, ensure_ascii=False)


class SessionStore:
    """Conversation history per device/session, kept in memory and mirrored to a JSON file."""

    def __init__(self, path: Optional[Path], max_turns: int) -> None:
        self.path = Path(path) if path else None
        self.max_turns = max_turns
        self._sessions: dict[str, list[dict[str, str]]] = {}
        self._lock = threading.Lock()
        if self.path and self.path.is_file():
            try:
                self._sessions = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                self._sessions = {}

    def history(self, session_id: str) -> list[dict[str, str]]:
        with self._lock:
            return list(self._sessions.get(session_id, []))

    def append(self, session_id: str, user: str, assistant: str) -> None:
        with self._lock:
            history = self._sessions.setdefault(session_id, [])
            history.append({"role": "user", "content": user})
            history.append({"role": "assistant", "content": assistant})
            keep = 2 * self.max_turns
            if len(history) > keep:
                del history[: len(history) - keep]
            self._save()

    def reset(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)
            self._save()

    def _save(self) -> None:
        if not self.path:
            return
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(self._sessions, ensure_ascii=False, indent=1), encoding="utf-8")
        except OSError:
            pass  # history is a convenience; never fail a turn over it


def pcm16_base64(clip: AudioClip) -> str:
    pcm = (np.clip(clip.samples, -1.0, 1.0) * 32767.0).astype("<i2")
    return base64.b64encode(pcm.tobytes()).decode("ascii")


class Voicebox:
    def __init__(
        self,
        llm: OllamaLLM,
        persona: str,
        knowledge: Optional[KnowledgeBase],
        speaker: Optional[Synthesizer],
        transcriber: Optional[Transcriber],
        sessions: SessionStore,
        top_k: int = 4,
        voice: Optional[str] = None,
        chunker_factory: Callable[[], SentenceChunker] = lambda: SentenceChunker(min_chars=30, max_chars=260, first_min_chars=12),
        clock: Callable[[], datetime] = datetime.now,
    ) -> None:
        self.llm = llm
        self.persona = persona
        self.knowledge = knowledge
        self.speaker = speaker
        self.transcriber = transcriber
        self.sessions = sessions
        self.top_k = top_k
        self.voice = voice
        self.chunker_factory = chunker_factory
        self.clock = clock

    # -- public ----------------------------------------------------------------

    def turn(self, session_id: str, audio: Optional[AudioClip] = None, text: Optional[str] = None, speak: bool = True) -> Iterator[TurnEvent]:
        started = time.perf_counter()
        question = (text or "").strip()
        if audio is not None and not question:
            if self.transcriber is None:
                yield TurnEvent("error", detail="this server has no speech-to-text configured")
                yield TurnEvent("done", seconds=round(time.perf_counter() - started, 2))
                return
            try:
                question = self.transcriber.transcribe(audio).strip()
            except Exception as exc:  # noqa: BLE001 - surfaced to the client as an event
                yield TurnEvent("error", detail=f"could not transcribe: {exc}")
                yield TurnEvent("done", seconds=round(time.perf_counter() - started, 2))
                return
            yield TurnEvent("transcript", text=question)
        if not question:
            yield TurnEvent("error", detail="I did not catch anything.")
            yield TurnEvent("done", seconds=round(time.perf_counter() - started, 2))
            return

        if FORGET_RE.match(question):
            self.sessions.reset(session_id)
            yield from self._speak_only("Okay, I have cleared our conversation.", speak, started)
            return

        remember = REMEMBER_RE.match(question)
        if remember and self.knowledge is not None and not question.rstrip().endswith("?"):
            note = remember.group(1).strip().rstrip(".")
            try:
                path = self.knowledge.add_note(note, clock=self.clock)
            except (KnowledgeError, OSError, ValueError) as exc:
                yield TurnEvent("error", detail=f"could not save the note: {exc}")
                yield TurnEvent("done", seconds=round(time.perf_counter() - started, 2))
                return
            yield TurnEvent("note_saved", text=note, detail=path.name)
            preview = " ".join(note.split()[:14])
            yield from self._speak_only(f"Saved a note: {preview}.", speak, started)
            return

        hits = self._lookup(question)
        user_content = f"{format_notes(hits)}\n\n### Question\n{question}" if hits else question
        messages = [{"role": "system", "content": self.persona}, *self.sessions.history(session_id), {"role": "user", "content": user_content}]
        yield from self._stream_answer(messages, session_id, question, hits, speak, started)

    # -- internals -------------------------------------------------------------

    def _lookup(self, question: str) -> list[Hit]:
        if self.knowledge is None:
            return []
        try:
            return self.knowledge.search(question, k=self.top_k)
        except KnowledgeError:
            return []

    def _speak_only(self, sentence: str, speak: bool, started: float) -> Iterator[TurnEvent]:
        yield TurnEvent("text", text=sentence)
        if speak and self.speaker is not None:
            try:
                clip = self.speaker.synthesize(sentence, voice=self.voice)
                yield TurnEvent("audio", text=sentence, sample_rate=clip.sample_rate, pcm16=pcm16_base64(clip))
            except Exception as exc:  # noqa: BLE001
                yield TurnEvent("error", detail=f"speech failed: {exc}")
        yield TurnEvent("done", answer=sentence, seconds=round(time.perf_counter() - started, 2))

    def _stream_answer(self, messages: list[dict[str, str]], session_id: str, question: str, hits: list[Hit], speak: bool, started: float) -> Iterator[TurnEvent]:
        events: "queue.Queue[Optional[TurnEvent]]" = queue.Queue(maxsize=256)
        sentences: "queue.Queue[Optional[str]]" = queue.Queue()
        chunker = self.chunker_factory()
        speaking = speak and self.speaker is not None
        result: dict[str, Any] = {}
        cancelled = threading.Event()  # set when the consumer stops reading (client disconnected)

        def emit(event: Optional[TurnEvent]) -> bool:
            """Queue an event for the consumer; False (and cancelled) if nobody has read for STALL_SECONDS."""
            try:
                events.put(event, timeout=STALL_SECONDS)
                return True
            except queue.Full:
                cancelled.set()
                return False

        def synth_worker() -> None:
            while True:
                sentence = sentences.get()
                if sentence is None:
                    return
                if cancelled.is_set():
                    continue  # drain without synthesizing: nobody is listening any more
                spoken = strip_markdown_for_speech(sentence).strip()
                if not spoken:
                    continue
                try:
                    clip = self.speaker.synthesize(spoken, voice=self.voice)  # type: ignore[union-attr]
                except Exception as exc:  # noqa: BLE001
                    emit(TurnEvent("error", detail=f"speech failed: {exc}"))
                    continue
                emit(TurnEvent("audio", text=spoken, sample_rate=clip.sample_rate, pcm16=pcm16_base64(clip)))

        def on_chunk(chunk: Chunk) -> None:
            if cancelled.is_set():
                raise _Cancelled()  # unwinds llm.chat, which closes the Ollama stream so generation stops
            if chunk.kind != "content":
                return
            if not emit(TurnEvent("text", text=chunk.text)):
                raise _Cancelled()
            if speaking:
                for sentence in chunker.feed(chunk.text):
                    sentences.put(sentence)

        def generate() -> None:
            synth = threading.Thread(target=synth_worker, name="voicebox-tts", daemon=True)
            if speaking:
                synth.start()
            try:
                reply = self.llm.chat(messages, on_chunk=on_chunk)
                result["answer"] = reply.content
            except _Cancelled:
                pass
            except LLMError as exc:
                emit(TurnEvent("error", detail=str(exc)))
            except Exception as exc:  # noqa: BLE001
                emit(TurnEvent("error", detail=f"model failed: {exc.__class__.__name__}: {exc}"))
            finally:
                if speaking:
                    for sentence in chunker.flush():
                        sentences.put(sentence)
                    sentences.put(None)
                    synth.join()
                emit(None)

        threading.Thread(target=generate, name="voicebox-turn", daemon=True).start()
        try:
            while True:
                event = events.get()
                if event is None:
                    break
                yield event
        finally:
            cancelled.set()  # no-op after a normal finish; stops the workers if the generator was closed early
        answer = result.get("answer", "")
        if answer:
            # History keeps the question only: notes are looked up fresh on every turn, so an
            # edited note is never contradicted by its old text lingering in the conversation.
            self.sessions.append(session_id, question, answer)
        yield TurnEvent("done", answer=answer, sources=list(dict.fromkeys(h.title for h in hits)), seconds=round(time.perf_counter() - started, 2))
