"""Export answers in the layout of RINN's PDF reports (Question / Answer / Sources)."""
from __future__ import annotations

from pathlib import Path

from .assistant import Answer
from .persona import DISCLAIMER, REPORT_TITLE

MENTIONS_HEADING = "Mentioned in answer (unverified)"


def render_markdown(answer: Answer, include_thinking: bool = False) -> str:
    """Render one answer as a Markdown report."""
    parts = [
        f"# {REPORT_TITLE}",
        "",
        f"Generated: {answer.generated_at:%Y-%m-%d %H:%M}",
        f"Model: {answer.model}",
        "",
        "## Question",
        "",
        answer.question.strip(),
        "",
        "## Answer",
        "",
        answer.text.strip(),
        "",
    ]
    if answer.sources:
        parts += ["## Sources", ""]
        parts += [f"- {source}" for source in answer.sources]
        parts.append("")
    if answer.mentions:
        parts += [f"## {MENTIONS_HEADING}", ""]
        parts += [f"- {item}" for item in answer.mentions]
        parts.append("")
    if include_thinking and answer.thinking:
        parts += ["## Model reasoning", "", answer.thinking.strip(), ""]
    parts += ["---", "", f"_{DISCLAIMER}_", ""]
    return "\n".join(parts)


def save_markdown(answer: Answer, path: str | Path, include_thinking: bool = False) -> Path:
    """Write the Markdown report to ``path`` (``~`` is expanded, parents are created)."""
    target = Path(path).expanduser()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render_markdown(answer, include_thinking=include_thinking), encoding="utf-8")
    return target
