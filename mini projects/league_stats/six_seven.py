"""Lightweight live-only discoveries, advanced by the existing stats collector."""
import math
import time
import uuid


def count(value):
    return value if type(value) in (int, float) and math.isfinite(value) and value >= 0 and value == int(value) else None


def findings(data):
    """Only exact reported values count; missing team scores are never zero."""
    players = data.get('allPlayers')
    if not isinstance(players, list) or not 1 <= len(players) <= 20:
        return {}
    found, teams = {}, {'ORDER': [], 'CHAOS': []}
    for player in players:
        if not isinstance(player, dict):
            return {}
        scores = player.get('scores')
        scores = scores if isinstance(scores, dict) else {}
        team = player.get('team')
        if team not in teams:
            return {}
        teams[team].append(count(scores.get('kills')))
        identity = player.get('riotId') or player.get('summonerName')
        if not identity:
            continue
        champion = ' '.join(str(player.get('championName') or 'Player').split())[:32]
        key = str(identity)[:160]
        if count(scores.get('kills')) == 6 and count(scores.get('deaths')) == 7:
            found['kd:' + key] = ('kd', champion)
        if count(scores.get('creepScore')) == 67:
            found['cs:' + key] = ('cs', champion)
    if all(values and all(v is not None for v in values) for values in teams.values()):
        blue, red = (sum(teams[team]) for team in ('ORDER', 'CHAOS'))
        if (blue, red) in ((6, 7), (7, 6)):
            found['teams'] = ('teams', f'Blue {int(blue)} · Red {int(red)}')
    return found


def lines_for(found):
    lines = []
    for kind, icon, label in (('kd', '⚔️', '6 kills / 7 deaths'), ('cs', '🌾', '67 CS')):
        names = [name for category, name in found.values() if category == kind]
        if names:
            names_text = ', '.join(names[:3])
            if len(names) > 3:
                names_text += f' +{len(names) - 3} more'
            lines.append(f'{icon} {names_text} · {label}')
    if 'teams' in found:
        lines.append('🏟️ Team score · ' + found['teams'][1])
    return lines


class SixSevenFinder:
    def __init__(self, monotonic=time.monotonic, clock=time.time):
        self.monotonic, self.clock = monotonic, clock
        self.match = None
        self.seen = set()
        self.last_time = -1
        self.next_notice = 0

    def observe(self, data, match, *, live=True):
        stamp = None
        # Game time may contain fractional seconds; it is ordering, not a find.
        raw_time = data.get('gameData', {}).get('gameTime')
        if type(raw_time) in (int, float) and math.isfinite(raw_time) and raw_time >= 0:
            stamp = raw_time
        if stamp is None or not live:
            return None
        current = findings(data)
        if match != self.match:
            self.match, self.last_time = match, stamp
            # Starting/restarting mid-match must not replay an old scoreboard.
            self.seen = set(current)
            self.next_notice = 0
            return None
        if stamp <= self.last_time:
            return None
        self.last_time = stamp
        fresh = {key: value for key, value in current.items() if key not in self.seen}
        now = self.monotonic()
        if not fresh or now < self.next_notice:
            return None
        # At most 41 keys (two per player and one team score) per match.
        if len(self.seen) + len(fresh) > 41:
            return None
        self.seen.update(fresh)
        self.next_notice = now + 12
        return dict(id=uuid.uuid4().hex, kind='six-seven', title='🔎 6–7 found!',
                    lines=lines_for(fresh), created_at=self.clock())
