"""Editor session endpoints; transport owns request parsing."""
from __future__ import annotations
import threading
from .settings import _load_editor_state
from .presentation import _build_api_data


class _SessionRoutes:

    def _handle_project_switch(self, data):
        key = str(data.get('key', '')).strip()
        found = next((p for p in self.context.projects if p['key'] == key), None)
        if not found:
            return self._json_err(f"Project '{key}' not found")
        self.context.current['proj'] = found
        proj = self.context.current['proj']
        state = _load_editor_state(proj)
        self._json_ok({'ok': True, **_build_api_data(proj, state, self.context.projects, self.context.current['proj'])})

    def _handle_shutdown(self, data):
        self._json_ok({'ok': True})
        srv = self.context.server_ref[0]
        if srv:
            threading.Thread(target=srv.shutdown, daemon=True).start()
