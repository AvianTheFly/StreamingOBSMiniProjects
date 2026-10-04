"""Hub settings persistence and playback-coordination rule configuration.

Paths and JSON formats stay stable; runtime project data belongs to each module.
"""
from __future__ import annotations

import copy
import json
from lib.json_store import write_json, update_json
from lib.paths import PROJECT_ROOT

RULES_FILE = PROJECT_ROOT / "hub_rules.json"
_SETTINGS_FILE = PROJECT_ROOT / "hub_settings.json"
_DEFAULT_HUB_HOTKEYS = {
    "abort_all_audio": {"enabled": False, "sequence": "", "max_interval": 0.8},
}
_DEFAULT_WORKFLOWS: list[dict] = []

def load_settings() -> dict:
    defaults = {
        "hub_hotkeys": copy.deepcopy(_DEFAULT_HUB_HOTKEYS),
        "hub_workflows": copy.deepcopy(_DEFAULT_WORKFLOWS),
        "project_trigger_modes": {},
    }
    try:
        import hub_config as cfg
        defaults.update({
            "whisper_model":    cfg.WHISPER_MODEL,
            "whisper_device":   cfg.WHISPER_DEVICE,
            "whisper_compute":  cfg.WHISPER_COMPUTE,
            "whisper_language": cfg.WHISPER_LANGUAGE,
            "mic_device":       cfg.MIC_DEVICE,
            "mic_sample_rate":  cfg.MIC_SAMPLE_RATE,
            "rms_threshold":    cfg.RMS_THRESHOLD,
        })
    except (ImportError, ValueError):
        pass
    if _SETTINGS_FILE.exists():
        try:
            data = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                if not isinstance(data.get("hub_hotkeys"), dict):
                    data["hub_hotkeys"] = copy.deepcopy(_DEFAULT_HUB_HOTKEYS)
                for action_id, cfg in _DEFAULT_HUB_HOTKEYS.items():
                    data["hub_hotkeys"].setdefault(action_id, dict(cfg))
                if not isinstance(data.get("hub_workflows"), list):
                    data["hub_workflows"] = []
                if not isinstance(data.get("project_trigger_modes"), dict):
                    data["project_trigger_modes"] = {}
                return {**defaults, **data}
        except Exception:
            pass
    return defaults


def save_settings(data: dict) -> None:
    from lib.settings_backups import SettingsBackups
    SettingsBackups().snapshot()
    update_json(_SETTINGS_FILE, lambda previous: {**(previous or {}), **data}, default={})


def get_live_rules() -> list[dict]:
    try:
        from coordinator import coordinator
        return [
            {
                "requester":        r.requester,
                "pause":            list(r.pause),
                "resume_on_finish": r.resume_on_finish,
            }
            for r in coordinator.get_rules()
        ]
    except Exception:
        return []


def parse_rules(rules: list[dict]):
    from coordinator import CoordinationRule
    if not isinstance(rules, list):
        raise ValueError("Rules must be a list")
    result = []
    for rule in rules:
        if not isinstance(rule, dict):
            raise ValueError("Each rule must be an object")
        requester = rule.get("requester", "")
        pause = rule.get("pause", [])
        if not isinstance(requester, str) or not isinstance(pause, list) or any(
                not isinstance(name, str) for name in pause):
            raise ValueError("Rule requester and pause targets must be project names")
        if requester:
            result.append(CoordinationRule(requester=requester, pause=list(pause),
                                          resume_on_finish=bool(rule.get("resume_on_finish", True))))
    return result


def apply_rules_from_list(rules: list[dict]) -> None:
    from coordinator import coordinator
    coordinator.replace_rules(parse_rules(rules))
