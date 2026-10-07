"""Feature-specific HTTP adapter; no runtime state ownership."""
from pathlib import Path
from hub_ui import updates

class SceneRoutes:
    def _svs_catalog(self):
        try:
            from scene_voice_switcher.api import catalog
            self._json(200, catalog())
        except ValueError as exc:
            self._err(400, str(exc))

    def _svs_artwork(self):
        try:
            from scene_voice_switcher.api import artwork
            from urllib.parse import urlparse, parse_qs
            name=parse_qs(urlparse(self.path).query).get('source',[''])[0]
            path=artwork(name)
            from lib.http_files import serve_file
            serve_file(self,path,content_type='image/png')
        except (ValueError,FileNotFoundError) as exc:
            self._err(404,str(exc))
    def _svs_lobbies(self):
        try:
            from scene_voice_switcher.api import locations
            self._json(200, locations())
        except Exception as exc:
            self._err(500, str(exc))


    def _svs_post(self, action: str, body: dict):
        if action == 'next_lobby':
            try:
                from scene_voice_switcher.api import next_lobby
                self._json(200, next_lobby())
            except ValueError as exc:
                self._err(400, str(exc))
            except Exception as exc:
                self._err(500, str(exc))
            return
        if action == 'effect':
            try:
                from scene_voice_switcher.api import lobby_effect
                cue = lobby_effect(body.get('source'), body.get('action'))
                updates.broadcast('living_lobby_action', cue)
                self._json(200, {'ok': True, **cue})
            except ValueError as exc:
                self._err(400, str(exc))
            except Exception as exc:
                self._err(500, str(exc))
            return
        if action == 'selection':
            try:
                from scene_voice_switcher.api import configure_selection
                self._json(200, configure_selection(body.get('mode'), body.get('source')))
            except ValueError as exc:
                self._err(400, str(exc))
            except Exception as exc:
                self._err(500, str(exc))
            return
        if action == 'select_stage':
            try:
                from scene_voice_switcher.api import select_stage
                self._json(200, select_stage(body.get('stage'), body.get('source')))
            except ValueError as exc:
                self._err(400, str(exc))
            except Exception as exc:
                self._err(500, str(exc))
            return
        if action in ('configure_lobby','restore_lobby'):
            try:
                from scene_voice_switcher.api import configure_lobby, restore_lobby
                result=(configure_lobby(body.get('source',''),body.get('changes',{}))
                        if action=='configure_lobby' else restore_lobby(body.get('source','')))
                self._json(200,result)
            except ValueError as exc:
                self._err(400,str(exc))
            except Exception as exc:
                self._err(500,str(exc))
            return
        if action == 'select_lobby':
            try:
                from scene_voice_switcher.api import select_lobby
                self._json(200, select_lobby(body.get('source') or None,
                                          screen_visible=body.get('screen_visible')))
            except ValueError as exc:
                self._err(400, str(exc))
            except Exception as exc:
                self._err(500, str(exc))
            return
        if action == "switch_scene":
            scene = body.get("scene", "")
            if not scene:
                self._err(400, "scene required")
                return
            try:
                import obs
                obs.switch_scene(scene, owner='hub_ui', reason='Scene button')
                updates.broadcast("project_action", {"project": "scene_voice_switcher", "action": "switch_scene", "scene": scene})
                self._json(200, {"ok": True})
            except Exception as exc:
                self._err(500, str(exc))
        else:
            self._err(404, f"Unknown action: {action}")

