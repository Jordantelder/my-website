from __future__ import annotations

from datetime import datetime

from rinn.assistant import Answer
from rinn.export import MENTIONS_HEADING, render_markdown, save_markdown
from rinn.persona import DISCLAIMER, REPORT_TITLE


def sample() -> Answer:
    return Answer(
        question="Testing for single-use endoscopes?",
        text="Based on the provided context ... [K183256.pdf]",
        model="qwen3.8:27b",
        generated_at=datetime(2026, 6, 23, 15, 52),
        thinking="first I consider IEC 60601-1",
        sources=["K183256.pdf", "https://measurlabs.com/blog/fda-510k-medical-device-testing"],
    )


def test_markdown_layout_matches_rinn_report():
    md = render_markdown(sample())
    assert md.startswith(f"# {REPORT_TITLE}\n\nGenerated: 2026-06-23 15:52\nModel: qwen3.8:27b\n")
    assert "## Question\n\nTesting for single-use endoscopes?\n" in md
    assert "## Answer\n\nBased on the provided context ... [K183256.pdf]\n" in md
    assert "## Sources\n\n- K183256.pdf\n- https://measurlabs.com/blog/fda-510k-medical-device-testing\n" in md
    assert md.rstrip().endswith(f"_{DISCLAIMER}_")
    assert "Model reasoning" not in md


def test_thinking_included_only_on_request():
    md = render_markdown(sample(), include_thinking=True)
    assert "## Model reasoning\n\nfirst I consider IEC 60601-1" in md


def test_sources_section_omitted_when_empty():
    answer = sample()
    answer.sources = []
    assert "## Sources" not in render_markdown(answer)


def test_save_creates_parent_directories(tmp_path):
    target = save_markdown(sample(), tmp_path / "exports" / "answer.md")
    assert target.read_text(encoding="utf-8") == render_markdown(sample())


def test_unverified_mentions_are_labelled_separately():
    answer = sample()
    answer.mentions = ["K999999", "https://www.fda.gov/z"]
    md = render_markdown(answer)
    assert f"## {MENTIONS_HEADING}\n\n- K999999\n- https://www.fda.gov/z\n" in md
    assert md.index("## Sources") < md.index(f"## {MENTIONS_HEADING}")
    answer.mentions = []
    assert MENTIONS_HEADING not in render_markdown(answer)


def test_save_expands_tilde(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    target = save_markdown(sample(), "~/reports/answer.md")
    assert target == tmp_path / "reports" / "answer.md" and target.exists()
