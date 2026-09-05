"""Voice layer for RINN: speech in (faster-whisper), streamed text out, speech out (any
OpenAI-compatible text-to-speech server, including ``rinn-voice-server``).

Heavy audio/ML libraries are imported lazily inside the modules that need them, so this
package imports cleanly on machines without a microphone, a GPU, or those libraries.
"""
from .chunker import SentenceChunker, strip_markdown_for_speech
from .tts_client import TTSClient, TTSError, TTSSettings

__all__ = ["SentenceChunker", "TTSClient", "TTSError", "TTSSettings", "strip_markdown_for_speech"]
