"""HTTP endpoints for audio; composed by the Hub request handler."""
from __future__ import annotations

import math
from lib.project_settings import audio_settings_transaction
from hub_ui import audio as audio_service
from hub_ui import updates

class AudioRoutes:
    def _get_audio(self):
        try:
            from lib.project_registry import discover_editor_projects
            changed_projects = audio_service.sync_audio_memory_from_obs()
            for changed in changed_projects:
                updates.broadcast("audio_updated", {"project": changed})
            projects_out = []
            for key, proj in sorted(discover_editor_projects().items()):
                if proj.error or not proj.hotkeys_file:
                    continue
                state_file = audio_service.editor_state_file_for_project(proj)
                state = audio_service.read_json_object(state_file)
                profiles_raw = state.get("profiles", {})
                if not isinstance(profiles_raw, dict) or not profiles_raw:
                    profiles_raw = {"default": {}}
                live_profile = str(state.get("live_profile") or state.get("active_profile") or next(iter(profiles_raw)))

                # project_volume_db is from live profile (project-level convention)
                live_data = profiles_raw.get(live_profile) or next(iter(profiles_raw.values()))
                if not isinstance(live_data, dict):
                    live_data = {}
                project_volume_db = float(live_data.get("project_volume_db") or 0.0)

                profiles_out = []
                for pname, pdata in sorted(profiles_raw.items()):
                    if not isinstance(pdata, dict):
                        continue
                    profile_volume_db = float(pdata.get("profile_volume_db") or 0.0)
                    file_volume_offsets = pdata.get("file_volume_offsets") or {}
                    sound_categories = pdata.get("sound_categories") or {}
                    display_names = pdata.get("display_names") or {}
                    scanned_stems = set(audio_service.scan_audio_assets(proj.asset_dir, proj.extensions))

                    all_stems: set[str] = set(scanned_stems)
                    if isinstance(sound_categories, dict):
                        all_stems |= set(sound_categories.keys())
                    if isinstance(file_volume_offsets, dict):
                        all_stems |= set(file_volume_offsets.keys())
                    if isinstance(display_names, dict):
                        all_stems |= set(display_names.keys())

                    files = []
                    for stem in sorted(all_stems):
                        offset = float(file_volume_offsets.get(stem, 0.0)) if isinstance(file_volume_offsets, dict) else 0.0
                        effective = project_volume_db + profile_volume_db + offset
                        cats_raw = (sound_categories.get(stem, []) if isinstance(sound_categories, dict) else [])
                        cats = [str(c) for c in (cats_raw if isinstance(cats_raw, list) else [])]
                        display = str(display_names.get(stem) or stem) if isinstance(display_names, dict) else stem
                        files.append({
                            "stem": stem,
                            "display": display,
                            "categories": cats,
                            "offset_db": round(offset, 2),
                            "effective_db": round(effective, 2),
                        })

                    profiles_out.append({
                        "name": pname,
                        "live": pname == live_profile,
                        "profile_volume_db": round(profile_volume_db, 2),
                        "effective_db": round(project_volume_db + profile_volume_db, 2),
                        "files": files,
                    })

                projects_out.append({
                    "key": key,
                    "name": proj.display,
                    "project_volume_db": round(project_volume_db, 2),
                    "profiles": profiles_out,
                })

            love_me_audio = audio_service.love_me_audio_payload()
            if love_me_audio:
                projects_out.append(love_me_audio)

            self._json(200, {"projects": projects_out})
        except Exception as exc:
            self._err(500, str(exc))

    @audio_settings_transaction
    def _post_audio(self):
        body = self._body()
        def validate_numbers(value):
            if not isinstance(value, dict):
                return
            for key, item in value.items():
                if key in {'project_volume_db', 'profile_volume_db'}:
                    if not math.isfinite(float(item)):
                        raise ValueError('Volume must be a finite number')
                elif key == 'file_volume_offsets' and isinstance(item, dict):
                    if any(not math.isfinite(float(v)) for v in item.values()):
                        raise ValueError('Volume offsets must be finite numbers')
                elif isinstance(item, dict):
                    validate_numbers(item)
        try:
            validate_numbers(body)
        except (TypeError, ValueError):
            return self._err(400, 'Volumes must be finite numbers')
        project_key = str(body.get("project") or "").strip()
        if not project_key:
            return self._err(400, "Missing 'project'")
        try:
            from lib.project_registry import discover_editor_projects

            if project_key == "love_me":
                audio_service.save_love_me_audio_payload(body)
                updates.broadcast("audio_updated", {"project": project_key})
                return self._json(200, {"ok": True})

            proj = discover_editor_projects().get(project_key)
            if proj is None or proj.error or not proj.hotkeys_file:
                return self._err(404, f"Audio project '{project_key}' not found")

            state_file = audio_service.editor_state_file_for_project(proj)
            state = audio_service.read_json_object(state_file)
            profiles = state.setdefault("profiles", {})
            if not isinstance(profiles, dict):
                profiles = {}
                state["profiles"] = profiles

            new_proj_db: float | None = None
            if "project_volume_db" in body:
                try:
                    new_proj_db = float(body["project_volume_db"])
                except (TypeError, ValueError):
                    pass

            payload_profiles = body.get("profiles") if isinstance(body.get("profiles"), dict) else {}
            for pname in payload_profiles:
                profiles.setdefault(str(pname), {})

            if new_proj_db is not None:
                for pdata in profiles.values():
                    if isinstance(pdata, dict):
                        pdata["project_volume_db"] = new_proj_db
                if not profiles:
                    profiles["default"] = {"project_volume_db": new_proj_db}

            for pname, pchanges in payload_profiles.items():
                if not isinstance(pchanges, dict):
                    continue
                profile = profiles.setdefault(str(pname), {})
                if not isinstance(profile, dict):
                    profile = {}
                    profiles[str(pname)] = profile
                if "profile_volume_db" in pchanges:
                    try:
                        profile["profile_volume_db"] = float(pchanges["profile_volume_db"])
                    except (TypeError, ValueError):
                        pass
                if isinstance(pchanges.get("file_volume_offsets"), dict):
                    offsets: dict[str, float] = {}
                    for stem, val in pchanges["file_volume_offsets"].items():
                        try:
                            offsets[str(stem)] = float(val)
                        except (TypeError, ValueError):
                            pass
                    profile["file_volume_offsets"] = offsets

            audio_service.suppress_sync(project_key)
            audio_service.write_json_object(state_file, state)
            try:
                audio_service.apply_live_audio_to_obs(project_key)
            except Exception as exc:
                print(f"[hub_ui] Could not apply live audio for '{project_key}': {exc}")
            updates.broadcast("audio_updated", {"project": project_key})
            self._json(200, {"ok": True})
        except Exception as exc:
            self._err(500, str(exc))

    def _get_obs_audio(self):
        try:
            import obs
            client = obs.get_obs()
            raw = client.get_input_list()
            inputs = []
            for item in getattr(raw, "inputs", []):
                if isinstance(item, dict):
                    name = item.get("inputName") or item.get("input_name") or ""
                    kind = item.get("inputKind") or item.get("input_kind") or item.get("unversionedInputKind") or ""
                else:
                    name = getattr(item, "inputName", None) or getattr(item, "input_name", None) or ""
                    kind = getattr(item, "inputKind", None) or getattr(item, "input_kind", None) or getattr(item, "unversionedInputKind", None) or ""
                name = str(name).strip()
                if not name:
                    continue
                vol = obs.get_input_volume(name)
                if vol is None:
                    continue
                muted = obs.get_input_mute(name)
                monitor = obs.get_input_audio_monitor_type(name)
                inputs.append({
                    "name": name,
                    "kind": str(kind or ""),
                    "volume_db": round(vol["db"] if vol.get("db") is not None else -100.0, 1),
                    "volume_mul": round(vol.get("mul") or 0.0, 4),
                    "muted": bool(muted),
                    "monitor": monitor or "OBS_MONITORING_TYPE_NONE",
                })
            inputs.sort(key=lambda item: item["name"].lower())
            self._json(200, {"inputs": inputs})
        except Exception as exc:
            self._json(200, {"inputs": [], "error": str(exc)})

    def _post_obs_audio(self):
        body = self._body()
        name = body.get("input", "")
        if not name:
            return self._err(400, "Missing 'input'")
        try:
            import obs
            if "volume_db" in body:
                obs.set_input_volume_db(name, float(body["volume_db"]))
            if "muted" in body:
                obs.set_input_mute(name, bool(body["muted"]))
            if "monitor" in body:
                obs.set_input_audio_monitor_type(name, str(body["monitor"]))
            self._json(200, {"ok": True})
        except Exception as exc:
            self._json(500, {"ok": False, "error": str(exc)})
