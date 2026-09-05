from __future__ import annotations

import io
import json
import queue
import threading
from typing import Any, Iterator

import httpx
import numpy as np
import pytest
from rinn.voice.audio import AudioClip, AudioError

from voicebox.assistant import pcm16_base64
from voicebox.device.pi_button import EXIT_ERROR, EXIT_OK, Handheld, HeldRecorder, TurnClient, beep, decode_pcm16, main

from .conftest import FakeLED, FakePlayer, FakeSoundDevice, tone


def ndjson_response(events: list[dict], status: int = 200) -> httpx.Response:
    body = "".join(json.dumps(e) + "\n" for e in events)
    return httpx.Response(status, content=body.encode(), headers={"content-type": "application/x-ndjson"})


def audio_event(text: str) -> dict:
    return {"type": "audio", "text": text, "sample_rate": 24000, "pcm16": pcm16_base64(AudioClip(np.full(240, 0.2, dtype=np.float32), 24000))}


SCRIPT = [
    {"type": "transcript", "text": "hello there"},
    {"type": "text", "text": "Hi! "},
    {"type": "text", "text": "How can I help?"},
    audio_event("Hi!"),
    audio_event("How can I help?"),
    {"type": "done", "answer": "Hi! How can I help?", "seconds": 1.2},
]


class ScriptedClient:
    """Stands in for TurnClient."""

    def __init__(self, events: list[dict] | None = None, error: BaseException | None = None, healthy: bool = True, gate: threading.Event | None = None) -> None:
        self.events = events if events is not None else SCRIPT
        self.error = error
        self.healthy = healthy
        self.gate = gate  # when set, the stream blocks after the first event until cancel() or the gate opens
        self.calls: list[dict[str, Any]] = []
        self.cancelled = 0
        self.closed = False

    def cancel(self) -> None:
        self.cancelled += 1
        if self.gate is not None:
            self.gate.set()

    def health(self):
        return {"status": "ok", "model": "qwen3.8:27b"} if self.healthy else None

    def stream(self, clip=None, text=None, speak=True) -> Iterator[dict]:
        self.calls.append({"clip": clip, "text": text, "speak": speak})
        if self.error is not None:
            raise self.error
        cancelled_before = self.cancelled
        for i, event in enumerate(self.events):
            if i == 1 and self.gate is not None:
                self.gate.wait(timeout=5)
                if self.cancelled > cancelled_before:  # cancelled during THIS stream, like a closed socket
                    raise httpx.ReadError("stream closed")
            yield event

    def close(self) -> None:
        self.closed = True


# -- TurnClient over a mock transport ---------------------------------------------------


def test_turn_client_streams_events_and_sends_wav():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = request.read()
        if request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok", "model": "m"})
        return ndjson_response(SCRIPT)

    client = TurnClient("http://box:8800/", api_key="k", session="pi-1", transport=httpx.MockTransport(handler))
    assert client.health() == {"status": "ok", "model": "m"}
    events = list(client.stream(clip=tone(0.5)))
    assert [e["type"] for e in events] == ["transcript", "text", "text", "audio", "audio", "done"]
    assert seen["path"] == "/turn" and seen["auth"] == "Bearer k"
    assert b'name="session"\r\n\r\npi-1' in seen["body"] and b'name="speak"\r\n\r\ntrue' in seen["body"] and b"RIFF" in seen["body"]
    list(client.stream(text="typed", speak=False))
    assert b"typed" in seen["body"] and b"speak=false" in seen["body"] or b"false" in seen["body"]
    client.close()


def test_turn_client_cancel_closes_the_stream():
    def handler(request: httpx.Request) -> httpx.Response:
        def body():
            yield (json.dumps({"type": "text", "text": "a"}) + "\n").encode()
            threading.Event().wait(0.2)
            yield (json.dumps({"type": "done"}) + "\n").encode()

        return httpx.Response(200, stream=_IterStream(body()), headers={"content-type": "application/x-ndjson"})

    client = TurnClient("http://box:8800", transport=httpx.MockTransport(handler))
    events = client.stream(text="hi")
    assert next(events)["type"] == "text"
    assert client._active is not None and not client._active.is_closed
    client.cancel()  # closes the response; on a real socket the next read raises and run_turn reports "(interrupted)"
    assert client._active is None or client._active.is_closed
    try:
        list(events)  # the mock stream cannot emulate a socket close, so it may finish instead of raising
    except (httpx.HTTPError, httpx.StreamError):
        pass
    assert client._active is None
    client.cancel()  # idempotent when nothing is in flight
    client.close()


