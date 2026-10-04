"""Typed Hub action/workflow sequences using the shared keyboard worker.

Importing this module never installs a listener. The UI lifecycle owns the loop.
"""
from __future__ import annotations

import threading
import queue
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


def hub_hotkey_configs(settings: dict | None = None) -> dict[str, dict]:
    if settings is None:
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


def hub_workflow_configs(settings: dict | None = None) -> dict[str, dict]:
    if settings is None:
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
    loaded_marker = object()
    workflows: dict[str, dict] = {}
    actions = queue.Queue(maxsize=32)

    def dispatch():
        while not stop_event.is_set():
            try:
                kind, item_id, workflow = actions.get(timeout=.1)
            except queue.Empty:
                continue
            try:
                if kind == 'workflow':
                    commands.run_workflow(workflow, source='hotkey')
                else:
                    commands.run_hub_action(action_id=item_id, source='hotkey')
            except Exception as exc:
                print(f'[hub_hotkeys] Action failed: {exc}')

    def refresh_triggers() -> None:
        nonlocal loaded_signature, loaded_marker, workflows
        try:
            stat = hub_settings._SETTINGS_FILE.stat()
            marker = (stat.st_mtime_ns, stat.st_size)
        except OSError:
            marker = None
        if marker == loaded_marker:
            return
        settings = hub_settings.load_settings()
        configs = hub_hotkey_configs(settings)
        workflows = hub_workflow_configs(settings)
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
                for workflow_id, cfg in workflows.items()
            )
        )
        loaded_marker = marker
        if signature == loaded_signature:
            return
        loaded_signature = signature
        triggers.clear()
        for action_id, cfg in configs.items():
            sequence = parse_hotkey_sequence(cfg.get("sequence", ""))
            max_interval = float(cfg.get("max_interval", 0.8) or 0.8)
            triggers[f"action:{action_id}"] = ("action", SequenceTrigger(sequence, max_interval,
                shift_agnostic_tail=action_id not in {'show_screen', 'hide_screen'}))
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
            fired_workflows = {item_id: workflows.get(item_id)
                               for item_id, kind in fired if kind == "workflow"}
        for item_id, kind in fired:
            try:
                actions.put_nowait((kind, item_id, fired_workflows.get(item_id)))
            except queue.Full:
                print('[hub_hotkeys] Action queue full; key sequence ignored.')

    with trigger_lock:
        refresh_triggers()
    listener_token = subscribe_global_hotkeys(on_press)
    worker = threading.Thread(target=dispatch, daemon=True, name='hub_ui:hotkey-actions')
    try:
        worker.start()
        print("[hub_hotkeys] listener started.")
        stop_event.wait()
    finally:
        unsubscribe_global_hotkeys(listener_token)
        if worker.ident is not None:
            worker.join(timeout=3)
        print("[hub_hotkeys] listener stopped.")
