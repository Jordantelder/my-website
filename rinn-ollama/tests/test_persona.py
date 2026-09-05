from __future__ import annotations

from rinn.persona import CONTEXT_HEADING, DISCLAIMER, FULL_NAME, NAME, SYSTEM_PROMPT, build_system_prompt


def test_prompt_identifies_rinn():
    assert f'named "{NAME}"' in SYSTEM_PROMPT
    assert FULL_NAME in SYSTEM_PROMPT
    assert "regulatory affairs professionals" in SYSTEM_PROMPT


def test_prompt_keeps_original_operational_instructions():
    for heading in (
        "Ask for Clarity to Narrow Scope",
        "Provide Technical Depth",
        "Structure Your Answers",
        "Cite Your Sources",
        "Synthesize and Conclude",
    ):
        assert heading in SYSTEM_PROMPT
    assert "catheters" in SYSTEM_PROMPT  # the clarifying-question example survives
    assert CONTEXT_HEADING in SYSTEM_PROMPT
    assert '"""' not in SYSTEM_PROMPT  # must stay embeddable in a Modelfile


def test_disclaimer_is_verbatim_report_footer():
    assert DISCLAIMER.startswith("RINN is a research aid for U.S. FDA regulatory affairs.")
    assert DISCLAIMER.endswith("This is not legal advice.")


def test_extra_instructions_are_appended_only_when_present():
    assert build_system_prompt(None) == SYSTEM_PROMPT
    assert build_system_prompt("   ") == SYSTEM_PROMPT
    extended = build_system_prompt("Prefer CDRH guidance.")
    assert extended.startswith(SYSTEM_PROMPT)
    assert extended.rstrip().endswith("Prefer CDRH guidance.")
