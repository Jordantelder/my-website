from __future__ import annotations

from pathlib import Path

from rinn.config import Settings
from rinn.modelfile import render_modelfile
from rinn.persona import SYSTEM_PROMPT

ROOT = Path(__file__).resolve().parent.parent


def test_rendered_modelfile_has_base_model_parameters_and_system_prompt():
    text = render_modelfile()
    assert "FROM qwen3.8:27b\n" in text
    assert "PARAMETER temperature 0.4\n" in text
    assert "PARAMETER num_ctx 32768\n" in text
    assert "PARAMETER num_predict" not in text
    assert 'SYSTEM """\n' + SYSTEM_PROMPT + '\n"""' in text


def test_optional_parameters_and_base_override():
    text = render_modelfile(Settings(num_predict=1024, seed=1), base_model="qwen3.8:27b-q8_0")
    assert "FROM qwen3.8:27b-q8_0\n" in text
    assert "PARAMETER num_predict 1024\n" in text and "PARAMETER seed 1\n" in text


def test_committed_modelfile_is_in_sync():
    assert (ROOT / "Modelfile").read_text(encoding="utf-8") == render_modelfile()
