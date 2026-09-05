"""``voicebox``: manage what the assistant knows, from any machine that can reach the server."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional, TextIO

import httpx
from dotenv import dotenv_values

from . import __version__


def _setting(name: str, default: str) -> str:
    """Environment first, then the .env file in the current folder (the server's own settings)."""
    value = os.environ.get(name, "").strip()
    if value:
        return value
    dotenv = Path.cwd() / ".env"
    if dotenv.is_file():
        value = (dotenv_values(dotenv).get(name) or "").strip()
        if value:
            return value
    return default


def _client(url: str, key: str) -> httpx.Client:
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    return httpx.Client(base_url=url.rstrip("/"), headers=headers, timeout=httpx.Timeout(300.0, connect=5.0))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="voicebox", description="Talk to a running Voicebox server: knowledge, notes, health, text questions.")
    parser.add_argument("--url", default=_setting("VOICEBOX_URL", "http://127.0.0.1:8800"), help="server URL (default VOICEBOX_URL, or http://127.0.0.1:8800)")
    parser.add_argument("--api-key", default=_setting("VOICEBOX_API_KEY", ""), help="server API key (default VOICEBOX_API_KEY from the environment or the .env file in the current folder)")
    parser.add_argument("--version", action="version", version=f"voicebox {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("health", help="server status")
    sub.add_parser("list", help="files the assistant knows")
    sync = sub.add_parser("sync", help="index new or changed files in the knowledge folder")
    sync.add_argument("--force", action="store_true", help="re-index everything")
    note = sub.add_parser("note", help="save a note")
    note.add_argument("text")
    note.add_argument("--title")
    upload = sub.add_parser("upload", help="upload a .md/.txt/.pdf into the knowledge folder")
    upload.add_argument("path")
    remove = sub.add_parser("remove", help="delete a knowledge file by its source path (see list)")
    remove.add_argument("source")
    ask = sub.add_parser("ask", help="ask a typed question and print the answer")
    ask.add_argument("question")
    ask.add_argument("--session", default="cli")
    reset = sub.add_parser("reset", help="forget a session's conversation")
    reset.add_argument("--session", default="cli")
    return parser


def main(argv: Optional[list[str]] = None, out: TextIO = sys.stdout) -> int:
    args = build_parser().parse_args(argv)
    try:
        with _client(args.url, args.api_key) as client:
            if args.command == "health":
                response = client.get("/health")
            elif args.command == "list":
                response = client.get("/knowledge")
            elif args.command == "sync":
                response = client.post("/knowledge/sync", params={"force": "true" if args.force else "false"})
            elif args.command == "note":
                response = client.post("/knowledge/notes", json={"text": args.text, "title": args.title})
            elif args.command == "upload":
                path = Path(args.path).expanduser()
                with path.open("rb") as handle:
                    response = client.post("/knowledge/files", files={"file": (path.name, handle, "application/octet-stream")})
            elif args.command == "remove":
                response = client.delete(f"/knowledge/{args.source}")
            elif args.command == "reset":
                response = client.post(f"/session/{args.session}/reset")
            elif args.command == "ask":
                answer = []
                with client.stream("POST", "/turn", data={"text": args.question, "session": args.session, "speak": "false"}) as stream:
                    if stream.status_code >= 400:
                        print(f"error {stream.status_code}: {stream.read().decode(errors='replace')[:300]}", file=out)
                        return 1
                    for line in stream.iter_lines():
                        if not line.strip():
                            continue
                        event = json.loads(line)
                        if event.get("type") == "text":
                            answer.append(event["text"])
                        elif event.get("type") == "error":
                            print(f"[problem: {event.get('detail')}]", file=out)
                        elif event.get("type") == "done" and event.get("sources"):
                            answer.append(f"\n(notes consulted: {', '.join(event['sources'])})")
                print("".join(answer), file=out)
                return 0
            else:  # pragma: no cover
                return 1
            if response.status_code >= 400:
                print(f"error {response.status_code}: {response.text[:300]}", file=out)
                return 1
            print(json.dumps(response.json(), indent=2), file=out)
            return 0
    except httpx.HTTPError as exc:
        print(f"cannot reach the server at {args.url}: {exc}", file=out)
        return 2
