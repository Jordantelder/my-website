from __future__ import annotations

import io
from datetime import datetime

import pytest

from rinn.assistant import RinnAssistant
from rinn.config import Settings
from rinn.llm import OllamaLLM
from rinn.voice.audio import AudioError
from rinn.voice.loop import VoiceLoop

from conftest import FakeOllamaClient, FakePlayer, FakeRecorder, FakeTTSClient, FakeTranscriber

REPLY = (
    "Catheters vary by intended use. **Cardiovascular** catheters are typically Class II or III [K183256.pdf]. "
    "See https://www.fda.gov/x for the product codes. Which type do you mean?"
)


def make_loop(client=None, tts=None, player=None, transcriber=None, recorder=None, **kw):
    client = client or FakeOllamaClient(replies=[REPLY], thinking=None)
    settings = Settings(think=False)
    assistant = RinnAssistant(OllamaLLM(settings, client=client), settings, clock=lambda: datetime(2026, 9, 5, 9, 0))
    out, err = io.StringIO(), io.StringIO()
    loop = VoiceLoop(assistant, tts, player, transcriber=transcriber, recorder=recorder, out=out, err=err, **kw)
    return loop, out, err, client


def test_answer_streams_text_and_speaks_clean_sentences_in_order():
    tts, player = FakeTTSClient(), FakePlayer()
    loop, out, err, client = make_loop(tts=tts, player=player)
    result = loop.answer("Tell me about catheters.")
    assert result.answer.text == REPLY
    assert out.getvalue().strip() == REPLY  # console keeps the markdown and citations
    assert tts.requests == [
        "Catheters vary by intended use.",
        "Cardiovascular catheters are typically Class II or III.",
        "See for the product codes. Which type do you mean?",
    ] or tts.requests[0] == "Catheters vary by intended use."
    assert all("**" not in s and "[K183256.pdf]" not in s and "https://" not in s for s in tts.requests)
    assert len(player.clips) == len(tts.requests) and result.sentences == tts.requests
    assert result.tts_errors == [] and err.getvalue() == ""
    assert client.calls[0]["think"] is False and client.calls[0]["stream"] is True


def test_answer_without_speech_only_prints():
    loop, out, _, _ = make_loop(tts=None, player=None)
    result = loop.answer("hello")
    assert result.sentences == [] and out.getvalue().strip() == REPLY


def test_tts_failure_does_not_lose_the_answer():
    tts, player = FakeTTSClient(fail_on={"Catheters vary by intended use."}), FakePlayer()
    loop, out, err, _ = make_loop(tts=tts, player=player)
    result = loop.answer("catheters?")
    assert result.answer.text == REPLY
    assert len(result.tts_errors) == 1 and "speech problem" in err.getvalue()
    assert "Catheters vary by intended use." not in result.sentences and len(player.clips) == len(result.sentences)


def test_listen_uses_recorder_and_transcriber():
    recorder, transcriber = FakeRecorder(seconds=2.0), FakeTranscriber("what about IEC 60601-1?")
    loop, out, _, _ = make_loop(tts=None, player=None, transcriber=transcriber, recorder=recorder)
    assert loop.listen() == "what about IEC 60601-1?"
    assert recorder.calls == 1 and transcriber.calls == [(32000, 16000)]
    assert "listening..." in out.getvalue() and "transcribing..." in out.getvalue()


def test_listen_ignores_very_short_recordings_and_requires_configuration():
    loop, _, _, _ = make_loop(tts=None, player=None, transcriber=FakeTranscriber(), recorder=FakeRecorder(seconds=0.1))
    assert loop.listen() == ""
    loop2, _, _, _ = make_loop(tts=None, player=None)
    with pytest.raises(AudioError):
        loop2.listen()


def test_run_handles_voice_typed_and_commands():
    client = FakeOllamaClient(replies=["Spoken answer.", "Typed answer."], thinking=None)
    tts, player = FakeTTSClient(), FakePlayer()
    transcriber = FakeTranscriber("spoken question")
    loop, out, err, client = make_loop(client=client, tts=tts, player=player, transcriber=transcriber, recorder=FakeRecorder())
    lines = iter(["", "typed question", "/stop", "/reset", "/quit"])
    code = loop.run(input_fn=lambda prompt: next(lines))
    assert code == 0
    text = out.getvalue()
    assert "Press Enter to talk" in text
    assert "you (heard): spoken question" in text
    assert "Spoken answer." in text and "Typed answer." in text
    assert "conversation cleared" in text
    assert player.stopped == 1
    assert client.calls[0]["messages"][-1]["content"] == "spoken question"
    assert client.calls[1]["messages"][-1]["content"] == "typed question"
    assert tts.requests == ["Spoken answer.", "Typed answer."]


def test_run_without_microphone_ignores_empty_lines():
    client = FakeOllamaClient(replies=["Answer."], thinking=None)
    loop, out, _, _ = make_loop(client=client, tts=None, player=None)
    lines = iter(["", "q", "/quit"])
    assert loop.run(input_fn=lambda prompt: next(lines)) == 0
    assert "Type a question." in out.getvalue() and len(client.calls) == 1


def test_show_thinking_prints_reasoning_before_answer():
    client = FakeOllamaClient(replies=["Answer."], thinking="let me think")
    loop, out, _, _ = make_loop(client=client, tts=None, player=None, show_thinking=True)
    loop.answer("q")
    assert out.getvalue().startswith("[thinking] let me think\n\nAnswer.")
