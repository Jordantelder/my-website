"""``voicebox-server``: the always-on half of the assistant.

Endpoints
- ``POST /turn``              audio (any common format) or text in; NDJSON stream of events out
- ``POST /session/{id}/reset`` forget one device's conversation
- ``GET  /knowledge``         what the assistant knows (files, chunks, embedder)
- ``POST /knowledge/sync``    index new/changed files in the knowledge folder
- ``POST /knowledge/notes``   add a note ({"text": ..., "title": ...})
- ``POST /knowledge/files``   upload a .md/.txt/.pdf into the knowledge folder
- ``DELETE /knowledge/{source}`` remove a file and its index entries
- ``GET  /health``            readiness and warnings
- ``GET  /``                  the phone web app
"""
from __future__ import annotations

import argparse
import hmac
import io
import json
import os
import re
import shutil
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator, Iterator, Mapping, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from rinn.config import ConfigError
from rinn.llm import LLMError, OllamaLLM
from rinn.voice.audio import AudioClip, AudioError, to_mono_float32, wav_bytes_to_clip

from . import __version__
from .assistant import SessionStore, Voicebox
from .config import VoiceboxSettings
from .knowledge import SUPPORTED_SUFFIXES, HashEmbedder, KnowledgeBase, KnowledgeError, OllamaEmbedder
from .persona import ensure_persona_file, load_persona
from .speech import RemoteTranscriber, Speaker

WEB_DIR = Path(__file__).parent / "web"
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_UPLOAD_BYTES = MAX_AUDIO_BYTES + 64 * 1024  # request body cap: the file plus multipart framing
MAX_AUDIO_SECONDS = 120.0
MAX_TEXT_CHARS = 4000
PUBLIC_PATHS = {"/", "/health", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"}


def supplied_key(headers: Mapping[str, str]) -> str:
    value = headers.get("authorization", "")
    if value.startswith("Bearer "):
        value = value[7:]
    return (value or headers.get("x-api-key", "")).strip()


def key_ok(expected: str, headers: Mapping[str, str]) -> bool:
    if not expected:
        return True
    return hmac.compare_digest(supplied_key(headers).encode("utf-8"), expected.encode("utf-8"))


def canonical_session(raw: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.:-]", "_", raw)[:64] or "default"


class Gate:
    """Pure-ASGI guard that runs before FastAPI reads any request body.

    FastAPI parses a multipart body before dependencies (including the API-key check) run, so
    without this an unauthenticated client could push arbitrarily large uploads. Here the key
    and the declared Content-Length are checked first; the route handlers keep their own
    checks as a second line.
    """

    def __init__(self, app: Any, state: "ServerState") -> None:
        self.app = app
        self.state = state

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope["type"] == "http" and scope.get("path", "") not in PUBLIC_PATHS:
            headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
            if not key_ok(self.state.api_key, headers):
                await self._reject(send, 401, "missing or wrong API key")
                return
            length = headers.get("content-length")
            if length and length.isdigit() and int(length) > MAX_UPLOAD_BYTES:
                await self._reject(send, 413, "request body too large (25 MB limit)")
                return
        await self.app(scope, receive, send)

    @staticmethod
    async def _reject(send: Any, status: int, detail: str) -> None:
        body = json.dumps({"detail": detail}).encode("utf-8")
        await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})


class NoteIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)
    title: Optional[str] = Field(None, max_length=200)


class ServerState:
    def __init__(self) -> None:
        self.settings: VoiceboxSettings | None = None
        self.voicebox: Voicebox | None = None
        self.knowledge: KnowledgeBase | None = None
        self.speaker: Speaker | None = None
        self.api_key = ""
        self.warnings: list[str] = []
        self.startup_error: str | None = None


