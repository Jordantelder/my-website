"""Speech-to-text via faster-whisper (CTranslate2), imported lazily."""
from __future__ import annotations

import os
import sys
from typing import Any, Optional, Protocol

import numpy as np

from .audio import resample, to_mono_float32

# Domain vocabulary nudges Whisper towards regulatory terms and acronyms.
REGULATORY_PROMPT = (
    "RINN, FDA, 510(k), premarket notification, De Novo, PMA, 21 CFR 807, 21 CFR 820, QMSR, "
    "IEC 60601-1, ISO 10993, ISO 14971, biocompatibility, predicate device, substantial equivalence, "
    "indications for use, product code, CDRH, guidance document, sterilization validation."
)


class STTError(RuntimeError):
    """Transcription model could not be loaded or run."""


class Transcriber(Protocol):
    def transcribe(self, samples: np.ndarray, sample_rate: int) -> str: ...


def _add_windows_cuda_dlls() -> None:
    """On Windows, make pip-installed cuBLAS/cuDNN visible to CTranslate2."""
    if sys.platform != "win32" or not hasattr(os, "add_dll_directory"):
        return
    for package in ("nvidia.cublas", "nvidia.cudnn"):
        try:
            module = __import__(package, fromlist=["__path__"])
        except ImportError:
            continue
        for base in getattr(module, "__path__", []):
            for sub in ("bin", "lib"):
                path = os.path.join(base, sub)
                if os.path.isdir(path):
                    try:
                        os.add_dll_directory(path)
                    except OSError:
                        pass


class FasterWhisperTranscriber:
    """faster-whisper wrapper. ``model`` accepts aliases like ``large-v3-turbo`` or a path."""

    def __init__(
        self,
        model: str = "large-v3-turbo",
        device: str = "auto",
        compute_type: str = "default",
        language: Optional[str] = "en",
        beam_size: int = 5,
        initial_prompt: Optional[str] = REGULATORY_PROMPT,
        whisper_model: Any | None = None,
    ) -> None:
        self.model_name = model
        self.language = language
        self.beam_size = beam_size
        self.initial_prompt = initial_prompt
        if whisper_model is not None:
            self._model = whisper_model
            return
        _add_windows_cuda_dlls()
        try:
            from faster_whisper import WhisperModel  # noqa: WPS433 - optional dependency
        except ImportError as exc:
            raise STTError("faster-whisper is not installed; run:  pip install -e \".[voice]\"") from exc
        try:
            self._model = WhisperModel(model, device=device, compute_type=compute_type)
        except Exception as exc:  # noqa: BLE001 - CTranslate2 raises RuntimeError/ValueError variants
            hint = ""
            message = str(exc)
            if "cublas" in message.lower() or "cudnn" in message.lower():
                hint = (
                    " (CUDA libraries missing: run  pip install nvidia-cublas-cu12 \"nvidia-cudnn-cu12==9.*\"  "
                    "or use --stt-device cpu)"
                )
            raise STTError(f"could not load Whisper model {model!r} on {device}: {exc}{hint}") from exc

    def transcribe(self, samples: np.ndarray, sample_rate: int) -> str:
        audio = resample(to_mono_float32(samples), sample_rate, 16000)
        if len(audio) < 1600:  # under 0.1 s
            return ""
        try:
            segments, _info = self._model.transcribe(
                audio,
                language=self.language,
                beam_size=self.beam_size,
                vad_filter=True,
                initial_prompt=self.initial_prompt,
                condition_on_previous_text=False,
            )
            text = " ".join(segment.text.strip() for segment in segments)
        except Exception as exc:  # noqa: BLE001
            raise STTError(f"transcription failed: {exc}") from exc
        return " ".join(text.split())
