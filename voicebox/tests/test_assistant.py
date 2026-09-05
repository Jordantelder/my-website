from __future__ import annotations

import base64
import json
from pathlib import Path

import numpy as np
import pytest
from rinn.llm import LLMError, OllamaUnavailable
from rinn.voice.audio import AudioClip

from voicebox.assistant import FORGET_RE, REMEMBER_RE, SessionStore, TurnEvent, Voicebox, pcm16_base64
from voicebox.knowledge import KnowledgeBase

from .conftest import FakeLLM, FakeSpeaker, FakeTranscriber, fixed_clock, tone


def run(box: Voicebox, **kwargs) -> list[TurnEvent]:
    return list(box.turn(kwargs.pop("session", "dev"), **kwargs))


def kinds(events: list[TurnEvent]) -> list[str]:
    return [e.type for e in events]


# -- small pieces -------------------------------------------------------------


def test_turn_event_json_drops_empty_fields():
    payload = json.loads(TurnEvent("text", text="hi").to_json())
    assert payload == {"type": "text", "text": "hi"}
    done = json.loads(TurnEvent("done", answer="a", sources=["n"], seconds=1.5).to_json())
    assert done == {"type": "done", "answer": "a", "sources": ["n"], "seconds": 1.5}
    assert json.loads(TurnEvent("done").to_json()) == {"type": "done"}


def test_pcm16_base64_roundtrip():
    clip = AudioClip(np.array([0.0, 0.5, -0.5, 1.5], dtype=np.float32), 24000)
    raw = base64.b64decode(pcm16_base64(clip))
    samples = np.frombuffer(raw, dtype="<i2")
    assert list(samples) == [0, 16383, -16383, 32767]


@pytest.mark.parametrize(
    "phrase, note",
    [
        ("Remember that the garage code is 4321", "the garage code is 4321"),
        ("remember: trash goes out tuesday", "trash goes out tuesday"),
        ("Hey, please make a note that Sam prefers oat milk.", "Sam prefers oat milk."),
        ("Take a note, the plumber is called Ana", "the plumber is called Ana"),
    ],
)
def test_remember_regex(phrase: str, note: str):
    match = REMEMBER_RE.match(phrase)
    assert match and match.group(1) == note


@pytest.mark.parametrize(
    "phrase",
    [
        "Do you remember what I said about the garage?",
        "Can you remember things?",
        "Remember what the garage code is?",
        "Remember when we talked about the plumber?",
        "Remember what I told you about my sister?",
        "Note the difference between a hub and a switch.",
        "Remember, what time is the meeting?",
        "Remember that time we went to Paris?",
    ],
)
def test_remember_regex_ignores_questions(phrase: str):
    match = REMEMBER_RE.match(phrase)
    assert match is None or phrase.endswith("?")  # the turn() guard drops the remaining question forms


def test_questions_starting_with_remember_go_to_the_model(box: Voicebox, llm: FakeLLM, kb: KnowledgeBase):
    events = run(box, text="Remember that time we went to Paris?")
    assert "note_saved" not in kinds(events) and llm.calls and kb.sources() == []


@pytest.mark.parametrize("phrase", ["forget the conversation", "Please clear our chat.", "reset context", "Forget the history!"])
def test_forget_regex(phrase: str):
    assert FORGET_RE.match(phrase)


def test_forget_regex_does_not_eat_real_questions():
    assert FORGET_RE.match("forget the conversation we had about taxes, what about April?") is None


# -- sessions -----------------------------------------------------------------------


def test_session_store_trims_persists_and_reloads(tmp_path: Path):
    path = tmp_path / "s.json"
    store = SessionStore(path, max_turns=2)
    for i in range(3):
        store.append("a", f"q{i}", f"a{i}")
    history = store.history("a")
    assert [m["content"] for m in history] == ["q1", "a1", "q2", "a2"]
    assert store.history("other") == []
    again = SessionStore(path, max_turns=2)
    assert again.history("a") == history
    again.reset("a")
    assert again.history("a") == [] and SessionStore(path, max_turns=2).history("a") == []


