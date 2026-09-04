"""
tik_tok/hotkey_editor.py
=========================
Launches the browser-based hotkey editor for the TikTok project.

Run standalone — NOT through the hub:
    py hotkey_editor.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_HUB_ROOT   = _SCRIPT_DIR.parent.parent
for _p in (_HUB_ROOT, _SCRIPT_DIR.parent):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from dotenv import load_dotenv
load_dotenv(_HUB_ROOT / ".env")

from lib.hotkey_editor import run_editor          # noqa: E402
from tik_tok.config import CONFIG, HOTKEYS_FILE  # noqa: E402

if __name__ == "__main__":
    run_editor(
        asset_dir        = CONFIG.asset_dir,
        hotkeys_file     = HOTKEYS_FILE,
        valid_extensions = CONFIG.valid_extensions,
        project_name     = "TikTok",
    )
