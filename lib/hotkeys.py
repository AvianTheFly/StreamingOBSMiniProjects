from __future__ import annotations

from pathlib import Path
from lib.json_store import write_json

from lib.project_settings import load_project_settings


def load_hotkeys(hotkeys_file: Path, project_name: str = "") -> dict[str, str | list[str]]:
    """Load a {key -> stem | [stem, ...]} hotkey map.

    The browser editor stores richer state in ``*_editor.json``. This function
    keeps the old mini-project API stable by reading the editor's live profile
    when it exists, then falling back to the legacy ``hotkeys.json`` file.
    """
    tag = f"[{project_name}]" if project_name else "[hotkeys]"

    try:
        settings = load_project_settings(
            hotkeys_file.parent,
            hotkeys_file=hotkeys_file,
        )
        return dict(settings.hotkeys)
    except Exception as exc:
        print(f"{tag} Could not load {hotkeys_file.name}: {exc}")
        return {}


def save_hotkeys(hotkeys_file: Path, data: dict[str, str | list[str]]) -> None:
    """Write the legacy {key -> stem | [stem, ...]} compatibility file."""
    write_json(hotkeys_file, data)