class _IterStream(httpx.SyncByteStream):
    def __init__(self, gen):
        self._gen = gen

    def __iter__(self):
        yield from self._gen


def test_turn_client_error_statuses():
    client = TurnClient("http://box:8800", transport=httpx.MockTransport(lambda r: httpx.Response(401, json={"detail": "missing or wrong API key"})))
    with pytest.raises(ConnectionError, match="401"):
        list(client.stream(text="hi"))
    assert client.health() == {"detail": "missing or wrong API key"}  # JSON bodies are passed through
    down = TurnClient("http://box:8800", transport=httpx.MockTransport(lambda r: (_ for _ in ()).throw(httpx.ConnectError("refused"))))
    assert down.health() is None
    with pytest.raises(httpx.HTTPError):
        list(down.stream(text="hi"))


# -- audio helpers -------------------------------------------------------------------------------


def test_decode_pcm16_roundtrip():
    clip = AudioClip(np.array([0.0, 0.25, -0.25], dtype=np.float32), 24000)
    back = decode_pcm16({"pcm16": pcm16_base64(clip), "sample_rate": 24000})
    assert back.sample_rate == 24000 and np.allclose(back.samples, clip.samples, atol=1e-3)
    assert decode_pcm16({}).sample_rate == 24000 and len(decode_pcm16({}).samples) == 0


@pytest.mark.parametrize("pattern", ["ready", "listening", "error"])
def test_beeps_are_short_and_bounded(pattern: str):
    clip = beep(pattern)
    assert 0.1 < clip.duration < 0.5 and float(np.abs(clip.samples).max()) <= 0.26


def test_held_recorder_collects_blocks_between_start_and_stop():
    blocks = [np.full((160, 1), 0.1 * (i + 1), dtype=np.float32) for i in range(5)]
    sd = FakeSoundDevice(blocks)
    rec = HeldRecorder(sample_rate=16000, device="USB mic", sd=sd)
    assert rec.stop().duration == 0.0  # stop before start is harmless
    rec.start()
    assert rec.recording
    rec.start()  # idempotent while recording
    assert len(sd.streams) == 1 and sd.streams[0].kwargs["device"] == "USB mic" and sd.streams[0].kwargs["channels"] == 1
    sd.streams[0]._thread.join(timeout=2)
    clip = rec.stop()
    assert not rec.recording and sd.streams[0].closed
    assert clip.sample_rate == 16000 and len(clip.samples) == 800 and clip.samples.dtype == np.float32
    for i in range(5):  # each block was copied out of PortAudio's reused buffer, not referenced
        assert np.allclose(clip.samples[i * 160 : (i + 1) * 160], 0.1 * (i + 1))


def test_held_recorder_falls_back_to_stereo_capture():
    class StereoOnlySoundDevice(FakeSoundDevice):
        def InputStream(self, **kwargs):  # noqa: N802
            if kwargs["channels"] == 1:
                raise ValueError("Invalid number of channels")
            return super().InputStream(**kwargs)

    blocks = [np.stack([np.full(160, 0.2, dtype=np.float32), np.full(160, 0.4, dtype=np.float32)], axis=1) for _ in range(3)]
    sd = StereoOnlySoundDevice(blocks)
    rec = HeldRecorder(sample_rate=16000, sd=sd)
    rec.start()
    assert sd.streams[0].kwargs["channels"] == 2
    sd.streams[0]._thread.join(timeout=2)
    clip = rec.stop()
    assert len(clip.samples) == 480 and np.allclose(clip.samples, 0.3)  # downmixed to mono


