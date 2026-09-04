"""
soundboard/hotkey_editor.py
============================
Launches the browser-based hotkey editor for this project.

Run standalone — NOT through the hub:
    py hotkey_editor.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make lib/ and mini projects/ importable when running standalone.
_SCRIPT_DIR = Path(__file__).resolve().parent
_HUB_ROOT   = _SCRIPT_DIR.parent.parent
for _p in (_HUB_ROOT, _SCRIPT_DIR.parent):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from lib.hotkey_editor import run_editor       # noqa: E402
from soundboard.config import ASSET_DIR, HOTKEYS_FILE, CONFIG  # noqa: E402

if __name__ == "__main__":
    run_editor(
        asset_dir        = ASSET_DIR,
        hotkeys_file     = HOTKEYS_FILE,
        valid_extensions = CONFIG.valid_extensions,
        project_name     = "Soundboard",
    )
