from __future__ import annotations

from typing import Any, Iterable

import ollama
import pytest

from rinn.config import Settings
from rinn.llm import OllamaLLM


class FakeOllamaClient:
    """Stand-in for ollama.Client that never touches the network."""

    def __init__(
        self,
        replies: Iterable[str] = ("stub answer",),
        models: Iterable[str] = ("qwen3.8:27b",),
        thinking: str | None = "thinking about it",
        chat_errors: Iterable[BaseException] = (),
        show_error: BaseException | None = None,
        list_error: BaseException | None = None,
    ) -> None:
        self.replies = list(replies)
        self.models = list(models)
        self.thinking = thinking
        self.chat_errors = list(chat_errors)
        self.show_error = show_error
        self.list_error = list_error
        self.calls: list[dict[str, Any]] = []

    def show(self, model: str) -> ollama.ShowResponse:
        if self.show_error is not None:
            raise self.show_error
        if model not in self.models:
            raise ollama.ResponseError(f'model "{model}" not found, try pulling it first', 404)
        return ollama.ShowResponse(model_info={}, capabilities=["completion", "thinking"])

    def list(self) -> ollama.ListResponse:
        if self.list_error is not None:
            raise self.list_error
        return ollama.ListResponse(models=[ollama.ListResponse.Model(model=name) for name in self.models])

    def chat(self, **kwargs: Any):
        self.calls.append(kwargs)
        if self.chat_errors:
            raise self.chat_errors.pop(0)
        text = self.replies.pop(0) if self.replies else "stub answer"
        model = kwargs["model"]
        if kwargs.get("stream"):
            return self._stream(model, text)
        return ollama.ChatResponse(
            model=model,
            done=True,
            done_reason="stop",
            prompt_eval_count=11,
            eval_count=7,
            total_duration=1234,
            message=ollama.Message(role="assistant", content=text, thinking=self.thinking),
        )

    def _stream(self, model: str, text: str):
        if self.thinking:
            yield ollama.ChatResponse(model=model, message=ollama.Message(role="assistant", thinking=self.thinking))
        half = max(1, len(text) // 2)
        yield ollama.ChatResponse(model=model, message=ollama.Message(role="assistant", content=text[:half]))
        yield ollama.ChatResponse(
            model=model,
            done=True,
            done_reason="stop",
            prompt_eval_count=11,
            eval_count=7,
            total_duration=1234,
            message=ollama.Message(role="assistant", content=text[half:]),
        )


@pytest.fixture
def settings() -> Settings:
    return Settings()


@pytest.fixture
def fake_client() -> FakeOllamaClient:
    return FakeOllamaClient()


@pytest.fixture
def llm(settings: Settings, fake_client: FakeOllamaClient) -> OllamaLLM:
    return OllamaLLM(settings, client=fake_client)