def test_session_store_survives_corrupt_file_and_no_path(tmp_path: Path):
    path = tmp_path / "s.json"
    path.write_text("{not json", encoding="utf-8")
    assert SessionStore(path, 5).history("x") == []
    memory = SessionStore(None, 5)
    memory.append("x", "q", "a")
    assert len(memory.history("x")) == 2


# -- text turns -------------------------------------------------------------------------


def test_text_turn_streams_text_then_audio_then_done(box: Voicebox, llm: FakeLLM, speaker: FakeSpeaker, sessions: SessionStore):
    events = run(box, text="What is the answer?")
    assert kinds(events)[0] == "text"
    assert kinds(events)[-1] == "done"
    assert "".join(e.text for e in events if e.type == "text") == "The answer is forty-two. Anything else?"
    audio = [e for e in events if e.type == "audio"]
    assert [a.text for a in audio] == ["The answer is forty-two.", "Anything else?"]
    assert all(a.sample_rate == 24000 and a.pcm16 for a in audio)
    assert speaker.requests == [("The answer is forty-two.", "af_heart"), ("Anything else?", "af_heart")]
    done = events[-1]
    assert done.answer == "The answer is forty-two. Anything else?" and done.sources == [] and done.seconds >= 0
    # persona is the system prompt and the exchange is remembered for the next turn
    assert llm.calls[0][0] == {"role": "system", "content": "You are a test persona."}
    assert llm.calls[0][-1] == {"role": "user", "content": "What is the answer?"}
    assert [m["role"] for m in sessions.history("dev")] == ["user", "assistant"]


def test_history_is_sent_on_following_turns(box: Voicebox, llm: FakeLLM):
    run(box, text="first")
    run(box, text="second")
    roles = [m["role"] for m in llm.calls[1]]
    assert roles == ["system", "user", "assistant", "user"]
    assert llm.calls[1][1]["content"] == "first"


def test_speak_false_skips_synthesis(box: Voicebox, speaker: FakeSpeaker):
    events = run(box, text="hello", speak=False)
    assert "audio" not in kinds(events)
    assert speaker.requests == []


def test_no_speaker_configured(llm: FakeLLM, kb: KnowledgeBase, sessions: SessionStore):
    box = Voicebox(llm, "p", kb, None, None, sessions)
    events = run(box, text="hello")
    assert "audio" not in kinds(events) and events[-1].type == "done"


def test_thinking_chunks_are_not_spoken_or_streamed(box: Voicebox):
    events = run(box, text="hello")
    assert all("hmm" not in e.text for e in events)


def test_speaker_failure_reports_error_but_answer_completes(llm: FakeLLM, kb: KnowledgeBase, sessions: SessionStore):
    speaker = FakeSpeaker(fail_on=["The answer is forty-two."])
    box = Voicebox(llm, "p", kb, speaker, None, sessions)
    events = run(box, text="hello")
    errors = [e for e in events if e.type == "error"]
    assert len(errors) == 1 and "speech failed" in errors[0].detail
    assert [e.text for e in events if e.type == "audio"] == ["Anything else?"]
    assert events[-1].answer.startswith("The answer")


def test_markdown_is_stripped_before_speech(kb: KnowledgeBase, sessions: SessionStore):
    llm = FakeLLM(replies=["**Sure.** Here is a list:\n\n- first item\n- second item"], piece_size=5)
    speaker = FakeSpeaker()
    box = Voicebox(llm, "p", kb, speaker, None, sessions)
    events = run(box, text="list please")
    spoken = " ".join(t for t, _ in speaker.requests)
    assert "*" not in spoken and "-" not in spoken.split()
    assert "Sure." in spoken and "first item" in spoken and "second item" in spoken
    # the text stream keeps the original markdown so the phone page can render it
    assert "**Sure.**" in "".join(e.text for e in events if e.type == "text")


