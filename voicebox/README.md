# Voicebox

A generic push-to-talk voice assistant that runs entirely on your own hardware. Hold a
button (on a phone page or a small handheld), speak, and hear the answer. Everything
heavy runs on one always-on server: transcription, a local language model through Ollama,
and speech synthesis. The device only records and plays.

Voicebox has no built-in subject. Its personality is a Markdown file you edit
(`persona.md`), and what it knows is a folder of files (`knowledge/`) you add to at any
time: drop in documents, type a note on the phone page, or say "remember that ...".

- **Setup, step by step:** [`docs/PLAN.md`](docs/PLAN.md)
- **Server:** `voicebox-server` (`voicebox/server.py`)
- **Phone page:** served at `/` by the server
- **Handheld client:** `voicebox-device` (`voicebox/device/pi_button.py`)
- **Knowledge tools:** `voicebox sync | note | upload | list | remove | ask`

Voicebox reuses engine modules from the sibling `rinn-ollama` package (the Ollama wrapper,
sentence chunker, audio helpers, and the speech server `rinn-voice-server`). Nothing from
that project's own assistant persona is used here; the plan starts the shared speech server
with `--stt-prompt ""` so Whisper gets no domain vocabulary hint either.
