from __future__ import annotations

import io
import json
import os
from pathlib import Path

import numpy as np
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from rinn.voice.audio import AudioClip, clip_to_wav_bytes

from voicebox.assistant import SessionStore, Voicebox
from voicebox.config import VoiceboxSettings
from voicebox.knowledge import KnowledgeBase
from voicebox.server import Gate, MAX_TEXT_CHARS, MAX_UPLOAD_BYTES, ServerState, apply_args_to_env, build_parser, canonical_session, create_app, decode_audio, main, safe_filename

from .conftest import FakeLLM, FakeSpeaker, FakeTranscriber, fixed_clock, tone

KEY = "test-key-123"
AUTH = {"Authorization": f"Bearer {KEY}"}


@pytest.fixture
def parts(tmp_path: Path):
    from voicebox.knowledge import HashEmbedder

    kb = KnowledgeBase(tmp_path / "knowledge", tmp_path / "data" / "k.db", HashEmbedder(dim=128))
    llm = FakeLLM()
    speaker = FakeSpeaker()
    box = Voicebox(llm, "persona", kb, speaker, FakeTranscriber(), SessionStore(tmp_path / "data" / "s.json", 5), clock=fixed_clock())
    yield {"kb": kb, "llm": llm, "speaker": speaker, "box": box}
    kb.close()


@pytest.fixture
def client(parts):
    settings = VoiceboxSettings(knowledge_dir=parts["kb"].knowledge_dir, data_dir=parts["kb"].db_path.parent)
    app = create_app(voicebox=parts["box"], knowledge=parts["kb"], speaker=parts["speaker"], settings=settings, api_key=KEY, load_on_startup=False)
    with TestClient(app) as tc:
        yield tc


def ndjson(response) -> list[dict]:
    assert response.headers["content-type"].startswith("application/x-ndjson")
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


# -- basics ---------------------------------------------------------------------------


