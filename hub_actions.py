from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class HubAction:
    id: str
    label: str
    description: str
    run: Callable[[], dict]


def _abort_all_audio() -> dict:
    from shared import project_registry

    affected: list[str] = []
    failed: list[dict] = []

    for iface in project_registry.all():
        if not getattr(iface, "produces_audio", False):
            continue
        name = getattr(iface, "name", "")
        try:
            iface.revert()
            affected.append(name)
        except Exception as exc:
            failed.append({"project": name, "error": str(exc)})

    return {
        "ok": not failed,
        "affected": affected,
        "failed": failed,
        "message": f"Aborted {len(affected)} audio project(s).",
    }


def run_project_action(project: str, action: str) -> dict:
    from shared import project_registry

    iface = project_registry.get(project)
    if iface is None:
        return {"ok": False, "error": f"Project '{project}' is not registered"}
    try:
        if hasattr(iface, "run_action"):
            result = iface.run_action(action)
            if isinstance(result, dict) and not result.get("ok", True):
                return {"ok": False, "project": project, "action": action, **result}
        elif action in {"revert", "pause", "resume"}:
            getattr(iface, action)()
            result = {}
        else:
            return {"ok": False, "error": f"Unsupported project action: {action}"}
        return {
            "ok": True,
            "project": project,
            "action": action,
            **(result if isinstance(result, dict) else {}),
            "message": f"{project}: {action} ran.",
        }
    except Exception as exc:
        return {"ok": False, "project": project, "action": action, "error": str(exc)}


def run_workflow(steps: list[dict]) -> dict:
    results: list[dict] = []
    for step in steps:
        kind = str(step.get("kind") or "project")
        if kind == "hub_action":
            result = run_action(str(step.get("action_id") or ""))
        else:
            result = run_project_action(
                str(step.get("project") or ""),
                str(step.get("action") or ""),
            )
        results.append(result)
    failed = [item for item in results if not item.get("ok", False)]
    return {
        "ok": not failed,
        "results": results,
        "failed": failed,
        "message": f"Workflow ran {len(results)} step(s), {len(failed)} failed.",
    }


_ACTIONS: dict[str, HubAction] = {
    "abort_all_audio": HubAction(
        id="abort_all_audio",
        label="Abort all audio sources",
        description="Stops every registered project marked as producing audio.",
        run=_abort_all_audio,
    ),
}


def list_actions() -> list[dict]:
    return [
        {
            "id": action.id,
            "label": action.label,
            "description": action.description,
        }
        for action in _ACTIONS.values()
    ]


def run_action(action_id: str) -> dict:
    action = _ACTIONS.get(action_id)
    if action is None:
        return {"ok": False, "error": f"Unknown hub action: {action_id}"}
    return action.run()
