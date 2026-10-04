"""Small, broadcast-safe view of a League champion-select session."""
from __future__ import annotations

import json
import math
import random
import time
from pathlib import Path


THEMES = ('astral', 'tidal', 'neon', 'frost', 'verdant')


def _id(value):
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _slot(champion_id=0, locked=False):
    return {'championId': _id(champion_id), 'locked': bool(locked)}


def project(session, catalog):
    """Put the local team on the left regardless of draft order or side."""
    if not isinstance(session, dict):
        return {'allies': [_slot() for _ in range(5)],
                'enemies': [_slot() for _ in range(5)],
                'allyBans': [_slot() for _ in range(5)],
                'enemyBans': [_slot() for _ in range(5)],
                'phase': '', 'seconds': None, 'localSlot': -1}

    allies = (session.get('myTeam') or [])[:5]
    enemies = (session.get('theirTeam') or [])[:5]
    allied_cells = {_id(p.get('cellId')): i for i, p in enumerate(allies) if isinstance(p, dict)}
    enemy_cells = {_id(p.get('cellId')): i for i, p in enumerate(enemies) if isinstance(p, dict)}
    picks = {'allies': [_slot() for _ in range(5)], 'enemies': [_slot() for _ in range(5)]}
    bans = {'allyBans': [], 'enemyBans': []}

    for row in session.get('actions') or []:
        for action in row if isinstance(row, list) else []:
            if not isinstance(action, dict):
                continue
            cell = _id(action.get('actorCellId'))
            side = 'allies' if cell in allied_cells else 'enemies' if cell in enemy_cells else None
            if side is None:
                continue
            champion = _id(action.get('championId'))
            locked = action.get('completed') is True
            if action.get('type') == 'pick' and champion:
                index = (allied_cells if side == 'allies' else enemy_cells)[cell]
                picks[side][index] = _slot(champion, locked)
            elif action.get('type') == 'ban' and champion and locked:
                key = 'allyBans' if side == 'allies' else 'enemyBans'
                if champion not in [ban['championId'] for ban in bans[key]]:
                    bans[key].append(_slot(champion, True))

    # The aggregate lists cover modes where per-player ban actions disappear
    # after the ban phase. Never replace the local team's ordering with theirs.
    summary = session.get('bans') or {}
    for key, source in [('allyBans', 'myTeamBans'), ('enemyBans', 'theirTeamBans')]:
        for champion in summary.get(source) or []:
            champion = _id(champion)
            if champion and champion not in [ban['championId'] for ban in bans[key]]:
                bans[key].append(_slot(champion, True))
        bans[key] = (bans[key] + [_slot() for _ in range(5)])[:5]

    for side, players in [('allies', allies), ('enemies', enemies)]:
        for index, player in enumerate(players):
            if not isinstance(player, dict) or picks[side][index]['championId']:
                continue
            champion = _id(player.get('championId') or player.get('championPickIntent'))
            if champion:
                picks[side][index] = _slot(champion, False)

    timer = session.get('timer') or {}
    milliseconds = timer.get('adjustedTimeLeftInPhase')
    seconds = (milliseconds / 1000 if isinstance(milliseconds, (int, float)) else
               timer.get('adjustedTimeLeftInPhaseInSec'))
    result = {**picks, **bans, 'phase': str(timer.get('phase') or ''),
              'seconds': seconds if not timer.get('isInfinite') else None,
              'localSlot': allied_cells.get(_id(session.get('localPlayerCellId')), -1)}
    for key in ('allies', 'enemies', 'allyBans', 'enemyBans'):
        for slot in result[key]:
            item = catalog.get(str(slot['championId']), {})
            slot['name'] = item.get('name', '')
            slot['image'] = f"/champ-select/icons/{slot['championId']}.png" if item else ''
            slot['portrait'] = f"/champ-select/portraits/{slot['championId']}.jpg" if item else ''
    return result


class ChampSelectState:
    def __init__(self, root):
        self.root = Path(root)
        file = self.root / 'champion_catalog.json'
        self.catalog = json.loads(file.read_text(encoding='utf-8')) if file.exists() else {}
        self.session_id = None
        self.theme = 'astral'
        self.data = project(None, self.catalog)
        self.chat = []
        self.timer_started = None
        self.timer_seconds = None
        self.timer_phase = ''
        self.timer_reported = None
        self.timer_stamp = None

    def update(self, phase, session, theme_setting='random', chat=None):
        if phase != 'ChampSelect' or not isinstance(session, dict):
            self.session_id = None
            self.data = project(None, self.catalog)
            self.chat = []
            self.timer_started = None
            self.timer_seconds = None
            self.timer_phase = ''
            self.timer_reported = None
            self.timer_stamp = None
            return
        # Stable within a draft, randomized only on entry to a new draft.
        identifier = session.get('gameId') or session.get('chatDetails', {}).get('chatRoomName') or 'active'
        if identifier != self.session_id:
            self.session_id = identifier
            self.theme = random.choice(THEMES)
            self.chat = []
        if theme_setting in THEMES:
            self.theme = theme_setting
        self.data = project(session, self.catalog)
        reported = self.data['seconds']
        phase_name = self.data['phase']
        stamp = (session.get('timer') or {}).get('internalNowInEpochMs')
        now = time.monotonic()
        if isinstance(reported, (int, float)) and math.isfinite(reported):
            remaining = max(0, float(reported))
            if isinstance(stamp, (int, float)) and math.isfinite(stamp):
                remaining = max(0, remaining - max(0, time.time() * 1000 - stamp) / 1000)
            if (self.timer_started is not None and self.timer_phase == phase_name and
                    self.timer_stamp == stamp and
                    self.timer_reported is not None and remaining <= self.timer_reported + 5):
                elapsed_remaining = max(0, self.timer_seconds - (now - self.timer_started))
                # A repeated LCU snapshot must not reset a running countdown.
                remaining = min(remaining, elapsed_remaining)
            self.timer_started = now
            self.timer_seconds = remaining
            self.timer_phase = phase_name
            self.timer_reported = float(reported)
            self.timer_stamp = stamp
        else:
            self.timer_started = None
            self.timer_seconds = None
            self.timer_phase = phase_name
            self.timer_reported = None
            self.timer_stamp = None
        if chat is not None:
            self.chat = chat[-10:]

    def snapshot(self, visible):
        draft = dict(self.data) if visible else project(None, self.catalog)
        if visible and self.timer_started is not None:
            draft['seconds'] = math.ceil(max(0, self.timer_seconds - (time.monotonic() - self.timer_started)))
        return {'visible': visible, 'theme': self.theme,
                'draft': draft,
                'chat': self.chat if visible else []}
