#!/usr/bin/env python3
"""Regenerate ./Modelfile from rinn/persona.py and rinn/config.py.

    python scripts/build_modelfile.py          # write Modelfile
    python scripts/build_modelfile.py --check  # exit 1 if Modelfile is stale
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from rinn.modelfile import render_modelfile  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    target = ROOT / "Modelfile"
    rendered = render_modelfile()
    if "--check" in args:
        current = target.read_text(encoding="utf-8") if target.exists() else ""
        if current != rendered:
            print("Modelfile is out of date; run: python scripts/build_modelfile.py", file=sys.stderr)
            return 1
        print("Modelfile is up to date")
        return 0
    target.write_text(rendered, encoding="utf-8")
    print(f"wrote {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
