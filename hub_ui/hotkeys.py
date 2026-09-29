"""Typed Hub action/workflow sequences using the shared keyboard worker.

Importing this module never installs a listener. The UI lifecycle owns the loop.
"""
from __future__ import annotations

import threading
from . import settings as hub_settings
from . import commands

def parse_hotkey_sequence(raw: str) -> list[str]:
    text = str(raw or "").strip().lower()
    if not text:
        return []
    for sep in (",", "+", ";"):
        text = text.replace(sep, " ")
    parts = [part for part in text.split() if part]
    if len(parts) > 1:
        return parts
    return list(parts[0]) if parts else []


def hub_hotkey_configs() -> dict[str, dict]:
    settings = hub_settings.load_settings()
    raw = settings.get("hub_hotkeys") or {}
    if not isinstance(raw, dict):
        return {}
    return {
        action_id: cfg
        for action_id, cfg in raw.items()
        if isinstance(cfg, dict)
        and cfg.get("enabled")
        and parse_hotkey_sequence(cfg.get("sequence", ""))
    }


def hub_workflow_configs() -> dict[str, dict]:
    settings = hub_settings.load_settings()
    raw = settings.get("hub_workflows") or []
    if not isinstance(raw, list):
        return {}
    result: dict[str, dict] = {}
    for idx, item in enumerate(raw):
        if not isinstance(item, dict) or not item.get("enabled"):
            continue
        sequence = parse_hotkey_sequence(item.get("sequence", ""))
        if not sequence:
            continue
        workflow_id = str(item.get("id") or f"workflow_{idx}")
        result[workflow_id] = item
    return result


def hub_hotkey_loop(stop_event: threading.Event) -> None:
    try:
        from shared import SequenceTrigger
        from lib.global_hotkeys import key_char, subscribe_global_hotkeys, unsubscribe_global_hotkeys
    except Exception as exc:
        print(f"[hub_hotkeys] disabled: {exc}")
        return

    trigger_lock = threading.Lock()
    triggers: dict[str, tuple[str, SequenceTrigger]] = {}
    loaded_signature: tuple | None = None

    def refresh_triggers() -> None:
        nonlocal loaded_signature
        configs = hub_hotkey_configs()
        signature = tuple(
            sorted(
                (
                    "action",
                    action_id,
                    str(cfg.get("sequence", "")),
                    float(cfg.get("max_interval", 0.8) or 0.8),
                )
                for action_id, cfg in configs.items()
            ) + sorted(
                (
                    "workflow",
                    workflow_id,
                    str(cfg.get("sequence", "")),
                    float(cfg.get("max_interval", 0.8) or 0.8),
                )
                for workflow_id, cfg in hub_workflow_configs().items()
            )
        )
        if signature == loaded_signature:
            return
        loaded_signature = signature
        triggers.clear()
        for action_id, cfg in configs.items():
            sequence = parse_hotkey_sequence(cfg.get("sequence", ""))
            max_interval = float(cfg.get("max_interval", 0.8) or 0.8)
            triggers[f"action:{action_id}"] = ("action", SequenceTrigger(sequence, max_interval))
        workflows = hub_workflow_configs()
        for workflow_id, cfg in workflows.items():
            sequence = parse_hotkey_sequence(cfg.get("sequence", ""))
            max_interval = float(cfg.get("max_interval", 0.8) or 0.8)
            triggers[f"workflow:{workflow_id}"] = ("workflow", SequenceTrigger(sequence, max_interval))
        if triggers:
            labels = ", ".join(item_id for item_id in triggers)
            print(f"[hub_hotkeys] armed: {labels}")

    def on_press(key) -> None:
        raw_char = key_char(key)
        char = str(raw_char or "").lower()
        if not char:
            return
        with trigger_lock:
            refresh_triggers()
            fired = [
                (item_id.split(":", 1)[1], kind)
                for item_id, (kind, trigger) in triggers.items()
                if trigger.register_key(char)
            ]
            workflows = hub_workflow_configs()
        for item_id, kind in fired:
            if kind == "workflow":
                workflow = workflows.get(item_id)
                if workflow:
                    threading.Thread(
                        target=commands.run_workflow,
                        args=(workflow,),
                        kwargs={"source": "hotkey"},
                        daemon=True,
                        name=f"hub_workflow:{item_id}",
                    ).start()
            else:
                threading.Thread(
                    target=commands.run_hub_action,
                    kwargs={"action_id": item_id, "source": "hotkey"},
                    daemon=True,
                    name=f"hub_action:{item_id}",
                ).start()

    with trigger_lock:
        refresh_triggers()
    listener_token = subscribe_global_hotkeys(on_press)
    print("[hub_hotkeys] listener started.")
    stop_event.wait()
    unsubscribe_global_hotkeys(listener_token)
    print("[hub_hotkeys] listener stopped.")
