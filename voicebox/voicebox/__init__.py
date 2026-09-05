"""Voicebox: a generic push-to-talk voice assistant on your own local model.

Voicebox is deliberately not tied to any domain. Its identity lives in ``persona.md``, what it
knows lives in the ``knowledge/`` folder, and every heavy step (transcription, the language
model, speech synthesis) runs on the server so the handheld or phone only records and plays.
It reuses the engine modules from the ``rinn-ollama`` package (Ollama wrapper, sentence
chunker, audio helpers, speech client); nothing about that package's own persona is used.
"""

__version__ = "0.1.0"
