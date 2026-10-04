"""Client phases control existing lobby groups; game scene routing stays in League."""
from __future__ import annotations

import copy
import json
from pathlib import Path
import threading
import time
from websocket import WebSocketTimeoutException

from lib.league_client import LeagueClient
from .champ_select import ChampSelectState, THEMES
from .scene_routing import apply_scene, replay_is_active, idle_uses_lobby
from lib.coordination.scenes import scene_director

DEFAULTS = {
    'enabled': False,
    'lobby_scene': 'Lobbies',
    'idle_scene': 'just screen',
    'idle_presentation': 'scene',
    'queue_group': 'TavernLobby',
    'champion_group': 'LOL champ select',
    'other_lobby_groups': ['FutureLobby'],
    'hidden_queue_sources': ['DESKTOP 3D SCREEN', 'league client'],
    'theme': 'random',
}
GAME_PHASES = {'InProgress', 'GameStart', 'Reconnect', 'WatchInProgress'}
IDLE_PHASES = {'None', 'Lobby', 'EndOfGame', 'PreEndOfGame', 'WaitingForStats', 'TerminatedInError'}


def route(phase, session=None):
    if phase in {'Matchmaking', 'ReadyCheck'}:
        return 'queue'
    if phase in GAME_PHASES:
        return None
    if phase in IDLE_PHASES:
        return 'idle'
    if phase != 'ChampSelect':
        return None
    if not isinstance(session, dict):
        return 'queue'
    timer = session.get('timer', {}).get('phase', '')
    actions = [a for row in session.get('actions', []) for a in row]
    bans = [a for a in actions if a.get('type') == 'ban']
    if timer == 'PLANNING' or any(not a.get('completed', False) for a in bans):
        return 'queue'
    if bans or timer in {'PICK', 'FINALIZATION'}:
        return 'champions'
    return 'queue'




