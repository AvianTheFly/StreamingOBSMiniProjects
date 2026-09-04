"""
hub_rules.py
============
Central cross-project coordination policy.

Rules are persisted in hub_rules.json so they can be edited via the Hub UI.
On first run (no JSON file) auto-generates rules from produces_audio flags and
saves them so the UI can immediately edit them.

To add a rule via code instead of the UI:
    coordinator.add_rule(CoordinationRule(
        requester="my_project",
        pause=["specific_song"],
    ))
"""

from __future__ import annotations

import json
from pathlib import Path

from coordinator import coordinator, CoordinationRule
from shared import project_registry

_RULES_FILE = Path(__file__).resolve().parent / "hub_rules.json"


def _auto_audio_rules() -> list[CoordinationRule]:
    audio = [i for i in project_registry.all() if i.produces_audio]
    rules: list[CoordinationRule] = []
    for iface in audio:
        others = [i.name for i in audio if i.name != iface.name]
        if others:
            rules.append(CoordinationRule(requester=iface.name, pause=others))
    return rules


def _rules_to_json(rules: list[CoordinationRule]) -> list[dict]:
    return [
        {
            "requester": r.requester,
            "pause": list(r.pause),
            "resume_on_finish": r.resume_on_finish,
        }
        for r in rules
    ]


def _rules_from_json(data: list[dict]) -> list[CoordinationRule]:
    return [
        CoordinationRule(
            requester=r.get("requester", ""),
            pause=list(r.get("pause", [])),
            resume_on_finish=bool(r.get("resume_on_finish", True)),
        )
        for r in data
        if r.get("requester")
    ]


def _load() -> list[CoordinationRule] | None:
    if not _RULES_FILE.exists():
        return None
    try:
        data = json.loads(_RULES_FILE.read_text(encoding="utf-8"))
        return _rules_from_json(data if isinstance(data, list) else [])
    except Exception as exc:
        print(f"[hub_rules] Failed to load {_RULES_FILE.name}: {exc}")
        return None


def _save(rules: list[CoordinationRule]) -> None:
    try:
        _RULES_FILE.write_text(
            json.dumps(_rules_to_json(rules), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception as exc:
        print(f"[hub_rules] Failed to save rules: {exc}")


# ── Apply rules at import time ────────────────────────────────────────────────

_loaded = _load()
if _loaded is not None:
    _rules = _loaded
else:
    _rules = _auto_audio_rules()
    _save(_rules)

for _rule in _rules:
    coordinator.add_rule(_rule)
