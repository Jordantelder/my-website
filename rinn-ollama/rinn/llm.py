"""Thin wrapper around the Ollama chat API.

This is the only module that talks to Ollama. Everything else works with the
``Reply`` and ``Chunk`` values it returns, which keeps the rest of the package
testable without a running server.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterator, Mapping, Optional, Sequence

import httpx
import ollama

from .config import Settings

Message = Mapping[str, Any]
ChunkCallback = Callable[["Chunk"], None]

# Bound TCP connect separately from generation so an unreachable remote host
# fails in seconds instead of waiting the full read timeout.
CONNECT_TIMEOUT_SECONDS = 10.0

# The ollama client turns httpx.ConnectError into the builtin ConnectionError for
# non-streaming calls and lets httpx errors through for streaming ones.
_TRANSPORT_ERRORS: tuple[type[BaseException], ...] = (ConnectionError, httpx.TransportError)
# A server that answers HTTP but is not Ollama yields json.JSONDecodeError (HTML
# body) or pydantic ValidationError (other JSON); both are ValueError subclasses.
_UNEXPECTED_RESPONSE_ERRORS: tuple[type[BaseException], ...] = (ValueError,)


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
        if client is None:
            timeout = httpx.Timeout(settings.timeout, connect=min(CONNECT_TIMEOUT_SECONDS, settings.timeout))
            client = ollama.Client(host=settings.host, timeout=timeout)
        self._client = client
        # Flipped to False if the server rejects the ``think`` parameter for this model.
        self._think_supported = True

    @property
    def model(self) -> str:
        return self.settings.model

    # -- server / model checks ------------------------------------------------

    def ensure_model(self) -> None:
        """Raise ``ModelNotAvailable`` or ``OllamaUnavailable`` if RINN cannot run."""
        self._guard(lambda: self._client.show(self.model))

    def available_models(self) -> list[str]:
        """Names of the models present on the server."""
        listing = self._guard(self._client.list)
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

        def drain() -> None:
            for part in rest:
                consume(part)

        self._guard(drain)

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

    def _guard(self, fn: Callable[[], Any]) -> Any:
        """Run ``fn`` translating every Ollama/transport failure into an ``LLMError``."""
        try:
            return fn()
        except ollama.ResponseError as exc:
            raise self._translate(exc) from exc
        except _TRANSPORT_ERRORS as exc:
            raise self._unavailable(exc) from exc
        except _UNEXPECTED_RESPONSE_ERRORS as exc:
            raise self._unexpected(exc) from exc

    def _call(self, fn: Callable[[dict[str, Any]], Any], messages: list[dict[str, Any]], stream: bool) -> Any:
        kwargs = self._kwargs(messages, stream)
        try:
            return fn(kwargs)
        except ollama.ResponseError as exc:
            if "think" in kwargs and self._is_think_rejection(exc):
                # Base model without a thinking capability: retry once without the flag.
                self._think_supported = False
                kwargs.pop("think")
                return self._guard(lambda: fn(kwargs))
            raise self._translate(exc) from exc
        except _TRANSPORT_ERRORS as exc:
            raise self._unavailable(exc) from exc
        except _UNEXPECTED_RESPONSE_ERRORS as exc:
            raise self._unexpected(exc) from exc

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
        lowered = message.lower()
        # Ollama phrases a missing model as `model 'X' not found` (HTTP 404) or, inside a
        # stream, as an error line with no HTTP status. A bare 404 from a proxy is not that.
        if "not found" in lowered and "model" in lowered:
            return ModelNotAvailable(
                f"model {self.model!r} is not available on {self.settings.host}. "
                f"Pull it with:  ollama pull {self.model}"
            )
        status = f" (status {exc.status_code})" if exc.status_code >= 0 else ""
        return LLMError(f"Ollama error for model {self.model!r}: {message}{status}")

    def _unavailable(self, exc: BaseException) -> OllamaUnavailable:
        return OllamaUnavailable(
            f"cannot reach Ollama at {self.settings.host} ({exc.__class__.__name__}: {exc}). "
            "Is `ollama serve` running?"
        )

    def _unexpected(self, exc: BaseException) -> LLMError:
        return LLMError(
            f"unexpected response from {self.settings.host}; is this an Ollama server? "
            f"({exc.__class__.__name__}: {str(exc).splitlines()[0] if str(exc) else exc.__class__.__name__})"
        )
