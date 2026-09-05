from __future__ import annotations

import io
import json
from pathlib import Path

import httpx
import pytest

from voicebox import cli


def install_transport(monkeypatch: pytest.MonkeyPatch, handler):
    seen: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        request.read()
        seen.append(request)
        return handler(request)

    def fake_client(url: str, key: str) -> httpx.Client:
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        return httpx.Client(base_url=url.rstrip("/"), headers=headers, transport=httpx.MockTransport(wrapped))

    monkeypatch.setattr(cli, "_client", fake_client)
    return seen


def test_health_list_sync_reset(monkeypatch: pytest.MonkeyPatch):
    seen = install_transport(monkeypatch, lambda r: httpx.Response(200, json={"ok": True, "path": r.url.path, "query": str(r.url.query, "ascii")}))
    out = io.StringIO()
    assert cli.main(["--url", "http://box:8800/", "--api-key", "k", "health"], out=out) == 0
    assert json.loads(out.getvalue())["path"] == "/health"
    assert seen[0].headers["authorization"] == "Bearer k"
    for argv, path in ([["list"], "/knowledge"], [["sync", "--force"], "/knowledge/sync"], [["reset", "--session", "pi"], "/session/pi/reset"]):
        out = io.StringIO()
        assert cli.main(["--url", "http://box:8800", *argv], out=out) == 0
        assert json.loads(out.getvalue())["path"] == path
    assert "force=true" in json.loads(out.getvalue())["query"] or seen[-2].url.query == b"force=true"


def test_note_upload_remove(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    seen = install_transport(monkeypatch, lambda r: httpx.Response(200, json={"method": r.method, "path": r.url.path}))
    out = io.StringIO()
    assert cli.main(["note", "the garage code is 4321", "--title", "Garage"], out=out) == 0
    assert json.loads(seen[0].content) == {"text": "the garage code is 4321", "title": "Garage"}
    doc = tmp_path / "manual.md"
    doc.write_text("# Manual\n\nhello", encoding="utf-8")
    assert cli.main(["upload", str(doc)], out=io.StringIO()) == 0
    assert seen[1].url.path == "/knowledge/files" and b'filename="manual.md"' in seen[1].content
    assert cli.main(["remove", "uploads/manual.md"], out=io.StringIO()) == 0
    assert seen[2].method == "DELETE" and seen[2].url.path == "/knowledge/uploads/manual.md"


def test_ask_streams_text_and_sources(monkeypatch: pytest.MonkeyPatch):
    events = [{"type": "text", "text": "It is "}, {"type": "text", "text": "4321."}, {"type": "error", "detail": "speech failed"}, {"type": "done", "answer": "It is 4321.", "sources": ["Garage"]}]
    body = "".join(json.dumps(e) + "\n" for e in events)
    seen = install_transport(monkeypatch, lambda r: httpx.Response(200, content=body.encode(), headers={"content-type": "application/x-ndjson"}))
    out = io.StringIO()
    assert cli.main(["ask", "what is the garage code?", "--session", "desk"], out=out) == 0
    assert out.getvalue() == "[problem: speech failed]\nIt is 4321.\n(notes consulted: Garage)\n"
    assert b"speak=false" in seen[0].content and b"session=desk" in seen[0].content


def test_error_statuses_and_unreachable(monkeypatch: pytest.MonkeyPatch):
    install_transport(monkeypatch, lambda r: httpx.Response(401, json={"detail": "missing or wrong API key"}))
    out = io.StringIO()
    assert cli.main(["list"], out=out) == 1 and "error 401" in out.getvalue()
    out = io.StringIO()
    assert cli.main(["ask", "hi"], out=out) == 1 and "error 401" in out.getvalue()

    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    install_transport(monkeypatch, refuse)
    out = io.StringIO()
    assert cli.main(["--url", "http://box:8800", "health"], out=out) == 2
    assert "cannot reach the server at http://box:8800" in out.getvalue()


def test_api_key_comes_from_dotenv_in_the_current_folder(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("VOICEBOX_API_KEY", raising=False)
    monkeypatch.delenv("VOICEBOX_URL", raising=False)
    (tmp_path / ".env").write_text("VOICEBOX_API_KEY=from-dotenv\nVOICEBOX_PORT=8800\n", encoding="utf-8")
    seen = install_transport(monkeypatch, lambda r: httpx.Response(200, json={}))
    assert cli.main(["health"], out=io.StringIO()) == 0
    assert seen[0].headers["authorization"] == "Bearer from-dotenv"
    monkeypatch.setenv("VOICEBOX_API_KEY", "from-env")  # the environment wins over the file
    assert cli.main(["health"], out=io.StringIO()) == 0
    assert seen[1].headers["authorization"] == "Bearer from-env"


def test_requires_a_command(capsys):
    with pytest.raises(SystemExit):
        cli.main([])