def test_list_devices_flag(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("voicebox.device.pi_button.list_devices", lambda: "  0 Fake Mic, 1 in\n  1 Fake Speaker, 2 out")
    out = io.StringIO()
    assert main(["--list-devices"], out=out) == EXIT_OK
    assert "Fake Mic" in out.getvalue()

    def missing():
        raise AudioError("sounddevice not available")

    monkeypatch.setattr("voicebox.device.pi_button.list_devices", missing)
    out = io.StringIO()
    assert main(["--list-devices"], out=out) == 5
    assert "sounddevice not available" in out.getvalue()


def test_held_recorder_reports_missing_microphone():
    rec = HeldRecorder(sd=FakeSoundDevice(fail=True))
    with pytest.raises(AudioError, match="cannot open microphone"):
        rec.start()
    assert not rec.recording


# -- Handheld --------------------------------------------------------------------------------------------


def test_run_turn_prints_and_plays():
    client, player, led, out = ScriptedClient(), FakePlayer(), FakeLED(), io.StringIO()
    handheld = Handheld(client, player, out=out, led=led)
    final = handheld.run_turn(clip=tone(0.5))
    text = out.getvalue()
    assert "you: hello there" in text and "voicebox: Hi! How can I help?\n" in text
    assert len(player.clips) == 2 and player.stopped == 1 and player.waited == 1
    assert final["type"] == "done" and final["answer"] == "Hi! How can I help?"
    assert client.calls[0]["speak"] is True
    assert led.states[0] == "blink:0.15" and "blink:0.6" in led.states and led.states[-1] == "off"


def test_run_turn_without_player_asks_for_text_only():
    client, out = ScriptedClient(), io.StringIO()
    Handheld(client, None, out=out).run_turn(text="hi")
    assert client.calls[0]["speak"] is False and "voicebox: Hi!" in out.getvalue()


def test_run_turn_interrupted_returns_cancelled():
    gate = threading.Event()
    client, player, out = ScriptedClient(gate=gate), FakePlayer(), io.StringIO()
    handheld = Handheld(client, player, out=out)
    result: dict = {}
    thread = threading.Thread(target=lambda: result.update(handheld.run_turn(text="hi")), daemon=True)
    thread.start()
    for _ in range(300):
        if "you: hello there" in out.getvalue():
            break
        threading.Event().wait(0.01)
    handheld.interrupt()
    thread.join(timeout=3)
    assert result == {"type": "cancelled"} and player.stopped >= 2 and player.clips == []


def test_run_turn_reports_server_errors_and_beeps():
    client, player, out = ScriptedClient(error=ConnectionError("server returned 401: nope")), FakePlayer(), io.StringIO()
    final = Handheld(client, player, out=out).run_turn(text="hi")
    assert final["type"] == "error" and "401" in final["detail"]
    assert "cannot reach the server" in out.getvalue()
    assert len(player.clips) == 1 and 0.1 < player.clips[0].duration < 0.5  # the error beep


def test_run_turn_shows_problem_events_and_notes():
    events = [{"type": "note_saved", "text": "garage code is 4321"}, {"type": "error", "detail": "speech failed: down"}, {"type": "done"}]
    out = io.StringIO()
    Handheld(ScriptedClient(events), None, out=out).run_turn(text="remember that the garage code is 4321")
    assert "saved note: garage code is 4321" in out.getvalue() and "[problem: speech failed: down]" in out.getvalue()


def test_serve_button_press_release_sends_clip_and_skips_short_taps():
    blocks = [np.full((1600, 1), 0.1, dtype=np.float32) for _ in range(8)]  # 0.8 s
    sd = FakeSoundDevice(blocks)
    recorder = HeldRecorder(sample_rate=16000, sd=sd)
    client, player, out = ScriptedClient(), FakePlayer(), io.StringIO()
    handheld = Handheld(client, player, out=out)
    pressed: "queue.Queue[str]" = queue.Queue()
    stop = threading.Event()
    worker = threading.Thread(target=handheld.serve_button, args=(recorder, pressed, stop), daemon=True)
    worker.start()
    pressed.put("release")  # release without press: ignored
    pressed.put("press")
    for _ in range(200):
        if sd.streams and sd.streams[0]._thread is not None and not sd.streams[0]._thread.is_alive():
            break
        threading.Event().wait(0.01)
    pressed.put("release")
    for _ in range(200):
        if client.calls:
            break
        threading.Event().wait(0.01)
    # a short tap
    sd.blocks = [np.zeros((160, 1), dtype=np.float32)]
    pressed.put("press")
    threading.Event().wait(0.05)
    pressed.put("release")
    for _ in range(200):
        if "too short" in out.getvalue():
            break
        threading.Event().wait(0.01)
    stop.set()
    worker.join(timeout=3)
    assert len(client.calls) == 1 and abs(client.calls[0]["clip"].duration - 0.8) < 0.01
    assert "too short" in out.getvalue()
    assert player.stopped >= 2  # pressing the button interrupts playback
    assert any(0.1 < c.duration < 0.5 for c in player.clips)  # listening beep
    assert "voicebox: Hi! How can I help?" in out.getvalue()  # the turn ran on its worker thread


def test_press_during_an_answer_interrupts_it():
    gate = threading.Event()
    client, player, out = ScriptedClient(gate=gate), FakePlayer(), io.StringIO()
    handheld = Handheld(client, player, out=out)
    recorder = HeldRecorder(sample_rate=16000, sd=FakeSoundDevice([np.full((1600, 1), 0.1, dtype=np.float32) for _ in range(8)]))
    pressed: "queue.Queue[str]" = queue.Queue()
    stop = threading.Event()
    worker = threading.Thread(target=handheld.serve_button, args=(recorder, pressed, stop), daemon=True)
    worker.start()
    # start a turn by text through the same worker machinery
    handheld._turn = threading.Thread(target=handheld.run_turn, kwargs={"text": "long question"}, daemon=True)
    handheld._turn.start()
    for _ in range(300):
        if "you: hello there" in out.getvalue():
            break
        threading.Event().wait(0.01)
    assert handheld.busy
    pressed.put("press")  # while the answer is still streaming
    for _ in range(300):
        if client.cancelled and not handheld.busy:
            break
        threading.Event().wait(0.01)
    assert client.cancelled == 1 and not handheld.busy
    assert "(interrupted)" in out.getvalue() and "cannot reach the server" not in out.getvalue()
    assert recorder.recording  # and it is already listening for the new question
    pressed.put("release")
    stop.set()
    worker.join(timeout=3)
    error_len = len(beep("error").samples)
    assert all(len(c.samples) != error_len for c in player.clips)  # no error beep after an interrupt


def test_serve_button_reports_microphone_problems():
    recorder = HeldRecorder(sd=FakeSoundDevice(fail=True))
    out = io.StringIO()
    handheld = Handheld(ScriptedClient(), None, out=out)
    pressed: "queue.Queue[str]" = queue.Queue()
    stop = threading.Event()
    pressed.put("press")
    threading.Thread(target=lambda: (threading.Event().wait(0.2), stop.set()), daemon=True).start()
    handheld.serve_button(recorder, pressed, stop)
    assert "[microphone:" in out.getvalue()


# -- main ---------------------------------------------------------------------------------------------------------


def test_main_ask_mode_uses_client_and_player():
    client, player, out = ScriptedClient(), FakePlayer(), io.StringIO()
    assert main(["--ask", "hello", "--url", "http://box:8800"], out=out, client=client, player=player) == EXIT_OK
    text = out.getvalue()
    assert "server: http://box:8800 status=ok model=qwen3.8:27b" in text and "voicebox: Hi!" in text
    assert client.calls[0]["text"] == "hello" and len(player.clips) == 2


def test_main_ask_mode_error_exit_and_missing_server_warning():
    client, out = ScriptedClient(error=ConnectionError("down"), healthy=False), io.StringIO()
    assert main(["--ask", "hello", "--no-speak"], out=out, client=client) == EXIT_ERROR
    assert "warning: no Voicebox server" in out.getvalue()
    assert client.closed  # cleanup runs on the --ask path too


def test_main_ask_mode_server_side_error_is_an_error_exit():
    events = [{"type": "error", "detail": "cannot reach Ollama at http://127.0.0.1:11434"}, {"type": "done", "seconds": 0.1}]
    client, out = ScriptedClient(events), io.StringIO()
    assert main(["--ask", "hello", "--no-speak"], out=out, client=client) == EXIT_ERROR
    assert "[problem: cannot reach Ollama" in out.getvalue()


def test_speaker_failures_are_reported_not_silent():
    client, player, out = ScriptedClient(), FakePlayer(), io.StringIO()
    player.errors.append("RuntimeError: Invalid sample rate [PaErrorCode -9997]")
    final = Handheld(client, player, out=out).run_turn(text="hi")
    assert final["type"] == "done"
    assert "[speaker: RuntimeError: Invalid sample rate" in out.getvalue() and "--list-devices" in out.getvalue()
    assert player.errors == []  # reported once


def test_main_without_gpiozero_explains(monkeypatch: pytest.MonkeyPatch):
    import sys

    monkeypatch.setitem(sys.modules, "gpiozero", None)  # makes `from gpiozero import ...` raise ImportError
    client, out = ScriptedClient(), io.StringIO()
    assert main(["--no-speak"], out=out, client=client) == EXIT_ERROR
    assert "gpiozero is not installed" in out.getvalue() and client.closed


def test_main_gpio_mode_wires_button_and_led(monkeypatch: pytest.MonkeyPatch):
    import sys
    import types

    made: dict = {}

    class FakeButton:
        def __init__(self, pin, pull_up=None, bounce_time=None):
            made["button"] = (pin, pull_up, bounce_time)
            self.when_pressed = None
            self.when_released = None
            made["obj"] = self

    class FakeGpioLED(FakeLED):
        def __init__(self, pin):
            super().__init__()
            made["led_pin"] = pin

    monkeypatch.setitem(sys.modules, "gpiozero", types.SimpleNamespace(Button=FakeButton, LED=FakeGpioLED))
    seen: dict = {}

    def fake_serve(self, recorder, pressed, stop):
        made["obj"].when_pressed()
        made["obj"].when_released()
        seen["actions"] = [pressed.get_nowait(), pressed.get_nowait()]
        seen["led"] = self.led

    monkeypatch.setattr(Handheld, "serve_button", fake_serve)
    client, player, out = ScriptedClient(), FakePlayer(), io.StringIO()
    player.errors.append("RuntimeError: Invalid sample rate")
    assert main(["--button-pin", "27", "--led-pin", "22"], out=out, client=client, player=player) == EXIT_OK
    assert made["button"] == (27, True, 0.05) and made["led_pin"] == 22
    assert seen["actions"] == ["press", "release"] and isinstance(seen["led"], FakeGpioLED)
    text = out.getvalue()
    assert "ready: hold the button on GPIO 27" in text
    assert len(player.clips) == 1 and "[speaker: RuntimeError" in text  # ready chime, and speaker trouble is reported at start
    assert player.closed and client.closed


def test_main_keyboard_mode_records_and_sends(monkeypatch: pytest.MonkeyPatch):
    blocks = [np.full((1600, 1), 0.1, dtype=np.float32) for _ in range(8)]
    sd = FakeSoundDevice(blocks)
    monkeypatch.setattr("voicebox.device.pi_button.HeldRecorder", lambda device=None, **kw: HeldRecorder(sample_rate=16000, device=device, sd=sd))
    client, player, out = ScriptedClient(), FakePlayer(), io.StringIO()
    presses = iter(["", "", None])
    prompt_count = [0]

    def fake_input(prompt: str) -> str:
        value = next(presses)
        if value is None:
            # let the recorder finish its blocks and the turn complete before ending the session
            for _ in range(300):
                if client.calls:
                    break
                threading.Event().wait(0.01)
            raise EOFError
        if value == "" and prompt_count[0] == 1:  # second Enter: wait until the fake mic has delivered everything
            for _ in range(300):
                if sd.streams and sd.streams[0]._thread is not None and not sd.streams[0]._thread.is_alive():
                    break
                threading.Event().wait(0.01)
        prompt_count[0] += 1
        return value

    code = main(["--no-gpio", "--mic", "2"], out=out, client=client, player=player, input_fn=fake_input)
    assert code == EXIT_OK
    assert "keyboard mode" in out.getvalue()
    assert len(client.calls) == 1 and client.calls[0]["clip"] is not None
    assert sd.streams[0].kwargs["device"] == 2
    assert player.closed and client.closed
