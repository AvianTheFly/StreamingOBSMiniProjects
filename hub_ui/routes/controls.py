"""HTTP endpoints for controls; composed by the Hub request handler."""
from __future__ import annotations

import json
import urllib.parse
from hub_ui import settings as hub_settings
from hub_ui import commands, project_status, updates

class ControlRoutes:
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
            hub_settings.RULES_FILE.write_text(
                json.dumps(rules, indent=2, ensure_ascii=False), encoding="utf-8"
            )
        except Exception:
            pass
        hub_settings.apply_rules_from_list(rules)
        updates.broadcast("rules_updated", {"rules": rules})
        self._json(200, {"ok": True, "rules": rules})

    def _post_settings(self):
        hub_settings.save_settings(self._body())
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
