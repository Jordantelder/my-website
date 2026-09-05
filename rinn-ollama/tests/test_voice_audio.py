from __future__ import annotations

import numpy as np
import pytest

from rinn.voice.audio import AudioClip, AudioError, Player, Recorder, clip_to_wav_bytes, resample, rms_db, to_mono_float32, wav_bytes_to_clip

from conftest import FakeSoundDevice


def tone(seconds: float, rate: int, amplitude: float = 0.3, freq: float = 220.0) -> np.ndarray:
    t = np.arange(int(seconds * rate)) / rate
    return (amplitude * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def test_wav_round_trip_and_stereo_int16():
    clip = AudioClip(tone(0.5, 24000), 24000)
    data = clip_to_wav_bytes(clip)
    back = wav_bytes_to_clip(data)
    assert back.sample_rate == 24000 and len(back.samples) == len(clip.samples)
    assert np.allclose(back.samples, clip.samples, atol=1e-3)
    with pytest.raises(AudioError):
        wav_bytes_to_clip(b"ID3not-a-wav")
    stereo = (np.stack([tone(0.1, 16000), tone(0.1, 16000)], axis=1) * 32767).astype(np.int16)
    assert to_mono_float32(stereo).shape == (1600,)


def test_resample_changes_length_proportionally():
    samples = tone(1.0, 48000)
    out = resample(samples, 48000, 16000)
    assert abs(len(out) - 16000) <= 1
    assert resample(samples, 48000, 48000) is not None and len(resample(np.zeros(0), 48000, 16000)) == 0


def test_rms_db_levels():
    assert rms_db(np.zeros(480, dtype=np.float32)) < -100
    assert -20 < rms_db(tone(0.1, 16000, amplitude=0.3)) < -10


def blocks(seconds: float, amplitude: float, rate: int = 16000, block: int = 480) -> list[np.ndarray]:
    total = tone(seconds, rate, amplitude=amplitude) if amplitude > 0 else np.zeros(int(seconds * rate), dtype=np.float32)
    return [total[i : i + block].reshape(-1, 1) for i in range(0, len(total) - block + 1, block)]


def test_recorder_stops_after_silence_following_speech():
    script = blocks(0.6, 0.001) + blocks(1.2, 0.3) + blocks(3.0, 0.001)
    sd = FakeSoundDevice(input_blocks=script)
    recorder = Recorder(sample_rate=16000, silence_seconds=1.2, max_seconds=10, sd=sd)
    states: list[str] = []
    clip = recorder.record_utterance(on_state=states.append)
    assert states == ["listening", "speech"]
    assert 2.6 <= clip.duration <= 3.6  # calibration + speech + trailing silence, then stop
    assert sd.input_kwargs["samplerate"] == 16000 and sd.input_kwargs["channels"] == 1


def test_recorder_returns_empty_clip_when_nothing_is_said():
    sd = FakeSoundDevice(input_blocks=blocks(2.0, 0.001))
    clip = Recorder(sample_rate=16000, max_seconds=1.0, sd=sd).record_utterance()
    assert clip.duration == 0.0


def test_recorder_reports_unopenable_microphone():
    class BrokenSD:
        def InputStream(self, **kwargs):  # noqa: N802
            raise RuntimeError("Error querying device -1")

    with pytest.raises(AudioError) as excinfo:
        Recorder(sd=BrokenSD()).record_utterance()
    assert "cannot open microphone" in str(excinfo.value)


def test_player_plays_clips_in_order_and_resamples():
    sink: list[np.ndarray] = []
    sd = FakeSoundDevice(output_sink=sink)
    player = Player(sample_rate=24000, sd=sd)
    first = AudioClip(tone(0.3, 16000), 16000)
    second = AudioClip(tone(0.2, 24000, amplitude=0.1), 24000)
    player.enqueue(first)
    player.enqueue(second)
    assert player.wait(timeout=5)
    written = np.concatenate(sink)
    expected = np.concatenate([resample(first.samples, 16000, 24000), second.samples])
    assert len(written) == len(expected)
    assert np.allclose(written, expected, atol=1e-6)
    assert player.errors == []
    player.close()


def test_player_ignores_empty_clips_and_stop_clears_queue():
    sd = FakeSoundDevice()
    player = Player(sd=sd)
    player.enqueue(AudioClip(np.zeros(0, dtype=np.float32), 24000))
    assert player.wait(timeout=1)
    player.stop()
    player.close()
