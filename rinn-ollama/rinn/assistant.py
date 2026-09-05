"""Stateful RINN assistant: persona + conversation memory + context grounding.

The original RINN was a LangChain ReAct agent whose retriever tool injected
document chunks into the conversation. Here the caller supplies any context
as ``ContextDoc`` objects, so a retriever (Chroma, SQLite full-text search,
web search) can be plugged in later without touching the model layer.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Iterable, Optional, Sequence

from .config import Settings
from .llm import ChunkCallback, OllamaLLM, Reply
from .persona import CONTEXT_HEADING, build_system_prompt

# Markdown emphasis and code-span characters are excluded so "**https://x**" and
# "`https://x`" do not leak their delimiters into the scraped URL.
_URL_RE = re.compile(r"https?://[^\s\]\)>\"'*`]+")
_SUBMISSION_RE = re.compile(r"\b(?:K|P|DEN)\d{6}(?:\.(?:pdf|txt))?\b")
_TRAILING_PUNCTUATION = ".,;:*_`~"


@dataclass(frozen=True)
class ContextDoc:
    """An excerpt the model should ground its answer in."""

    source: str
    text: str
    kind: str = "file"  # "file" for local documents, "web" for pages

    def __post_init__(self) -> None:
        if not self.source.strip():
            raise ValueError("ContextDoc.source must not be empty")
        if self.kind not in ("file", "web"):
            raise ValueError(f"ContextDoc.kind must be 'file' or 'web', got {self.kind!r}")

    def tag(self) -> str:
        """Citation tag in the format RINN reports use."""
        if self.kind == "web":
            return f"[WEB SOURCE: {self.source}]"
        return f"[{self.source}]"


@dataclass
class Answer:
    """One question/answer exchange, ready for display or export.

    ``sources`` are the documents that were actually supplied as context.
    ``mentions`` are identifiers (510(k)/PMA/De Novo numbers, URLs) the model
    wrote into the answer without a matching context document; they are
    unverified and reports label them as such.
    """

    question: str
    text: str
    model: str
    generated_at: datetime
    thinking: Optional[str] = None
    sources: list[str] = field(default_factory=list)
    mentions: list[str] = field(default_factory=list)
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None


def format_context(docs: Sequence[ContextDoc]) -> str:
    """Render context excerpts as a block the system prompt knows how to read."""
    lines = [
        f"### {CONTEXT_HEADING}",
        "Cite facts taken from these excerpts using the bracketed source tag shown above each one.",
        "",
    ]
    for doc in docs:
        lines.append(doc.tag())
        lines.append(doc.text.strip())
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def build_user_message(question: str, docs: Sequence[ContextDoc]) -> str:
    """Combine optional context and the question into one user turn."""
    if not docs:
        return question
    return f"{format_context(docs)}\n### Question\n{question}"


def extract_sources(text: str, docs: Sequence[ContextDoc]) -> list[str]:
    """Sources for the report: every provided document, cited ones first.

    Only documents that were actually supplied count as sources; anything the
    model cites from memory is reported separately by :func:`extract_mentions`.
    """
    ranked = []
    for doc in docs:
        position = text.find(doc.tag())
        if position == -1:
            position = text.find(doc.source)
        ranked.append((position if position != -1 else len(text) + 1, doc.source))
    ordered: list[str] = []
    for _, source in sorted(ranked, key=lambda item: item[0]):
        if source not in ordered:
            ordered.append(source)
    return ordered


def extract_mentions(text: str, exclude: Iterable[str] = ()) -> list[str]:
    """Submission numbers and URLs the model mentioned that are not in ``exclude``."""
    known = set(exclude)
    found: list[str] = []

    def add(item: str) -> None:
        if item and item not in known and item not in found:
            found.append(item)

    for match in _SUBMISSION_RE.finditer(text):
        add(match.group(0))
    for match in _URL_RE.finditer(text):
        add(match.group(0).rstrip(_TRAILING_PUNCTUATION))
    return found


class RinnAssistant:
    """Conversation-aware RINN on top of :class:`OllamaLLM`."""

    def __init__(
        self,
        llm: OllamaLLM,
        settings: Settings | None = None,
        clock: Callable[[], datetime] = datetime.now,
    ) -> None:
        self.llm = llm
        self.settings = settings or llm.settings
        self.system_prompt = build_system_prompt(self.settings.extra_instructions)
        self.history: list[dict[str, str]] = []
        self._clock = clock

    def messages_for(self, user_content: str) -> list[dict[str, str]]:
        """Full message list for one request: system prompt, history, new turn."""
        return [{"role": "system", "content": self.system_prompt}, *self.history, {"role": "user", "content": user_content}]

    def ask(
        self,
        question: str,
        context: Iterable[ContextDoc] | None = None,
        on_chunk: ChunkCallback | None = None,
    ) -> Answer:
        """Ask RINN a question, remembering the exchange for follow-ups."""
        question = question.strip()
        if not question:
            raise ValueError("question must not be empty")
        docs = list(context or [])
        user_content = build_user_message(question, docs)

        reply: Reply = self.llm.chat(self.messages_for(user_content), on_chunk=on_chunk)

        self.history.append({"role": "user", "content": user_content})
        self.history.append({"role": "assistant", "content": reply.content})
        self._trim_history()

        sources = extract_sources(reply.content, docs)
        return Answer(
            question=question,
            text=reply.content,
            model=reply.model,
            generated_at=self._clock(),
            thinking=reply.thinking,
            sources=sources,
            mentions=extract_mentions(reply.content, exclude=sources),
            prompt_tokens=reply.prompt_tokens,
            completion_tokens=reply.completion_tokens,
        )

    def reset(self) -> None:
        """Forget the conversation."""
        self.history.clear()

    def _trim_history(self) -> None:
        keep = 2 * self.settings.max_history_turns
        if len(self.history) > keep:
            del self.history[: len(self.history) - keep]
