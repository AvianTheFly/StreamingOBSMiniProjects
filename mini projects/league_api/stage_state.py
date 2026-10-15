"""Broadcast stage projection; client and live observations share one bounded state."""
import copy
import math
from lib.league_match import MatchLifecycle
from .stage_roster import StageRoster

GAME_PHASES = {'GameStart', 'InProgress', 'Reconnect', 'WatchInProgress'}


class StageState:
    """Called under ClientScenes.lock; no I/O, workers or scene writes."""
    def __init__(self):
        self.phase = None
        self.playing = False
        self.roster_state = StageRoster()
        self.queue = False
        self.ended = False
        self.lifecycle = MatchLifecycle()

    def client(self, phase, target, draft, session=None, catalog=None):
        previous = self.phase
        self.phase = phase
        self.queue = phase in {'Matchmaking', 'ReadyCheck'} or (phase == 'ChampSelect' and target == 'queue')
        if phase not in GAME_PHASES and phase != previous:
            self.playing = False
            self.ended = False
        if phase == 'ChampSelect':
            if isinstance(session, dict) or draft.get('allies') or draft.get('enemies'):
                self.roster_state.draft(draft, session, catalog)
        elif phase not in GAME_PHASES:
            self.roster_state.clear()
            self.lifecycle = MatchLifecycle()
        if phase in GAME_PHASES and isinstance(session, dict):
            self.roster_state.client(session, catalog)

    @property
    def roster(self):
        return self.roster_state.snapshot()

    def live(self, data):
        value = data.get('gameData', {}).get('gameTime')
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
            return
        running = self.lifecycle.observe(data)
        ended = self.ended = self.lifecycle.ended
        if ended:
            self.playing = False
        elif running:
            self.playing = True
        players = data.get('allPlayers')
        if not isinstance(players, list) or not players or ended:
            return
        self.roster_state.live(data)

    def snapshot(self, connected):
        return {'queue': self.queue and connected,
                'queue_label': 'BANNING' if self.phase == 'ChampSelect' else 'MATCH FOUND' if self.phase == 'ReadyCheck' else 'IN QUEUE',
                'loading': self.phase in GAME_PHASES and not self.playing and not self.ended,
                'playing': self.playing, 'roster': copy.deepcopy(self.roster),
                'connected': connected}
