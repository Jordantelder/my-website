"""``rinn-voice``: talk to RINN with a microphone and hear the answer."""
from __future__ import annotations

import argparse
import sys
from typing import Optional, Sequence, TextIO

from .. import __version__
from ..assistant import RinnAssistant
from ..cli import load_context_files
from ..config import ConfigError, Settings
from ..llm import LLMError, ModelNotAvailable, OllamaLLM, OllamaUnavailable
from .audio import AudioError, Player, Recorder, list_devices
from .loop import VoiceLoop
from .stt import FasterWhisperTranscriber, STTError, Transcriber
from .tts_client import TTSClient, TTSError, TTSSettings

EXIT_OK, EXIT_ERROR, EXIT_OLLAMA, EXIT_MODEL, EXIT_TTS, EXIT_AUDIO = 0, 1, 2, 3, 4, 5


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="rinn-voice", description="Voice conversation with RINN (Ollama + faster-whisper + a TTS server).")
    parser.add_argument("--ask", metavar="QUESTION", help="ask one question, speak the answer, exit")
    parser.add_argument("--context", metavar="PATH", action="append", default=[], help="text file to ground answers in (repeatable)")
    parser.add_argument("--text-only", action="store_true", help="no microphone: type questions, still speak answers")
    parser.add_argument("--no-speak", action="store_true", help="do not synthesize speech (text only)")
    parser.add_argument("--list-devices", action="store_true", help="list microphones and speakers, then exit")
    parser.add_argument("--mic", dest="mic_device", help="input device index or name substring")
    parser.add_argument("--speaker", dest="speaker_device", help="output device index or name substring")
    parser.add_argument("--silence", type=float, default=1.2, help="seconds of silence that ends your question (default 1.2)")
    parser.add_argument("--stt-model", default="large-v3-turbo", help="faster-whisper model (large-v3-turbo, distil-large-v3, small.en, ...)")
    parser.add_argument("--stt-device", default="auto", help="cuda, cpu or auto")
    parser.add_argument("--stt-compute", default="default", help="float16 on GPU, int8 on CPU, or default")
    parser.add_argument("--tts-url", help="TTS server base URL (default RINN_TTS_URL or http://127.0.0.1:8880/v1)")
    parser.add_argument("--tts-voice", help="voice id (default RINN_TTS_VOICE or af_bella)")
    parser.add_argument("--tts-model", help="model name sent to the TTS server (default rinn; use 'kokoro' for Kokoro-FastAPI)")
    parser.add_argument("--tts-speed", type=float, help="speech speed multiplier")
    parser.add_argument("--tts-api-key", help="API key for the TTS server, if it requires one (default RINN_TTS_API_KEY)")
    parser.add_argument("--model", help="Ollama model tag (default RINN_MODEL or qwen3.8:27b)")
    parser.add_argument("--host", help="Ollama server URL")
    parser.add_argument("--think", action="store_true", help="enable the model's thinking mode (slower first words; off by default for voice)")
    parser.add_argument("--show-thinking", action="store_true", help="print the model's reasoning while it streams")
    parser.add_argument("--version", action="version", version=f"rinn-voice {__version__}")
    return parser


def _device_arg(value: Optional[str]) -> Optional[int | str]:
    if value is None or value == "":
        return None
    return int(value) if value.isdigit() else value


def main(argv: Optional[Sequence[str]] = None, out: TextIO = sys.stdout, err: TextIO = sys.stderr, transcriber: Transcriber | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.list_devices:
        try:
            print(list_devices(), file=out)
        except AudioError as exc:
            print(f"error: {exc}", file=err)
            return EXIT_AUDIO
        return EXIT_OK

    try:
        settings = Settings.from_env().with_overrides(
            model=args.model,
            host=args.host,
            think=True if args.think else False,
            show_thinking=True if args.show_thinking else None,
        )
    except ConfigError as exc:
        print(f"configuration error: {exc}", file=err)
        return EXIT_ERROR

    try:
        docs = load_context_files(args.context)
    except OSError as exc:
        print(f"cannot read context file: {exc}", file=err)
        return EXIT_ERROR

    llm = OllamaLLM(settings)
    try:
        llm.ensure_model()
    except LLMError as exc:
        print(f"error: {exc}", file=err)
        return EXIT_OLLAMA if isinstance(exc, OllamaUnavailable) else EXIT_MODEL if isinstance(exc, ModelNotAvailable) else EXIT_ERROR
    assistant = RinnAssistant(llm, settings)

    tts: TTSClient | None = None
    player: Player | None = None
    if not args.no_speak:
        tts_settings = TTSSettings.from_env().with_overrides(
            base_url=args.tts_url.rstrip("/") if args.tts_url else None,
            voice=args.tts_voice,
            model=args.tts_model,
            speed=args.tts_speed,
            api_key=args.tts_api_key,
        )
        tts = TTSClient(tts_settings)
        if not tts.health():
            print(
                f"error: no TTS server at {tts_settings.base_url}. Start one in another terminal:\n"
                "  rinn-voice-server --backend kokoro --voice af_bella\n"
                "or pass --no-speak to run without audio output.",
                file=err,
            )
            return EXIT_TTS
        try:
            available = tts.voices()
            if available and tts_settings.voice not in available and "clone" not in available:
                print(f"note: voice {tts_settings.voice!r} is not in the server's list ({', '.join(available[:8])}); the server default will be used", file=err)
        except TTSError as exc:
            print(f"note: {exc}", file=err)
        try:
            player = Player(device=_device_arg(args.speaker_device))
        except AudioError as exc:
            print(f"error: {exc}\n(use --no-speak to run without audio output)", file=err)
            return EXIT_AUDIO
        print(f"speech: {tts_settings.base_url} voice={tts_settings.voice}", file=out)

    recorder: Recorder | None = None
    if not args.text_only and args.ask is None:
        if transcriber is None:
            print(f"loading speech-to-text model {args.stt_model} on {args.stt_device}...", file=out, flush=True)
            try:
                transcriber = FasterWhisperTranscriber(model=args.stt_model, device=args.stt_device, compute_type=args.stt_compute)
            except STTError as exc:
                print(f"error: {exc}\n(use --text-only to type instead)", file=err)
                return EXIT_AUDIO
        recorder = Recorder(device=_device_arg(args.mic_device), silence_seconds=args.silence)

    loop = VoiceLoop(
        assistant,
        tts,
        player,
        transcriber=transcriber if recorder is not None else None,
        recorder=recorder,
        out=out,
        err=err,
        show_thinking=settings.show_thinking,
    )
    try:
        if args.ask is not None:
            if not args.ask.strip():
                print("no question given", file=err)
                return EXIT_ERROR
            print("rinn> ", end="", file=out, flush=True)
            try:
                loop.answer(args.ask, context=docs)
            except LLMError as exc:
                print(f"error: {exc}", file=err)
                return EXIT_ERROR
            return EXIT_OK
        return loop.run(context=docs)
    finally:
        if player is not None:
            player.close()
        if tts is not None:
            tts.close()
