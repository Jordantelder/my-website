"""``voicebox-device``: the handheld client.

Hold the button, speak, release. The recording goes to the Voicebox server; the answer's
text is printed and its audio is played as it streams back. Runs on a Raspberry Pi with a
button on a GPIO pin (and an optional LED), or on any laptop with ``--no-gpio`` where the
Enter key starts and stops recording. All heavy work happens on the server.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import queue
import socket
import sys
import threading
import time
from typing import Any, Callable, Iterator, Optional, TextIO

import httpx
import numpy as np
from rinn.voice.audio import AudioClip, AudioError, Player, clip_to_wav_bytes, list_devices, to_mono_float32

EXIT_OK, EXIT_ERROR, EXIT_AUDIO = 0, 1, 5


class TurnClient:
    """Streams one turn from the server as parsed NDJSON events."""

    def __init__(self, base_url: str, api_key: str = "", session: str = "handheld", timeout: float = 180.0, transport: httpx.BaseTransport | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.session = session
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._client = httpx.Client(base_url=self.base_url, timeout=httpx.Timeout(timeout, connect=5.0), headers=headers, transport=transport)
        self._active: httpx.Response | None = None
        self._lock = threading.Lock()

    def health(self) -> dict[str, Any] | None:
        try:
            response = self._client.get("/health")
            return response.json() if response.headers.get("content-type", "").startswith("application/json") else {"status": response.status_code}
        except (httpx.HTTPError, ValueError):
            return None

    def stream(self, clip: AudioClip | None = None, text: str | None = None, speak: bool = True) -> Iterator[dict[str, Any]]:
        data = {"session": self.session, "speak": "true" if speak else "false"}
        files = None
        if text:
            data["text"] = text
        if clip is not None:
            files = {"audio": ("turn.wav", clip_to_wav_bytes(clip), "audio/wav")}
        with self._client.stream("POST", "/turn", data=data, files=files) as response:
            with self._lock:
                self._active = response
            try:
                if response.status_code >= 400:
                    body = response.read().decode("utf-8", errors="replace")[:300]
                    raise ConnectionError(f"server returned {response.status_code}: {body}")
                for line in response.iter_lines():
                    line = line.strip()
                    if line:
                        yield json.loads(line)
            finally:
                with self._lock:
                    self._active = None

    def cancel(self) -> None:
        """Abort the turn in flight (from another thread): the stream loop then raises httpx.HTTPError."""
        with self._lock:
            response = self._active
        if response is not None:
            try:
                response.close()
            except Exception:  # noqa: BLE001
                pass

    def close(self) -> None:
        self._client.close()


def decode_pcm16(event: dict[str, Any]) -> AudioClip:
    raw = base64.b64decode(event.get("pcm16", ""))
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    return AudioClip(samples, int(event.get("sample_rate") or 24000))


def beep(pattern: str = "error", sample_rate: int = 24000) -> AudioClip:
    """Short tones for feedback without the server: 'ready', 'listening', 'error'."""
    freqs = {"ready": (660, 880), "listening": (880,), "error": (440, 330)}[pattern]
    pieces = []
    for f in freqs:
        t = np.arange(int(0.12 * sample_rate)) / sample_rate
        tone = 0.25 * np.sin(2 * np.pi * f * t) * np.hanning(len(t))
        pieces.append(tone.astype(np.float32))
        pieces.append(np.zeros(int(0.04 * sample_rate), dtype=np.float32))
    return AudioClip(np.concatenate(pieces), sample_rate)


class HeldRecorder:
    """Records from the microphone between start() and stop()."""

    def __init__(self, sample_rate: int = 16000, device: Optional[int | str] = None, max_seconds: float = 30.0, sd: Any | None = None) -> None:
        self.sample_rate = sample_rate
        self.device = device
        self.max_seconds = max_seconds
        self._sd = sd
        self._blocks: list[np.ndarray] = []
        self._stream: Any = None
        self._lock = threading.Lock()
        self._started_at = 0.0

    def _module(self) -> Any:
        if self._sd is not None:
            return self._sd
        try:
            import sounddevice  # noqa: WPS433
        except (ImportError, OSError) as exc:
            raise AudioError(f"sounddevice/PortAudio not available ({exc}); on the Pi run: sudo apt install libportaudio2 && pip install sounddevice") from exc
        return sounddevice

    def start(self) -> None:
        with self._lock:
            if self._stream is not None:
                return
            self._blocks = []
            sd = self._module()

            def callback(indata: np.ndarray, frames: int, time_info: Any, status: Any) -> None:  # noqa: ARG001
                if self._stream is not None and time.monotonic() - self._started_at <= self.max_seconds:
                    self._blocks.append(np.array(indata, copy=True))

            # Stamp the start before the stream runs: the callback can fire immediately and
            # drops blocks that fall outside the max_seconds window.
            self._started_at = time.monotonic()
            errors: list[str] = []
            # Some cards (two-microphone HATs) only open as stereo; blocks are downmixed in stop().
            for channels in (1, 2):
                try:
                    self._stream = sd.InputStream(samplerate=self.sample_rate, channels=channels, dtype="float32", device=self.device, callback=callback)
                    self._stream.start()
                    return
                except Exception as exc:  # noqa: BLE001
                    self._stream = None
                    errors.append(f"{channels} channel(s): {exc}")
            raise AudioError(f"cannot open microphone (device={self.device!r}): " + "; ".join(errors))

    def stop(self) -> AudioClip:
        with self._lock:
            stream, self._stream = self._stream, None
            if stream is not None:
                try:
                    stream.stop()
                    stream.close()
                except Exception:  # noqa: BLE001
                    pass
            if not self._blocks:
                return AudioClip(np.zeros(0, dtype=np.float32), self.sample_rate)
            samples = np.concatenate([to_mono_float32(b) for b in self._blocks])
            self._blocks = []
            return AudioClip(samples, self.sample_rate)

    @property
    def recording(self) -> bool:
        return self._stream is not None


class Handheld:
    """Runs turns and plays them; independent of how the button is wired."""

    def __init__(self, client: TurnClient, player: Player | None, out: TextIO = sys.stdout, led: Any | None = None) -> None:
        self.client = client
        self.player = player
        self.out = out
        self.led = led  # object with on(), off(), blink() such as gpiozero.LED; optional
        self.cancelled = threading.Event()
        self._turn: threading.Thread | None = None

    def interrupt(self) -> None:
        """Stop the answer that is playing or still streaming (the button was pressed again)."""
        self.cancelled.set()
        if self.player is not None:
            self.player.stop()
        cancel = getattr(self.client, "cancel", None)
        if cancel is not None:
            cancel()
        if self._turn is not None and self._turn.is_alive():
            self._turn.join(timeout=3.0)

    @property
    def busy(self) -> bool:
        return self._turn is not None and self._turn.is_alive()

    def report_speaker(self) -> None:
        """Player failures are recorded, not raised; say so instead of playing silence."""
        errors = getattr(self.player, "errors", None)
        if errors:
            print(f"[speaker: {errors[-1]}; run voicebox-device --list-devices and pass --speaker, or use --no-speak]", file=self.out, flush=True)
            errors.clear()

    def _led(self, state: str) -> None:
        if self.led is None:
            return
        try:
            if state == "listening":
                self.led.on()
            elif state == "thinking":
                self.led.blink(on_time=0.15, off_time=0.15)
            elif state == "speaking":
                self.led.blink(on_time=0.6, off_time=0.6)
            else:
                self.led.off()
        except Exception:  # noqa: BLE001 - LED is decoration
            pass

    def run_turn(self, clip: AudioClip | None = None, text: str | None = None) -> dict[str, Any]:
        """Send one turn, print and play it, return the final 'done' event (or an error dict)."""
        self._led("thinking")
        self.cancelled.clear()
        if self.player is not None:
            self.player.stop()
        printed_reply = False
        problem: str | None = None
        final: dict[str, Any] = {"type": "done"}
        try:
            for event in self.client.stream(clip=clip, text=text, speak=self.player is not None):
                if self.cancelled.is_set():
                    break
                kind = event.get("type")
                if kind == "transcript":
                    print(f"you: {event.get('text', '')}", file=self.out, flush=True)
                elif kind == "text":
                    if not printed_reply:
                        self.out.write("voicebox: ")
                        printed_reply = True
                    self.out.write(event.get("text", ""))
                    self.out.flush()
                elif kind == "audio" and self.player is not None:
                    self._led("speaking")
                    self.player.enqueue(decode_pcm16(event))
                elif kind == "note_saved":
                    print(f"saved note: {event.get('text', '')}", file=self.out, flush=True)
                elif kind == "error":
                    problem = str(event.get("detail", ""))
                    print(f"\n[problem: {problem}]", file=self.out, flush=True)
                elif kind == "done":
                    final = event
            if final.get("type") == "done" and problem and not final.get("answer"):
                final = {"type": "error", "detail": problem}  # the server reported a failure and produced no answer
        except (httpx.HTTPError, httpx.StreamError, ConnectionError, ValueError) as exc:  # StreamError: the stream was closed by interrupt()
            if not self.cancelled.is_set():
                print(f"\n[cannot reach the server: {exc}]", file=self.out, flush=True)
                if self.player is not None:
                    self.player.enqueue(beep("error"))
                final = {"type": "error", "detail": str(exc)}
        finally:
            if self.cancelled.is_set():
                print("\n(interrupted)", file=self.out, flush=True)
                final = {"type": "cancelled"}
            elif printed_reply:
                self.out.write("\n")
                self.out.flush()
            if self.player is not None:
                self.player.wait()
                self.report_speaker()
            self._led("idle")
        return final

    def serve_button(self, recorder: HeldRecorder, pressed: "queue.Queue[str]", stop: threading.Event) -> None:
        """Main loop for GPIO or keyboard: 'press' starts recording (and interrupts any answer), 'release' sends the clip.

        Turns run on a worker thread so a press during a long answer is seen at once.
        """
        while not stop.is_set():
            try:
                action = pressed.get(timeout=0.5)
            except queue.Empty:
                continue
            if action == "press":
                if self.busy:
                    self.interrupt()
                elif self.player is not None:
                    self.player.stop()
                try:
                    recorder.start()
                    self._led("listening")
                    if self.player is not None:
                        self.player.enqueue(beep("listening"))
                except AudioError as exc:
                    print(f"[microphone: {exc}]", file=self.out, flush=True)
            elif action == "release":
                if not recorder.recording:
                    continue
                clip = recorder.stop()
                self._led("idle")
                if clip.duration < 0.4:
                    print("(too short; hold the button while you speak)", file=self.out, flush=True)
                    continue
                self._turn = threading.Thread(target=self.run_turn, kwargs={"clip": clip}, name="voicebox-turn", daemon=True)
                self._turn.start()
        if self.busy:
            self.interrupt()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="voicebox-device", description="Hold-to-talk handheld client for a Voicebox server.")
    parser.add_argument("--url", default=os.environ.get("VOICEBOX_URL", "http://127.0.0.1:8800"), help="server URL (default VOICEBOX_URL)")
    parser.add_argument("--api-key", default=os.environ.get("VOICEBOX_API_KEY", ""), help="server API key (default VOICEBOX_API_KEY)")
    parser.add_argument("--session", default=os.environ.get("VOICEBOX_SESSION", socket.gethostname()), help="device name used for conversation memory")
    parser.add_argument("--button-pin", type=int, default=int(os.environ.get("VOICEBOX_BUTTON_PIN", "17")), help="GPIO (BCM) pin of the talk button, other side to GND")
    parser.add_argument("--led-pin", type=int, default=int(os.environ.get("VOICEBOX_LED_PIN", "0")), help="GPIO pin of a status LED (0 = none)")
    parser.add_argument("--no-gpio", action="store_true", help="keyboard mode: press Enter to start and Enter again to stop")
    parser.add_argument("--mic", help="input device index or name substring")
    parser.add_argument("--speaker", help="output device index or name substring")
    parser.add_argument("--no-speak", action="store_true", help="print answers only")
    parser.add_argument("--ask", help="send one typed question and exit")
    parser.add_argument("--list-devices", action="store_true", help="print the microphones and speakers PortAudio can see, then exit")
    return parser


def _device_arg(value: Optional[str]) -> Optional[int | str]:
    if not value:
        return None
    return int(value) if value.isdigit() else value


def main(argv: Optional[list[str]] = None, out: TextIO = sys.stdout, client: TurnClient | None = None, player: Player | None = None, input_fn: Callable[[str], str] = input) -> int:
    args = build_parser().parse_args(argv)
    if args.list_devices:
        try:
            print(list_devices(), file=out)
        except AudioError as exc:
            print(f"error: {exc}", file=out)
            return EXIT_AUDIO
        return EXIT_OK
    client = client or TurnClient(args.url, api_key=args.api_key, session=args.session)
    if player is None and not args.no_speak:
        try:
            player = Player(device=_device_arg(args.speaker))
        except AudioError as exc:
            print(f"error: {exc} (use --no-speak to run without audio output)", file=out, flush=True)
            return EXIT_AUDIO
    stop = threading.Event()
    try:
        health = client.health()
        if health is None:
            print(f"warning: no Voicebox server at {args.url}; turns will fail until it is up", file=out, flush=True)
        else:
            print(f"server: {args.url} status={health.get('status')} model={health.get('model')}", file=out, flush=True)
        handheld = Handheld(client, player, out=out)

        if args.ask:
            final = handheld.run_turn(text=args.ask)
            return EXIT_OK if final.get("type") == "done" else EXIT_ERROR

        recorder = HeldRecorder(device=_device_arg(args.mic))
        pressed: "queue.Queue[str]" = queue.Queue()

        if args.no_gpio:
            print("keyboard mode: press Enter to start recording, Enter again to send; Ctrl+C to quit", file=out, flush=True)

            def keyboard() -> None:
                state = "idle"
                while not stop.is_set():
                    try:
                        input_fn("")
                    except (EOFError, KeyboardInterrupt):
                        stop.set()
                        return
                    pressed.put("press" if state == "idle" else "release")
                    state = "recording" if state == "idle" else "idle"

            threading.Thread(target=keyboard, daemon=True).start()
        else:
            try:
                from gpiozero import LED, Button  # noqa: WPS433 - Raspberry Pi only
            except ImportError:
                print("gpiozero is not installed (pip install gpiozero) or this is not a Raspberry Pi; use --no-gpio", file=out, flush=True)
                return EXIT_ERROR
            button = Button(args.button_pin, pull_up=True, bounce_time=0.05)
            button.when_pressed = lambda: pressed.put("press")
            button.when_released = lambda: pressed.put("release")
            if args.led_pin:
                handheld.led = LED(args.led_pin)
            print(f"ready: hold the button on GPIO {args.button_pin} to talk (Ctrl+C to quit)", file=out, flush=True)
            if player is not None:
                player.enqueue(beep("ready"))
                player.wait(timeout=3.0)
                handheld.report_speaker()

        try:
            handheld.serve_button(recorder, pressed, stop)
        except KeyboardInterrupt:
            pass
        return EXIT_OK
    finally:
        stop.set()
        if player is not None:
            player.close()
        client.close()
