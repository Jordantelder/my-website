"""The knowledge base: a folder of files the assistant can draw on.

Every source of knowledge is a file under the knowledge folder (``.md``, ``.txt``, ``.pdf``).
``sync`` indexes new and changed files and forgets deleted ones; ``add_note`` writes a new
Markdown file for something the owner said or typed and indexes it. Retrieval is embedding
similarity (Ollama embeddings) with a small keyword boost; when no embedding model is
available a deterministic hashing embedder keeps keyword-style search working.
"""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable, Optional, Protocol, Sequence

import numpy as np

SUPPORTED_SUFFIXES = (".md", ".markdown", ".txt", ".text", ".pdf")


class KnowledgeError(RuntimeError):
    """Indexing or embedding failure."""


class Embedder(Protocol):
    name: str
    dim: int
    min_score: float  # below this a chunk is not worth showing the model

    def embed(self, texts: Sequence[str]) -> list[list[float]]: ...


# Dense embedders give unrelated English text a cosine of 0.3 to 0.5, so the floor must be
# much higher than for the sparse hash embedder, where unrelated text scores near 0.
DENSE_MIN_SCORE = 0.45
HASH_MIN_SCORE = 0.05
# Hits far below the best hit are noise even when they clear the floor.
MAX_GAP_BELOW_BEST = 0.12


class HashEmbedder:
    """Deterministic bag-of-words embedder: no model needed, behaves like keyword search."""

    def __init__(self, dim: int = 512) -> None:
        self.dim = dim
        self.name = f"hash:{dim}"
        self.min_score = HASH_MIN_SCORE

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        out = []
        for text in texts:
            vec = np.zeros(self.dim, dtype=np.float32)
            tokens = _tokens(text)
            for tok in tokens:
                vec[_bucket(tok, self.dim)] += 1.0
            for a, b in zip(tokens, tokens[1:]):
                vec[_bucket(f"{a} {b}", self.dim)] += 0.5
            norm = float(np.linalg.norm(vec))
            out.append((vec / norm).tolist() if norm else vec.tolist())
        return out


