"""Live project interfaces and their process-wide registry.

Unlike lib.project_registry (discovery on disk), this module tracks interfaces
registered by module code. It does not discover modules, start threads or contact
OBS. shared.py re-exports these exact objects for existing callers; there must be
only one project_registry singleton per process.
"""
import threading
from dataclasses import dataclass


# ── Project interface system (cross-project conflict resolution) ──────────────
#
# Each mini-project that touches OBS exposes a ProjectInterface singleton in
# its  interface.py  module.  The singleton auto-registers with project_registry
# on import so the hub and other projects can query live state and request
# clean reverts or pauses without reaching into project internals.
#
# Usage from another project:
#
#     from shared import project_registry
#
#     # Ask all other projects to pause before you start playing something:
#     project_registry.pause_all(except_="my_project")
#     player.play_async(source, on_complete=lambda: project_registry.resume_all(except_="my_project"))
#
#     # Emergency stop — revert ALL OBS state for conflicting projects:
#     project_registry.revert_all(except_="my_project")
#
#     # Check who owns the scenes you're about to touch:
#     conflicts = project_registry.conflicting_projects("my_project", ["My Scene"])
#
#     # Snapshot every project's live state:
#     for name, status in project_registry.get_all_status().items():
#         print(name, status)

@dataclass
class ProjectStatus:
    """Snapshot of a project's live state at the moment get_status() is called."""
    name:               str
    is_active:          bool                  # currently doing something visible in OBS?
    current_activity:   str | None            # human-readable, e.g. "playing: SongName"
    controlled_scenes:  list[str]             # OBS scenes this project may touch
    can_revert:         bool                  # True if revert() is implemented


class ProjectInterface:
    """
    Base class every mini-project interface implements.

    Each project creates one subclass, instantiates it at module level in
    interface.py, and calls  project_registry.register(interface)  on creation.
    The project's main.py populates a module-level  _live  dict with live
    references (player objects, state flags, callables) so get_status(),
    revert(), pause(), and resume() have something to work with at runtime.

    Implementing pause() / resume()
    --------------------------------
    Override these if your project supports temporary suspension:
      - pause() should stop visible activity without hiding/reverting OBS state.
      - resume() should pick up where pause() left off.
    Projects that don't support pause leave the default no-ops in place.
    """
    name:              str       = ""
    controlled_scenes: list[str] = []
    produces_audio:    bool      = False  # True → this project outputs audible audio

    def get_status(self) -> ProjectStatus:
        raise NotImplementedError

    def revert(self) -> None:
        """Stop all activity and restore OBS to a clean state."""
        raise NotImplementedError

    def pause(self) -> None:
        """
        Temporarily pause activity without reverting OBS state.
        Called by project_registry.pause_all() when another project needs focus.
        Default: no-op (projects that don't support pause are unaffected).
        """
        pass

    def resume(self) -> None:
        """
        Resume after a pause() call.
        Called by project_registry.resume_all() when the other project finishes.
        Default: no-op.
        """
        pass

    def action_catalog(self) -> list[dict]:
        """
        Optional list of user-facing actions this project supports.
        Hub/editor UIs use this to build buttons and hotkey editors.
        """
        actions = [
            {"key": "pause", "label": "Pause Playback", "description": "Pause current activity."},
            {"key": "resume", "label": "Resume Playback", "description": "Resume paused activity."},
        ]
        try:
            status = self.get_status()
            if status.can_revert:
                actions.append({"key": "revert", "label": "Revert", "description": "Stop and clean up OBS state."})
        except Exception:
            pass
        return actions

    def run_action(self, action: str, **kwargs) -> dict:
        """Run a named interface action. Projects can override for richer verbs."""
        if action == "revert":
            self.revert()
        elif action == "pause":
            self.pause()
        elif action == "resume":
            self.resume()
        else:
            return {"ok": False, "error": f"Unsupported project action: {action}"}
        return {"ok": True, "action": action}

    def volume_state(self) -> dict:
        """Optional project/profile volume snapshot for hub display."""
        return {}


class _ProjectRegistry:
    """
    Central registry of all ProjectInterface singletons.

    Populated automatically when each project's interface.py is imported.
    The hub imports all interface modules after project discovery so the
    registry is fully populated before any run() threads are started.
    """

    def __init__(self) -> None:
        self._ifaces: dict[str, ProjectInterface] = {}
        self._lock   = threading.Lock()

    def register(self, iface: ProjectInterface) -> None:
        with self._lock:
            self._ifaces[iface.name] = iface

    def get(self, name: str) -> ProjectInterface | None:
        with self._lock:
            return self._ifaces.get(name)

    def all(self) -> list[ProjectInterface]:
        with self._lock:
            return list(self._ifaces.values())

    def get_all_status(self) -> dict[str, ProjectStatus]:
        """Return a {name: ProjectStatus} snapshot for every registered project."""
        result: dict[str, ProjectStatus] = {}
        for iface in self.all():
            try:
                result[iface.name] = iface.get_status()
            except Exception as exc:
                print(f"[registry] get_status failed for '{iface.name}': {exc}")
        return result

    def conflicting_projects(self, requester: str, scenes: list[str]) -> list[str]:
        """
        Return names of OTHER currently active projects that share any of
        the given OBS scenes.  An empty list means it is safe to proceed.
        """
        scene_set = set(scenes)
        conflicts: list[str] = []
        for iface in self.all():
            if iface.name == requester:
                continue
            try:
                status = iface.get_status()
                if status.is_active and scene_set & set(iface.controlled_scenes):
                    conflicts.append(iface.name)
            except Exception:
                pass
        return conflicts

    def revert_all(self, except_: str | None = None) -> None:
        """Stop and clean up all projects, optionally excluding the requester."""
        self._dispatch_all("revert", except_)

    def pause_all(self, except_: str | None = None) -> None:
        """Temporarily suspend other projects; unsupported pause methods are no-ops."""
        self._dispatch_all("pause", except_)

    def resume_all(self, except_: str | None = None) -> None:
        """Resume after pause_all(); idle projects treat this as a no-op."""
        self._dispatch_all("resume", except_)

    def _dispatch_all(self, action: str, except_: str | None) -> None:
        # all() releases the registry lock before any project code runs.
        for iface in self.all():
            if iface.name == except_:
                continue
            try:
                getattr(iface, action)()
            except Exception as exc:
                print(f"[registry] {action} failed for '{iface.name}': {exc}")


project_registry = _ProjectRegistry()
