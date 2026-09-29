"""Hub settings persistence and playback-coordination rule configuration.

Paths and JSON formats stay stable; runtime project data belongs to each module.
"""
from __future__ import annotations

import json
from lib.paths import PROJECT_ROOT

RULES_FILE = PROJECT_ROOT / "hub_rules.json"
_SETTINGS_FILE = PROJECT_ROOT / "hub_settings.json"
_DEFAULT_HUB_HOTKEYS = {
    "abort_all_audio": {"enabled": False, "sequence": "", "max_interval": 0.8},
}
_DEFAULT_WORKFLOWS: list[dict] = []

def load_settings() -> dict:
    defaults = {
        "hub_hotkeys": json.loads(json.dumps(_DEFAULT_HUB_HOTKEYS)),
        "hub_workflows": json.loads(json.dumps(_DEFAULT_WORKFLOWS)),
        "project_trigger_modes": {},
    }
    if _SETTINGS_FILE.exists():
        try:
            data = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                if not isinstance(data.get("hub_hotkeys"), dict):
                    data["hub_hotkeys"] = json.loads(json.dumps(_DEFAULT_HUB_HOTKEYS))
                for action_id, cfg in _DEFAULT_HUB_HOTKEYS.items():
                    data["hub_hotkeys"].setdefault(action_id, dict(cfg))
                if not isinstance(data.get("hub_workflows"), list):
                    data["hub_workflows"] = []
                if not isinstance(data.get("project_trigger_modes"), dict):
                    data["project_trigger_modes"] = {}
                return data
        except Exception:
            pass
    try:
        import hub_config as cfg
        return {
            "whisper_model":    cfg.WHISPER_MODEL,
            "whisper_device":   cfg.WHISPER_DEVICE,
            "whisper_compute":  cfg.WHISPER_COMPUTE,
            "whisper_language": cfg.WHISPER_LANGUAGE,
            "mic_device":       cfg.MIC_DEVICE,
            "mic_sample_rate":  cfg.MIC_SAMPLE_RATE,
            "rms_threshold":    cfg.RMS_THRESHOLD,
            **defaults,
        }
    except Exception:
        return defaults


def save_settings(data: dict) -> None:
    _SETTINGS_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )


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


def apply_rules_from_list(rules: list[dict]) -> None:
    try:
        from coordinator import coordinator, CoordinationRule
        coordinator.clear_rules()
        for r in rules:
            if not r.get("requester"):
                continue
            coordinator.add_rule(CoordinationRule(
                requester=r["requester"],
                pause=list(r.get("pause", [])),
                resume_on_finish=bool(r.get("resume_on_finish", True)),
            ))
    except Exception as exc:
        print(f"[hub_ui] apply_rules error: {exc}")
