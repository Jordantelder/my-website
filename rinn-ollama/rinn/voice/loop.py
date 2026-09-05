"""The voice conversation loop: listen, ask RINN, print and speak the answer as it streams."""
from __future__ import annotations

import queue
import sys
import threading
from dataclasses import dataclass, field
from typing import Callable, Iterable, Optional, Sequence, TextIO

from ..assistant import Answer, ContextDoc, RinnAssistant
from ..llm import Chunk, LLMError
from .audio import AudioClip, AudioError, Player, Recorder
from .chunker import SentenceChunker, strip_markdown_for_speech
from .stt import STTError, Transcriber
from .tts_client import TTSClient, TTSError

SpeakFilter = Callable[[str], str]


@dataclass
class SpokenAnswer:
    answer: Answer
    sentences: list[str] = field(default_factory=list)
    tts_errors: list[str] = field(default_factory=list)


class VoiceLoop:
    """Wire RINN's streamed text into sentence-level speech.

    While the model is still generating sentence N+1, sentence N is being synthesized and
    sentence N-1 is playing, which is what makes the reply feel live. In the interactive
    session the prompt returns as soon as the reply has been synthesized, so playback can
    continue in the background and be cut short with ``/stop`` or by asking the next
    question.
    """

    def __init__(
        self,
        assistant: RinnAssistant,
        tts: TTSClient | None,
        player: Player | None,
        transcriber: Transcriber | None = None,
        recorder: Recorder | None = None,
        out: TextIO = sys.stdout,
        err: TextIO = sys.stderr,
        speak_filter: SpeakFilter = strip_markdown_for_speech,
        chunker_factory: Callable[[], SentenceChunker] = SentenceChunker,
        show_thinking: bool = False,
    ) -> None:
        self.assistant = assistant
        self.tts = tts
        self.player = player
        self.transcriber = transcriber
        self.recorder = recorder
        self.out = out
        self.err = err
        self.speak_filter = speak_filter
        self.chunker_factory = chunker_factory
        self.show_thinking = show_thinking
        self._speech_thread: threading.Thread | None = None
        self._cancel = threading.Event()

    @property
    def speaking_enabled(self) -> bool:
        return self.tts is not None and self.player is not None

    # -- speech in ------------------------------------------------------------

    def listen(self, stop_event: threading.Event | None = None) -> str:
        """Record one utterance and return its transcript ("" when nothing was heard)."""
        if self.recorder is None or self.transcriber is None:
            raise AudioError("microphone input is not configured (no recorder/transcriber)")
        self.interrupt()  # never record while RINN is still talking

        def state(name: str) -> None:
            if name == "listening":
                print("listening... (speak, then pause)", file=self.out, flush=True)
            elif name == "speech":
                print("hearing you...", file=self.out, flush=True)

        clip = self.recorder.record_utterance(stop_event=stop_event, on_state=state)
        if clip.duration < 0.3:
            return ""
        print("transcribing...", file=self.out, flush=True)
        return self.transcriber.transcribe(clip.samples, clip.sample_rate).strip()

    # -- speech out -----------------------------------------------------------

    def answer(self, question: str, context: Iterable[ContextDoc] | None = None, wait_for_playback: bool = True) -> SpokenAnswer:
        """Ask RINN and stream the answer to the console and, if configured, the speaker.

        Returns once the model has finished and every sentence has been handed to the
        speaker. With ``wait_for_playback`` it also waits for the audio to finish.
        If the model call fails or is interrupted, pending speech is cancelled.
        """
        self.interrupt()  # a new question silences whatever is still being spoken
        chunker = self.chunker_factory()
        sentences: "queue.Queue[Optional[str]]" = queue.Queue()
        spoken: list[str] = []
        tts_errors: list[str] = []
        cancel = threading.Event()
        self._cancel = cancel
        speaking = self.speaking_enabled

        def synth_worker() -> None:
            while True:
                sentence = sentences.get()
                if sentence is None or cancel.is_set():
                    return
                speech_text = self.speak_filter(sentence).strip()
                if not speech_text or self.tts is None or self.player is None:
                    continue
                try:
                    clip: AudioClip = self.tts.synthesize(speech_text)
                except (TTSError, ValueError) as exc:
                    tts_errors.append(str(exc))
                    continue
                if cancel.is_set():
                    return
                spoken.append(speech_text)
                try:
                    self.player.enqueue(clip)
                except AudioError as exc:
                    tts_errors.append(str(exc))
                    return

        worker = threading.Thread(target=synth_worker, name="rinn-tts", daemon=True)
        if speaking:
            worker.start()
            self._speech_thread = worker

        in_thinking = False

        def on_chunk(chunk: Chunk) -> None:
            nonlocal in_thinking
            if chunk.kind == "thinking":
                if self.show_thinking:
                    if not in_thinking:
                        self.out.write("[thinking] ")
                        in_thinking = True
                    self.out.write(chunk.text)
                    self.out.flush()
                return
            if in_thinking:
                self.out.write("\n\n")
                in_thinking = False
            self.out.write(chunk.text)
            self.out.flush()
            if speaking:
                for sentence in chunker.feed(chunk.text):
                    sentences.put(sentence)

        completed = False
        try:
            answer = self.assistant.ask(question, context=context, on_chunk=on_chunk)
            completed = True
        finally:
            self.out.write("\n")
            self.out.flush()
            if speaking:
                if completed:
                    for sentence in chunker.flush():
                        sentences.put(sentence)
                    sentences.put(None)
                    while worker.is_alive():  # interruptible join
                        worker.join(0.2)
                else:
                    cancel.set()
                    _drain(sentences)
                    sentences.put(None)
                    if self.player is not None:
                        self.player.stop()
                    worker.join(timeout=5)

        if speaking and wait_for_playback:
            self.wait_for_speech()
        if speaking and self.player is not None and self.player.errors:
            tts_errors.extend(self.player.errors)
            self.player.errors.clear()
        if tts_errors:
            print(f"[speech problem: {tts_errors[0]}]", file=self.err)
        return SpokenAnswer(answer=answer, sentences=spoken, tts_errors=tts_errors)

    def wait_for_speech(self, poll: float = 0.2) -> None:
        """Block until synthesis and playback are done (polling so Ctrl+C is honoured)."""
        thread = self._speech_thread
        while thread is not None and thread.is_alive():
            thread.join(poll)
        if self.player is not None:
            while not self.player.wait(poll):
                pass

    def interrupt(self) -> None:
        """Stop speaking: drop queued sentences and cut off the current clip."""
        self._cancel.set()
        if self.player is not None:
            self.player.stop()
        thread = self._speech_thread
        if thread is not None and thread.is_alive():
            thread.join(timeout=2)
        self._speech_thread = None

    # -- interactive session --------------------------------------------------

    def run(self, context: Sequence[ContextDoc] = (), input_fn: Callable[[str], str] | None = None) -> int:
        docs = list(context)
        if input_fn is None:
            input_fn = input  # resolved now so a replaced builtins.input is honoured
        mic = self.recorder is not None and self.transcriber is not None
        print(
            f"RINN voice ({self.assistant.llm.model}) ready. "
            + ("Press Enter to talk, or type a question. " if mic else "Type a question. ")
            + ("/stop silences RINN, " if self.speaking_enabled else "")
            + "/quit to exit.",
            file=self.out,
        )
        while True:
            try:
                line = input_fn("you> ").strip()
            except (EOFError, KeyboardInterrupt):
                print(file=self.out)
                self.interrupt()
                return 0
            if line in ("/quit", "/exit"):
                self.interrupt()
                return 0
            if line == "/reset":
                self.assistant.reset()
                print("conversation cleared", file=self.out)
                continue
            if line == "/stop":
                self.interrupt()
                continue
            if not line:
                if not mic:
                    continue
                try:
                    line = self.listen()
                except KeyboardInterrupt:
                    print("(cancelled)", file=self.err)
                    continue
                except (AudioError, STTError) as exc:
                    print(f"error: {exc}", file=self.err)
                    continue
                if not line:
                    print("(heard nothing)", file=self.out)
                    continue
                print(f"you (heard): {line}", file=self.out)
            print("rinn> ", end="", file=self.out, flush=True)
            try:
                self.answer(line, context=docs, wait_for_playback=False)
            except KeyboardInterrupt:
                self.interrupt()
                print("(interrupted)", file=self.err)
            except LLMError as exc:
                print(f"error: {exc}", file=self.err)


def _drain(q: "queue.Queue[Optional[str]]") -> None:
    while True:
        try:
            q.get_nowait()
        except queue.Empty:
            return
