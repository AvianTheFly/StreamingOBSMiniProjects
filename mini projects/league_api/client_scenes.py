"""Client phases control existing lobby groups; game scene routing stays in League."""
from __future__ import annotations

import copy
import json
from pathlib import Path
import threading
import time
from websocket import WebSocketTimeoutException

from lib.league_client import LeagueClient
from .champ_select import ChampSelectState, THEMES, LEGACY_THEMES
from .stage_state import StageState
from .queue_state import QueueState, THEMES as QUEUE_THEMES, bans_finished
from .replay_viewing import ReplayViewing
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
    'queue_theme': 'bear',
    'replay_scene': 'Test',
}
GAME_PHASES = {'InProgress', 'GameStart', 'Reconnect', 'WatchInProgress'}
IDLE_PHASES = {'None', 'Lobby', 'EndOfGame', 'PreEndOfGame', 'WaitingForStats', 'TerminatedInError'}


def scene_event(phase, session=None):
    """Stable event identity: roster/timer updates do not renew scene intent."""
    if phase in IDLE_PHASES:
        return ('idle', None)
    if phase in {'Matchmaking', 'ReadyCheck'}:
        return ('queue', None)
    if phase in GAME_PHASES:
        return ('game', None)
    if phase != 'ChampSelect' or not isinstance(session, dict):
        return (phase, None)
    timer = (session.get('timer') or {}).get('phase', '')
    actions = [a for row in session.get('actions') or [] for a in row]
    if not actions and timer not in {'PLANNING', 'BAN_PICK', 'PICK', 'FINALIZATION'}:
        return (phase, None)
    bans = [a for a in actions if a.get('type') == 'ban']
    stage = ('planning' if timer == 'PLANNING' else
             'banning' if any(not a.get('completed', False) for a in bans) else
             'finalization' if timer == 'FINALIZATION' else 'picking')
    return (phase, stage)


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
    if bans_finished(session):
        return 'champions'
    return 'queue'




