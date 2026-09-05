"""Text-to-speech backends for ``rinn-voice-server``.

Every backend returns an ``AudioClip``. Model libraries are imported lazily, so the
server starts on any machine and reports a clear error for a backend whose library is
missing.

- ``kokoro``   Stock voices (Kokoro-82M, Apache 2.0). Fast on GPU or CPU. No cloning.
- ``f5tts``    Your fine-tuned F5-TTS checkpoint plus a short reference clip of your voice.
- ``qwen3tts`` A fine-tuned Qwen3-TTS checkpoint (custom speaker) or zero-shot cloning
               from a reference clip with a Base model.
- ``silence``  Test backend; returns silence of a plausible duration.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional, Protocol

import numpy as np

from .audio import AudioClip, to_mono_float32

BACKEND_NAMES = ("kokoro", "f5tts", "qwen3tts", "silence")


class BackendError(RuntimeError):
    """Backend misconfiguration or library failure."""


class TTSBackend(Protocol):
    name: str

    def voices(self) -> list[str]: ...

    def synthesize(self, text: str, voice: Optional[str] = None, speed: float = 1.0) -> AudioClip: ...


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _require_file(path: str, label: str) -> Path:
    if not path:
        raise BackendError(f"{label} is not set")
    candidate = Path(path).expanduser()
    if not candidate.is_file():
        raise BackendError(f"{label} does not exist: {candidate}")
    return candidate


@dataclass
class SilenceBackend:
    """Deterministic backend for tests and wiring checks (no model needed)."""

    name: str = "silence"
    sample_rate: int = 24000
    seconds_per_char: float = 0.06

    def voices(self) -> list[str]:
        return ["silence"]

    def synthesize(self, text: str, voice: Optional[str] = None, speed: float = 1.0) -> AudioClip:
        duration = max(0.2, len(text) * self.seconds_per_char / max(speed, 0.1))
        return AudioClip(np.zeros(int(duration * self.sample_rate), dtype=np.float32), self.sample_rate)


class KokoroBackend:
    """Kokoro-82M stock voices. Voice IDs like af_bella, af_heart, am_michael."""

    name = "kokoro"
    SAMPLE_RATE = 24000
    DEFAULT_VOICES = ["af_heart", "af_bella", "af_nicole", "af_sarah", "am_michael", "am_fenrir", "am_puck", "bf_emma"]

    def __init__(self, default_voice: str = "af_bella", lang_code: str = "a", device: Optional[str] = None) -> None:
        self.default_voice = default_voice
        try:
            from kokoro import KPipeline  # noqa: WPS433 - optional dependency
        except ImportError as exc:
            raise BackendError("kokoro is not installed; run:  pip install -e \".[kokoro]\"  (plus espeak-ng)") from exc
        try:
            self._pipeline = KPipeline(lang_code=lang_code, repo_id="hexgrad/Kokoro-82M", device=device)
        except Exception as exc:  # noqa: BLE001
            raise BackendError(f"could not start Kokoro: {exc}") from exc

    def voices(self) -> list[str]:
        return list(dict.fromkeys([self.default_voice, *self.DEFAULT_VOICES]))

    def synthesize(self, text: str, voice: Optional[str] = None, speed: float = 1.0) -> AudioClip:
        pieces: list[np.ndarray] = []
        try:
            for result in self._pipeline(text, voice=voice or self.default_voice, speed=speed):
                audio = getattr(result, "audio", None)
                if audio is None and isinstance(result, tuple) and len(result) >= 3:
                    audio = result[2]
                if audio is None:
                    continue
                pieces.append(_to_numpy(audio))
        except Exception as exc:  # noqa: BLE001
            raise BackendError(f"Kokoro synthesis failed: {exc}") from exc
        if not pieces:
            return AudioClip(np.zeros(0, dtype=np.float32), self.SAMPLE_RATE)
        return AudioClip(np.concatenate(pieces).astype(np.float32), self.SAMPLE_RATE)


class F5TTSBackend:
    """Fine-tuned F5-TTS checkpoint plus a reference clip (under 12 s) of the target voice.

    Environment: RINN_F5_MODEL (F5TTS_v1_Base or F5TTS_Base), RINN_F5_CKPT (model_*.pt or
    .safetensors), RINN_F5_VOCAB (vocab.txt from the fine-tune), RINN_F5_REF_AUDIO,
    RINN_F5_REF_TEXT (exact transcript of the clip), RINN_F5_NFE (32 quality / 16 speed),
    RINN_F5_SEED (fixed seed keeps the timbre consistent between sentences).
    """

    name = "f5tts"

    def __init__(
        self,
        ref_audio: str,
        ref_text: str,
        ckpt_file: str = "",
        vocab_file: str = "",
        model: str = "F5TTS_v1_Base",
        nfe_step: int = 32,
        seed: int = 42,
        device: Optional[str] = None,
    ) -> None:
        self.ref_audio = str(_require_file(ref_audio, "RINN_F5_REF_AUDIO"))
        self.ref_text = ref_text.strip()
        if not self.ref_text:
            raise BackendError("RINN_F5_REF_TEXT (transcript of the reference clip) is not set")
        if ckpt_file:
            ckpt_file = str(_require_file(ckpt_file, "RINN_F5_CKPT"))
        if vocab_file:
            vocab_file = str(_require_file(vocab_file, "RINN_F5_VOCAB"))
        self.nfe_step = nfe_step
        self.seed = seed
        try:
            from f5_tts.api import F5TTS  # noqa: WPS433 - optional dependency
        except ImportError as exc:
            raise BackendError("f5-tts is not installed; run:  pip install -e \".[f5tts]\"  (plus ffmpeg)") from exc
        try:
            self._model = F5TTS(model=model, ckpt_file=ckpt_file, vocab_file=vocab_file, device=device)
        except Exception as exc:  # noqa: BLE001
            raise BackendError(f"could not load F5-TTS ({model}, ckpt={ckpt_file or 'default'}): {exc}") from exc
        self.sample_rate = int(getattr(self._model, "target_sample_rate", 24000))

    def voices(self) -> list[str]:
        return ["clone"]

    def synthesize(self, text: str, voice: Optional[str] = None, speed: float = 1.0) -> AudioClip:
        try:
            wav, sr, _spec = self._model.infer(
                ref_file=self.ref_audio,
                ref_text=self.ref_text,
                gen_text=text,
                nfe_step=self.nfe_step,
                speed=speed,
                seed=self.seed,
                show_info=lambda *args, **kwargs: None,
            )
        except Exception as exc:  # noqa: BLE001
            raise BackendError(f"F5-TTS synthesis failed: {exc}") from exc
        return AudioClip(_to_numpy(wav), int(sr))


class Qwen3TTSBackend:
    """Qwen3-TTS: fine-tuned custom speaker, or zero-shot clone from a reference clip.

    Environment: RINN_QWEN_TTS_MODEL (checkpoint dir such as output/checkpoint-epoch-2, or
    Qwen/Qwen3-TTS-12Hz-1.7B-Base), RINN_QWEN_TTS_SPEAKER (speaker name used in
    fine-tuning; leave empty for zero-shot), RINN_QWEN_TTS_REF_AUDIO + RINN_QWEN_TTS_REF_TEXT
    (zero-shot clone), RINN_QWEN_TTS_LANGUAGE (English).
    """

    name = "qwen3tts"

    def __init__(
        self,
        model_path: str = "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        speaker: str = "",
        ref_audio: str = "",
        ref_text: str = "",
        language: str = "English",
        device: str = "cuda:0",
    ) -> None:
        self.speaker = speaker.strip()
        self.language = language
        if not self.speaker and not ref_audio:
            raise BackendError("set RINN_QWEN_TTS_SPEAKER (fine-tuned voice) or RINN_QWEN_TTS_REF_AUDIO (zero-shot clone)")
        if ref_audio:
            ref_audio = str(_require_file(ref_audio, "RINN_QWEN_TTS_REF_AUDIO"))
        self.ref_audio = ref_audio
        self.ref_text = ref_text.strip() or None
        try:
            import torch  # noqa: WPS433
            from qwen_tts import Qwen3TTSModel  # noqa: WPS433 - optional dependency
        except ImportError as exc:
            raise BackendError("qwen-tts is not installed; run:  pip install -e \".[qwen3tts]\"") from exc
        try:
            self._model = Qwen3TTSModel.from_pretrained(model_path, device_map=device, dtype=torch.bfloat16)
        except Exception as exc:  # noqa: BLE001
            raise BackendError(f"could not load Qwen3-TTS from {model_path}: {exc}") from exc
        self._clone_prompt: Any = None
        if not self.speaker:
            try:
                self._clone_prompt = self._model.create_voice_clone_prompt(
                    ref_audio=self.ref_audio, ref_text=self.ref_text, x_vector_only_mode=self.ref_text is None
                )
            except Exception as exc:  # noqa: BLE001
                raise BackendError(f"could not build the voice-clone prompt from {self.ref_audio}: {exc}") from exc

    def voices(self) -> list[str]:
        return [self.speaker or "clone"]

    def synthesize(self, text: str, voice: Optional[str] = None, speed: float = 1.0) -> AudioClip:
        try:
            if self.speaker:
                wavs, sr = self._model.generate_custom_voice(text=text, language=self.language, speaker=self.speaker)
            else:
                wavs, sr = self._model.generate_voice_clone(
                    text=text, language=self.language, voice_clone_prompt=self._clone_prompt
                )
        except Exception as exc:  # noqa: BLE001
            raise BackendError(f"Qwen3-TTS synthesis failed: {exc}") from exc
        wav = wavs[0] if isinstance(wavs, (list, tuple)) else wavs
        return AudioClip(_to_numpy(wav), int(sr))


def _to_numpy(audio: Any) -> np.ndarray:
    if hasattr(audio, "detach"):  # torch tensor
        audio = audio.detach().float().cpu().numpy()
    return to_mono_float32(np.asarray(audio).squeeze())


def build_backend(name: str, env: Optional[dict[str, str]] = None) -> TTSBackend:
    """Construct a backend from its name and RINN_* environment variables."""
    values = os.environ if env is None else env

    def get(key: str, default: str = "") -> str:
        return values.get(key, default).strip()

    name = name.strip().lower()
    if name == "silence":
        return SilenceBackend()
    if name == "kokoro":
        return KokoroBackend(default_voice=get("RINN_TTS_VOICE", "af_bella"), lang_code=get("RINN_KOKORO_LANG", "a"), device=get("RINN_TTS_DEVICE") or None)
    if name == "f5tts":
        return F5TTSBackend(
            ref_audio=get("RINN_F5_REF_AUDIO"),
            ref_text=get("RINN_F5_REF_TEXT"),
            ckpt_file=get("RINN_F5_CKPT"),
            vocab_file=get("RINN_F5_VOCAB"),
            model=get("RINN_F5_MODEL", "F5TTS_v1_Base"),
            nfe_step=int(get("RINN_F5_NFE", "32")),
            seed=int(get("RINN_F5_SEED", "42")),
            device=get("RINN_TTS_DEVICE") or None,
        )
    if name == "qwen3tts":
        return Qwen3TTSBackend(
            model_path=get("RINN_QWEN_TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base"),
            speaker=get("RINN_QWEN_TTS_SPEAKER"),
            ref_audio=get("RINN_QWEN_TTS_REF_AUDIO"),
            ref_text=get("RINN_QWEN_TTS_REF_TEXT"),
            language=get("RINN_QWEN_TTS_LANGUAGE", "English"),
            device=get("RINN_TTS_DEVICE", "cuda:0"),
        )
    raise BackendError(f"unknown TTS backend {name!r}; choose one of {', '.join(BACKEND_NAMES)}")
