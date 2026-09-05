"""Audio primitives: clips, WAV encoding, resampling, microphone capture, and playback.

``sounddevice`` (PortAudio) is imported lazily; ``Recorder`` and ``Player`` accept a
compatible module object so tests can run without audio hardware.
"""
from __future__ import annotations

import io
import queue
import threading
import time
import wave
from dataclasses import dataclass
from typing import Any, Optional

import numpy as np


class AudioError(RuntimeError):
    """Microphone or speaker problem."""


@dataclass(frozen=True)
class AudioClip:
    samples: np.ndarray  # float32 mono in [-1, 1]
    sample_rate: int

    @property
    def duration(self) -> float:
        return float(len(self.samples)) / self.sample_rate if self.sample_rate else 0.0


def to_mono_float32(samples: np.ndarray) -> np.ndarray:
    data = np.asarray(samples)
    if data.ndim == 2:
        data = data.mean(axis=1)
    if data.dtype.kind in "iu":
        scale = float(np.iinfo(data.dtype).max)
        data = data.astype(np.float32) / scale
    return np.ascontiguousarray(data.astype(np.float32, copy=False))


def resample(samples: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    """Linear-interpolation resampler; adequate for speech playback and 16 kHz STT input."""
    data = to_mono_float32(samples)
    if src_rate == dst_rate or len(data) == 0:
        return data
    duration = len(data) / src_rate
    target_len = max(1, int(round(duration * dst_rate)))
    src_x = np.linspace(0.0, duration, num=len(data), endpoint=False)
    dst_x = np.linspace(0.0, duration, num=target_len, endpoint=False)
    return np.interp(dst_x, src_x, data).astype(np.float32)


def clip_to_wav_bytes(clip: AudioClip) -> bytes:
    pcm = np.clip(to_mono_float32(clip.samples), -1.0, 1.0)
    pcm16 = (pcm * 32767.0).astype("<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(clip.sample_rate)
        handle.writeframes(pcm16.tobytes())
    return buffer.getvalue()


def wav_bytes_to_clip(data: bytes) -> AudioClip:
    try:
        with wave.open(io.BytesIO(data), "rb") as handle:
            channels = handle.getnchannels()
            width = handle.getsampwidth()
            rate = handle.getframerate()
            frames = handle.readframes(handle.getnframes())
    except (wave.Error, EOFError) as exc:
        raise AudioError(f"not a PCM WAV stream: {exc}") from exc
    if width == 2:
        samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    elif width == 4:
        samples = np.frombuffer(frames, dtype="<i4").astype(np.float32) / 2147483648.0
    elif width == 1:
        samples = (np.frombuffer(frames, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        raise AudioError(f"unsupported WAV sample width {width}")
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    return AudioClip(np.ascontiguousarray(samples, dtype=np.float32), rate)


def _sounddevice() -> Any:
    try:
        import sounddevice  # noqa: WPS433 - optional dependency
    except (ImportError, OSError) as exc:  # OSError: PortAudio library missing
        raise AudioError(
            "the 'sounddevice' package (and the PortAudio library it needs) is not available; "
            "install the voice extra:  pip install -e \".[voice]\"  "
            f"({exc.__class__.__name__}: {exc})"
        ) from exc
    return sounddevice


def list_devices() -> str:
    """Human-readable device table (what `rinn-voice --list-devices` prints)."""
    return str(_sounddevice().query_devices())


def rms_db(block: np.ndarray) -> float:
    data = to_mono_float32(block)
    if len(data) == 0:
        return -120.0
    rms = float(np.sqrt(np.mean(np.square(data))))
    return 20.0 * np.log10(max(rms, 1e-6))


class Recorder:
    """Capture one utterance from the microphone.

    Recording starts immediately; speech is detected when the level rises well above the
    noise floor measured during the first ``calibration_seconds``. Recording stops after
    ``silence_seconds`` of quiet following speech, when ``max_seconds`` is reached, when
    ``stop_event`` is set, or on a manual stop.
    """

    def __init__(
        self,
        sample_rate: int = 16000,
        device: Optional[int | str] = None,
        silence_seconds: float = 1.2,
        max_seconds: float = 90.0,
        calibration_seconds: float = 0.4,
        speech_margin_db: float = 12.0,
        min_speech_db: float = -45.0,
        block_ms: int = 30,
        sd: Any | None = None,
    ) -> None:
        self.sample_rate = sample_rate
        self.device = device
        self.silence_seconds = silence_seconds
        self.max_seconds = max_seconds
        self.calibration_seconds = calibration_seconds
        self.speech_margin_db = speech_margin_db
        self.min_speech_db = min_speech_db
        self.block_size = max(1, int(sample_rate * block_ms / 1000))
        self._sd = sd

    def record_utterance(self, stop_event: threading.Event | None = None, on_state: Any | None = None) -> AudioClip:
        sd = self._sd or _sounddevice()
        blocks: "queue.Queue[np.ndarray]" = queue.Queue()

        def callback(indata: np.ndarray, frames: int, time_info: Any, status: Any) -> None:  # noqa: ARG001
            blocks.put(np.array(indata, copy=True))

        captured: list[np.ndarray] = []
        noise_levels: list[float] = []
        speech_started = False
        silence_run = 0.0
        elapsed = 0.0
        block_seconds = self.block_size / self.sample_rate
        threshold = self.min_speech_db

        try:
            stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=1,
                dtype="float32",
                blocksize=self.block_size,
                device=self.device,
                callback=callback,
            )
        except Exception as exc:  # noqa: BLE001 - PortAudio raises its own error types
            raise AudioError(f"cannot open microphone (device={self.device!r}): {exc}") from exc

        with stream:
            if on_state:
                on_state("listening")
            while True:
                if stop_event is not None and stop_event.is_set():
                    break
                try:
                    block = blocks.get(timeout=1.0)
                except queue.Empty:
                    if stop_event is not None and stop_event.is_set():
                        break
                    continue
                mono = to_mono_float32(block)
                captured.append(mono)
                elapsed += block_seconds
                level = rms_db(mono)
                if elapsed <= self.calibration_seconds:
                    noise_levels.append(level)
                    threshold = max(self.min_speech_db, (max(noise_levels) if noise_levels else -80.0) + self.speech_margin_db)
                    continue
                if level >= threshold:
                    if not speech_started and on_state:
                        on_state("speech")
                    speech_started = True
                    silence_run = 0.0
                elif speech_started:
                    silence_run += block_seconds
                    if silence_run >= self.silence_seconds:
                        break
                if elapsed >= self.max_seconds:
                    break

        if not captured:
            return AudioClip(np.zeros(0, dtype=np.float32), self.sample_rate)
        samples = np.concatenate(captured)
        if not speech_started:
            return AudioClip(np.zeros(0, dtype=np.float32), self.sample_rate)
        return AudioClip(samples, self.sample_rate)


class Player:
    """Queue clips and play them in order on a background thread."""

    def __init__(self, sample_rate: int = 24000, device: Optional[int | str] = None, sd: Any | None = None) -> None:
        self.sample_rate = sample_rate
        self.device = device
        self._sd = sd
        self._queue: "queue.Queue[Optional[AudioClip]]" = queue.Queue()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._idle = threading.Event()
        self._idle.set()
        self._lock = threading.Lock()
        self.errors: list[str] = []

    def enqueue(self, clip: AudioClip) -> None:
        if len(clip.samples) == 0:
            return
        self._idle.clear()
        self._queue.put(clip)
        self._ensure_thread()

    def wait(self, timeout: float | None = None) -> bool:
        """Block until everything queued has been played."""
        return self._idle.wait(timeout)

    def stop(self) -> None:
        """Drop queued clips and interrupt the current one (barge-in)."""
        self._stop.set()
        while True:
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break
        self._queue.put(None)

    def close(self) -> None:
        self.stop()
        if self._thread is not None:
            self._thread.join(timeout=5)

    # -- internals ------------------------------------------------------------

    def _ensure_thread(self) -> None:
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                self._stop.clear()
                self._thread = threading.Thread(target=self._run, name="rinn-player", daemon=True)
                self._thread.start()

    def _run(self) -> None:
        sd = self._sd or _sounddevice()
        try:
            with sd.OutputStream(samplerate=self.sample_rate, channels=1, dtype="float32", device=self.device) as stream:
                while True:
                    try:
                        clip = self._queue.get(timeout=2.0)
                    except queue.Empty:
                        if self._queue.empty():
                            self._idle.set()
                        continue
                    if clip is None:
                        self._idle.set()
                        if self._stop.is_set():
                            self._stop.clear()
                            continue
                        continue
                    data = resample(clip.samples, clip.sample_rate, self.sample_rate)
                    # Write in slices so stop() can interrupt long clips promptly.
                    step = max(1, int(self.sample_rate * 0.25))
                    for start in range(0, len(data), step):
                        if self._stop.is_set():
                            break
                        stream.write(np.ascontiguousarray(data[start : start + step]).reshape(-1, 1))
                    if self._queue.empty():
                        self._idle.set()
        except Exception as exc:  # noqa: BLE001 - surface device failures to the caller
            self.errors.append(f"{exc.__class__.__name__}: {exc}")
            self._idle.set()
            while True:
                try:
                    self._queue.get_nowait()
                except queue.Empty:
                    break


def silence(seconds: float, sample_rate: int) -> AudioClip:
    return AudioClip(np.zeros(int(seconds * sample_rate), dtype=np.float32), sample_rate)


def sleep_for(clip: AudioClip) -> None:  # pragma: no cover - convenience for scripts
    time.sleep(clip.duration)