def test_health_and_static_pages(client: TestClient, parts):
    health = client.get("/health").json()
    assert health["status"] == "ok" and health["model"] == "qwen3.8:27b" and health["speech_server"] is True
    assert health["knowledge"] == {"documents": 0, "chunks": 0}  # no folder path without the key
    assert "warnings" not in health and "restricted" in health
    trusted = client.get("/health", headers=AUTH).json()
    assert trusted["warnings"] == [] and trusted["error"] is None and "folder" in trusted["knowledge"]
    page = client.get("/")
    assert page.status_code == 200 and "text/html" in page.headers["content-type"]
    assert "Voicebox" in page.text and "MediaRecorder" in page.text
    manifest = client.get("/manifest.webmanifest")
    assert manifest.status_code == 200 and manifest.json()["display"] == "standalone"
    assert [i["sizes"] for i in manifest.json()["icons"]] == ["192x192", "512x512"]
    for icon in ("/icon-192.png", "/icon-512.png"):
        response = client.get(icon)
        assert response.status_code == 200 and response.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_auth_required_on_protected_routes(client: TestClient):
    assert client.post("/turn", data={"text": "hi"}).status_code == 401
    assert client.get("/knowledge").status_code == 401
    assert client.post("/turn", data={"text": "hi"}, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/knowledge", headers={"X-API-Key": KEY}).status_code == 200
    assert client.get(f"/knowledge?key={KEY}").status_code == 401  # keys never travel in URLs (access logs)
    assert client.get("/health").status_code == 200  # health is public so a device can find the server


def test_gate_unit_never_touches_the_body():
    import asyncio

    state = ServerState()
    state.api_key = "k"
    inner_calls: list = []
    sent: list = []

    async def inner(scope, receive, send):
        inner_calls.append(scope.get("path", scope["type"]))

    async def receive():
        raise AssertionError("the gate must not read the body")

    async def send(message):
        sent.append(message)

    gate = Gate(inner, state)
    base = {"type": "http", "method": "POST", "path": "/turn"}
    asyncio.run(gate({**base, "headers": [(b"authorization", b"Bearer wrong"), (b"content-length", b"10")]}, receive, send))
    assert inner_calls == [] and sent[0]["status"] == 401
    sent.clear()
    asyncio.run(gate({**base, "headers": [(b"authorization", b"Bearer k"), (b"content-length", str(MAX_UPLOAD_BYTES + 1).encode())]}, receive, send))
    assert inner_calls == [] and sent[0]["status"] == 413
    sent.clear()
    asyncio.run(gate({**base, "headers": [(b"x-api-key", b"k"), (b"content-length", b"10")]}, receive, send))
    assert inner_calls == ["/turn"] and sent == []
    asyncio.run(gate({"type": "http", "method": "GET", "path": "/health", "headers": []}, receive, send))
    assert inner_calls == ["/turn", "/health"]  # public paths pass without a key
    asyncio.run(gate({"type": "lifespan"}, receive, send))
    assert len(inner_calls) == 3


def test_gate_rejects_before_parsing_body(client: TestClient, parts):
    huge = b"x" * (MAX_UPLOAD_BYTES + 10)
    # wrong key: rejected by the ASGI gate, not by the handler
    response = client.post("/turn", files={"audio": ("a.wav", huge, "audio/wav")}, headers={"Authorization": "Bearer nope"})
    assert response.status_code == 401
    # right key but oversized Content-Length: 413 without touching the transcriber
    response = client.post("/knowledge/files", files={"file": ("big.md", huge, "text/markdown")}, headers=AUTH)
    assert response.status_code == 413 and "25 MB" in response.json()["detail"]
    assert parts["kb"].sources() == []


def test_no_key_means_open(parts):
    app = create_app(voicebox=parts["box"], knowledge=parts["kb"], api_key="", load_on_startup=False)
    with TestClient(app) as tc:
        assert tc.get("/knowledge").status_code == 200


def test_not_ready_returns_503():
    app = create_app(load_on_startup=False)
    with TestClient(app) as tc:
        assert tc.get("/health").status_code == 503
        assert tc.post("/turn", data={"text": "hi"}).status_code == 503
        assert tc.get("/knowledge").status_code == 503


def _closed_port() -> int:
    import socket

    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def test_real_startup_degrades_gracefully_without_ollama_or_speech(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(tmp_path)
    for key in [k for k in os.environ if k.startswith("VOICEBOX_") or k == "OLLAMA_HOST"]:
        monkeypatch.delenv(key)
    monkeypatch.setenv("VOICEBOX_OLLAMA_HOST", f"http://127.0.0.1:{_closed_port()}")
    monkeypatch.setenv("VOICEBOX_SPEECH_URL", f"http://127.0.0.1:{_closed_port()}/v1")
    (tmp_path / "knowledge").mkdir()
    (tmp_path / "knowledge" / "wifi.md").write_text("# Wifi\n\nThe wifi password is hunter2.", encoding="utf-8")
    with TestClient(create_app()) as tc:
        health = tc.get("/health").json()
        assert health["status"] == "ok" and health["knowledge"]["documents"] == 1 and health["knowledge"]["chunks"] == 1
        assert health["knowledge"]["embedder"].startswith("hash:")  # no API key configured, so the full report is public
        warnings = " | ".join(health["warnings"])
        assert "keyword-style search" in warnings  # embedding model unreachable -> HashEmbedder fallback
        assert "speech server" in warnings  # speech server down -> text-only turns
        assert "Ollama" in warnings  # ensure_model could not reach Ollama
        assert (tmp_path / "persona.md").is_file() and (tmp_path / "data" / "knowledge.db").is_file()
        # the server answers; the model is unreachable so the turn reports it instead of crashing
        events = ndjson(tc.post("/turn", data={"text": "what is the wifi password?", "speak": "false"}))
        assert events[0]["type"] == "error" and "Ollama" in events[0]["detail"] and events[-1]["type"] == "done"
        assert tc.get("/knowledge").json()["sources"][0]["source"] == "wifi.md"


def test_startup_failure_is_reported_not_fatal(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("VOICEBOX_MODEL", "not a tag!")
    monkeypatch.chdir(tmp_path)
    with TestClient(create_app()) as tc:
        health = tc.get("/health")
        assert health.status_code == 503 and "invalid model tag" in health.json()["error"]


# -- turns -------------------------------------------------------------------------------------


def test_text_turn_streams_ndjson(client: TestClient, parts):
    response = client.post("/turn", data={"text": "What is the answer?", "session": "phone"}, headers=AUTH)
    assert response.status_code == 200
    events = ndjson(response)
    assert events[0]["type"] == "text" and events[-1]["type"] == "done"
    assert events[-1]["answer"] == "The answer is forty-two. Anything else?"
    audio = [e for e in events if e["type"] == "audio"]
    assert len(audio) == 2 and audio[0]["sample_rate"] == 24000 and audio[0]["pcm16"]
    assert response.headers["cache-control"] == "no-store"
    assert parts["box"].sessions.history("phone")


def test_speak_false_and_session_sanitised(client: TestClient, parts):
    response = client.post("/turn", data={"text": "hi", "speak": "false", "session": "my phone/ü"}, headers=AUTH)
    events = ndjson(response)
    assert all(e["type"] != "audio" for e in events)
    assert parts["box"].sessions.history("my_phone__")


def test_audio_turn_with_wav(client: TestClient, parts):
    wav = clip_to_wav_bytes(tone(1.0))
    response = client.post("/turn", files={"audio": ("turn.wav", wav, "audio/wav")}, data={"session": "pi"}, headers=AUTH)
    events = ndjson(response)
    assert events[0] == {"type": "transcript", "text": "what is the wifi password"}
    assert events[-1]["type"] == "done"


def test_turn_validation(client: TestClient):
    assert client.post("/turn", data={"session": "x"}, headers=AUTH).status_code == 400
    assert client.post("/turn", data={"text": "x" * (MAX_TEXT_CHARS + 1)}, headers=AUTH).status_code == 413
    long_wav = clip_to_wav_bytes(AudioClip(np.zeros(16000 * 121, dtype=np.float32), 16000))
    assert client.post("/turn", files={"audio": ("a.wav", long_wav, "audio/wav")}, headers=AUTH).status_code == 413
    garbage = client.post("/turn", files={"audio": ("a.bin", b"\x00\x01\x02garbage", "application/octet-stream")}, headers=AUTH)
    assert garbage.status_code == 415
    empty = client.post("/turn", files={"audio": ("a.wav", b"", "audio/wav")}, headers=AUTH)
    assert empty.status_code == 400


def test_reset_session(client: TestClient, parts):
    client.post("/turn", data={"text": "hi", "session": "phone", "speak": "false"}, headers=AUTH)
    assert client.post("/session/phone/reset", headers=AUTH).json() == {"status": "cleared", "session": "phone"}
    assert parts["box"].sessions.history("phone") == []
    # a device name with spaces is stored under its canonical form and must reset under it too
    client.post("/turn", data={"text": "hi", "session": "Jordan's phone", "speak": "false"}, headers=AUTH)
    assert parts["box"].sessions.history("Jordan_s_phone")
    assert client.post("/session/Jordan's%20phone/reset", headers=AUTH).json()["session"] == "Jordan_s_phone"
    assert parts["box"].sessions.history("Jordan_s_phone") == []
    assert canonical_session("") == "default" and canonical_session("a" * 100) == "a" * 64


# -- knowledge ---------------------------------------------------------------------------------------------


def test_knowledge_endpoints_roundtrip(client: TestClient, parts):
    kb: KnowledgeBase = parts["kb"]
    (kb.knowledge_dir / "wifi.md").write_text("# Wifi\n\nThe wifi password is hunter2.", encoding="utf-8")
    sync = client.post("/knowledge/sync", headers=AUTH).json()
    assert sync["added"] == ["wifi.md"] and sync["errors"] == {}
    listing = client.get("/knowledge", headers=AUTH).json()
    assert listing["documents"] == 1 and listing["sources"][0]["source"] == "wifi.md"

    note = client.post("/knowledge/notes", json={"text": "The garage code is 4321", "title": "Garage"}, headers=AUTH).json()
    assert note["saved"].endswith("-garage.md") and note["source"] == f"notes/{note['saved']}"
    assert client.post("/knowledge/notes", json={"text": ""}, headers=AUTH).status_code == 422

    upload = client.post("/knowledge/files", files={"file": ("Recipes (v2).md", b"# Recipes\n\nPancakes need eggs.", "text/markdown")}, headers=AUTH).json()
    assert upload == {"saved": "uploads/Recipes _v2_.md", "indexed": True, "errors": {}}  # parentheses are not in the safe set
    assert (kb.knowledge_dir / "uploads" / "Recipes _v2_.md").is_file()
    assert client.post("/knowledge/files", files={"file": ("virus.exe", b"x", "application/octet-stream")}, headers=AUTH).status_code == 415
    assert client.post("/knowledge/files", files={"file": ("empty.md", b"", "text/markdown")}, headers=AUTH).status_code == 400

    turn = ndjson(client.post("/turn", data={"text": "what is the garage code?", "speak": "false"}, headers=AUTH))
    assert turn[-1]["sources"][0] == "Garage"  # the hash embedder may also pull weak matches

    removed = client.delete(f"/knowledge/{note['source']}", headers=AUTH).json()
    assert removed == {"removed": note["source"], "existed": True}
    assert client.delete("/knowledge/nothing.md", headers=AUTH).json()["existed"] is False
    assert client.delete("/knowledge/notes/%2E%2E/%2E%2E/etc/passwd", headers=AUTH).status_code == 400
    assert client.delete("/knowledge/%2Fetc%2Fpasswd", headers=AUTH).status_code == 400
    assert client.get("/knowledge", headers=AUTH).json()["documents"] == 2


def test_sync_force_query(client: TestClient, parts):
    (parts["kb"].knowledge_dir / "a.md").write_text("alpha", encoding="utf-8")
    client.post("/knowledge/sync", headers=AUTH)
    assert client.post("/knowledge/sync?force=true", headers=AUTH).json()["updated"] == ["a.md"]


# -- helpers ----------------------------------------------------------------------------------------------------


def test_decode_audio_wav_and_soundfile_and_ffmpeg_missing(tmp_path: Path):
    clip = tone(0.5)
    decoded = decode_audio(clip_to_wav_bytes(clip), "a.wav")
    assert decoded.sample_rate == 16000 and abs(decoded.duration - 0.5) < 0.01

    sf = pytest.importorskip("soundfile")
    buffer = io.BytesIO()
    sf.write(buffer, clip.samples, 16000, format="FLAC")
    flac = decode_audio(buffer.getvalue(), "a.flac")
    assert flac.sample_rate == 16000 and len(flac.samples) == len(clip.samples)

    with pytest.raises(HTTPException) as info:
        decode_audio(b"definitely not audio", "clip.webm", ffmpeg=str(tmp_path / "no-such-ffmpeg"))
    assert info.value.status_code == 415


def test_decode_audio_uses_ffmpeg_when_present(tmp_path: Path):
    fake = tmp_path / "ffmpeg"
    wav_path = tmp_path / "out.wav"
    wav_path.write_bytes(clip_to_wav_bytes(tone(0.25)))
    fake.write_text(f"#!/bin/sh\ncat {wav_path}\n", encoding="utf-8")
    fake.chmod(0o755)
    clip = decode_audio(b"opus-ish bytes", "clip.webm", ffmpeg=str(fake))
    assert abs(clip.duration - 0.25) < 0.01
    broken = tmp_path / "ffmpeg-bad"
    broken.write_text("#!/bin/sh\necho 'Invalid data found' >&2\nexit 1\n", encoding="utf-8")
    broken.chmod(0o755)
    with pytest.raises(HTTPException) as info:
        decode_audio(b"opus-ish bytes", "clip.webm", ffmpeg=str(broken))
    assert info.value.status_code == 415 and "Invalid data" in info.value.detail


def test_safe_filename():
    assert safe_filename("../../etc/passwd") == "passwd"
    assert safe_filename("My Notes (final).md") == "My Notes _final_.md"
    assert safe_filename("") == "upload"
    assert safe_filename("..") == "upload"
    assert len(safe_filename("x" * 500 + ".md")) == 120


def test_cli_args_map_to_env():
    args = build_parser().parse_args(["--host", "0.0.0.0", "--port", "9000", "--api-key", "k", "--embed-model", ""])
    env: dict[str, str] = {}
    apply_args_to_env(args, env)
    assert env == {"VOICEBOX_HOST": "0.0.0.0", "VOICEBOX_PORT": "9000", "VOICEBOX_API_KEY": "k", "VOICEBOX_EMBED_MODEL": ""}


def test_main_refuses_public_bind_without_key(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys):
    monkeypatch.chdir(tmp_path)
    # main() writes CLI flags into the process environment; give it a private copy so nothing leaks into other tests
    monkeypatch.setattr(os, "environ", {k: v for k, v in os.environ.items() if not k.startswith("VOICEBOX_")})
    assert main(["--host", "0.0.0.0"]) == 1
    assert "API key" in capsys.readouterr().err
    assert main(["--model", "bad tag!"]) == 1
    assert "configuration error" in capsys.readouterr().err
    assert os.environ["VOICEBOX_HOST"] == "0.0.0.0"  # written to the sandboxed copy only


def test_live_server_streams_incrementally_and_stops_on_disconnect(tmp_path: Path):
    import json as _json
    import socket
    import threading
    import time

    import httpx
    import uvicorn

    from voicebox.knowledge import HashEmbedder

    text = " ".join(f"Sentence number {i} is here." for i in range(80))
    llm = FakeLLM(replies=[text], piece_size=5, delay=0.01)
    speaker = FakeSpeaker()
    kb = KnowledgeBase(tmp_path / "k", tmp_path / "k.db", HashEmbedder(dim=64))
    box = Voicebox(llm, "p", kb, speaker, None, SessionStore(None, 5))
    app = create_app(voicebox=box, knowledge=kb, speaker=speaker, api_key=KEY, load_on_startup=False)
    port = _closed_port()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", lifespan="off"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        for _ in range(300):
            if server.started:
                break
            time.sleep(0.02)
        assert server.started
        started = time.perf_counter()
        with httpx.Client(timeout=10.0) as http, http.stream("POST", f"http://127.0.0.1:{port}/turn", data={"text": "go on", "speak": "true"}, headers=AUTH) as response:
            assert response.status_code == 200
            lines = (line for line in response.iter_lines() if line.strip())
            first = _json.loads(next(lines))
            first_at = time.perf_counter() - started
            assert first["type"] == "text"
            for _ in range(3):
                next(lines)
        # leaving the blocks closes the connection: the phone walked away mid-answer
        disconnected = time.perf_counter()
        total_pieces = -(-len(text) // 5)
        assert first_at < 2.0, f"first event only after {first_at:.2f}s: the response was buffered, not streamed"
        for _ in range(600):
            if llm.aborted:
                break
            time.sleep(0.01)
        assert llm.aborted, "the model callback kept being fed after the client left"
        assert time.perf_counter() - disconnected < 6.0
        assert llm.pieces_sent < total_pieces  # generation was cut short
        synthesized = len(speaker.requests)
        time.sleep(0.2)
        assert len(speaker.requests) == synthesized and synthesized < 80  # and speech stopped with it
        assert box.sessions.history("default") == []
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        kb.close()