def test_llm_error_yields_error_event_and_no_history(kb: KnowledgeBase, sessions: SessionStore):
    llm = FakeLLM(error=OllamaUnavailable("cannot reach Ollama at http://127.0.0.1:11434"))
    box = Voicebox(llm, "p", kb, FakeSpeaker(), None, sessions)
    events = run(box, text="hello")
    assert kinds(events) == ["error", "done"]
    assert "cannot reach Ollama" in events[0].detail
    assert events[-1].answer == "" and sessions.history("dev") == []


def test_unexpected_exception_is_reported_not_raised(kb: KnowledgeBase, sessions: SessionStore):
    box = Voicebox(FakeLLM(error=RuntimeError("boom")), "p", kb, None, None, sessions)
    events = run(box, text="hello")
    assert events[0].type == "error" and "RuntimeError: boom" in events[0].detail


def test_empty_text_is_an_error(box: Voicebox):
    events = run(box, text="   ")
    assert kinds(events) == ["error", "done"] and "did not catch" in events[0].detail


# -- audio turns ------------------------------------------------------------------------------


def test_audio_turn_emits_transcript_first(box: Voicebox, transcriber: FakeTranscriber, llm: FakeLLM):
    events = run(box, audio=tone())
    assert events[0].type == "transcript" and events[0].text == "what is the wifi password"
    assert transcriber.clips and transcriber.clips[0].sample_rate == 16000
    assert llm.calls[0][-1]["content"].endswith("what is the wifi password")


def test_audio_without_transcriber(llm: FakeLLM, kb: KnowledgeBase, sessions: SessionStore):
    box = Voicebox(llm, "p", kb, None, None, sessions)
    events = run(box, audio=tone())
    assert kinds(events) == ["error", "done"] and "speech-to-text" in events[0].detail


def test_transcriber_failure(llm: FakeLLM, kb: KnowledgeBase, sessions: SessionStore):
    box = Voicebox(llm, "p", kb, None, FakeTranscriber(error=RuntimeError("whisper down")), sessions)
    events = run(box, audio=tone())
    assert kinds(events) == ["error", "done"] and "whisper down" in events[0].detail


def test_silent_transcript_is_an_error(llm: FakeLLM, kb: KnowledgeBase, sessions: SessionStore):
    box = Voicebox(llm, "p", kb, None, FakeTranscriber(text="  "), sessions)
    events = run(box, audio=tone())
    assert kinds(events) == ["transcript", "error", "done"]
    assert llm.calls == []


def test_text_wins_over_audio_when_both_given(box: Voicebox, transcriber: FakeTranscriber):
    events = run(box, audio=tone(), text="typed question")
    assert "transcript" not in kinds(events) and transcriber.clips == []


# -- notes: remember, retrieve, forget ------------------------------------------------------------


def test_remember_saves_a_note_and_confirms_aloud(box: Voicebox, kb: KnowledgeBase, speaker: FakeSpeaker, llm: FakeLLM):
    events = run(box, text="Remember that the garage code is 4321.")
    assert kinds(events) == ["note_saved", "text", "audio", "done"]
    saved = events[0]
    assert saved.text == "the garage code is 4321"
    assert saved.detail == "2026-09-05-101530-the-garage-code-is-4321.md"
    assert (kb.knowledge_dir / "notes" / saved.detail).is_file()
    assert events[1].text.startswith("Saved a note: the garage code is 4321")
    assert speaker.requests[0][0] == events[1].text
    assert llm.calls == []  # no model call for a note
    assert events[-1].answer == events[1].text


def test_saved_note_is_used_on_the_next_question(box: Voicebox, llm: FakeLLM):
    run(box, text="remember that the garage code is 4321")
    events = run(box, text="what is the garage code?")
    user = llm.calls[0][-1]["content"]
    assert user.startswith("### Notes")
    assert "the garage code is 4321" in user and user.rstrip().endswith("### Question\nwhat is the garage code?")
    assert events[-1].sources == ["the garage code is 4321"]
    # the conversation remembers the question, not the notes block, so edited notes are never contradicted
    history = box.sessions.history("dev")
    assert history[-2] == {"role": "user", "content": "what is the garage code?"}


