"""Hub action dispatch shared by HTTP controls and typed hotkeys.

Actual actions live in hub_actions.py; this adapter adds UI notifications.
"""
from __future__ import annotations

from . import updates

def run_hub_action(action_id: str, *, source: str = "ui") -> dict:
    from hub_actions import run_action

    result = run_action(action_id)
    payload = {
        "action": action_id,
        "source": source,
        "result": result,
    }
    updates.broadcast("hub_action", payload)
    print(f"[hub_action] {source}: {action_id} -> {result}")
    return result


def run_project_action(project: str, action: str, *, source: str = "ui") -> dict:
    from hub_actions import run_project_action

    result = run_project_action(project, action)
    updates.broadcast("hub_action", {
        "action": f"project:{project}:{action}",
        "source": source,
        "result": result,
    })
    print(f"[hub_action] {source}: project:{project}:{action} -> {result}")
    return result


def run_workflow(workflow: dict, *, source: str = "ui") -> dict:
    from hub_actions import run_workflow

    result = run_workflow(workflow.get("steps") or [])
    updates.broadcast("hub_action", {
        "action": f"workflow:{workflow.get('id') or workflow.get('name')}",
        "source": source,
        "result": result,
    })
    print(f"[hub_action] {source}: workflow:{workflow.get('name')} -> {result}")
    return result
