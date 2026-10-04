"""HTTP endpoints for projects; composed by the Hub request handler."""
from __future__ import annotations

from .songs import SongRoutes
from .scenes import SceneRoutes
from .sound_effects import SoundEffectRoutes
from .replay import ReplayRoutes
from hub_ui import project_status, updates

class ProjectRoutes(SongRoutes, SceneRoutes, SoundEffectRoutes, ReplayRoutes):
    def _get_project(self, path: str):
        parts = path[len("/api/projects/"):].split("/")
        name   = parts[0] if parts else ""
        action = parts[1] if len(parts) > 1 else "status"

        if action in ("", "status"):
            for s in project_status.all_statuses():
                if s["name"] == name:
                    self._json(200, s)
                    return
            self._err(404, f"Project '{name}' not registered")
            return

        if action == 'assets':
            from shared import project_registry
            iface = project_registry.get(name)
            getter = getattr(iface, 'asset_catalog', None)
            if not callable(getter):
                return self._err(404, 'This feature has no asset catalog')
            try:
                return self._json(200, getter())
            except Exception as exc:
                return self._err(500, str(exc))

        # project-specific read endpoints
        if name == "specific_song":
            if action == "library":
                self._ss_library()
            elif action == "categories":
                self._ss_categories()
            else:
                self._err(404, "Unknown action")
        elif name == "scene_voice_switcher" and action == "lobbies":
            self._svs_lobbies()
        elif name == "scene_voice_switcher" and action == "artwork":
            self._svs_artwork()
        elif name == "sound_effects" and action == "library":
            self._sfx_library()
        elif name == "instant_replay":
            self._get_replay(action)
        else:
            self._err(404, "Unknown action")

    def _post_project(self, path: str):
        parts = path[len("/api/projects/"):].split("/")
        name   = parts[0] if parts else ""
        action = parts[1] if len(parts) > 1 else ""
        body   = self._body()

        if action == 'play-asset':
            from shared import project_registry
            iface = project_registry.get(name)
            runner = getattr(iface, 'play_asset', None)
            if not callable(runner):
                return self._err(404, 'This feature cannot play an asset')
            source = body.get('source')
            if not isinstance(source, str) or not source.strip():
                return self._err(400, 'source required')
            try:
                result = runner(source)
            except Exception as exc:
                return self._err(500, str(exc))
            return self._json(200 if result.get('ok') else 400, result)
        elif action == "revert":
            self._proj_revert(name)
        elif action == "pause":
            self._proj_pause(name)
        elif action == "resume":
            self._proj_resume(name)
        elif name == "specific_song":
            self._ss_post(action, body)
        elif name == "scene_voice_switcher":
            self._svs_post(action, body)
        elif name == "sound_effects":
            self._sfx_post(action, body)
        elif name == "instant_replay":
            self._post_replay(action, body)
        else:
            self._err(404, "Unknown action")

    def _proj_revert(self, name: str):
        try:
            from shared import project_registry
            iface = project_registry.get(name)
            if iface is None:
                self._err(404, f"Project '{name}' not registered")
                return
            iface.revert()
            updates.broadcast("project_reverted", {"project": name})
            self._json(200, {"ok": True})
        except Exception as exc:
            self._err(500, str(exc))

    def _proj_pause(self, name: str):
        try:
            from shared import project_registry
            iface = project_registry.get(name)
            if iface is None:
                self._err(404, f"Project '{name}' not registered")
                return
            from coordinator import coordinator
            coordinator.manual_action(name, "pause")
            self._json(200, {"ok": True})
        except Exception as exc:
            self._err(500, str(exc))

    def _proj_resume(self, name: str):
        try:
            from shared import project_registry
            iface = project_registry.get(name)
            if iface is None:
                self._err(404, f"Project '{name}' not registered")
                return
            from coordinator import coordinator
            coordinator.manual_action(name, "resume")
            self._json(200, {"ok": True})
        except Exception as exc:
            self._err(500, str(exc))
