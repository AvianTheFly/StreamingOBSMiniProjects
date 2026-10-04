"""HTTP adapter for replay inventory, presentation, previews, and editing."""
import urllib.parse

class ReplayRoutes:
    def _get_replay(self, action):
        if action == "clips":
            try:
                from instant_replay.api import clips
                query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                data = clips(purpose=query.get('purpose', [None])[0])
                from lib.twitch_clips import status as twitch_clip_status
                data["twitch_clip"] = twitch_clip_status()
                self._json(200, data)
            except Exception as exc:
                self._err(500, str(exc))
        elif action == "stage":
            from instant_replay.stage import state
            self._json(200, state())
        elif action == "trim":
            from hub_ui.replay_trim import trim_status
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            try:
                self._json(200, trim_status(query.get("job", [""])[0]))
            except ValueError as exc:
                self._err(400, str(exc))
        elif action in {"preview", "preview-media"}:
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

    def _post_replay(self, action, body):
        if action == 'capture':
            from instant_replay.api import capture, NotReady
            try:
                self._json(202, capture(body))
            except NotReady as exc:
                self._err(409, str(exc))
            except ValueError as exc:
                self._err(400, str(exc))
        elif action == 'stage-cue':
            from instant_replay.stage import acknowledge_cue
            revision = body.get('revision')
            if body.get('event') not in ('covered', 'revealed') or not isinstance(revision, int) or isinstance(revision, bool):
                self._err(400, 'Invalid replay cue')
            else:
                self._json(200, {'accepted': acknowledge_cue(revision, body['event'])})
        elif action == "library":
            from instant_replay import library
            from instant_replay.api import mutate_library
            try:
                self._json(200, mutate_library(body))
            except library.Conflict as exc:
                self._err(409, str(exc))
            except (ValueError, OSError) as exc:
                self._err(400, str(exc))
        elif action == "trim":
            from hub_ui.replay_trim import start_trim
            from instant_replay.config import REPLAY_DIR
            try:
                self._json(202, start_trim(body, REPLAY_DIR))
            except (ValueError, OSError) as exc:
                self._err(400, str(exc))
        elif action == "skip":
            from instant_replay.api import skip
            if skip():
                self._json(200, {"ok": True})
            else:
                self._err(409, "No replay is playing.")
        elif action == "companion":
            from instant_replay.stage import set_companion, set_view
            try:
                self._json(200, set_view(body['view']) if 'view' in body else set_companion(bool(body.get("enabled"))))
            except ValueError as exc:
                self._err(400, str(exc))
            except Exception as exc:
                self._err(503, str(exc))
        elif action == 'presentation':
            from instant_replay.stage import configure
            try:
                self._json(200, configure(body))
            except (ValueError, OSError) as exc:
                self._err(400, str(exc))
            except Exception as exc:
                self._err(503, str(exc))
        elif action == "play":
            from instant_replay.api import play, NotReady
            try:
                play(body)
                self._json(200, {"ok": True})
            except NotReady as exc:
                self._err(409, str(exc))
            except ValueError as exc:
                self._err(400, str(exc))
            except Exception as exc:
                self._err(500, str(exc))
        else:
            self._err(404, "Unknown action")
