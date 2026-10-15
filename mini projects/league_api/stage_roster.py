"""Match-scoped roster enrichment; incomplete observations never erase a player."""
import copy


def text(value, limit=64):
    return str(value or '').strip()[:limit]


def champion_id(value):
    try:
        return max(0, int(value)) if not isinstance(value, bool) else 0
    except (ValueError, TypeError):
        return 0


def identities(player):
    return {str(player[key]).casefold() for key in
            ('puuid', 'summonerId', 'riotId', 'summonerName', 'gameName', 'riotIdGameName')
            if player.get(key)}


class StageRoster:
    """Ten stable slots under ClientScenes.lock, with private matching evidence."""
    def __init__(self):
        self.clear()

    def clear(self):
        self.slots = []
        self.catalog = {}
        self.game_id = None

    def snapshot(self):
        return [copy.deepcopy(slot['row']) for slot in self.slots]

    def begin(self, session):
        game = (session or {}).get('gameData')
        game_id = (session or {}).get('gameId') or (game.get('gameId') if isinstance(game, dict) else None)
        if game_id and self.game_id and str(game_id) != self.game_id:
            self.clear()
        if game_id:
            self.game_id = str(game_id)

    def draft(self, draft, session, catalog):
        self.begin(session)
        self.catalog = catalog or self.catalog
        self.slots = []
        for side, field in [('allies', 'myTeam'), ('enemies', 'theirTeam')]:
            players = (session or {}).get(field) or []
            for index, row in enumerate(draft.get(side, [])[:5]):
                self.slots.append({'row': dict(row, team=side, slot=index),
                                   'ids': identities(players[index]) if index < len(players) and isinstance(players[index], dict) else set(),
                                   'rank': {key: 1 for key in row}})

    def _match(self, player, row, candidates):
        ids = identities(player)
        matches = [s for s in candidates if ids & s['ids']]
        if len(matches) == 1:
            return matches[0]
        cid = row.get('championId')
        matches = [s for s in candidates if cid and s['row'].get('championId') == cid]
        if len(matches) == 1:
            return matches[0]
        name = text(row.get('name')).casefold()
        matches = [s for s in candidates if name and text(s['row'].get('name')).casefold() == name]
        return matches[0] if len(matches) == 1 else None

    def _row(self, player, live):
        cid = champion_id(player.get('championId'))
        name = text(player.get('championName')) if live else ''
        if live and not cid:
            raw = text(player.get('rawChampionName')).removeprefix('game_character_displayname_')
            found = [key for key, item in self.catalog.items()
                     if (raw and (item.get('slug') or item.get('id')) == raw) or (name and item.get('name', '').casefold() == name.casefold())]
            if len(found) == 1:
                cid = champion_id(found[0])
        champion = self.catalog.get(str(cid), {})
        role = text(player.get('position') if live else player.get('selectedPosition') or player.get('assignedPosition'), 24)
        if role.upper() in {'NONE', 'UNSELECTED', 'UNKNOWN', 'INVALID'}:
            role = ''
        return {'championId': cid, 'name': text(champion.get('name') or name),
                'image': f'/champ-select/icons/{cid}.png' if champion else '',
                'label': text(player.get('riotIdGameName') or player.get('gameName') or player.get('summonerName')),
                'role': role}

    def _group(self, players, fallback, rank, live=False):
        rows = [(p, self._row(p, live)) for p in players[:5] if isinstance(p, dict)]
        matches = [self._match(p, row, self.slots) for p, row in rows]
        # Draft uses the local team, while gameflow/live use map sides. Retain
        # the established side only when the observed team has unambiguous evidence.
        sides = {s['row']['team'] for s in matches if s is not None}
        side = next(iter(sides)) if len(sides) == 1 else fallback
        used = set()
        for player, row in rows:
            available = [s for s in self.slots if s['row']['team'] == side and id(s) not in used]
            slot = self._match(player, row, available)
            if slot is None:
                # Fill a pending slot, never overwrite a different known champion.
                slot = next((s for s in available if not s['row'].get('championId') and not s['row'].get('name')), None)
            if slot is None and len([s for s in self.slots if s['row']['team'] == side]) < 5:
                index = len([s for s in self.slots if s['row']['team'] == side])
                slot = {'row': {'team': side, 'slot': index}, 'ids': set(), 'rank': {}}
                self.slots.append(slot)
            if slot is None:
                continue
            used.add(id(slot))
            slot['ids'].update(sorted(identities(player) - slot['ids'])[:max(0, 32 - len(slot['ids']))])
            for key, value in row.items():
                if value and (not slot['row'].get(key) or rank >= slot['rank'].get(key, 0)):
                    slot['row'][key] = value
                    slot['rank'][key] = rank
        self.slots.sort(key=lambda s: (s['row']['team'] != 'allies', s['row']['slot']))

    def client(self, session, catalog):
        self.begin(session)
        self.catalog = catalog or self.catalog
        game = (session or {}).get('gameData') or {}
        if not isinstance(game, dict):
            return
        for field, side in [('teamOne', 'allies'), ('teamTwo', 'enemies')]:
            players = game.get(field)
            if isinstance(players, list):
                self._group(players, side, 2)

    def live(self, data):
        players = data.get('allPlayers')
        if not isinstance(players, list):
            return
        active = identities(data.get('activePlayer') or {})
        local_team = next((p.get('team') for p in players if isinstance(p, dict) and identities(p) & active), 'ORDER')
        for team in ('ORDER', 'CHAOS'):
            group = [p for p in players[:10] if isinstance(p, dict) and p.get('team') == team]
            self._group(group, 'allies' if team == local_team else 'enemies', 3, live=True)
