"""HTTP endpoints for profiles; composed by the Hub request handler."""
from __future__ import annotations

import json
import math
from lib.json_store import write_json
from lib.project_settings import audio_settings_transaction
from hub_ui import project_status, updates

class ProfileRoutes:
    def _get_editor_profiles(self):
        try:
            from lib.project_registry import discover_editor_projects
            from lib.project_settings import load_project_profile_summaries
            from lib.hotkey_editor.server import _config_response

            rows = []
            for key, proj in discover_editor_projects().items():
                if proj.error or not proj.hotkeys_file:
                    continue
                profiles = load_project_profile_summaries(
                    proj.hotkeys_file.parent,
                    hotkeys_file=proj.hotkeys_file,
                )
                settings = {}
                if proj.asset_dir and proj.extensions:
                    settings = _config_response({
                        "config_defaults": proj.config_defaults or {},
                        "features": proj.features or {},
                        "asset_dir": proj.asset_dir,
                        "extensions": proj.extensions,
                        "hotkeys_file": proj.hotkeys_file,
                    })
                rows.append({
                    "key": key,
                    "name": proj.display,
                    "path": str(proj.path),
                    "settings": settings,
                    "profiles": profiles,
                })
            seen = {row["key"] for row in rows}
            for status in project_status.all_statuses():
                name = status.get("name")
                if not name or name in seen:
                    continue
                rows.append({
                    "key": name,
                    "name": name.replace("_", " ").title(),
                    "path": "",
                    "settings": {},
                    "profiles": [{
                        "name": "runtime",
                        "live": True,
                        "trigger_sequences": "",
                        "hotkey_count": 0,
                        "hotkeys": [],
                        "hotkey_map": {},
                        "readonly": True,
                    }],
                })
            self._json(200, {"projects": rows})
        except Exception as exc:
            self._err(500, str(exc))

    @audio_settings_transaction
    def _post_editor_profiles(self):
        body = self._body()
        for key in ("project_volume_db", "profile_volume_db"):
            if key in body:
                try:
                    if not math.isfinite(float(body[key])):
                        raise ValueError()
                except (TypeError, ValueError):
                    return self._err(400, "Volumes must be finite numbers")
        project_key = str(body.get("project") or "").strip()
        profile_name = str(body.get("profile") or "").strip()
        try:
            from lib.project_registry import discover_editor_projects
            from lib.hotkeys import save_hotkeys

            projects = discover_editor_projects()
            proj = projects.get(project_key)
            if proj is None or proj.error or not proj.hotkeys_file:
                self._err(404, f"Editor project '{project_key}' not found")
                return
            state_file = proj.hotkeys_file.parent / f"{proj.hotkeys_file.stem}_editor.json"
            raw = json.loads(state_file.read_text(encoding="utf-8")) if state_file.is_file() else {}
            if not isinstance(raw, dict):
                raw = {}
            profiles = raw.setdefault("profiles", {})
            if not isinstance(profiles, dict):
                profiles = {}
                raw["profiles"] = profiles
            profile = profiles.setdefault(profile_name or "default", {})
            if not isinstance(profile, dict):
                profile = {}
                profiles[profile_name or "default"] = profile
            if "trigger_sequences" in body:
                profile["trigger_sequences"] = str(body.get("trigger_sequences") or "")
            if isinstance(body.get("hotkeys"), dict):
                profile["hotkeys"] = body["hotkeys"]
            if isinstance(body.get("interface_hotkeys"), dict):
                from lib.shared_media.controls import normalize_interface_hotkeys
                profile["interface_hotkeys"] = normalize_interface_hotkeys(body["interface_hotkeys"])
            for key in ("project_volume_db", "profile_volume_db"):
                if key in body:
                    profile[key] = float(body[key])
            raw.setdefault("active_profile", profile_name or "default")
            raw.setdefault("live_profile", raw.get("active_profile", profile_name or "default"))
            write_json(state_file, raw)
            if raw.get("live_profile") == (profile_name or "default"):
                save_hotkeys(proj.hotkeys_file, profile.get("hotkeys", {}))
            updates.broadcast("editor_profiles_updated", {"project": project_key, "profile": profile_name or "default"})
            self._json(200, {"ok": True})
        except Exception as exc:
            self._err(500, str(exc))

    def _post_editor_project_settings(self):
        body = self._body()
        project_key = str(body.get("project") or "").strip()
        settings = body.get("settings") if isinstance(body.get("settings"), dict) else {}
        try:
            from lib.project_registry import discover_editor_projects
            from lib.hotkey_editor.server import _save_config_overrides

            proj = discover_editor_projects().get(project_key)
            if proj is None or proj.error or not proj.hotkeys_file:
                self._err(404, f"Editor project '{project_key}' not found")
                return
            _save_config_overrides({
                "hotkeys_file": proj.hotkeys_file,
                "config_defaults": proj.config_defaults or {},
            }, settings)
            updates.broadcast("editor_project_settings_updated", {"project": project_key})
            self._json(200, {"ok": True})
        except Exception as exc:
            self._err(500, str(exc))
