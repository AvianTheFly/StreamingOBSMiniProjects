"""Editor profile data and transitions; no files, HTTP, or OBS access."""
from copy import deepcopy

from lib.shared_media.controls import (
    normalize_file_volume_offsets,
    normalize_interface_hotkeys,
    volume_db,
)

PROFILE_ACTIONS = frozenset({"create", "duplicate", "delete", "rename", "set_live", "switch"})


def default_profile() -> dict:
    return {
        "trigger_sequences": "",
        "hotkeys": {},
        "interface_hotkeys": {},
        "project_volume_db": 0.0,
        "profile_volume_db": 0.0,
        "category_volume_db": {},
        "file_volume_offsets": {},
        "group_names": {},
        "display_names": {},
        "categories": [],
        "sound_categories": {},
        "empty_groups": [],
        "unbound_groups": [],
    }


def default_editor_state() -> dict:
    return {
        "live_profile": "default",
        "active_profile": "default",
        "profiles": {"default": default_profile()},
    }


def profile_response_fields(profile: dict) -> dict:
    fields = {key: profile.get(key, value) for key, value in default_profile().items()}
    fields["profile_trigger_sequences"] = fields.pop("trigger_sequences")
    fields["interface_hotkeys"] = normalize_interface_hotkeys(fields["interface_hotkeys"])
    for key in ("project_volume_db", "profile_volume_db"):
        fields[key] = volume_db(fields[key])
    for key in ("category_volume_db", "file_volume_offsets"):
        fields[key] = normalize_file_volume_offsets(fields[key])
    return fields


def profile_response(state: dict, action: str) -> dict:
    if action == "set_live":
        return {"ok": True, "live_profile": state["live_profile"]}
    response = {
        "ok": True,
        "profile_names": sorted(state["profiles"]),
        "active_profile": state["active_profile"],
        "live_profile": state.get("live_profile", "default"),
    }
    if action != "rename":
        profile = state["profiles"].get(state["active_profile"], default_profile())
        response.update(profile_response_fields(profile))
    return response


def change_profile(state: dict, action: str, data: dict) -> None:
    """Mutate loaded editor state, validating before any change.

    Active is the profile being edited; live is the profile used by playback.
    Copying/switching only changes active. Deleting live chooses the first
    remaining profile in insertion order, as the editor has always done.
    Unknown fields are preserved, including nested per-asset settings.
    """
    profiles = state["profiles"]
    name = str(data.get("name", "")).strip()
    if action in {"create", "duplicate"}:
        if not name:
            raise ValueError("Name required")
        if name in profiles:
            raise ValueError(f"Profile '{name}' already exists")
        source = state.get("active_profile", "default")
        if action == "duplicate":
            source = str(data.get("source", "")).strip() or source
            if source not in profiles:
                raise ValueError(f"Profile '{source}' not found")
        profiles[name] = deepcopy(profiles.get(source, default_profile()))
        state["active_profile"] = name
    elif action == "rename":
        source = str(data.get("from", "")).strip()
        target = str(data.get("to", "")).strip()
        if not source or not target:
            raise ValueError("from and to required")
        if source not in profiles:
            raise ValueError(f"Profile '{source}' not found")
        if target in profiles:
            raise ValueError(f"Profile '{target}' already exists")
        profiles[target] = profiles.pop(source)
        for key in ("live_profile", "active_profile"):
            if state.get(key) == source:
                state[key] = target
    elif action in {"delete", "set_live", "switch"}:
        if name not in profiles:
            raise ValueError(f"Profile '{name}' not found")
        if action == "delete":
            if len(profiles) <= 1:
                raise ValueError("Cannot delete the last profile")
            del profiles[name]
            if state.get("live_profile") == name:
                state["live_profile"] = next(iter(profiles))
            if state.get("active_profile") == name:
                state["active_profile"] = state["live_profile"]
        else:
            state["live_profile" if action == "set_live" else "active_profile"] = name
    else:
        raise ValueError(f"Unknown profile action: {action}")
