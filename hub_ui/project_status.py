"""Read-only presentation of registered runtime project interfaces.

Discovery on disk remains in lib.project_registry; this is the live UI view.
"""
from __future__ import annotations



def audio_project_names() -> list[str]:
    try:
        from shared import project_registry
        return [i.name for i in project_registry.all() if getattr(i, "produces_audio", False)]
    except Exception:
        return []


def all_statuses() -> list[dict]:
    try:
        from shared import project_registry
        result: list[dict] = []
        for iface in project_registry.all():
            try:
                s = iface.get_status()
                result.append({
                    "name":             s.name,
                    "is_active":        s.is_active,
                    "current_activity": s.current_activity,
                    "controlled_scenes": list(s.controlled_scenes),
                    "can_revert":       s.can_revert,
                    "produces_audio":   getattr(iface, "produces_audio", False),
                    "actions":          iface.action_catalog() if hasattr(iface, "action_catalog") else [],
                    "volume":           iface.volume_state() if hasattr(iface, "volume_state") else {},
                })
            except Exception as exc:
                result.append({
                    "name":             iface.name,
                    "is_active":        False,
                    "current_activity": f"error: {exc}",
                    "controlled_scenes": list(getattr(iface, "controlled_scenes", [])),
                    "can_revert":       False,
                    "produces_audio":   False,
                    "actions":          [],
                    "volume":           {},
                })
        return result
    except Exception:
        return []
