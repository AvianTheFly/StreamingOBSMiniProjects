from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class MediaInterfaceAction:
    key: str
    label: str
    description: str


MEDIA_INTERFACE_ACTIONS: tuple[MediaInterfaceAction, ...] = (
    MediaInterfaceAction("start_listen", "Start Listen", "Open the voice/manual trigger window."),
    MediaInterfaceAction("stop_listen", "Stop Listen", "Finish the current voice capture and transcribe it."),
    MediaInterfaceAction("abort_listen", "Abort Listen", "Cancel the current voice capture without matching."),
    MediaInterfaceAction("pause", "Pause Playback", "Pause the current OBS media source."),
    MediaInterfaceAction("resume", "Resume Playback", "Resume the paused OBS media source."),
    MediaInterfaceAction("stop", "Stop Playback", "Stop the current source and random mode."),
    MediaInterfaceAction("random", "Random", "Start random playback for the active profile."),
    MediaInterfaceAction("next", "Next", "Skip the current item while random mode is active."),
    MediaInterfaceAction("reload", "Reload", "Reload files, profiles, phrases, and layout rules."),
)

ACTION_KEYS = {action.key for action in MEDIA_INTERFACE_ACTIONS}
DEFAULT_INTERFACE_HOTKEYS: dict[str, str] = {
    "start_listen": "",
    "stop_listen": "",
    "abort_listen": "",
    "pause": "",
    "resume": "",
    "stop": "",
    "random": "",
    "next": "",
    "reload": "",
}


def action_catalog() -> list[dict[str, str]]:
    return [
        {"key": item.key, "label": item.label, "description": item.description}
        for item in MEDIA_INTERFACE_ACTIONS
    ]


def normalize_interface_hotkeys(raw: Any) -> dict[str, str]:
    if isinstance(raw, str):
        raw = parse_mapping_text(raw)
    if not isinstance(raw, dict):
        return dict(DEFAULT_INTERFACE_HOTKEYS)

    result = dict(DEFAULT_INTERFACE_HOTKEYS)
    for key, value in raw.items():
        action = str(key).strip()
        if action not in ACTION_KEYS:
            continue
        result[action] = str(value or "").strip()
    return result


def parse_mapping_text(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for part in str(text or "").replace("\n", ";").split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        action = key.strip()
        if action in ACTION_KEYS:
            result[action] = value.strip()
    return result


def mapping_to_text(mapping: Any) -> str:
    normalized = normalize_interface_hotkeys(mapping)
    return "; ".join(
        f"{action.key}={normalized.get(action.key, '')}"
        for action in MEDIA_INTERFACE_ACTIONS
    )


def parse_sequences(text: str) -> list[list[str]]:
    sequences: list[list[str]] = []
    for part in str(text or "").split(";"):
        item = part.strip().lower()
        if not item:
            continue
        if " " in item:
            seq = [token.strip() for token in item.split(" ") if token.strip()]
        else:
            seq = list(item)
        if seq:
            sequences.append(seq)
    return sequences


def normalize_file_volume_offsets(raw: Any) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    result: dict[str, float] = {}
    for stem, value in raw.items():
        key = str(stem).strip()
        if not key:
            continue
        try:
            result[key] = float(value)
        except (TypeError, ValueError):
            continue
    return result


def volume_db(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def effective_volume_db(
    *,
    project_volume_db: Any = 0.0,
    profile_volume_db: Any = 0.0,
    category_offset_db: Any = 0.0,
    file_offset_db: Any = 0.0,
) -> float:
    return (
        volume_db(project_volume_db)
        + volume_db(profile_volume_db)
        + volume_db(category_offset_db)
        + volume_db(file_offset_db)
    )
