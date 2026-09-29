"""Conservative objective timing from observed history; no invented dragon type."""
from collections import Counter

ELEMENTS = {'earth': 'earth', 'mountain': 'earth', 'fire': 'fire', 'infernal': 'fire',
            'water': 'water', 'ocean': 'water', 'air': 'air', 'cloud': 'air',
            'hextech': 'hextech', 'chemtech': 'chemtech', 'elder': 'elder'}


def element(value):
    return ELEMENTS.get(str(value or '').lower())


def player_aliases(player):
    names = {str(player.get(key, '')) for key in ('riotId', 'summonerName', 'riotIdGameName')}
    return names - {''}


def dragon_state(data):
    """Repeating elemental drakes are predictable after the third observed kill.

    The first two types are random. mapTerrain can remain Default even after a
    transformation, so a Default value is never interpreted as Earth. Requiring
    three elemental kills also excludes Swiftplay's two-drake format. Unknown
    ownership near Soul suppresses predictions. All timing is game time.
    """
    game = data.get('gameData', {})
    if game.get('mapNumber') != 11 or game.get('gameMode') != 'CLASSIC':
        return None
    events = { (e.get('EventID'), e.get('EventTime')): e
              for e in data.get('events', {}).get('Events', []) if e.get('EventName') == 'DragonKill' }
    kills = sorted(events.values(), key=lambda e: e.get('EventTime', 0))
    if not kills:
        return None
    elemental = [e for e in kills if element(e.get('DragonType')) not in {None, 'elder'}]
    if len(elemental) < 3 or element(kills[-1].get('DragonType')) in {None, 'elder'}:
        return None
    players = data.get('allPlayers', [])
    counts = Counter()
    for kill in elemental:
        matches = [p for p in players if kill.get('KillerName') in player_aliases(p)]
        team = matches[0].get('team') if len(matches) == 1 else None
        counts[team if team in {'ORDER', 'CHAOS'} else 'UNKNOWN'] += 1
    if max(counts['ORDER'], counts['CHAOS']) >= 4 or (counts['UNKNOWN'] and len(elemental) >= 4):
        return None  # Soul/Elder timing is intentionally not guessed.
    last = elemental[-1]
    observed = element(last.get('DragonType'))
    terrain = element(game.get('mapTerrain'))
    if terrain and terrain != observed:
        return None
    theme = terrain or observed
    spawn = float(last.get('EventTime', 0)) + 300
    if float(game.get('gameTime', 0)) < spawn:
        return None
    return dict(id=f"dragon-{last.get('EventID')}-{last.get('EventTime')}",
                theme=theme, spawn_game_time=spawn, estimated=True,
                evidence='repeating element after third drake; five-minute respawn')
