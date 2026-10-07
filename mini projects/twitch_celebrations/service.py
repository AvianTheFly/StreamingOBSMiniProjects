"""Synchronized celebration state, settings and browser notifications."""
import json
import copy
import secrets
import threading
import time
from pathlib import Path
from .engine import Engine, THEMES
from .twitch import Twitch
from .config import ROOT


class Service:
    def __init__(self, stop):
        self.lock = threading.RLock()
        self._changed = threading.Condition(self.lock)
        self._revision = 0
        self._closed = False
        self.engine = Engine()
        self.csrf = secrets.token_urlsafe(32)
        self.last_overlay = -1000
        self.settings = {'enabled':True, 'volume':0.22, 'muted':False, 'custom':{}}
        try:
            self.settings.update(json.loads((ROOT/'settings.json').read_text()))
        except FileNotFoundError:
            pass
        self.twitch = Twitch(stop, self.receive)

    def receive(self, kind, name, count=1, event_id=None, theme=None, details=None):
        from events import inspect_event
        with self.lock:
            if self._closed or not self.settings['enabled']:
                inspect_event('twitch:' + kind, owner='twitch_celebrations', phase='disabled', count=count)
                return False
            accepted = self.engine.submit(kind, name, count, event_id, theme, details)
            if accepted:
                self._notify()
            inspect_event('twitch:' + kind, owner='twitch_celebrations', phase='queued' if accepted else 'skipped', count=count)
            return accepted

    def state(self, overlay=False):
        with self.lock:
            if overlay:
                self.last_overlay = time.monotonic()
            active = self.engine.snapshot(ready=overlay)
            return dict(active=active, queue=len(self.engine.queue), settings=self.settings,
                        themes=THEMES, history=list(self.engine.history),
                        connected=self.twitch.connected, message=self.twitch.message, auth=self.twitch.auth,
                        subscriptions=self.twitch.subscriptions, last_event=self.twitch.last_event,
                        overlay_ready=time.monotonic()-self.last_overlay < 3)

    def _notify(self):
        self._revision += 1
        self._changed.notify_all()

    def wait_overlay(self, after, timeout=1.0):
        """Idle browsers release the lock while waiting; events wake them promptly."""
        with self._changed:
            self.last_overlay = time.monotonic()
            active = self.engine.snapshot(ready=not self._closed)
            if active is None and self._revision == after and not self._closed:
                self._changed.wait_for(lambda: self._revision != after or self._closed,
                                       timeout=max(0., min(timeout, 1.0)))
                active = self.engine.snapshot(ready=not self._closed)
            self.last_overlay = time.monotonic()
            return dict(active=copy.deepcopy(active), settings=copy.deepcopy(self.settings), revision=self._revision)

    def clear(self):
        with self._changed:
            self.engine.clear()
            self._notify()

    def set_paused(self, paused):
        with self._changed:
            self.engine.paused = bool(paused)
            if paused:
                self.engine.clear()
            self._notify()

    def close(self):
        with self._changed:
            self._closed = True
            self.engine.clear()
            self._notify()

    def save(self, body):
        with self.lock:
            patch = {}
            for key in ('enabled','muted'):
                if key in body:
                    if not isinstance(body[key],bool): raise ValueError('Invalid switch')
                    patch[key] = body[key]
            if 'volume' in body:
                value = float(body['volume'])
                if not 0 <= value <= 1: raise ValueError('Volume must be between 0 and 1')
                patch['volume'] = value
            if 'custom' in body:
                custom = body['custom']
                if not isinstance(custom,dict) or set(custom)-set(THEMES): raise ValueError('Invalid theme')
                for values in custom.values():
                    if not isinstance(values,dict) or set(values)-{'visual','audio'}: raise ValueError('Invalid media slot')
                    for kind, name in values.items():
                        if name and not self.asset(name, kind): raise ValueError('Choose a file from the media folder')
                patch['custom'] = custom
            from lib.settings_backups import SettingsBackups
            from lib.json_store import update_json
            SettingsBackups().snapshot()
            self.settings = update_json(ROOT/'settings.json',
                lambda current: {**self.settings, **current, **patch}, default={})
            if not self.settings['enabled']:
                self.engine.clear()
            self._notify()

    def asset(self, name, kind=None):
        if not isinstance(name,str) or Path(name).name != name: return None
        path = (ROOT/'media'/name).resolve()
        allowed = {'.wav','.mp3','.ogg','.m4a'} if kind == 'audio' else {'.webm','.mp4','.gif','.png','.webp'} if kind == 'visual' else {'.wav','.mp3','.ogg','.m4a','.webm','.mp4','.gif','.png','.webp'}
        return path if path.parent == (ROOT/'media').resolve() and path.suffix.lower() in allowed and path.is_file() else None

    def attach_obs(self):
        from .obs_source import attach_obs
        return attach_obs()