def decode_audio(data: bytes, filename: str, ffmpeg: Optional[str] = None) -> AudioClip:
    """WAV natively; other formats via soundfile, then ffmpeg (browser recordings are webm/opus or mp4)."""
    try:
        return wav_bytes_to_clip(data)
    except AudioError:
        pass
    try:
        import soundfile as sf  # noqa: WPS433 - optional dependency

        samples, rate = sf.read(io.BytesIO(data), dtype="float32", always_2d=False)
        return AudioClip(to_mono_float32(samples), int(rate))
    except Exception:  # noqa: BLE001 - fall through to ffmpeg
        pass
    ffmpeg = ffmpeg or shutil.which("ffmpeg")
    if not ffmpeg:
        raise HTTPException(status_code=415, detail=f"cannot decode {filename!r}; install ffmpeg on the server or send WAV")
    try:
        proc = subprocess.run(
            [ffmpeg, "-nostdin", "-loglevel", "error", "-i", "pipe:0", "-f", "wav", "-ac", "1", "-ar", "16000", "pipe:1"],
            input=data, capture_output=True, timeout=60, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise HTTPException(status_code=415, detail=f"ffmpeg failed on {filename!r}: {exc}") from exc
    if proc.returncode != 0 or not proc.stdout:
        raise HTTPException(status_code=415, detail=f"ffmpeg could not decode {filename!r}: {proc.stderr.decode(errors='replace')[:200]}")
    return wav_bytes_to_clip(proc.stdout)


def safe_filename(name: str) -> str:
    base = Path(name or "upload").name
    base = re.sub(r"[^A-Za-z0-9._ -]+", "_", base).strip(" .") or "upload"
    return base[:120]


def build_embedder(settings: VoiceboxSettings, warnings: list[str]):
    if not settings.embed_model:
        warnings.append("VOICEBOX_EMBED_MODEL is blank: keyword-style search only")
        return HashEmbedder()
    try:
        return OllamaEmbedder(settings.embed_model, settings.ollama_host)
    except KnowledgeError as exc:
        warnings.append(f"{exc}; using keyword-style search until it is available")
        return HashEmbedder()


def create_app(
    voicebox: Voicebox | None = None,
    knowledge: KnowledgeBase | None = None,
    speaker: Speaker | None = None,
    settings: VoiceboxSettings | None = None,
    api_key: str | None = None,
    load_on_startup: bool = True,
) -> FastAPI:
    state = ServerState()
    state.voicebox, state.knowledge, state.speaker, state.settings = voicebox, knowledge, speaker, settings
    env_key = os.environ.get("VOICEBOX_API_KEY", "").strip()
    state.api_key = (api_key if api_key is not None else (settings.api_key if settings else env_key)).strip()

    def authorize(request: Request) -> None:
        if not key_ok(state.api_key, request.headers):
            raise HTTPException(status_code=401, detail="missing or wrong API key")

    protected = [Depends(authorize)]

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if load_on_startup and state.voicebox is None:
            try:
                _startup(state)
            except (ConfigError, LLMError, KnowledgeError, OSError) as exc:
                state.startup_error = str(exc)
                print(f"[voicebox-server] startup FAILED: {exc}", file=sys.stderr, flush=True)
        yield

    app = FastAPI(title="voicebox", version=__version__, lifespan=lifespan)
    app.state.voicebox = state
    app.add_middleware(Gate, state=state)

    def ready() -> Voicebox:
        if state.voicebox is None:
            raise HTTPException(status_code=503, detail=state.startup_error or "server is still starting")
        return state.voicebox

    def kb() -> KnowledgeBase:
        if state.knowledge is None:
            raise HTTPException(status_code=503, detail="knowledge base not available")
        return state.knowledge

    @app.get("/health")
    def health(request: Request) -> JSONResponse:
        """Public readiness check. Folder paths, warnings and error text appear only with the API key."""
        ok = state.voicebox is not None
        speech_ok = state.speaker.health() if state.speaker is not None else None
        trusted = key_ok(state.api_key, request.headers)
        stats = state.knowledge.stats() if state.knowledge else None
        body: dict[str, Any] = {
            "status": "ok" if ok else "error",
            "version": __version__,
            "model": state.settings.model if state.settings else None,
            "speech_server": speech_ok,
            "knowledge": (stats if trusted else {k: v for k, v in stats.items() if k in ("documents", "chunks")}) if stats else None,
        }
        if trusted:
            body["warnings"] = state.warnings
            body["error"] = state.startup_error
        else:
            body["restricted"] = "send the API key to see warnings, errors and the knowledge folder"
        return JSONResponse(body, status_code=200 if ok else 503)

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(WEB_DIR / "index.html", media_type="text/html")

    @app.get("/manifest.webmanifest")
    def manifest() -> FileResponse:
        return FileResponse(WEB_DIR / "manifest.webmanifest", media_type="application/manifest+json")

    @app.get("/icon-192.png")
    def icon_192() -> FileResponse:
        return FileResponse(WEB_DIR / "icon-192.png", media_type="image/png")

    @app.get("/icon-512.png")
    def icon_512() -> FileResponse:
        return FileResponse(WEB_DIR / "icon-512.png", media_type="image/png")

    @app.post("/turn", dependencies=protected)
    def turn(
        audio: Optional[UploadFile] = File(None),
        text: Optional[str] = Form(None),
        session: str = Form("default"),
        speak: bool = Form(True),
    ) -> StreamingResponse:
        box = ready()
        clip: AudioClip | None = None
        if text is not None and len(text) > MAX_TEXT_CHARS:
            raise HTTPException(status_code=413, detail=f"text longer than {MAX_TEXT_CHARS} characters")
        if audio is not None:
            data = audio.file.read(MAX_AUDIO_BYTES + 1)
            if len(data) > MAX_AUDIO_BYTES:
                raise HTTPException(status_code=413, detail="audio upload too large")
            if data:
                clip = decode_audio(data, audio.filename or "audio")
                if clip.duration > MAX_AUDIO_SECONDS:
                    raise HTTPException(status_code=413, detail=f"audio longer than {int(MAX_AUDIO_SECONDS)} seconds")
        if clip is None and not (text or "").strip():
            raise HTTPException(status_code=400, detail="send an audio file or a text field")
        session_id = canonical_session(session)

        def events() -> Iterator[bytes]:
            for event in box.turn(session_id, audio=clip, text=text, speak=speak):
                yield (event.to_json() + "\n").encode("utf-8")

        return StreamingResponse(events(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})

    @app.post("/session/{session_id}/reset", dependencies=protected)
    def reset(session_id: str) -> dict[str, str]:
        canonical = canonical_session(session_id)
        ready().sessions.reset(canonical)
        return {"status": "cleared", "session": canonical}

    @app.get("/knowledge", dependencies=protected)
    def knowledge_index() -> dict[str, Any]:
        base = kb()
        return {**base.stats(), "sources": base.sources()}

    @app.post("/knowledge/sync", dependencies=protected)
    def knowledge_sync(force: bool = False) -> dict[str, Any]:
        report = kb().sync(force=force)
        return {"added": report.added, "updated": report.updated, "removed": report.removed, "unchanged": report.unchanged, "errors": report.errors, "reindexed_all": report.reindexed_all}

    @app.post("/knowledge/notes", dependencies=protected)
    def knowledge_note(note: NoteIn) -> dict[str, str]:
        try:
            path = kb().add_note(note.text, title=note.title)
        except (KnowledgeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"saved": path.name, "source": path.relative_to(kb().knowledge_dir).as_posix()}

    @app.post("/knowledge/files", dependencies=protected)
    def knowledge_upload(file: UploadFile = File(...)) -> dict[str, Any]:
        base = kb()
        name = safe_filename(file.filename or "")
        if Path(name).suffix.lower() not in SUPPORTED_SUFFIXES:
            raise HTTPException(status_code=415, detail=f"unsupported file type; use one of {', '.join(SUPPORTED_SUFFIXES)}")
        data = file.file.read(MAX_AUDIO_BYTES + 1)
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="file too large (25 MB limit)")
        if not data:
            raise HTTPException(status_code=400, detail="empty file")
        target_dir = base.knowledge_dir / "uploads"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / name
        target.write_bytes(data)
        report = base.sync()
        source = target.relative_to(base.knowledge_dir).as_posix()
        return {"saved": source, "indexed": source in report.added or source in report.updated, "errors": report.errors}

    @app.delete("/knowledge/{source:path}", dependencies=protected)
    def knowledge_delete(source: str) -> dict[str, Any]:
        try:
            existed = kb().remove(source)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"removed": source, "existed": existed}

    return app


