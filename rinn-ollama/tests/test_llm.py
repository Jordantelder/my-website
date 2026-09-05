from __future__ import annotations

import httpx
import ollama
import pytest

from rinn.config import Settings
from rinn.llm import Chunk, LLMError, ModelNotAvailable, OllamaLLM, OllamaUnavailable

from conftest import FakeOllamaClient

MESSAGES = [{"role": "system", "content": "sys"}, {"role": "user", "content": "hi"}]


def test_ensure_model_passes_when_model_present(llm):
    llm.ensure_model()


def test_ensure_model_reports_missing_model_with_pull_hint():
    llm = OllamaLLM(Settings(model="qwen3.8:27b-q8_0"), client=FakeOllamaClient(models=["llama3:8b"]))
    with pytest.raises(ModelNotAvailable) as excinfo:
        llm.ensure_model()
    assert "ollama pull qwen3.8:27b-q8_0" in str(excinfo.value)


def test_ensure_model_reports_unreachable_server():
    client = FakeOllamaClient(show_error=httpx.ConnectError("connection refused"))
    with pytest.raises(OllamaUnavailable) as excinfo:
        OllamaLLM(Settings(), client=client).ensure_model()
    assert "ollama serve" in str(excinfo.value)


def test_available_models_lists_server_models(llm):
    assert llm.available_models() == ["qwen3.8:27b"]


def test_chat_returns_content_thinking_and_usage(llm, fake_client):
    reply = llm.chat(MESSAGES)
    assert reply.content == "stub answer"
    assert reply.thinking == "thinking about it"
    assert reply.model == "qwen3.8:27b"
    assert reply.done_reason == "stop"
    assert (reply.prompt_tokens, reply.completion_tokens, reply.duration_ns) == (11, 7, 1234)

    call = fake_client.calls[0]
    assert call["model"] == "qwen3.8:27b"
    assert call["messages"] == MESSAGES
    assert call["stream"] is False
    assert call["think"] is True
    assert call["keep_alive"] == "10m"
    assert call["options"] == Settings().ollama_options()


def test_chat_honours_think_false(fake_client):
    llm = OllamaLLM(Settings(think=False), client=fake_client)
    llm.chat(MESSAGES)
    assert fake_client.calls[0]["think"] is False


def test_streaming_delivers_chunks_in_order_and_assembles_reply(llm, fake_client):
    seen: list[Chunk] = []
    reply = llm.chat(MESSAGES, on_chunk=seen.append)
    assert [c.kind for c in seen] == ["thinking", "content", "content"]
    assert "".join(c.text for c in seen if c.kind == "content") == "stub answer"
    assert reply.content == "stub answer"
    assert reply.thinking == "thinking about it"
    assert reply.completion_tokens == 7
    assert fake_client.calls[0]["stream"] is True


def test_streaming_without_thinking_yields_only_content():
    client = FakeOllamaClient(thinking=None)
    seen: list[Chunk] = []
    reply = OllamaLLM(Settings(), client=client).chat(MESSAGES, on_chunk=seen.append)
    assert all(c.kind == "content" for c in seen)
    assert reply.thinking is None


def test_retries_without_think_when_model_rejects_it():
    client = FakeOllamaClient(chat_errors=[ollama.ResponseError('"llama3:8b" does not support thinking', 400)])
    llm = OllamaLLM(Settings(model="llama3:8b"), client=client)
    reply = llm.chat(MESSAGES)
    assert reply.content == "stub answer"
    assert "think" in client.calls[0]
    assert "think" not in client.calls[1]
    # Subsequent calls do not send the flag either.
    llm.chat(MESSAGES)
    assert "think" not in client.calls[2]


def test_streaming_request_errors_are_translated():
    client = FakeOllamaClient(chat_errors=[ollama.ResponseError("model not found", 404)])
    with pytest.raises(ModelNotAvailable):
        OllamaLLM(Settings(), client=client).chat(MESSAGES, on_chunk=lambda c: None)


def test_other_response_errors_become_llm_error():
    client = FakeOllamaClient(chat_errors=[ollama.ResponseError("server exploded", 500)])
    with pytest.raises(LLMError) as excinfo:
        OllamaLLM(Settings(), client=client).chat(MESSAGES)
    assert "status 500" in str(excinfo.value)
    assert not isinstance(excinfo.value, (ModelNotAvailable, OllamaUnavailable))


def test_transport_errors_become_unavailable():
    client = FakeOllamaClient(chat_errors=[httpx.ReadTimeout("slow")])
    with pytest.raises(OllamaUnavailable):
        OllamaLLM(Settings(), client=client).chat(MESSAGES)
