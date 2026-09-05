"""Turn a stream of text fragments into sentences that can be spoken as they arrive.

The LLM streams tokens; text-to-speech needs whole sentences. ``SentenceChunker`` buffers
fragments and releases a sentence as soon as it ends, with a shorter threshold for the
first sentence so audio starts quickly. ``strip_markdown_for_speech`` removes formatting
and citation tags that would otherwise be read aloud.
"""
from __future__ import annotations

import re

# Sentence end: terminal punctuation, optional closing quotes/brackets, then whitespace or
# end of text. A period followed directly by a digit (21 CFR 807.92) is not a boundary.
_BOUNDARY_RE = re.compile(r"(?<=[.!?…])[\"'”’)\]]*(?:\s+|$)")
_ABBREVIATIONS = {
    "e.g.", "i.e.", "etc.", "vs.", "dr.", "mr.", "mrs.", "ms.", "no.", "fig.", "sec.", "vol.",
    "u.s.", "approx.", "dept.", "inc.", "ltd.", "co.", "st.", "jr.", "sr.", "min.", "max.",
    "cfr.", "rev.", "ed.", "pp.", "p.", "al.",
}
_CLAUSE_SPLIT_RE = re.compile(r"(?<=[,;:])\s+")
# A newline followed by a list marker, heading, or table row starts a new chunk even
# without terminal punctuation, so list items are spoken one at a time.
_LINE_BREAK_RE = re.compile(r"\n(?=[ \t]*(?:\d+[.)]\s|[-*+•]\s|#{1,6}\s|\|))")
_LEADING_MARKER_RE = re.compile(r"^\s*(?:\d+[.)]|[-*+•])\s+")
_BARE_MARKER_RE = re.compile(r"^\s*(?:\d+[.)]|[-*+•])\s*$")
_LEADING_PUNCT = "(\"'“‘[«"

_CITATION_RE = re.compile(r"\[(?:WEB SOURCE:\s*)?[^\[\]]*?(?:https?://|\.pdf|\.txt|\.html?)[^\[\]]*\]", re.IGNORECASE)
_SUBMISSION_TAG_RE = re.compile(r"\[(?:K|P|DEN)\d{6}(?:\.\w+)?\]")
_LINK_RE = re.compile(r"\[([^\]]+)\]\((?:[^)]+)\)")
_URL_RE = re.compile(r"https?://\S+")
_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s*", re.MULTILINE)
_BULLET_RE = re.compile(r"^\s*(?:[-*+•]|\d+[.)])\s+", re.MULTILINE)
_TABLE_SEPARATOR_RE = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$", re.MULTILINE)
_EMPHASIS_RE = re.compile(r"(\*\*|__|\*|_|~~|`{1,3})")
_HR_RE = re.compile(r"^\s*(?:-{3,}|\*{3,}|_{3,})\s*$", re.MULTILINE)
_MULTISPACE_RE = re.compile(r"[ \t]{2,}")


def strip_markdown_for_speech(text: str) -> str:
    """Return ``text`` with Markdown, URLs, and citation tags removed for a TTS engine."""
    out = text
    out = _TABLE_SEPARATOR_RE.sub("", out)
    out = _HR_RE.sub("", out)
    out = _CITATION_RE.sub("", out)
    out = _SUBMISSION_TAG_RE.sub("", out)
    out = _LINK_RE.sub(r"\1", out)
    out = _URL_RE.sub("", out)
    out = _HEADING_RE.sub("", out)
    out = _BULLET_RE.sub("", out)
    out = _EMPHASIS_RE.sub("", out)
    # Table rows become comma-separated phrases ending in a period.
    lines = []
    for line in out.splitlines():
        stripped = line.strip()
        if stripped.startswith("|") or stripped.endswith("|"):
            cells = [cell.strip() for cell in stripped.strip("|").split("|")]
            cells = [cell for cell in cells if cell]
            if cells:
                lines.append(", ".join(cells) + ".")
            continue
        lines.append(line)
    out = "\n".join(lines)
    out = _MULTISPACE_RE.sub(" ", out)
    out = re.sub(r"\s+([,.;:!?])", r"\1", out)  # "word ." -> "word."
    out = re.sub(r"\(\s*\)", "", out)  # empty parentheses left by removed tags
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


