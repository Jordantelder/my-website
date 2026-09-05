"""RINN (Regulatory Intelligence Neural Network) core model layer on Ollama.

This package is the model "building block" of RINN: the persona, the Ollama
client wrapper, a stateful assistant, and report export. Retrieval over the
FDA corpus is intentionally not included; see README.md.
"""
from .assistant import Answer, ContextDoc, RinnAssistant
from .config import ConfigError, Settings
from .llm import Chunk, LLMError, ModelNotAvailable, OllamaLLM, OllamaUnavailable, Reply
from .persona import DISCLAIMER, FULL_NAME, NAME, SYSTEM_PROMPT, build_system_prompt

__version__ = "0.1.0"

__all__ = [
    "Answer",
    "Chunk",
    "ConfigError",
    "ContextDoc",
    "DISCLAIMER",
    "FULL_NAME",
    "LLMError",
    "ModelNotAvailable",
    "NAME",
    "OllamaLLM",
    "OllamaUnavailable",
    "Reply",
    "RinnAssistant",
    "SYSTEM_PROMPT",
    "Settings",
    "build_system_prompt",
    "__version__",
]
