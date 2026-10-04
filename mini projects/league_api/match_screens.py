"""Text-free match artwork and a bounded hold shared by automatic scene routers.

Only fresh, observed win/lose candidates choose result art. Disconnects and client
phases may reserve two seconds for an in-flight result, never invent an outcome.
State belongs to the service so losing the game API does not erase the finish.
"""
from pathlib import Path
import threading
import time

ART = {'game_start': 'game-start.png', 'victory': 'victory.png', 'defeat': 'defeat.png'}
GAME_PHASES = {'InProgress', 'GameStart', 'Reconnect', 'WatchInProgress'}


class MatchScreens:
    def __init__(self, asset_dir, settings, clock=time.monotonic):
        self.asset_dir = Path(asset_dir)
        self.clock = clock
        self.lock = threading.RLock()
        self.settings = dict(settings)
        self.serial = 0
        self.reset()

    @property
    def enabled(self):
        return (self.settings.get('enabled', False) and self.settings.get('lifecycle', True)
                and self.settings.get('match_screens', False))

    def reset(self):
        with self.lock:
            self.current = None
            self.demo = None
            self.game_time = -1
            self.result_seen = False
            self.end_reserved = False
            self.grace_until = 0

    def clear(self):
        with self.lock:
            self.current = None
            self.demo = None
            self.grace_until = 0

    def configure(self, settings):
        with self.lock:
            self.settings = dict(settings)
            self.clear()

    def asset(self, key):
        name = ART.get(key)
        path = self.asset_dir / name if name else None
        return path if path and path.is_file() else None

    def _show(self, key, preview=False):
        if not self.enabled or not self.asset(key):
            return False
        if not preview and not self.settings.get('event_options', {}).get(key, {}).get('enabled', True):
            return False
        now = self.clock()
        ending = key in {'victory', 'defeat'}
        delay = self.settings.get('result_delay_seconds', 1.5) if ending and not preview else 0
        duration = self.settings.get('result_hold_seconds', 5) if ending else self.settings.get('start_hold_seconds', 5)
        self.serial += 1
        screen = dict(id=self.serial, key=key, started=now+delay,
                      expires=now+delay+duration, duration=duration, preview=preview)
        if preview:
            self.demo = screen
        else:
            self.current = screen
            self.demo = None
        if ending and not preview:
            self.result_seen = self.end_reserved = True
            self.grace_until = 0
        from events import inspect_event
        inspect_event('league_production.match_screen', owner='league_api', phase='scheduled',
                      kind=key, mode='preview' if preview else 'automatic')
        return True

    def ingest(self, game_time, candidates):
        with self.lock:
            if game_time < self.game_time - 2:
                self.reset()
            self.game_time = game_time
            if not self.enabled:
                self.clear()
                return
            observed = {c['key'] for c in candidates if c.get('confidence') == 'observed'}
            result = next((key for key in ('victory', 'defeat') if key in observed), None)
            if result and not self.result_seen:
                self._show(result)
            elif 'game_start' in observed and not self.result_seen:
                self._show('game_start')

    def preview(self, key):
        with self.lock:
            if not self._show(key, preview=True):
                raise ValueError('Enable cinematic match screens and check the artwork files before previewing.')

    def scene_hold(self, previous_phase=None, phase=None, disconnected=False):
        with self.lock:
            if not self.enabled:
                return 0
            now = self.clock()
            # A preview never delays the real client's routing.
            if self.current and not self.current['preview'] and self.current['key'] in {'victory', 'defeat'}:
                return max(0, self.current['expires'] - now)
            leaving_game = previous_phase in GAME_PHASES and phase not in GAME_PHASES
            if (leaving_game or disconnected) and not self.end_reserved and not self.result_seen:
                if self.asset('victory') and self.asset('defeat'):
                    self.end_reserved = True
                    self.grace_until = now + 2
            return max(0, self.grace_until - now)

    def snapshot(self):
        with self.lock:
            now = self.clock()
            screen = self.demo if self.demo and now < self.demo['expires'] else self.current
            if not self.enabled or not screen or now >= screen['expires']:
                return None
            return {**screen, 'image': '/match-art/' + screen['key'],
                    'delay': max(0, screen['started']-now),
                    'elapsed': now-screen['started'],
                    'remaining': max(0, screen['expires']-now)}