class SentenceChunker:
    """Buffer streamed text and release speakable sentences.

    ``feed`` returns zero or more completed sentences; ``flush`` returns whatever remains.
    Short sentences are merged until ``min_chars`` unless it is the first one, which is
    released after ``first_min_chars`` so speech starts early. Sentences longer than
    ``max_chars`` are split at clause boundaries, then at spaces.
    """

    def __init__(self, min_chars: int = 40, max_chars: int = 300, first_min_chars: int = 15) -> None:
        if not 0 < first_min_chars <= min_chars <= max_chars:
            raise ValueError("expected 0 < first_min_chars <= min_chars <= max_chars")
        self.min_chars = min_chars
        self.max_chars = max_chars
        self.first_min_chars = first_min_chars
        self._buffer = ""
        self._pending = ""  # completed sentences waiting to reach min_chars
        self._emitted = 0

    def feed(self, text: str) -> list[str]:
        self._buffer += text
        out: list[str] = []
        while True:
            paragraph = self._buffer.find("\n\n")
            line_break = _LINE_BREAK_RE.search(self._buffer)
            hard = min([i for i in (paragraph, line_break.start() if line_break else -1) if i != -1], default=-1)
            cut = self._find_boundary(self._buffer)
            if hard != -1 and (cut is None or hard < cut):
                # A blank line, or a line that starts a list item / heading / table row,
                # ends the chunk even without terminal punctuation.
                is_paragraph = hard == paragraph
                head, self._buffer = self._buffer[:hard], self._buffer[hard + (2 if is_paragraph else 1) :]
                out.extend(self._accept_block(head, force=is_paragraph))
                continue
            if cut is None:
                break
            sentence, self._buffer = self._buffer[:cut], self._buffer[cut:]
            out.extend(self._accept(sentence))
        return out

    def flush(self) -> list[str]:
        out: list[str] = []
        remainder = self._join(self._pending, _LEADING_MARKER_RE.sub("", self._buffer, count=1))
        self._pending = ""
        self._buffer = ""
        if remainder:
            out.extend(self._split_long(remainder))
        self._emitted += len(out)
        return out

    # -- internals ------------------------------------------------------------

    def _threshold(self) -> int:
        return self.first_min_chars if self._emitted == 0 else self.min_chars

    def _accept(self, sentence: str) -> list[str]:
        sentence = _LEADING_MARKER_RE.sub("", sentence, count=1)  # "1. item" -> "item" (markers are never spoken)
        if _BARE_MARKER_RE.match(sentence):
            return []
        candidate = self._join(self._pending, sentence)
        if not candidate:
            return []
        if len(candidate) < self._threshold():
            self._pending = candidate
            return []
        self._pending = ""
        pieces = self._split_long(candidate)
        self._emitted += len(pieces)
        return pieces

    def _accept_block(self, block: str, force: bool = False) -> list[str]:
        """Emit the sentences inside a completed block, then its remainder.

        With ``force`` (a blank line) anything still pending is released too, so a
        paragraph is never glued to the next one.
        """
        out: list[str] = []
        rest = block
        while True:
            cut = self._find_boundary(rest, final=True)
            if cut is None:
                break
            sentence, rest = rest[:cut], rest[cut:]
            out.extend(self._accept(sentence))
        if rest.strip():
            out.extend(self._accept(rest))
        if force and self._pending:
            pieces = self._split_long(self._pending)
            self._pending = ""
            self._emitted += len(pieces)
            out.extend(pieces)
        return out

    @staticmethod
    def _join(pending: str, sentence: str) -> str:
        pending, sentence = pending.strip(), sentence.strip()
        if not pending:
            return sentence
        if not sentence:
            return pending
        if not pending.endswith((".", "!", "?", ":", ";", ",", "…")):
            pending += "."  # a pause between merged fragments ("Cytotoxicity. Sensitization.")
        return f"{pending} {sentence}"

    def _find_boundary(self, text: str, final: bool = False) -> int | None:
        for match in _BOUNDARY_RE.finditer(text):
            end = match.end()
            if end == len(text) and not text[end - 1].isspace() and not final:
                return None  # sentence may still continue ("U.S." at the end of a fragment)
            head = text[: match.start()]
            words = head.split()
            last_word = words[-1].lower().lstrip(_LEADING_PUNCT) if words else ""
            if last_word in _ABBREVIATIONS or (len(last_word) == 2 and last_word[0].isalpha() and last_word.endswith(".")):
                continue  # "e.g." / "(i.e." / "A." initials
            if _BARE_MARKER_RE.match(head.rsplit("\n", 1)[-1]):
                continue  # "1." at the start of a list item is not a sentence end
            return end
        return None

    def _split_long(self, sentence: str) -> list[str]:
        sentence = sentence.strip()
        if len(sentence) <= self.max_chars:
            return [sentence] if sentence else []
        pieces: list[str] = []
        current = ""
        for clause in _CLAUSE_SPLIT_RE.split(sentence):
            if current and len(current) + 1 + len(clause) > self.max_chars:
                pieces.extend(self._split_words(current))
                current = clause
            else:
                current = f"{current} {clause}".strip()
        if current:
            pieces.extend(self._split_words(current))
        return pieces

    def _split_words(self, text: str) -> list[str]:
        if len(text) <= self.max_chars:
            return [text]
        pieces: list[str] = []
        current = ""
        for word in text.split():
            if current and len(current) + 1 + len(word) > self.max_chars:
                pieces.append(current)
                current = word
            else:
                current = f"{current} {word}".strip()
        if current:
            pieces.append(current)
        return pieces