def _startup(state: ServerState) -> None:
    settings = state.settings or VoiceboxSettings.from_env()
    state.settings = settings
    state.api_key = state.api_key or settings.api_key
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    persona_path = ensure_persona_file(settings.persona_file)
    persona = load_persona(persona_path)

    llm = OllamaLLM(settings.engine_settings())
    try:
        llm.ensure_model()
    except LLMError as exc:
        state.warnings.append(str(exc))

    embedder = build_embedder(settings, state.warnings)
    knowledge = KnowledgeBase(settings.knowledge_dir, settings.data_dir / "knowledge.db", embedder)
    report = knowledge.sync()
    print(f"[voicebox-server] knowledge: {knowledge.stats()} (added {len(report.added)}, updated {len(report.updated)}, removed {len(report.removed)}, errors {len(report.errors)})", flush=True)
    for source, error in report.errors.items():
        state.warnings.append(f"{source}: {error}")

    speaker = Speaker(settings.speech_url, settings.voice, model=settings.tts_model, api_key=settings.speech_api_key, timeout=settings.speech_timeout)
    if not speaker.health():
        state.warnings.append(f"speech server at {settings.speech_url} is not answering; turns will be text-only until it is up")
    transcriber = RemoteTranscriber(settings.speech_url, api_key=settings.speech_api_key, timeout=settings.speech_timeout)
    sessions = SessionStore(settings.data_dir / "sessions.json", settings.max_history_turns)

    state.knowledge = knowledge
    state.speaker = speaker
    state.voicebox = Voicebox(llm, persona, knowledge, speaker, transcriber, sessions, top_k=settings.top_k, voice=settings.voice)
    print(f"[voicebox-server] ready: model={settings.model} voice={settings.voice} persona={persona_path} api_key={'set' if state.api_key else 'OFF (loopback only)'}", flush=True)


