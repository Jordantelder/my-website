from __future__ import annotations

from datetime import datetime

import pytest

from rinn.assistant import ContextDoc, RinnAssistant, build_user_message, extract_mentions, extract_sources, format_context
from rinn.config import Settings
from rinn.llm import OllamaLLM
from rinn.persona import CONTEXT_HEADING, SYSTEM_PROMPT

from conftest import FakeOllamaClient

FIXED = datetime(2026, 6, 23, 15, 52)


def make(client: FakeOllamaClient, **overrides) -> RinnAssistant:
    settings = Settings(**overrides)
    return RinnAssistant(OllamaLLM(settings, client=client), settings, clock=lambda: FIXED)


def test_context_doc_tags_match_report_format():
    assert ContextDoc("K183256.pdf", "text").tag() == "[K183256.pdf]"
    assert ContextDoc("https://www.fda.gov/x", "text", kind="web").tag() == "[WEB SOURCE: https://www.fda.gov/x]"
    with pytest.raises(ValueError):
        ContextDoc("", "text")
    with pytest.raises(ValueError):
        ContextDoc("a", "text", kind="pdf")


def test_user_message_embeds_context_block_and_question():
    docs = [ContextDoc("K183256.pdf", "Bench testing per IEC 60601-1."), ContextDoc("https://fda.gov/g", "Guidance text.", "web")]
    message = build_user_message("What testing is required?", docs)
    assert message.startswith(f"### {CONTEXT_HEADING}")
    assert "[K183256.pdf]\nBench testing per IEC 60601-1." in message
    assert "[WEB SOURCE: https://fda.gov/g]\nGuidance text." in message
    assert message.rstrip().endswith("### Question\nWhat testing is required?")
    assert build_user_message("plain", []) == "plain"
    assert format_context(docs).endswith("\n")


def test_ask_sends_system_prompt_history_and_returns_answer():
    client = FakeOllamaClient(replies=["Could you specify the catheter type?", "Cardiovascular catheters are ... [K183256.pdf]"])
    assistant = make(client)

    first = assistant.ask("Regulatory requirements for a catheter?")
    assert first.text.startswith("Could you specify")
    assert first.model == "qwen3.8:27b"
    assert first.generated_at == FIXED
    assert first.thinking == "thinking about it"
    assert (first.prompt_tokens, first.completion_tokens) == (11, 7)

    docs = [ContextDoc("K183256.pdf", "510(k) summary text")]
    second = assistant.ask("cardiovascular", context=docs)
    sent = client.calls[1]["messages"]
    assert sent[0] == {"role": "system", "content": SYSTEM_PROMPT}
    assert sent[1]["content"] == "Regulatory requirements for a catheter?"
    assert sent[2] == {"role": "assistant", "content": "Could you specify the catheter type?"}
    assert sent[3]["role"] == "user" and "cardiovascular" in sent[3]["content"] and "[K183256.pdf]" in sent[3]["content"]
    assert second.sources == ["K183256.pdf"]
    assert len(assistant.history) == 4


def test_extra_instructions_extend_system_prompt():
    client = FakeOllamaClient()
    assistant = make(client, extra_instructions="Only CDRH.")
    assistant.ask("hello")
    system = client.calls[0]["messages"][0]["content"]
    assert system.startswith(SYSTEM_PROMPT) and system.endswith("Only CDRH.")


def test_history_is_trimmed_to_max_turns():
    client = FakeOllamaClient(replies=[f"answer {i}" for i in range(6)])
    assistant = make(client, max_history_turns=2)
    for i in range(5):
        assistant.ask(f"question {i}")
    assert [m["content"] for m in assistant.history] == ["question 3", "answer 3", "question 4", "answer 4"]


def test_zero_history_turns_keeps_nothing():
    assistant = make(FakeOllamaClient(), max_history_turns=0)
    assistant.ask("one")
    assert assistant.history == []


def test_reset_and_empty_question():
    assistant = make(FakeOllamaClient())
    assistant.ask("hello")
    assistant.reset()
    assert assistant.history == []
    with pytest.raises(ValueError):
        assistant.ask("   ")


def test_streaming_callback_is_forwarded():
    seen = []
    assistant = make(FakeOllamaClient())
    answer = assistant.ask("hello", on_chunk=seen.append)
    assert answer.text == "stub answer"
    assert seen and seen[0].kind == "thinking"


def test_extract_sources_orders_cited_docs_first_then_uncited():
    docs = [ContextDoc("A.pdf", "a"), ContextDoc("B.pdf", "b"), ContextDoc("https://x.example/p", "c", "web")]
    text = "See [WEB SOURCE: https://x.example/p] and then [A.pdf]."
    assert extract_sources(text, docs) == ["https://x.example/p", "A.pdf", "B.pdf"]


def test_sources_come_only_from_provided_context():
    text = "Per K183256.pdf and https://www.fda.gov/guidance this is so."
    assert extract_sources(text, []) == []  # nothing supplied, nothing is a source


def test_extract_mentions_scrapes_identifiers_and_cleans_markdown():
    text = (
        "Per K183256.pdf and K191948, see **https://www.fda.gov/media/71018/download** and "
        "`https://ecfr.gov/x`, also (https://example.org/a). DEN200001 and P170019 too. Repeat K191948."
    )
    assert extract_mentions(text) == [
        "K183256.pdf",
        "K191948",
        "DEN200001",
        "P170019",
        "https://www.fda.gov/media/71018/download",
        "https://ecfr.gov/x",
        "https://example.org/a",
    ]
    assert extract_mentions("no cites here") == []
    assert extract_mentions("K183256.pdf again", exclude=["K183256.pdf"]) == []


def test_answer_separates_sources_from_unverified_mentions():
    client = FakeOllamaClient(replies=["Grounded in [K183256.pdf]; FDA also cleared K999999 per https://www.fda.gov/z."])
    answer = make(client).ask("q", context=[ContextDoc("K183256.pdf", "summary")])
    assert answer.sources == ["K183256.pdf"]
    assert answer.mentions == ["K999999", "https://www.fda.gov/z"]

    client = FakeOllamaClient(replies=["From general knowledge: K999999 (unverified)."])
    answer = make(client).ask("q")
    assert answer.sources == [] and answer.mentions == ["K999999"]