class OllamaEmbedder:
    """Embeddings from a local Ollama model such as nomic-embed-text."""

    def __init__(self, model: str, host: str, client=None, batch_size: int = 32) -> None:
        import ollama  # noqa: WPS433 - imported here so tests can use fakes without Ollama

        self.model = model
        self.batch_size = batch_size
        self._client = client if client is not None else ollama.Client(host=host)
        self.name = f"ollama:{model}"
        self.min_score = DENSE_MIN_SCORE
        self.dim = 0
        self.dim = len(self.embed(["dimension probe"])[0])
        self.name = f"ollama:{model}:{self.dim}"

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        import ollama  # noqa: WPS433

        vectors: list[list[float]] = []
        for start in range(0, len(texts), self.batch_size):
            batch = list(texts[start : start + self.batch_size])
            try:
                response = self._client.embed(model=self.model, input=batch)
            except ollama.ResponseError as exc:
                message = str(exc.error)
                if "not found" in message.lower():
                    raise KnowledgeError(f"embedding model {self.model!r} is not available; run:  ollama pull {self.model}") from exc
                raise KnowledgeError(f"embedding failed: {message}") from exc
            except Exception as exc:  # noqa: BLE001 - connection errors from httpx
                raise KnowledgeError(f"cannot reach Ollama for embeddings ({exc.__class__.__name__}: {exc})") from exc
            vectors.extend([list(map(float, v)) for v in response.embeddings])
        return vectors


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9][a-z0-9'\-]*", text.lower()) if len(t) >= 2]


def _bucket(token: str, dim: int) -> int:
    return int.from_bytes(hashlib.blake2b(token.encode("utf-8"), digest_size=4).digest(), "big") % dim


def chunk_text(text: str, size: int = 900, overlap: int = 150) -> list[str]:
    """Split text into chunks of about ``size`` characters, preferring paragraph boundaries."""
    if size <= overlap:
        raise ValueError("size must be larger than overlap")
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if len(para) > size:
            if current:
                chunks.append(current)
                current = ""
            start = 0
            while start < len(para):
                end = min(len(para), start + size)
                if end < len(para):
                    cut = para.rfind(" ", start + size // 2, end)
                    if cut != -1:
                        end = cut
                chunks.append(para[start:end].strip())
                if end >= len(para):
                    break
                start = max(end - overlap, start + 1)
            continue
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) > size and current:
            chunks.append(current)
            tail = current[-overlap:] if overlap else ""
            current = f"{tail}\n\n{para}".strip() if tail else para
        else:
            current = candidate
    if current:
        chunks.append(current)
    return [c for c in chunks if c]


def read_document(path: Path) -> str:
    """Plain text of a supported file; PDFs need pypdf."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader  # noqa: WPS433 - optional dependency
        except ImportError as exc:
            raise KnowledgeError("PDF support needs the 'pypdf' package: pip install pypdf") from exc
        try:
            reader = PdfReader(str(path))
            return "\n\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as exc:  # noqa: BLE001
            raise KnowledgeError(f"cannot read PDF {path.name}: {exc}") from exc
    return path.read_text(encoding="utf-8", errors="replace")


def title_for(path: Path, text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip().lstrip("#").strip()
        if stripped:
            return stripped[:120]
    return path.stem.replace("_", " ").replace("-", " ")


@dataclass(frozen=True)
class Hit:
    source: str
    title: str
    text: str
    score: float


@dataclass
class SyncReport:
    added: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)
    unchanged: int = 0
    skipped: list[str] = field(default_factory=list)
    errors: dict[str, str] = field(default_factory=dict)
    reindexed_all: bool = False

    @property
    def changed(self) -> bool:
        return bool(self.added or self.updated or self.removed)


class KnowledgeBase:
    def __init__(self, knowledge_dir: Path, db_path: Path, embedder: Embedder, chunk_size: int = 900, chunk_overlap: int = 150) -> None:
        self.knowledge_dir = Path(knowledge_dir)
        self.db_path = Path(db_path)
        self.embedder = embedder
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.knowledge_dir.mkdir(parents=True, exist_ok=True)
        (self.knowledge_dir / "notes").mkdir(exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._db.execute("PRAGMA journal_mode=WAL")
        # One connection shared by the server's worker threads: every public method takes this lock
        # so a sync or note write never interleaves with a search.
        self._lock = threading.RLock()
        self._init_schema()

    # -- schema ----------------------------------------------------------------

    def _init_schema(self) -> None:
        self._db.executescript(
            """
            CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS documents (
                source TEXT PRIMARY KEY, title TEXT NOT NULL, sha256 TEXT NOT NULL,
                chunks INTEGER NOT NULL, indexed_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, ord INTEGER NOT NULL,
                title TEXT NOT NULL, text TEXT NOT NULL, embedding BLOB NOT NULL);
            CREATE INDEX IF NOT EXISTS chunks_source ON chunks(source);
            """
        )
        self._db.commit()

    def _meta(self, key: str) -> Optional[str]:
        row = self._db.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def _set_meta(self, key: str, value: str) -> None:
        self._db.execute("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", (key, value))

    # -- files -----------------------------------------------------------------

    def _files(self) -> list[Path]:
        """Every supported file under the folder, except hidden files and the folder's own README."""
        return sorted(
            p for p in self.knowledge_dir.rglob("*")
            if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES and not p.name.startswith(".")
            and not (p.parent == self.knowledge_dir and p.stem.lower() == "readme")
        )

    def _source_of(self, path: Path) -> str:
        return path.relative_to(self.knowledge_dir).as_posix()

    def sync(self, force: bool = False) -> SyncReport:
        """Index new/changed files, forget deleted ones. Re-indexes everything if the embedder changed."""
        with self._lock:
            report = SyncReport()
            if self._meta("embedder") != self.embedder.name:
                self._db.execute("DELETE FROM chunks")
                self._db.execute("DELETE FROM documents")
                self._set_meta("embedder", self.embedder.name)
                self._db.commit()
                report.reindexed_all = True
            known = {row[0]: row[1] for row in self._db.execute("SELECT source, sha256 FROM documents")}
            seen: set[str] = set()
            for path in self._files():
                source = self._source_of(path)
                seen.add(source)
                try:
                    data = path.read_bytes()
                except OSError as exc:
                    report.errors[source] = str(exc)
                    continue
                digest = hashlib.sha256(data).hexdigest()
                if not force and known.get(source) == digest:
                    report.unchanged += 1
                    continue
                try:
                    self._index_file(path, source, digest)
                except KnowledgeError as exc:
                    report.errors[source] = str(exc)
                    continue
                (report.updated if source in known else report.added).append(source)
            for source in set(known) - seen:
                self._forget(source)
                report.removed.append(source)
            self._db.commit()
            return report

    def _index_file(self, path: Path, source: str, digest: str) -> None:
        text = read_document(path)
        chunks = chunk_text(text, self.chunk_size, self.chunk_overlap)
        title = title_for(path, text)
        self._db.execute("DELETE FROM chunks WHERE source = ?", (source,))
        if chunks:
            vectors = self.embedder.embed(chunks)
            self._db.executemany(
                "INSERT INTO chunks(source, ord, title, text, embedding) VALUES (?, ?, ?, ?, ?)",
                [(source, i, title, chunk, np.asarray(vec, dtype=np.float32).tobytes()) for i, (chunk, vec) in enumerate(zip(chunks, vectors))],
            )
        self._db.execute(
            "INSERT OR REPLACE INTO documents(source, title, sha256, chunks, indexed_at) VALUES (?, ?, ?, ?, ?)",
            (source, title, digest, len(chunks), datetime.now().isoformat(timespec="seconds")),
        )

    def _forget(self, source: str) -> None:
        self._db.execute("DELETE FROM chunks WHERE source = ?", (source,))
        self._db.execute("DELETE FROM documents WHERE source = ?", (source,))

    def add_note(self, text: str, title: Optional[str] = None, clock: Callable[[], datetime] = datetime.now) -> Path:
        """Save a note as a Markdown file under knowledge/notes and index it."""
        with self._lock:
            text = text.strip()
            if not text:
                raise ValueError("note text must not be empty")
            stamp = clock()
            title = (title or " ".join(text.split()[:8])).strip()
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40] or "note"
            path = self.knowledge_dir / "notes" / f"{stamp:%Y-%m-%d-%H%M%S}-{slug}.md"
            counter = 1
            while path.exists():
                path = path.with_name(f"{stamp:%Y-%m-%d-%H%M%S}-{slug}-{counter}.md")
                counter += 1
            path.write_text(f"# {title}\n\n{text}\n\nSaved {stamp:%Y-%m-%d %H:%M}.\n", encoding="utf-8")
            source = self._source_of(path)
            self._index_file(path, source, hashlib.sha256(path.read_bytes()).hexdigest())
            self._db.commit()
            return path

    def resolve_source(self, source: str) -> Path:
        """Path of a source inside the knowledge folder; ValueError if it would escape it."""
        candidate = Path(source)
        if not source.strip() or candidate.anchor or ".." in candidate.parts:
            raise ValueError("invalid source path")
        root = self.knowledge_dir.resolve()
        target = (self.knowledge_dir / candidate).resolve()
        if not target.is_relative_to(root) or target == root:
            raise ValueError("invalid source path")
        return target

    def remove(self, source: str) -> bool:
        """Delete a source file and its index entries. Returns False if unknown; ValueError if the path is not inside the folder."""
        with self._lock:
            path = self.resolve_source(source)
            existed = path.is_file()
            if existed:
                path.unlink()
            self._forget(source)
            self._db.commit()
            return existed

    # -- retrieval -------------------------------------------------------------

    def search(self, query: str, k: int = 4, min_score: Optional[float] = None, max_gap: float = MAX_GAP_BELOW_BEST) -> list[Hit]:
        """Up to ``k`` chunks worth showing the model: above the embedder's floor and not far below the best hit."""
        if min_score is None:
            min_score = getattr(self.embedder, "min_score", HASH_MIN_SCORE)
        with self._lock:
            query = query.strip()
            if not query:
                return []
            rows = self._db.execute("SELECT source, title, text, embedding FROM chunks").fetchall()
            if not rows:
                return []
            matrix = np.vstack([np.frombuffer(row[3], dtype=np.float32) for row in rows])
            q = np.asarray(self.embedder.embed([query])[0], dtype=np.float32)
            if matrix.shape[1] != q.shape[0]:
                raise KnowledgeError("index was built with a different embedding model; run sync to rebuild")
            norms = np.linalg.norm(matrix, axis=1) * (np.linalg.norm(q) or 1.0)
            cosine = (matrix @ q) / np.where(norms == 0, 1.0, norms)
            terms = {t for t in _tokens(query) if len(t) > 3}
            scores = []
            for i, row in enumerate(rows):
                lexical = 0.0
                if terms:
                    chunk_terms = set(_tokens(row[2]))
                    lexical = len(terms & chunk_terms) / len(terms)
                scores.append(float(cosine[i]) + 0.15 * lexical)
            order = np.argsort(scores)[::-1]
            hits: list[Hit] = []
            best = scores[order[0]] if len(order) else 0.0
            for i in order:
                if scores[i] < min_score or scores[i] < best - max_gap:
                    break
                hits.append(Hit(source=rows[i][0], title=rows[i][1], text=rows[i][2], score=round(scores[i], 4)))
                if len(hits) >= k:
                    break
            return hits

    def sources(self) -> list[dict]:
        with self._lock:
            return [
                {"source": row[0], "title": row[1], "chunks": row[2], "indexed_at": row[3]}
                for row in self._db.execute("SELECT source, title, chunks, indexed_at FROM documents ORDER BY source")
            ]

    def stats(self) -> dict:
        with self._lock:
            docs = self._db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
            chunks = self._db.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
            return {"documents": docs, "chunks": chunks, "embedder": self.embedder.name, "folder": str(self.knowledge_dir)}

    def close(self) -> None:
        with self._lock:
            self._db.close()


def format_notes(hits: Iterable[Hit]) -> str:
    """Render retrieved notes for the model, one block per hit."""
    lines = ["### Notes", "The owner's notes and documents relevant to the question."]
    for hit in hits:
        lines.append("")
        lines.append(f"[Note: {hit.title} | file: {hit.source}]")
        lines.append(hit.text.strip())
    return "\n".join(lines)
