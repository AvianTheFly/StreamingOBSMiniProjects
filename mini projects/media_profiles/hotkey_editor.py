from __future__ import annotations

import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_HUB_ROOT = _SCRIPT_DIR.parent.parent
for _p in (_HUB_ROOT, _SCRIPT_DIR.parent):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from lib.hotkey_editor import run_editor  # noqa: E402
from media_profiles.config import discover_editor_projects  # noqa: E402


if __name__ == "__main__":
    projects = discover_editor_projects()
    if not projects:
        raise SystemExit("No media profiles are configured.")
    first = projects[0]
    run_editor(
        asset_dir=first["asset_dir"],
        hotkeys_file=first["hotkeys_file"],
        valid_extensions=first["extensions"],
        project_name=first["name"],
        all_projects=projects,
    )
