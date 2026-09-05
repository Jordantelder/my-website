"""``rinn-voice-server``: an OpenAI-compatible speech server for RINN.

Endpoints (the same ones Open WebUI, Kokoro-FastAPI clients, and ``rinn-voice`` expect):

- ``POST /v1/audio/speech``          text -> audio (wav, mp3, flac, or raw pcm)
- ``POST /v1/audio/transcriptions``  audio file -> text (faster-whisper), when STT is enabled
- ``GET  /v1/audio/voices``          voice IDs the active backend offers
- ``GET  /v1/models``                model list (some clients probe it)
- ``GET  /health``                   readiness

Configuration comes from CLI flags or RINN_* environment variables (see tts_backends.py).
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from .. import __version__
from .audio import AudioClip, clip_to_wav_bytes, to_mono_float32
from .chunker import strip_markdown_for_speech
from .stt import REGULATORY_PROMPT, FasterWhisperTranscriber, STTError, Transcriber
from .tts_backends import BACKEND_NAMES, BackendError, TTSBackend, build_backend

MAX_INPUT_CHARS = 4000


class SpeechRequest(BaseModel):
    input: str = Field(..., description="Text to speak")
    model: str = "rinn"
    voice: Optional[str] = None
    response_format: str = "mp3"  # OpenAI's default; rinn-voice asks for wav
    speed: float = 1.0
    strip_markdown: bool = True


class ServerState:
    def __init__(self) -> None:
        self.backend: TTSBackend | None = None
        self.transcriber: Transcriber | None = None
        self.backend_error: str | None = None
        self.stt_error: str | None = None


def encode_audio(clip: AudioClip, fmt: str) -> tuple[bytes, str]:
    """Return (bytes, media type) for the requested format."""
    fmt = fmt.lower()
    if fmt == "wav":
        return clip_to_wav_bytes(clip), "audio/wav"
    if fmt == "pcm":
        pcm16 = (np.clip(to_mono_float32(clip.samples), -1.0, 1.0) * 32767.0).astype("<i2")
        return pcm16.tobytes(), "audio/pcm"
    if fmt in ("mp3", "flac", "ogg"):
        try:
            import soundfile as sf  # noqa: WPS433 - optional dependency
        except ImportError as exc:
            raise HTTPException(status_code=400, detail=f"{fmt} output needs the 'soundfile' package; request response_format=wav") from exc
        buffer = io.BytesIO()
        sf_format = {"mp3": "MP3", "flac": "FLAC", "ogg": "OGG"}[fmt]
        try:
            sf.write(buffer, to_mono_float32(clip.samples), clip.sample_rate, format=sf_format)
        except Exception as exc:  # noqa: BLE001 - libsndfile without MP3 support
            raise HTTPException(status_code=400, detail=f"cannot encode {fmt} ({exc}); request response_format=wav") from exc
        media = {"mp3": "audio/mpeg", "flac": "audio/flac", "ogg": "audio/ogg"}[fmt]
        return buffer.getvalue(), media
    raise HTTPException(status_code=400, detail=f"unsupported response_format {fmt!r}; use wav, mp3, flac, ogg or pcm")


def decode_upload(data: bytes, filename: str) -> AudioClip:
    """Decode an uploaded audio file (wav natively; other formats via soundfile)."""
    from .audio import AudioError, wav_bytes_to_clip

    try:
        return wav_bytes_to_clip(data)
    except AudioError:
        pass
    try:
        import soundfile as sf  # noqa: WPS433
    except ImportError as exc:
        raise HTTPException(status_code=415, detail=f"cannot decode {filename!r}: only WAV is supported without the 'soundfile' package") from exc
    try:
        samples, rate = sf.read(io.BytesIO(data), dtype="float32", always_2d=False)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=415, detail=f"cannot decode audio file {filename!r}: {exc}") from exc
    return AudioClip(to_mono_float32(samples), int(rate))


def create_app(backend: TTSBackend | None = None, transcriber: Transcriber | None = None, load_on_startup: bool = True) -> FastAPI:
    state = ServerState()
    state.backend = backend
    state.transcriber = transcriber

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if load_on_startup and state.backend is None:
            name = os.environ.get("RINN_TTS_BACKEND", "kokoro")
            try:
                state.backend = build_backend(name)
                print(f"[rinn-voice-server] TTS backend '{state.backend.name}' ready; voices: {', '.join(state.backend.voices())}", flush=True)
            except BackendError as exc:
                state.backend_error = str(exc)
                print(f"[rinn-voice-server] TTS backend '{name}' FAILED: {exc}", file=sys.stderr, flush=True)
        if load_on_startup and state.transcriber is None:
            stt_model = os.environ.get("RINN_STT_MODEL", "").strip()
            if stt_model:
                try:
                    state.transcriber = FasterWhisperTranscriber(
                        model=stt_model,
                        device=os.environ.get("RINN_STT_DEVICE", "auto"),
                        compute_type=os.environ.get("RINN_STT_COMPUTE", "default"),
                        language=os.environ.get("RINN_STT_LANGUAGE", "en") or None,
                    )
                    print(f"[rinn-voice-server] STT model '{stt_model}' ready", flush=True)
                except STTError as exc:
                    state.stt_error = str(exc)
                    print(f"[rinn-voice-server] STT FAILED: {exc}", file=sys.stderr, flush=True)
        yield

    app = FastAPI(title="rinn-voice-server", version=__version__, lifespan=lifespan)
    app.state.rinn = state

    @app.get("/health")
    def health() -> JSONResponse:
        ok = state.backend is not None
        body: dict[str, Any] = {
            "status": "ok" if ok else "error",
            "tts_backend": state.backend.name if state.backend else None,
            "voices": state.backend.voices() if state.backend else [],
            "tts_error": state.backend_error,
            "stt": state.transcriber is not None,
            "stt_error": state.stt_error,
            "version": __version__,
        }
        return JSONResponse(body, status_code=200 if ok else 503)

    @app.get("/v1/models")
    def models() -> dict[str, Any]:
        return {"object": "list", "data": [{"id": "rinn", "object": "model", "owned_by": "rinn"}, {"id": "whisper-1", "object": "model", "owned_by": "rinn"}]}

    @app.get("/v1/audio/voices")
    def voices() -> dict[str, Any]:
        if state.backend is None:
            raise HTTPException(status_code=503, detail=state.backend_error or "TTS backend not loaded")
        return {"voices": state.backend.voices()}

    @app.post("/v1/audio/speech")
    def speech(req: SpeechRequest) -> Response:
        if state.backend is None:
            raise HTTPException(status_code=503, detail=state.backend_error or "TTS backend not loaded")
        text = strip_markdown_for_speech(req.input) if req.strip_markdown else req.input.strip()
        if not text:
            raise HTTPException(status_code=400, detail="input is empty after removing formatting")
        if len(text) > MAX_INPUT_CHARS:
            raise HTTPException(status_code=413, detail=f"input longer than {MAX_INPUT_CHARS} characters; send it in sentences")
        if not 0.25 <= req.speed <= 4.0:
            raise HTTPException(status_code=400, detail="speed must be between 0.25 and 4.0")
        try:
            clip = state.backend.synthesize(text, voice=req.voice or None, speed=req.speed)
        except BackendError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        data, media = encode_audio(clip, req.response_format)
        return Response(content=data, media_type=media)

    @app.post("/v1/audio/transcriptions")
    async def transcriptions(
        request: Request,
        file: UploadFile = File(...),
        model: str = Form("whisper-1"),  # noqa: ARG001 - accepted for OpenAI compatibility
        language: Optional[str] = Form(None),  # noqa: ARG001
        response_format: str = Form("json"),
    ) -> Any:
        if state.transcriber is None:
            raise HTTPException(status_code=501, detail=state.stt_error or "speech-to-text is not enabled; start the server with --stt large-v3-turbo")
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="empty audio upload")
        clip = decode_upload(data, file.filename or "audio")
        try:
            text = state.transcriber.transcribe(clip.samples, clip.sample_rate)
        except STTError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        if response_format == "text":
            return Response(content=text, media_type="text/plain")
        return {"text": text}

    return app


# Module-level app for `uvicorn rinn.voice.server:app`; backend and STT come from the environment.
app = create_app()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="rinn-voice-server", description="OpenAI-compatible speech server for RINN (TTS + optional STT).")
    parser.add_argument("--backend", choices=BACKEND_NAMES, default=os.environ.get("RINN_TTS_BACKEND", "kokoro"), help="text-to-speech backend")
    parser.add_argument("--voice", help="default voice (kokoro voice id, e.g. af_bella / af_heart / am_michael)")
    parser.add_argument("--host", default=os.environ.get("RINN_VOICE_SERVER_HOST", "127.0.0.1"), help="bind address (0.0.0.0 to reach it from Docker/WSL)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("RINN_VOICE_SERVER_PORT", "8880")))
    parser.add_argument("--stt", metavar="MODEL", help="enable /v1/audio/transcriptions with this faster-whisper model (e.g. large-v3-turbo)")
    parser.add_argument("--stt-device", default=None, help="cuda, cpu or auto for the STT model")
    parser.add_argument("--device", help="torch device for the TTS backend (default: auto)")
    # F5-TTS
    parser.add_argument("--f5-ckpt", help="fine-tuned F5-TTS checkpoint (.pt/.safetensors)")
    parser.add_argument("--f5-vocab", help="vocab.txt matching the checkpoint")
    parser.add_argument("--f5-model", help="F5TTS_v1_Base (default) or F5TTS_Base")
    parser.add_argument("--ref-audio", help="reference clip of the target voice (F5-TTS: under 12 s)")
    parser.add_argument("--ref-text", help="exact transcript of the reference clip")
    parser.add_argument("--f5-nfe", type=int, help="F5-TTS denoising steps: 32 quality, 16 speed")
    # Qwen3-TTS
    parser.add_argument("--qwen-model", help="Qwen3-TTS checkpoint directory or hub id")
    parser.add_argument("--qwen-speaker", help="speaker name registered during Qwen3-TTS fine-tuning")
    parser.add_argument("--version", action="version", version=f"rinn-voice-server {__version__}")
    return parser


def apply_args_to_env(args: argparse.Namespace, env: dict[str, str]) -> None:
    mapping = {
        "backend": "RINN_TTS_BACKEND",
        "voice": "RINN_TTS_VOICE",
        "stt": "RINN_STT_MODEL",
        "stt_device": "RINN_STT_DEVICE",
        "device": "RINN_TTS_DEVICE",
        "f5_ckpt": "RINN_F5_CKPT",
        "f5_vocab": "RINN_F5_VOCAB",
        "f5_model": "RINN_F5_MODEL",
        "f5_nfe": "RINN_F5_NFE",
        "qwen_model": "RINN_QWEN_TTS_MODEL",
        "qwen_speaker": "RINN_QWEN_TTS_SPEAKER",
    }
    for attr, key in mapping.items():
        value = getattr(args, attr, None)
        if value is not None and value != "":
            env[key] = str(value)
    if getattr(args, "ref_audio", None):
        env["RINN_F5_REF_AUDIO"] = args.ref_audio
        env["RINN_QWEN_TTS_REF_AUDIO"] = args.ref_audio
    if getattr(args, "ref_text", None):
        env["RINN_F5_REF_TEXT"] = args.ref_text
        env["RINN_QWEN_TTS_REF_TEXT"] = args.ref_text


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    apply_args_to_env(args, os.environ)
    try:
        import uvicorn  # noqa: WPS433 - optional dependency
    except ImportError:
        print("uvicorn is not installed; run:  pip install -e \".[server]\"", file=sys.stderr)
        return 1
    print(f"[rinn-voice-server] starting on http://{args.host}:{args.port}  backend={os.environ.get('RINN_TTS_BACKEND')}  stt={os.environ.get('RINN_STT_MODEL') or 'off'}", flush=True)
    uvicorn.run("rinn.voice.server:app", host=args.host, port=args.port, log_level="info")
    return 0