class ClientScenes:
    def __init__(self, path, reader=None, obs_factory=None, clock=time.monotonic, scene_hold=None,
                 director=scene_director):
        self.path = Path(path)
        self.settings = {**copy.deepcopy(DEFAULTS), **(json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {})}
        # Resolve retired choices without rewriting the saved settings file.
        self.settings['theme'] = LEGACY_THEMES.get(self.settings.get('theme'), self.settings.get('theme'))
        self.reader = reader or LeagueClient()
        self.champ_select = ChampSelectState(self.path.parent)
        self.stage = StageState()
        if obs_factory is None:
            from obs import get_obs
            obs_factory = get_obs
        self.obs_factory = obs_factory
        self.clock = clock
        self.queue = QueueState(clock)
        self.scene_hold = scene_hold or (lambda **context: 0)
        self.director = director
        self.replay_viewing = ReplayViewing(director)
        self.intent_revision = None
        self.lock = threading.RLock()
        self.phase = None
        self.client_event = (None, None)
        self.target = None
        self.applied = None
        self.error = None
        self.retry_at = 0
        self.privacy_armed = False
        self.manual_choice = None
        self.connected = False
        self.event_stream_connected = False
        self.status = 'Waiting for League client'
        self.match_ended = False

    def snapshot(self):
        with self.lock:
            return {'settings': copy.deepcopy(self.settings), 'phase': self.phase,
                    'target': self.target, 'status': self.status, 'error': self.error,
                    'privacy_armed': self.privacy_armed, 'connected': self.connected,
                    'event_stream': self.event_stream_connected,
                    'watching_replay': self.replay_viewing.active,
                    'manual_stage': self.manual_choice[1] if self.manual_choice else None,
                    'manual_revision': self.intent_revision,
                    'draft_phase': self.client_event[1] if self.phase == 'ChampSelect' else None,
                    'stage': self.stage_snapshot()}

    def present_stage(self, target):
        """Deliberate desk scene selection does not require a live client phase.

        Observed roster/privacy data stays untouched. Automatic phase routing
        keeps its own gates and can resume on a genuinely new client phase.
        """
        if target not in {'queue', 'champions', 'loading'}:
            raise ValueError('Choose queue, draft or loading')
        revision = self.director.snapshot()['manual_revision']
        with self.lock:
            if target == 'loading' and not self.settings.get('loading_scene'):
                raise ValueError('Loading scene is not configured')
            if not apply_scene(self.obs_factory(), self.settings, target,
                               director=self.director, automatic=False,
                               expected_manual_revision=revision):
                raise ValueError('Scene choice was superseded')
            self.target = self.applied = target
            self.manual_choice = (self.client_event, target)
            self.privacy_armed = target == 'queue' and self.phase in IDLE_PHASES
            self.intent_revision = self.director.snapshot()['manual_revision']
            self.error = None
            self.status = f'{target.title()} scene chosen manually'
            return self.snapshot()

    def observe_live(self, data, *, running=None):
        with self.lock:
            self.stage.live(data)
            if running is not None:
                self.stage.playing = running
            if self.stage.playing and self.target == 'loading':
                self.director.cancel_pending('league_client')
                self.target = self.applied = None

    def game_started(self):
        """Called before gameplay admission, serializing against pending loading."""
        with self.lock:
            self.match_ended = False
            self.stage.playing = True
            if self.target is not None:
                self.director.cancel_pending('league_client')
                self.target = self.applied = None

    def game_ended(self, *, expected_manual_revision=None):
        """Reserve the post-game route on the image clock, before LCU catches up."""
        revision = (self.director.snapshot()['manual_revision'] if expected_manual_revision is None
                    else expected_manual_revision)
        with self.lock:
            self.match_ended = True
            self.stage.playing = False
            if self.phase in GAME_PHASES:
                self.client_event = ('game', 'ended')
            self.director.cancel_pending('league_client')
            self.target, self.applied = 'idle', None
            self.intent_revision = revision
            self.retry_at = 0

    def stage_snapshot(self):
        with self.lock:
            return {**self.stage.snapshot(self.connected),
                    'queue_timer': self.queue.snapshot(self.connected, self.settings['queue_theme'])}

    def present_loading(self):
        """Manual loading uses the same observed state and revision guard."""
        revision = self.director.snapshot()['manual_revision']
        with self.lock:
            if not self.connected or not self.stage.snapshot(self.connected)['loading'] or not self.settings.get('loading_scene'):
                raise ValueError('Loading is available while a match is loading')
            if not apply_scene(self.obs_factory(), self.settings, 'loading', director=self.director,
                               automatic=False, expected_manual_revision=revision):
                raise ValueError('Loading choice was superseded')
            self.target = self.applied = 'loading'
            self.intent_revision = self.director.snapshot()['manual_revision']
            return self.snapshot()

    def overlay_snapshot(self):
        with self.lock:
            return self.champ_select.snapshot(self.phase == 'ChampSelect'
                                             and self.target == 'champions' and self.applied == 'champions')

    def present_champions(self):
        """Show the configured draft presentation from confirmed client data."""
        revision = self.director.snapshot()['manual_revision']
        phase, session = self.reader.snapshot()
        if phase != 'ChampSelect' or not isinstance(session, dict):
            raise ValueError('Champion select is available while you are in a League draft')
        with self.lock:
            self.champ_select.update(phase, session, self.settings['theme'])
            if not apply_scene(self.obs_factory(), self.settings, 'champions',
                               director=self.director, automatic=False,
                               expected_manual_revision=revision):
                raise ValueError('Champion select choice was superseded')
            self.phase, self.target, self.applied = phase, 'champions', 'champions'
            self.connected = True
            self.intent_revision = self.director.snapshot()['manual_revision']
            self.error = None
            self.status = 'Champion select chosen manually'
            self.client_event = scene_event(phase, session)
            self.manual_choice = (self.client_event, 'champions')
            return self.snapshot()

    @property
    def enabled(self):
        with self.lock:
            return self.settings['enabled']

    def routes_lobbies(self):
        """Delegate post-game routing only while this client owner can observe it."""
        with self.lock:
            return self.settings['enabled'] and (self.connected or self.replay_viewing.active)

    def configure(self, body):
        if not body or set(body) - {'enabled', 'theme', 'idle_presentation', 'queue_theme'}:
            raise ValueError('Expected scene automation or theme settings')
        if 'enabled' in body and not isinstance(body['enabled'], bool):
            raise ValueError('Expected an enabled checkbox')
        if 'theme' in body and body['theme'] not in ('random', *THEMES):
            raise ValueError('Unknown champion select theme')
        if 'queue_theme' in body and body['queue_theme'] not in (*QUEUE_THEMES, 'rotate'):
            raise ValueError('Choose bear, turtle, ram, phoenix or rotate')
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
            if set(body) == {'queue_theme'}:
                return self.snapshot()
            self.director.cancel_pending('league_client')
            if updated['theme'] in THEMES:
                self.champ_select.theme = updated['theme']
            self.applied = None
            self.manual_choice = None
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
        revision = self.director.snapshot()['manual_revision']
        phase, session = self.reader.snapshot()
        if phase not in IDLE_PHASES | {'Matchmaking', 'ReadyCheck', 'ChampSelect'}:
            raise ValueError('Hide screen now is available outside gameplay.')
        with self.lock:
            client = self.obs_factory()
            if replay_is_active(client):
                raise ValueError('Wait for Instant Replay to finish before hiding the screen.')
            if not apply_scene(client, self.settings, 'queue', director=self.director, automatic=False,
                               expected_manual_revision=revision):
                raise ValueError('A temporary scene owns the screen; try after it finishes.')
            self.privacy_armed = phase in IDLE_PHASES
            self.client_event = scene_event(phase, session)
            self.manual_choice = (self.client_event, 'queue') if phase == 'ChampSelect' else None
            self.connected = True
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
            self.manual_choice = None
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
        # Replay observation is independent of the launcher's HTTP availability.
        # Only a real bool/None is accepted from optional reader implementations.
        try:
            replay = self.reader.replay_active() if hasattr(self.reader, 'replay_active') else False
        except OSError:
            replay = None
        if replay is not True and replay is not False:
            replay = None
        with self.lock:
            replay_changed = self.replay_viewing.observe(replay, revision)
            if replay_changed:
                self.applied = None
                self.retry_at = 0
                if not self.replay_viewing.active:
                    self.intent_revision = self.replay_viewing.manual_revision
            replay_ended = self.replay_viewing.return_pending
        try:
            phase, session = self.reader.snapshot()
            details = self.reader.queue_details(phase) if hasattr(self.reader, 'queue_details') else {}
            target = route(phase, session)
            event = scene_event(phase, session)
            with self.lock:
                self.champ_select.update(phase, session, self.settings['theme'])
                self.stage.client(phase, target, self.champ_select.data, session, self.champ_select.catalog)
                self.queue.observe(phase, session, details)
                if phase not in GAME_PHASES | IDLE_PHASES:
                    self.match_ended = False
                if phase in GAME_PHASES:
                    event = ('game', 'ended' if self.match_ended else 'playing' if self.stage.playing else 'loading')
                event_changed = event != self.client_event
                self.client_event = event
                if phase in GAME_PHASES and self.match_ended:
                    target = 'idle'
                elif (phase in GAME_PHASES and not self.stage.playing and not self.stage.ended
                      and self.settings.get('loading_scene')):
                    target = 'loading'
                if self.enabled and target is not None:
                    self.scene_hold(previous_phase=self.phase, phase=phase)
                self.phase = phase
                self.connected = True
                if self.manual_choice and self.manual_choice[0] != event:
                    self.manual_choice = None
                if self.manual_choice:
                    target = self.manual_choice[1]
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
                self.connected = False
                if self.replay_viewing.active:
                    self.apply_pending()
                return
        with self.lock:
            if event_changed or target != self.target:
                self.director.cancel_pending('league_client')
                if (event_changed and target == self.target and
                        (target != 'queue' or self.director.snapshot()['scene'] != self.settings['lobby_scene'])):
                    self.applied = None
                self.retry_at = 0
                from events import inspect_event
                inspect_event('league_client.phase', owner='league_api', phase=str(phase), action=target or 'gameplay')
                if replay_ended:
                    self.intent_revision = self.replay_viewing.manual_revision
                elif not (self.match_ended and target == 'idle' and self.target == 'idle'):
                    self.intent_revision = revision
            elif replay_ended:
                self.intent_revision = self.replay_viewing.manual_revision
            self.replay_viewing.return_pending = False
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
            if self.replay_viewing.active:
                self.status = 'Watching a League replay; client scene switching suspended'
                if self.clock() >= self.retry_at:
                    try:
                        self.replay_viewing.present(self.obs_factory(), self.settings['replay_scene'])
                        self.error = None
                    except Exception as exc:
                        self.error = str(exc)
                        self.retry_at = self.clock() + 5
                return
            if self.replay_viewing.return_pending:
                self.status = 'Replay closed; waiting for current League client phase'
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
                with self.lock:
                    self.event_stream_connected = True
                # Subscribe before the baseline read, so changes during the read
                # remain queued on the socket rather than getting missed.
                self.tick()
                last_client_poll = self.clock()
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
                    interval = 1 if self.phase == 'ChampSelect' else 2
                    if now - last_client_poll >= interval:
                        self.tick()
                        last_client_poll = now
                    if now - last_scene_check >= 2:
                        self.apply_pending(verify_active=True)
                        last_scene_check = now
                    elif self.target != self.applied:
                        self.apply_pending()
            except Exception:
                with self.lock:
                    self.event_stream_connected = False
                # Some LCU versions close WAMP subscriptions while HTTP remains
                # healthy. Refresh phases on this same bounded worker; losing the
                # event socket is not evidence that the client itself disappeared.
                self.tick()
                # A confirmed route can still finish its hold if the client closes.
                if self.target != self.applied:
                    self.apply_pending()
                stop_event.wait(2)
            finally:
                try:
                    if connection is not None:
                        connection.close()
                finally:
                    if stop_event.is_set() or parent_stop.is_set():
                        with self.lock:
                            self.event_stream_connected = False
                        self.director.cancel_pending('league_client')
                        self.replay_viewing.close()
