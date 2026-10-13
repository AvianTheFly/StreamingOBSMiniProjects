"""Bounded, identity-checked projections of archived timeline samples for recap charts."""
import math


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def project(report, stored):
    result = dict(points=[], peak_wallet=None, farm_window=None, wards=[], objectives=[])
    events = report.get('events', [])
    result['wards'] = [e for e in events if e.get('kind') == 'vision']
    result['objectives'] = [e for e in events if e.get('kind') == 'objective']
    record = stored or {}
    data = record.get('raw_timeline') or {}
    own = record.get('participant_id')
    match_id = data.get('metadata', {}).get('matchId', '')
    if (not isinstance(own, int) or own <= 0 or not match_id or
            str(match_id).rsplit('_', 1)[-1] != str(record.get('game_id')) or
            record.get('id') != report.get('match', {}).get('id') or
            record.get('api_match_id', match_id) != match_id):
        return result
    info = data.get('info', {})
    identities = info.get('participants', [])
    if identities and not any(p.get('participantId') == own and
                              p.get('puuid') == record.get('api_account', record.get('account')) for p in identities):
        return result
    fields = {'totalGold':'gold', 'currentGold':'wallet', 'xp':'xp', 'level':'level'}
    points = {}
    for frame in info.get('frames', [])[:720]:
        stamp = frame.get('timestamp')
        if not numeric(stamp) or stamp < 0:
            continue
        players = frame.get('participantFrames', {})
        player = players.get(str(own), {})
        if not player:
            continue
        p = dict(time=stamp/1000)
        for source, target in fields.items():
            if numeric(player.get(source)) and player[source] >= 0:
                p[target] = player[source]
        lane, jungle = player.get('minionsKilled'), player.get('jungleMinionsKilled')
        if numeric(lane) and numeric(jungle) and min(lane, jungle) >= 0:
            p.update(cs=lane+jungle, lane_cs=lane, jungle_cs=jungle)
        damage = player.get('damageStats', {}).get('totalDamageDoneToChampions')
        if numeric(damage) and damage >= 0:
            p['damage'] = damage
        opponent = players.get(str(record.get('opponent_id')), {})
        if 'gold' in p and numeric(opponent.get('totalGold')):
            p['lead'] = p['gold']-opponent['totalGold']
        points[p['time']] = p
    result['points'] = sorted(points.values(), key=lambda p:p['time'])
    wallets = [p for p in result['points'] if 'wallet' in p]
    if wallets:
        result['peak_wallet'] = max(wallets, key=lambda p:p['wallet'])
    # Compare similarly sized 3–5 minute windows, using actual elapsed time.
    best = None
    for i, start in enumerate(result['points']):
        if start['time'] < 120 or 'cs' not in start:
            continue
        for end in result['points'][i+1:]:
            elapsed = end['time']-start['time']
            if 180 <= elapsed <= 300 and 'cs' in end and end['cs'] >= start['cs']:
                candidate = dict(start=start['time'], end=end['time'], cs=end['cs']-start['cs'],
                                 rate=(end['cs']-start['cs'])*60/elapsed)
                if best is None or candidate['rate'] > best['rate']:
                    best = candidate
    result['farm_window'] = best
    return result
