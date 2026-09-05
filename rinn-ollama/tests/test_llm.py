from __future__ import annotations

import json

import httpx
import ollama
import pytest

from rinn.config import Settings
from rinn.llm import CONNECT_TIMEOUT_SECONDS, Chunk, LLMError, ModelNotAvailable, OllamaLLM, OllamaUnavailable

from conftest import FakeOllamaClient

MESSAGES = [{"role": "system", "content": "sys"}, {"role": "user", "content": "hi"}]

# The message ollama.Client raises (as builtin ConnectionError) for non-streaming calls.
CONNECT_FAILURE = ConnectionError("Failed to connect to Ollama. Please check that Ollama is downloaded, running and accessible.")


def real_validation_error() -> Exception:
    """A pydantic ValidationError exactly as the client raises for a foreign JSON body."""
    try:
        ollama.ChatResponse(message="not-a-message")
    except Exception as exc:  # noqa: BLE001 - we want the concrete pydantic error
        return exc
    raise AssertionError("expected a validation error")


def test_real_client_gets_bounded_connect_timeout():
    llm = OllamaLLM(Settings(timeout=600))
    timeout = llm._client._client.timeout  # httpx.Client underneath ollama.Client
    assert timeout.connect == CONNECT_TIMEOUT_SECONDS
    assert timeout.read == 600.0
    short = OllamaLLM(Settings(timeout=3))._client._client.timeout
    assert short.connect == 3.0  # never longer than the overall timeout


def test_ensure_model_passes_when_model_present(llm):
    llm.ensure_model()


def test_ensure_model_reports_missing_model_with_pull_hint():
    llm = OllamaLLM(Settings(model="qwen3.8:27b-q8_0"), client=FakeOllamaClient(models=["llama3:8b"]))
    with pytest.raises(ModelNotAvailable) as excinfo:
        llm.ensure_model()
    assert "ollama pull qwen3.8:27b-q8_0" in str(excinfo.value)


def test_ensure_model_reports_unreachable_server():
    client = FakeOllamaClient(show_error=CONNECT_FAILURE)
    with pytest.raises(OllamaUnavailable) as excinfo:
        OllamaLLM(Settings(), client=client).ensure_model()
    assert "ollama serve" in str(excinfo.value)


@pytest.mark.parametrize(
    "error",
    [json.JSONDecodeError("Expecting value", "<html>", 0), real_validation_error()],
    ids=["html-body", "foreign-json"],
)
def test_non_ollama_http_server_is_reported_not_raised(error):
    client = FakeOllamaClient(show_error=error, list_error=error, chat_errors=[error, error])
    llm = OllamaLLM(Settings(), client=client)
    for call in (llm.ensure_model, llm.available_models, lambda: llm.chat(MESSAGES), lambda: llm.chat(MESSAGES, on_chunk=lambda c: None)):
        with pytest.raises(LLMError) as excinfo:
            call()
        assert "is this an Ollama server?" in str(excinfo.value)
        assert not isinstance(excinfo.value, (ModelNotAvailable, OllamaUnavailable))


def test_available_models_lists_server_models(llm):
    assert llm.available_models() == ["qwen3.8:27b"]


def test_available_models_unreachable():
    with pytest.raises(OllamaUnavailable):
        OllamaLLM(Settings(), client=FakeOllamaClient(list_error=CONNECT_FAILURE)).available_models()


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


@pytest.mark.parametrize("streaming", [False, True], ids=["blocking", "streaming"])
def test_retries_without_think_when_model_rejects_it(streaming):
    client = FakeOllamaClient(chat_errors=[ollama.ResponseError('"llama3:8b" does not support thinking', 400)])
    llm = OllamaLLM(Settings(model="llama3:8b"), client=client)
    on_chunk = (lambda c: None) if streaming else None
    reply = llm.chat(MESSAGES, on_chunk=on_chunk)
    assert reply.content == "stub answer"
    assert "think" in client.calls[0]
    assert "think" not in client.calls[1]
    llm.chat(MESSAGES, on_chunk=on_chunk)  # subsequent calls do not send the flag either
    assert "think" not in client.calls[2]


def test_streaming_request_errors_are_translated():
    client = FakeOllamaClient(chat_errors=[ollama.ResponseError('model "qwen3.8:27b" not found, try pulling it first', 404)])
    with pytest.raises(ModelNotAvailable):
        OllamaLLM(Settings(), client=client).chat(MESSAGES, on_chunk=lambda c: None)


def test_streaming_connect_error_is_unavailable():
    client = FakeOllamaClient(chat_errors=[httpx.ConnectError("connection refused")])
    with pytest.raises(OllamaUnavailable):
        OllamaLLM(Settings(), client=client).chat(MESSAGES, on_chunk=lambda c: None)


@pytest.mark.parametrize(
    "error, expected",
    [
        (httpx.ReadTimeout("slow"), OllamaUnavailable),
        (ollama.ResponseError("unexpected EOF"), LLMError),  # in-band error line, status_code -1
        (ollama.ResponseError("model 'qwen3.8:27b' not found"), ModelNotAvailable),
    ],
    ids=["read-timeout", "inband-error", "inband-missing-model"],
)
def test_errors_after_first_chunk_are_translated(error, expected):
    client = FakeOllamaClient(stream_error=error)
    seen: list[Chunk] = []
    with pytest.raises(expected) as excinfo:
        OllamaLLM(Settings(), client=client).chat(MESSAGES, on_chunk=seen.append)
    assert [c.kind for c in seen] == ["thinking", "content"]  # partial output reached the caller first
    if expected is LLMError:
        assert "status -1" not in str(excinfo.value)


def test_bare_404_from_a_proxy_is_not_reported_as_missing_model():
    client = FakeOllamaClient(chat_errors=[ollama.ResponseError("404 page not found", 404)])
    with pytest.raises(LLMError) as excinfo:
        OllamaLLM(Settings(), client=client).chat(MESSAGES)
    assert not isinstance(excinfo.value, ModelNotAvailable)
    assert "status 404" in str(excinfo.value)


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
    with pytest.raises(OllamaUnavailable):
        OllamaLLM(Settings(), client=FakeOllamaClient(chat_errors=[CONNECT_FAILURE])).chat(MESSAGES)