app = create_app()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="voicebox-server", description="Voicebox: the always-on server for the handheld and phone clients.")
    parser.add_argument("--host", help="bind address (default VOICEBOX_HOST or 127.0.0.1; use 0.0.0.0 with an API key to reach it from devices)")
    parser.add_argument("--port", type=int, help="port (default VOICEBOX_PORT or 8800)")
    parser.add_argument("--api-key", help="require this key from clients (default VOICEBOX_API_KEY)")
    parser.add_argument("--model", help="Ollama model tag (default VOICEBOX_MODEL or qwen3.8:27b)")
    parser.add_argument("--voice", help="voice id on the speech server (default VOICEBOX_VOICE or af_heart)")
    parser.add_argument("--speech-url", help="speech server base URL (default http://127.0.0.1:8880/v1)")
    parser.add_argument("--knowledge-dir", help="folder of notes and documents (default ./knowledge)")
    parser.add_argument("--persona", help="persona Markdown file (default ./persona.md)")
    parser.add_argument("--embed-model", help="Ollama embedding model; empty string for keyword-only search")
    parser.add_argument("--version", action="version", version=f"voicebox {__version__}")
    return parser


def apply_args_to_env(args: argparse.Namespace, env: dict[str, str]) -> None:
    mapping = {
        "host": "VOICEBOX_HOST", "port": "VOICEBOX_PORT", "api_key": "VOICEBOX_API_KEY", "model": "VOICEBOX_MODEL",
        "voice": "VOICEBOX_VOICE", "speech_url": "VOICEBOX_SPEECH_URL", "knowledge_dir": "VOICEBOX_KNOWLEDGE_DIR",
        "persona": "VOICEBOX_PERSONA_FILE", "embed_model": "VOICEBOX_EMBED_MODEL",
    }
    for attr, key in mapping.items():
        value = getattr(args, attr, None)
        if value is not None:
            env[key] = str(value)


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    apply_args_to_env(args, os.environ)
    try:
        settings = VoiceboxSettings.from_env()
    except ConfigError as exc:
        print(f"configuration error: {exc}", file=sys.stderr)
        return 1
    try:
        import uvicorn  # noqa: WPS433
    except ImportError:
        print("uvicorn is not installed; run:  pip install -e .", file=sys.stderr)
        return 1
    if settings.host not in ("127.0.0.1", "localhost", "::1") and not settings.api_key:
        print("refusing to listen on a non-loopback address without an API key; set VOICEBOX_API_KEY or --api-key", file=sys.stderr)
        return 1
    print(f"[voicebox-server] starting on http://{settings.host}:{settings.port}", flush=True)
    uvicorn.run("voicebox.server:app", host=settings.host, port=settings.port, log_level="info")
    return 0
