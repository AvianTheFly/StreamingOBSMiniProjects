"""HTTP endpoints for controls; composed by the Hub request handler."""
from __future__ import annotations

import urllib.parse
from lib.json_store import write_json
from hub_ui import settings as hub_settings
from hub_ui import commands, project_status, updates

class ControlRoutes:
    def _get_twitch_stream_settings(self):
        from lib.twitch_stream_settings import service
        self._json(200, service.snapshot())

    def _post_twitch_stream_settings(self):
        from lib.twitch_stream_settings import service
        body = self._body()
        if body.get('action') not in {'retry', 'login'}:
            return self._err(400, 'Expected retry or login')
        ok = service.retry(login=body['action'] == 'login')
        self._json(200 if ok else 409, service.snapshot())

    def _post_twitch_stream_settings_result(self):
        from lib.twitch_stream_settings import service
        ok = service.report(self._body())
        self._json(200 if ok else 409, {'ok': ok})

    def _get_voice(self):
        from voice.service import service
        self._json(200, service.diagnostics())

    def _get_coordination(self):
        from coordinator import coordinator
        from lib.coordination.scenes import scene_director
        # Events report changes, so the director may not yet have a scene after
        # startup. Read the actual program view; never mutate scene ownership.
        from obs.scenes import get_current_scene
        from obs.outputs import get_stream_status
        from lib.display_capture import snapshot
        scenes = scene_director.snapshot()
        try:
            scenes['scene'] = get_current_scene()
        except Exception:
            scenes['observing'] = False
        try:
            display = snapshot()
        except Exception:
            display = {'visible': None}
        try:
            stream = {'active': get_stream_status()['active']}
        except Exception:
            stream = {'active': None}
        self._json(200, {'scenes': scenes, 'display': display, 'stream': stream,
                         **coordinator.snapshot()})

    def _post_voice(self):
        from voice.service import service
        data = self._body()
        action = data.get("action")
        if action == "clear_history":
            service.clear_history()
            return self._json(200, {"ok": True})
        session_id = data.get("session_id")
        if not isinstance(session_id, int) or isinstance(session_id, bool):
            return self._err(400, "Expected the current voice session ID")
        if action == "finish":
            ok = service.finish(session_id=session_id)
        elif action == "cancel":
            ok = service.cancel(reason="cancelled from Voice page", session_id=session_id)
        else:
            return self._err(400, "Unknown voice action")
        self._json(200 if ok else 409, {"ok": ok, "error": None if ok else "Voice session has changed"})

    def _get_info(self):
        self._json(200, {"editor_port": getattr(self.server, "_editor_port", 8765)})

    def _get_status(self):
        self._json(200, {"projects": project_status.all_statuses()})

    def _get_projects(self):
        try:
            from lib.project_registry import discover_runnable_projects
            ps = discover_runnable_projects()
            self._json(200, [{"name": p.name, "path": str(p.path)} for p in ps])
        except Exception:
            self._json(200, [])

    def _get_rules(self):
        self._json(200, {
            "rules":         hub_settings.get_live_rules(),
            "audio_projects": project_status.audio_project_names(),
        })

    def _get_settings(self):
        self._json(200, hub_settings.load_settings())

    def _get_hub_actions(self):
        from hub_actions import list_actions

        settings = hub_settings.load_settings()
        hotkeys = settings.get("hub_hotkeys") or {}
        self._json(200, {
            "actions": list_actions(),
            "hotkeys": hotkeys if isinstance(hotkeys, dict) else {},
            "workflows": settings.get("hub_workflows") if isinstance(settings.get("hub_workflows"), list) else [],
        })

    def _post_rules(self):
        body  = self._body()
        rules = body.get("rules", [])
        try:
            parsed = hub_settings.parse_rules(rules)
        except ValueError as exc:
            return self._err(400, str(exc))
        try:
            write_json(hub_settings.RULES_FILE, rules)
        except OSError as exc:
            return self._err(500, f"Could not save rules: {exc}")
        from coordinator import coordinator
        coordinator.replace_rules(parsed)
        updates.broadcast("rules_updated", {"rules": rules})
        self._json(200, {"ok": True, "rules": rules})

    def _post_settings(self):
        body = self._body()
        try:
            hub_settings.save_settings(body)
        except ValueError as exc:
            return self._err(400, f"Could not save settings: {exc}")
        except OSError as exc:
            return self._err(500, f"Could not save settings: {exc}")
        updates.broadcast("settings_updated", {})
        self._json(200, {"ok": True})

    def _post_hub_action(self, path: str):
        action_id = urllib.parse.unquote(path[len("/api/hub-actions/"):])
        result = commands.run_hub_action(action_id, source="ui")
        if not result.get("ok", False):
            self._json(400, result)
            return
        self._json(200, result)

    def _post_project_action(self, path: str):
        rest = path[len("/api/project-actions/"):]
        parts = [urllib.parse.unquote(part) for part in rest.split("/") if part]
        if len(parts) != 2:
            self._err(400, "Expected /api/project-actions/{project}/{action}")
            return
        result = commands.run_project_action(parts[0], parts[1], source="ui")
        if not result.get("ok", False):
            self._json(400, result)
            return
        self._json(200, result)

    def _post_workflow(self, path: str):
        workflow_id = urllib.parse.unquote(path[len("/api/workflows/"):])
        settings = hub_settings.load_settings()
        workflows = settings.get("hub_workflows") if isinstance(settings.get("hub_workflows"), list) else []
        workflow = next((item for item in workflows if isinstance(item, dict) and str(item.get("id")) == workflow_id), None)
        if workflow is None:
            self._err(404, f"Workflow '{workflow_id}' not found")
            return
        result = commands.run_workflow(workflow, source="ui")
        if not result.get("ok", False):
            self._json(400, result)
            return
        self._json(200, result)
