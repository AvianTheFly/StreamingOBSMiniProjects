"""Broadcast stage projection; client and live observations share one bounded state."""
import copy
import math
from lib.league_match import MatchLifecycle

GAME_PHASES = {'GameStart', 'InProgress', 'Reconnect', 'WatchInProgress'}


class StageState:
    """Called under ClientScenes.lock; no I/O, workers or scene writes."""
    def __init__(self):
        self.phase = None
        self.playing = False
        self.roster = []
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
            self.roster = [dict(p, team=side) for side in ('allies', 'enemies')
                           for p in draft.get(side, [])]
        elif phase not in GAME_PHASES:
            self.roster = []
        if phase in GAME_PHASES and isinstance(session, dict):
            game = session.get('gameData') or {}
            rows = []
            for field, side in [('teamOne', 'allies'), ('teamTwo', 'enemies')]:
                for index, player in enumerate((game.get(field) or [])[:5]):
                    if not isinstance(player, dict):
                        continue
                    champion = (catalog or {}).get(str(player.get('championId')), {})
                    previous = [p for p in self.roster if p.get('championId') and p.get('championId') == player.get('championId')]
                    prior = previous[0] if len(previous) == 1 else {}
                    role = str(player.get('selectedPosition') or player.get('assignedPosition') or '')[:24]
                    if role.upper() in {'NONE', 'UNSELECTED', ''}:
                        role = prior.get('role', '')
                    rows.append(dict(label=str(player.get('gameName') or player.get('summonerName') or prior.get('label') or f'Player {index+1}')[:64],
                                     championId=player.get('championId'), name=champion.get('name', ''), role=role,
                                     image=f"/champ-select/icons/{player['championId']}.png" if champion else '', team=side))
            if rows:
                self.roster = rows

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
        self.roster = [dict(label=str(p.get('riotIdGameName') or p.get('summonerName') or 'Player')[:64],
                            name=str(p.get('championName') or '')[:64],
                            role=str(p.get('position') or '')[:24],
                            team='allies' if p.get('team') == 'ORDER' else 'enemies')
                       for p in players[:10] if isinstance(p, dict)]

    def snapshot(self, connected):
        return {'queue': self.queue and connected,
                'queue_label': 'BANNING' if self.phase == 'ChampSelect' else 'MATCH FOUND' if self.phase == 'ReadyCheck' else 'IN QUEUE',
                'loading': self.phase in GAME_PHASES and not self.playing and not self.ended,
                'playing': self.playing, 'roster': copy.deepcopy(self.roster),
                'connected': connected}
