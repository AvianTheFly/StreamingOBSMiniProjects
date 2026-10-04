"""HTTP adapter for the public song library and command API."""
from hub_ui import updates

class SongRoutes:
    def _ss_library(self):
        from specific_song.api import library
        try:
            self._json(200, library())
        except Exception as exc:
            self._err(500, str(exc))

    def _ss_categories(self):
        from specific_song.api import categories
        try:
            self._json(200, categories())
        except Exception as exc:
            self._err(500, str(exc))

    def _ss_post(self, action, body):
        from specific_song.api import command
        status, result = command(action, body)
        if status == 200 and action in {"play", "stop", "random"}:
            updates.broadcast("project_action", {"project": "specific_song", "action": action,
                              **{k: body[k] for k in ("source", "category") if k in body}})
        self._json(status, result)