class ClientScenes:
    def __init__(self, path, reader=None, obs_factory=None, clock=time.monotonic, scene_hold=None,
                 director=scene_director):
        self.path = Path(path)
        self.settings = {**copy.deepcopy(DEFAULTS), **(json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {})}
        self.reader = reader or LeagueClient()
        self.champ_select = ChampSelectState(self.path.parent)
        if obs_factory is None:
            from obs import get_obs
            obs_factory = get_obs
        self.obs_factory = obs_factory
        self.clock = clock
        self.scene_hold = scene_hold or (lambda **context: 0)
        self.director = director
        self.intent_revision = None
        self.lock = threading.RLock()
        self.phase = None
        self.target = None
        self.applied = None
        self.error = None
        self.retry_at = 0
        self.privacy_armed = False
        self.status = 'Waiting for League client'

    def snapshot(self):
        with self.lock:
            return {'settings': copy.deepcopy(self.settings), 'phase': self.phase,
                    'target': self.target, 'status': self.status, 'error': self.error,
                    'privacy_armed': self.privacy_armed}

    def overlay_snapshot(self):
        with self.lock:
            return self.champ_select.snapshot(self.enabled and self.phase == 'ChampSelect'
                                             and self.target == 'champions' and self.applied == 'champions')

    @property
    def enabled(self):
        with self.lock:
            return self.settings['enabled']

    def configure(self, body):
        if not body or set(body) - {'enabled', 'theme', 'idle_presentation'}:
            raise ValueError('Expected scene automation or theme settings')
        if 'enabled' in body and not isinstance(body['enabled'], bool):
            raise ValueError('Expected an enabled checkbox')
        if 'theme' in body and body['theme'] not in ('random', *THEMES):
            raise ValueError('Unknown champion select theme')
        if 'idle_presentation' in body and body['idle_presentation'] not in ('scene', 'lobby'):
            raise ValueError('Unknown idle presentation')
        with self.lock:
            from lib.settings_backups import SettingsBackups
            SettingsBackups().snapshot()
            from lib.json_store import update_json
            def merge(saved):
                if not isinstance(saved, dict):
                    raise ValueError('Preserve malformed client scene settings; repair explicitly')
                return {**copy.deepcopy(DEFAULTS), **saved, **body}
            updated = update_json(self.path, merge, default={})
            self.settings = updated
            if updated['theme'] in THEMES:
                self.champ_select.theme = updated['theme']
            self.applied = None
            self.intent_revision = self.director.snapshot()['manual_revision']
            self.retry_at = 0
            self.error = None
            self.status = 'Waiting for League client' if self.enabled else 'Client scene automation paused'
            result = self.snapshot()
        if updated['enabled']:
            self.tick()
            return self.snapshot()
        return result

    def hide_now(self):
        """Enter a private location before the streamer clicks Find Match."""
        phase, _ = self.reader.snapshot()
        if phase not in IDLE_PHASES | {'Matchmaking', 'ReadyCheck', 'ChampSelect'}:
            raise ValueError('Hide screen now is available outside gameplay.')
        with self.lock:
            client = self.obs_factory()
            if replay_is_active(client):
                raise ValueError('Wait for Instant Replay to finish before hiding the screen.')
            if not apply_scene(client, self.settings, 'queue', director=self.director, automatic=False):
                raise ValueError('A temporary scene owns the screen; try after it finishes.')
            self.privacy_armed = phase in IDLE_PHASES
            self.phase = phase
            self.target = 'queue'
            self.applied = 'queue'
            self.intent_revision = self.director.snapshot()['manual_revision']
            self.error = None
            self.status = 'Screen hidden until queue starts' if self.privacy_armed else f'League client: {phase}'
            return self.snapshot()

    def show_screen(self):
        """Cancel a pre-queue privacy hold; active queues remain automatic."""
        try:
            phase, _ = self.reader.snapshot()
        except Exception:
            phase = None
        if phase not in IDLE_PHASES and not (phase is None and self.phase not in GAME_PHASES):
            raise ValueError('The screen can only be shown outside queue.')
        with self.lock:
            client = self.obs_factory()
            if replay_is_active(client):
                raise ValueError('Wait for Instant Replay to finish before showing the screen.')
            if idle_uses_lobby(self.settings):
                from lib.display_capture import set_visible
                set_visible(True, client=client)
            elif not apply_scene(client, self.settings, 'idle', director=self.director, automatic=False):
                raise ValueError('A temporary scene owns the screen; try after it finishes.')
            self.privacy_armed = False
            self.phase = phase
            self.target = 'idle'
            self.applied = 'idle'
            self.intent_revision = self.director.snapshot()['manual_revision']
            self.error = None
            self.status = f'League client: {phase}' if phase else 'Screen shown manually; League client unavailable'
            return self.snapshot()

    def tick(self):
        # Capture intent before slow client I/O. A newer manual scene selection
        # during that read or a cinematic/replay hold invalidates this transition.
        revision = self.director.snapshot()['manual_revision']
        try:
            phase, session = self.reader.snapshot()
            target = route(phase, session)
            with self.lock:
                self.champ_select.update(phase, session, self.settings['theme'])
                if self.enabled and target is not None:
                    self.scene_hold(previous_phase=self.phase, phase=phase)
                self.phase = phase
                if phase not in IDLE_PHASES:
                    self.privacy_armed = False
                if self.privacy_armed and phase in IDLE_PHASES:
                    target = 'queue'
                self.status = 'Screen hidden until queue starts' if self.privacy_armed else f'League client: {phase}'
        except Exception:
            with self.lock:
                # Fail closed: losing the client API is not evidence that queue
                # ended. Keep the private scene until an idle phase is confirmed.
                self.status = 'League client unavailable; keeping current scene private'
                return
        with self.lock:
            if target != self.target:
                from events import inspect_event
                inspect_event('league_client.phase', owner='league_api', phase=str(phase), action=target or 'gameplay')
                self.intent_revision = revision
            self.target = target
        self.apply_pending()
        if phase == 'ChampSelect' and target == 'champions' and isinstance(session, dict):
            try:
                chat = self.reader.chat_messages(session)
                if isinstance(chat, list):
                    with self.lock:
                        self.champ_select.chat = chat[-10:]
            except (OSError, ValueError, KeyError, TypeError, AttributeError):
                pass

    def apply_pending(self, verify_active=False):
        """Apply a confirmed transition once; never reclaim a manual scene."""
        with self.lock:
            if not self.enabled:
                self.status = 'Client scene automation paused'
                return
            target = self.target
            if target is None:
                self.applied = None
                return
            if self.clock() < self.retry_at:
                return
            # A new client phase can choose a lobby; an unchanged queue must
            # not pull the program back after another deliberate scene choice.
            if target == self.applied:
                return
            if (self.intent_revision is not None and
                    self.director.snapshot()['manual_revision'] != self.intent_revision):
                self.applied = target
                self.status = f'League client: {self.phase}; keeping newer scene choice'
                return
            if self.scene_hold() > 0:
                self.status = f'League client: {self.phase}; waiting for cinematic match result'
                return
            try:
                client = self.obs_factory()
                if replay_is_active(client):
                    self.status = f'League client: {self.phase}; waiting for Instant Replay'
                    return
                if not apply_scene(client, self.settings, target, director=self.director,
                                   expected_manual_revision=self.intent_revision):
                    if self.director.snapshot()['manual_revision'] != self.intent_revision:
                        self.applied = target
                        self.status = f'League client: {self.phase}; keeping newer scene choice'
                    else:
                        self.status = f'League client: {self.phase}; waiting for temporary scene owner'
                    return
                self.applied = target
                self.error = None
                print(f'[league-client] {self.phase or "Closed"} -> {target}', flush=True)
            except Exception as exc:
                self.error = str(exc)
                self.retry_at = self.clock() + 5

    def run(self, stop_event, parent_stop):
        while not stop_event.is_set() and not parent_stop.is_set():
            connection = None
            try:
                connection = self.reader.connect_events()
                # Subscribe before the baseline read, so changes during the read
                # remain queued on the socket rather than getting missed.
                self.tick()
                last_draft_poll = self.clock()
                last_scene_check = self.clock()
                while not stop_event.is_set() and not parent_stop.is_set():
                    try:
                        raw = connection.recv()
                    except WebSocketTimeoutException:
                        raw = None
                    if raw is not None:
                        if raw == '':
                            raise OSError('League client event stream closed')
                        if self.reader.relevant_event(raw):
                            self.tick()
                    now = self.clock()
                    if self.phase == 'ChampSelect' and now - last_draft_poll >= 1:
                        self.tick()
                        last_draft_poll = now
                    if now - last_scene_check >= 2:
                        self.apply_pending(verify_active=True)
                        last_scene_check = now
                    elif self.target != self.applied:
                        self.apply_pending()
            except Exception:
                with self.lock:
                    self.status = 'League client unavailable; keeping current scene private'
                # A confirmed route can still finish its hold if the client closes.
                if self.target != self.applied:
                    self.apply_pending()
                stop_event.wait(2)
            finally:
                if connection is not None:
                    connection.close()
