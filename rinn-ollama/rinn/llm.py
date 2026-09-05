"""Thin wrapper around the Ollama chat API.

This is the only module that talks to Ollama. Everything else works with the
``Reply`` and ``Chunk`` values it returns, which keeps the rest of the package
testable without a running server.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterator, Mapping, Optional, Sequence

import ollama

try:  # httpx is the transport underneath the ollama client
    import httpx

    _TRANSPORT_ERRORS: tuple[type[BaseException], ...] = (ConnectionError, httpx.TransportError)
except ImportError:  # pragma: no cover - httpx is a hard dependency of ollama
    _TRANSPORT_ERRORS = (ConnectionError,)

from .config import Settings

Message = Mapping[str, Any]
ChunkCallback = Callable[["Chunk"], None]


class LLMError(RuntimeError):
    """Base class for failures while talking to Ollama."""


class OllamaUnavailable(LLMError):
    """The Ollama server could not be reached."""


class ModelNotAvailable(LLMError):
    """The configured model has not been pulled on the server."""


@dataclass(frozen=True)
class Chunk:
    """One streamed piece of a response."""

    kind: str  # "thinking" or "content"
    text: str


@dataclass(frozen=True)
class Reply:
    """A complete model response."""

    content: str
    thinking: Optional[str]
    model: str
    done_reason: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    duration_ns: Optional[int] = None


class OllamaLLM:
    """RINN's connection to one Ollama server and one model.

    ``client`` may be any object with ``show``, ``list`` and ``chat`` methods
    compatible with :class:`ollama.Client`; tests pass a fake.
    """

    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self.settings = settings
        self._client = client if client is not None else ollama.Client(host=settings.host, timeout=settings.timeout)
        # Flipped to False if the server rejects the ``think`` parameter for this model.
        self._think_supported = True

    @property
    def model(self) -> str:
        return self.settings.model

    # -- server / model checks ------------------------------------------------

    def ensure_model(self) -> None:
        """Raise ``ModelNotAvailable`` or ``OllamaUnavailable`` if RINN cannot run."""
        try:
            self._client.show(self.model)
        except ollama.ResponseError as exc:
            raise self._translate(exc) from exc
        except _TRANSPORT_ERRORS as exc:
            raise self._unavailable(exc) from exc

    def available_models(self) -> list[str]:
        """Names of the models present on the server."""
        try:
            listing = self._client.list()
        except ollama.ResponseError as exc:
            raise self._translate(exc) from exc
        except _TRANSPORT_ERRORS as exc:
            raise self._unavailable(exc) from exc
        return [entry.model for entry in listing.models if entry.model]

    # -- chat -----------------------------------------------------------------

    def chat(self, messages: Sequence[Message], on_chunk: ChunkCallback | None = None) -> Reply:
        """Send ``messages`` and return the reply.

        With ``on_chunk`` the response is streamed and each piece is passed to
        the callback as it arrives; the assembled ``Reply`` is still returned.
        """
        history = [dict(message) for message in messages]
        if on_chunk is None:
            response = self._call(lambda kw: self._client.chat(**kw), history, stream=False)
            return self._reply_from(response, response.message.content or "", response.message.thinking or None)

        first, rest = self._call(self._open_stream, history, stream=True)
        content: list[str] = []
        thinking: list[str] = []
        last = None

        def consume(part: Any) -> None:
            nonlocal last
            last = part
            if part.message.thinking:
                thinking.append(part.message.thinking)
                on_chunk(Chunk("thinking", part.message.thinking))
            if part.message.content:
                content.append(part.message.content)
                on_chunk(Chunk("content", part.message.content))

        if first is not None:
            consume(first)
        try:
            for part in rest:
                consume(part)
        except ollama.ResponseError as exc:
            raise self._translate(exc) from exc
        except _TRANSPORT_ERRORS as exc:
            raise self._unavailable(exc) from exc

        if last is None:
            raise LLMError(f"Ollama returned an empty stream for model {self.model!r}")
        return self._reply_from(last, "".join(content), "".join(thinking) or None)

    # -- internals ------------------------------------------------------------

    def _open_stream(self, kwargs: dict[str, Any]) -> tuple[Any, Iterator[Any]]:
        """Start a streaming request and pull the first part so request errors surface here."""
        iterator = iter(self._client.chat(**kwargs))
        first = next(iterator, None)
        return first, iterator

    def _kwargs(self, messages: list[dict[str, Any]], stream: bool) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
            "options": self.settings.ollama_options(),
            "keep_alive": self.settings.keep_alive,
        }
        if self._think_supported:
            kwargs["think"] = self.settings.think
        return kwargs

    def _call(self, fn: Callable[[dict[str, Any]], Any], messages: list[dict[str, Any]], stream: bool) -> Any:
        kwargs = self._kwargs(messages, stream)
        try:
            return fn(kwargs)
        except ollama.ResponseError as exc:
            if "think" in kwargs and self._is_think_rejection(exc):
                # Base model without a thinking capability: retry once without the flag.
                self._think_supported = False
                kwargs.pop("think")
                try:
                    return fn(kwargs)
                except ollama.ResponseError as retry_exc:
                    raise self._translate(retry_exc) from retry_exc
                except _TRANSPORT_ERRORS as retry_exc:
                    raise self._unavailable(retry_exc) from retry_exc
            raise self._translate(exc) from exc
        except _TRANSPORT_ERRORS as exc:
            raise self._unavailable(exc) from exc

    @staticmethod
    def _is_think_rejection(exc: ollama.ResponseError) -> bool:
        return exc.status_code == 400 and "think" in str(exc.error).lower()

    def _reply_from(self, response: Any, content: str, thinking: Optional[str]) -> Reply:
        return Reply(
            content=content,
            thinking=thinking,
            model=response.model or self.model,
            done_reason=response.done_reason,
            prompt_tokens=response.prompt_eval_count,
            completion_tokens=response.eval_count,
            duration_ns=response.total_duration,
        )

    def _translate(self, exc: ollama.ResponseError) -> LLMError:
        message = str(exc.error)
        if exc.status_code == 404 or "not found" in message.lower():
            return ModelNotAvailable(
                f"model {self.model!r} is not available on {self.settings.host}. "
                f"Pull it with:  ollama pull {self.model}"
            )
        return LLMError(f"Ollama error for model {self.model!r}: {message} (status {exc.status_code})")

    def _unavailable(self, exc: BaseException) -> OllamaUnavailable:
        return OllamaUnavailable(
            f"cannot reach Ollama at {self.settings.host} ({exc.__class__.__name__}: {exc}). "
            "Is `ollama serve` running?"
        )
