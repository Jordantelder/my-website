from __future__ import annotations

import pytest

from rinn.voice.chunker import SentenceChunker, strip_markdown_for_speech


def stream(chunker: SentenceChunker, text: str, step: int = 7) -> list[str]:
    out: list[str] = []
    for start in range(0, len(text), step):
        out.extend(chunker.feed(text[start : start + step]))
    out.extend(chunker.flush())
    return out


def test_sentences_are_released_at_boundaries_and_first_one_early():
    chunker = SentenceChunker(min_chars=40, first_min_chars=15)
    text = "Catheters vary widely. Cardiovascular catheters are typically Class II or Class III devices under 21 CFR 870. Ask me which one."
    sentences = stream(chunker, text)
    assert sentences[0] == "Catheters vary widely."  # released early: 22 chars >= first_min_chars
    assert sentences[1].startswith("Cardiovascular catheters") and sentences[1].endswith("21 CFR 870.")
    assert sentences[-1] == "Ask me which one."
    assert " ".join(sentences) == text


def test_short_sentences_are_merged_until_min_chars():
    chunker = SentenceChunker(min_chars=40, first_min_chars=15)
    sentences = stream(chunker, "Yes. It applies here. Both parts are required by the rule. Done.")
    assert sentences[0] == "Yes. It applies here."  # 4 chars alone is below first_min_chars, merged with the next
    assert sentences[1] == "Both parts are required by the rule. Done."


@pytest.mark.parametrize(
    "text",
    [
        "See 21 CFR 807.92 for the summary requirements. Then continue.",
        "Examples include catheters, e.g. urological ones, and implants. Then continue.",
        "The U.S. FDA reviews it. Then continue.",
        "Refer to Fig. 3 of the guidance. Then continue.",
    ],
)
def test_abbreviations_and_decimals_do_not_split(text):
    sentences = stream(SentenceChunker(min_chars=10, first_min_chars=5), text)
    assert sentences[-1] == "Then continue."
    assert len(sentences) == 2


def test_long_sentence_is_split_at_clauses_then_words():
    chunker = SentenceChunker(min_chars=10, max_chars=60, first_min_chars=5)
    text = "The submission must include biocompatibility testing, sterilization validation, packaging integrity testing, electrical safety data, and software documentation for every configuration."
    pieces = stream(chunker, text)
    assert len(pieces) >= 3
    assert all(len(piece) <= 60 for piece in pieces)
    assert " ".join(pieces) == text


def test_paragraph_break_flushes_without_punctuation():
    chunker = SentenceChunker(min_chars=10, first_min_chars=5)
    out = chunker.feed("Key points\n\nFirst, the predicate. ")
    assert out == ["Key points", "First, the predicate."]


def test_flush_returns_remainder_and_streaming_fragments_do_not_split_mid_token():
    chunker = SentenceChunker(min_chars=10, first_min_chars=5)
    assert chunker.feed("This ends here.") == []  # no trailing space yet: may be "U.S." etc.
    assert chunker.feed(" Next one") == ["This ends here."]
    assert chunker.flush() == ["Next one"]
    assert chunker.flush() == []


def test_invalid_thresholds():
    with pytest.raises(ValueError):
        SentenceChunker(min_chars=5, first_min_chars=10)


def test_strip_markdown_for_speech():
    text = (
        "## Testing Matrix\n\n"
        "**Electrical safety** is covered by `IEC 60601-1` [K183256.pdf] and [WEB SOURCE: https://www.fda.gov/x].\n"
        "- First bullet\n"
        "1. Numbered item\n\n"
        "| Test | Standard |\n"
        "|---|---|\n"
        "| Cytotoxicity | ISO 10993-5 |\n\n"
        "See [the guidance](https://www.fda.gov/guidance) or https://ecfr.gov/x for details.\n"
        "---\n"
    )
    spoken = strip_markdown_for_speech(text)
    assert "**" not in spoken and "`" not in spoken and "#" not in spoken and "|" not in spoken
    assert "[K183256.pdf]" not in spoken and "WEB SOURCE" not in spoken and "https://" not in spoken
    assert "Electrical safety is covered by IEC 60601-1 and." in spoken  # tags removed; the dangling 'and' is accepted
    assert "Test, Standard." in spoken and "Cytotoxicity, ISO 10993-5." in spoken
    assert "See the guidance or for details." in spoken
    assert spoken.startswith("Testing Matrix")
    assert "First bullet" in spoken and "Numbered item" in spoken
