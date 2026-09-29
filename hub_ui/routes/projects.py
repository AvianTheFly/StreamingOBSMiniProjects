"""HTTP endpoints for projects; composed by the Hub request handler."""
from __future__ import annotations

import json
import sys
import threading
import urllib.parse
from pathlib import Path
from hub_ui import project_status, updates

class ProjectRoutes:
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
        elif name == "sound_effects" and action == "library":
            self._sfx_library()
        elif name == "instant_replay" and action == "clips":
            try:
                from instant_replay.interface import _live
                from instant_replay.library import decorate, disk_rows
                from instant_replay.config import REPLAY_DIR
                list_clips = _live.get("list_clips")
                data = decorate(list_clips() if callable(list_clips) else disk_rows(REPLAY_DIR))
                data["ready"] = callable(_live.get("play_sequence"))
                from lib.twitch_clips import status as twitch_clip_status
                data["twitch_clip"] = twitch_clip_status()
                self._json(200, data)
            except Exception as exc:
                self._err(500, str(exc))
        elif name == "instant_replay" and action == "trim":
            from hub_ui.replay_trim import trim_status
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            try:
                self._json(200, trim_status(query.get("job", [""])[0]))
            except ValueError as exc:
                self._err(400, str(exc))
        elif name == "instant_replay" and action in {"preview", "preview-media"}:
            try:
                from instant_replay.library import resolve
                from instant_replay.config import REPLAY_DIR
                from hub_ui.replay_media import preview, serve_file
                query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                source = resolve(query.get("path", [""])[0], REPLAY_DIR)
                status, media = preview(source)
                if action == "preview-media" and media:
                    serve_file(self, media)
                else:
                    self._json(200, status)
            except (ValueError, OSError) as exc:
                self._err(400, str(exc))
        else:
            self._err(404, "Unknown action")

    def _post_project(self, path: str):
        parts = path[len("/api/projects/"):].split("/")
        name   = parts[0] if parts else ""
        action = parts[1] if len(parts) > 1 else ""
        body   = self._body()

        if action == "revert":
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
        elif name == "instant_replay" and action == "library":
            from instant_replay import library
            from instant_replay.config import REPLAY_DIR
            try:
                self._json(200, library.mutate(body, REPLAY_DIR))
            except library.Conflict as exc:
                self._err(409, str(exc))
            except (ValueError, OSError) as exc:
                self._err(400, str(exc))
        elif name == "instant_replay" and action == "trim":
            from hub_ui.replay_trim import start_trim
            from instant_replay.config import REPLAY_DIR
            try:
                self._json(202, start_trim(body, REPLAY_DIR))
            except (ValueError, OSError) as exc:
                self._err(400, str(exc))
        elif name == "instant_replay" and action == "skip":
            from instant_replay.interface import _live
            handler = _live.get("skip_clip")
            if handler and _live.get("replay_active", [False])[0]:
                handler()
                self._json(200, {"ok": True})
            else:
                self._err(409, "No replay is playing.")
        elif name == "instant_replay" and action == "play":
            try:
                from instant_replay.interface import _live
                from instant_replay.library import group_paths, resolve
                from instant_replay.config import REPLAY_DIR
                play_sequence = _live.get("play_sequence")
                if not callable(play_sequence):
                    self._err(409, "Instant Replay is not ready")
                    return
                if _live.get("playback_busy", lambda: False)():
                    self._err(409, "A replay is already playing. Stop it before starting another.")
                    return
                paths = group_paths(str(body["group_id"]), REPLAY_DIR) if body.get("group_id") else [
                    str(resolve(str(body.get("path") or ""), REPLAY_DIR))]
                threading.Thread(
                    target=play_sequence,
                    args=(paths,),
                    daemon=True,
                    name="instant-replay-ui-play",
                ).start()
                self._json(200, {"ok": True})
            except ValueError as exc:
                self._err(400, str(exc))
            except Exception as exc:
                self._err(500, str(exc))
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
            iface.pause()
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
            iface.resume()
            self._json(200, {"ok": True})
        except Exception as exc:
            self._err(500, str(exc))

    def _ss_library(self):
        try:
            from specific_song.config import SONGS_JSON
            if not Path(SONGS_JSON).exists():
                self._json(200, [])
                return
            self._json(200, json.loads(Path(SONGS_JSON).read_text(encoding="utf-8")))
        except Exception as exc:
            self._err(500, str(exc))

    def _ss_categories(self):
        try:
            from specific_song.config import SONGS_JSON
            cats = Path(SONGS_JSON).parent / "categories.json"
            self._json(200, json.loads(cats.read_text(encoding="utf-8")) if cats.exists() else {})
        except Exception as exc:
            self._err(500, str(exc))

    def _ss_post(self, action: str, body: dict):
        live = self._live_dict("specific_song")
        if action == "play":
            source = body.get("source", "")
            player = live.get("player")
            if not (player and source):
                self._err(400, "source required / player not ready")
                return
            stop_random = live.get("stop_random")
            if stop_random:
                stop_random()
            player.play_async(source)
            updates.broadcast("project_action", {"project": "specific_song", "action": "play", "source": source})
            self._json(200, {"ok": True})

        elif action == "stop":
            player     = live.get("player")
            stop_random = live.get("stop_random")
            if stop_random:
                stop_random()
            if player:
                player.abort()
            updates.broadcast("project_action", {"project": "specific_song", "action": "stop"})
            self._json(200, {"ok": True})

        elif action == "random":
            category = (body.get("category") or "").strip() or None
            start_random = live.get("start_random")
            if not start_random:
                self._err(503, "specific_song not running")
                return
            threading.Thread(target=start_random, args=(category,), daemon=True).start()
            updates.broadcast("project_action", {"project": "specific_song", "action": "random", "category": category})
            self._json(200, {"ok": True})

        elif action == "next":
            player = live.get("player")
            rand_active = live.get("rand_active", [False])
            if rand_active[0] and player:
                player.abort()
            self._json(200, {"ok": True})

        elif action == "save_library":
            try:
                from specific_song.config import SONGS_JSON
                songs = body.get("songs", [])
                Path(SONGS_JSON).write_text(
                    json.dumps(songs, indent=2, ensure_ascii=False), encoding="utf-8"
                )
                reload_fn = live.get("reload")
                if reload_fn:
                    threading.Thread(target=reload_fn, daemon=True).start()
                self._json(200, {"ok": True})
            except Exception as exc:
                self._err(500, str(exc))

        elif action == "save_categories":
            try:
                from specific_song.config import SONGS_JSON
                cats = body.get("categories", {})
                cats_path = Path(SONGS_JSON).parent / "categories.json"
                cats_path.write_text(
                    json.dumps(cats, indent=2, ensure_ascii=False), encoding="utf-8"
                )
                self._json(200, {"ok": True})
            except Exception as exc:
                self._err(500, str(exc))

        elif action == "match_test":
            try:
                query = (body.get("query") or "").strip()
                if not query:
                    self._json(200, {"match": None, "top": []})
                    return
                from specific_song.config import SONGS_JSON, MATCH_THRESHOLD
                from specific_song.matcher import rank_matches
                if not Path(SONGS_JSON).exists():
                    self._json(200, {"match": None, "top": []})
                    return
                songs = json.loads(Path(SONGS_JSON).read_text(encoding="utf-8"))
                top = rank_matches(query, songs, top_n=5)
                best = top[0] if top and top[0][1] >= MATCH_THRESHOLD else None
                self._json(200, {
                    "match": {"song": best[0], "score": round(best[1] * 100)} if best else None,
                    "top":   [{"song": s, "score": round(sc * 100)} for s, sc in top],
                })
            except Exception as exc:
                self._err(500, str(exc))

        else:
            self._err(404, f"Unknown specific_song action: {action}")

    def _svs_lobbies(self):
        try:
            from scene_voice_switcher.config import GAME_SCENE, LOBBIES_SCENE
            self._json(200, {"game_scene": GAME_SCENE, "lobbies_scene": LOBBIES_SCENE})
        except Exception as exc:
            self._err(500, str(exc))

    def _svs_post(self, action: str, body: dict):
        if action == "switch_scene":
            scene = body.get("scene", "")
            if not scene:
                self._err(400, "scene required")
                return
            try:
                import obs
                obs.switch_scene(scene)
                updates.broadcast("project_action", {"project": "scene_voice_switcher", "action": "switch_scene", "scene": scene})
                self._json(200, {"ok": True})
            except Exception as exc:
                self._err(500, str(exc))
        else:
            self._err(404, f"Unknown action: {action}")

    def _sfx_library(self):
        try:
            from sound_effects.config import CONFIG
            asset_dir = Path(str(CONFIG.asset_dir))
            if not asset_dir.exists():
                self._json(200, [])
                return
            exts = set(getattr(CONFIG, "valid_extensions", {".mp3", ".wav", ".mp4"}))
            files = sorted(
                f.stem for f in asset_dir.iterdir()
                if f.is_file() and f.suffix.lower() in exts
            )
            self._json(200, files)
        except Exception as exc:
            self._err(500, str(exc))

    def _sfx_post(self, action: str, body: dict):
        if action == "play":
            source = body.get("source", "")
            if not source:
                self._err(400, "source required")
                return
            try:
                import events as hub_events
                hub_events.emit("sfx.play", source=source)
                self._json(200, {"ok": True})
            except Exception as exc:
                self._err(500, str(exc))
        else:
            self._err(404, f"Unknown action: {action}")

    @staticmethod
    def _live_dict(project_name: str) -> dict:
        mod = sys.modules.get(f"{project_name}.interface")
        return getattr(mod, "_live", {}) if mod else {}