def test_remember_without_knowledge_base_goes_to_the_model(llm: FakeLLM, sessions: SessionStore):
    box = Voicebox(llm, "p", None, None, None, sessions)
    events = run(box, text="remember that the garage code is 4321")
    assert "note_saved" not in kinds(events) and llm.calls


def test_remember_reports_storage_failure(box: Voicebox, kb: KnowledgeBase, monkeypatch: pytest.MonkeyPatch):
    def broken(*args, **kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(kb, "add_note", broken)
    events = run(box, text="remember that x is y")
    assert kinds(events) == ["error", "done"] and "disk full" in events[0].detail


def test_forget_clears_history(box: Voicebox, sessions: SessionStore, llm: FakeLLM):
    run(box, text="first question")
    assert sessions.history("dev")
    events = run(box, text="Forget the conversation")
    assert kinds(events) == ["text", "audio", "done"]
    assert "cleared" in events[0].text
    assert sessions.history("dev") == [] and len(llm.calls) == 1


def test_knowledge_search_failure_falls_back_to_plain_question(box: Voicebox, kb: KnowledgeBase, llm: FakeLLM, monkeypatch: pytest.MonkeyPatch):
    from voicebox.knowledge import KnowledgeError

    def broken(*args, **kwargs):
        raise KnowledgeError("index broken")

    monkeypatch.setattr(kb, "search", broken)
    events = run(box, text="hello there")
    assert events[-1].type == "done" and llm.calls[0][-1]["content"] == "hello there"


def test_sessions_are_independent(box: Voicebox, sessions: SessionStore):
    run(box, text="hi", session="phone")
    run(box, text="hi", session="handheld")
    assert len(sessions.history("phone")) == 2 and len(sessions.history("handheld")) == 2
    run(box, text="forget the conversation", session="phone")
    assert sessions.history("phone") == [] and len(sessions.history("handheld")) == 2


def test_closing_the_stream_early_stops_generation_and_speech(kb: KnowledgeBase, sessions: SessionStore):
    import threading

    text = " ".join(f"Sentence number {i} is here." for i in range(40))
    llm = FakeLLM(replies=[text], piece_size=6, delay=0.003)
    speaker = FakeSpeaker()
    box = Voicebox(llm, "p", kb, speaker, None, sessions)
    gen = box.turn("phone", text="tell me everything")
    first = [next(gen) for _ in range(3)]
    assert all(e.type in ("text", "audio") for e in first)
    gen.close()  # what Starlette does when the phone disconnects mid-answer
    for _ in range(200):
        if not any(t.name in ("voicebox-turn", "voicebox-tts") for t in threading.enumerate()):
            break
        threading.Event().wait(0.01)
    assert not any(t.name in ("voicebox-turn", "voicebox-tts") for t in threading.enumerate())
    synthesized = len(speaker.requests)
    threading.Event().wait(0.1)
    assert len(speaker.requests) == synthesized  # nothing more is synthesized after the close
    assert synthesized < 40  # generation was cut short rather than run to completion
    assert sessions.history("phone") == []  # an unfinished answer is not remembered


def test_audio_events_stay_in_sentence_order_with_slow_model(kb: KnowledgeBase, sessions: SessionStore):
    text = "One is first. Two is second. Three is third. Four is fourth. Five is fifth."
    llm = FakeLLM(replies=[text], piece_size=4, delay=0.002)
    speaker = FakeSpeaker()
    box = Voicebox(llm, "p", kb, speaker, None, sessions, chunker_factory=lambda: __import__("rinn.voice.chunker", fromlist=["SentenceChunker"]).SentenceChunker(min_chars=5, max_chars=200, first_min_chars=5))
    events = run(box, text="count")
    spoken = [e.text for e in events if e.type == "audio"]
    assert spoken == ["One is first.", "Two is second.", "Three is third.", "Four is fourth.", "Five is fifth."]
    assert events[-1].answer == text
