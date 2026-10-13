"""Coverage-aware post-game presentation and same-champion comparisons."""
from . import analytics, insights
from .recap_events import merge, row, live_events


def restore(record, stored, champions, items):
    """Project archived evidence without a download or an archive rewrite."""
    from .normalize import postgame, champion
    from .timeline import extract
    if not stored:
        return record
    try:
        normalized = postgame(stored.get('raw_postgame', {}), record.get('api_account', record['account']), champions, items)
        base = {**record, **{k:normalized[k] for k in ('team_id', 'participants') if normalized and k in normalized}}
        if stored.get('raw_timeline'):
            patch = extract(stored['raw_timeline'], base, items)
            return {**base, **analytics.public(patch), 'metrics': {**base['metrics'], **patch['metrics']}}
        raw = stored.get('raw_postgame', {})
        info = raw.get('info', raw)
        identities = {p.get('participantId'):p.get('player', {}) for p in info.get('participantIdentities', [])}
        players = [{**p, **identities.get(p.get('participantId'), {}),
                    'championName':champion(p, champions), 'team':{100:'ORDER',200:'CHAOS'}.get(p.get('teamId'))}
                   for p in info.get('participants', [])]
        own = [p for p in players if p.get('puuid') == record.get('api_account', record['account'])]
        if len(own) == 1 and stored.get('raw_events'):
            base['personal_events'] = live_events(dict(allPlayers=players,events=dict(Events=stored['raw_events'])), own[0])
        return base
    except (ValueError, TypeError, KeyError):
        return record


def build(records, current=None):
    finished = [r for r in records if r.get('state') == 'complete']
    # An interrupted last match can still explain what was captured, without inventing a result.
    candidates = [r for r in records if r.get('state') in {'complete', 'partial'}]
    last = max(candidates, key=lambda r:r.get('started_at', 0), default=None)
    summary = analytics.aggregate(finished)
    lifetime = dict(games=summary['completed_games'], wins=summary['wins'], losses=summary['losses'],
                    win_rate=summary['win_rate'], cs_per_minute=summary['cs_per_minute'],
                    kda=summary['kda'], scope='Recorded completed games on this account')
    if last is None:
        return dict(match=None, lifetime=lifetime, events=[], samples=[], notes=[])
    record = insights.derived(last)
    m = record['metrics']
    if all(k in m for k in ('kills', 'deaths', 'assists')):
        m['kda'] = (m['kills'] + m['assists']) / max(1, m['deaths'])
    if all(k in m for k in ('kills', 'assists', 'team_kills')) and m['team_kills'] > 0:
        m['kill_participation'] = 100 * (m['kills'] + m['assists']) / m['team_kills']
    official = 'official_events' in record
    events = record.get('official_events', []) if official else merge(record.get('client_events', record.get('personal_events', [])), record.get('level_observations', []))
    if not official:
        events = merge(events, [dict(row(i['time'], 'item', 'Item appeared', i['name'], source='observed'),item_id=i.get('id')) for i in record.get('item_observations', [])])
    peers = [insights.derived(r) for r in finished if r['id'] != record['id'] and
             r.get('started_at', 0) < record.get('started_at', 0) and r.get('champion') == record.get('champion') and
             r.get('queue') == record.get('queue') and r.get('role') == record.get('role')]
    peers = sorted(peers, key=lambda r:r.get('started_at', 0))[-20:]
    comparisons = []
    for key, label in [('cs_per_minute', 'Farm pace'), ('damage_per_minute', 'Damage / min'), ('vision_per_minute', 'Vision / min')]:
        values = [r['metrics'][key] for r in peers if key in r['metrics']]
        if key in m and len(values) >= 3:
            average = sum(values) / len(values)
            comparisons.append(dict(metric=key, label=label, value=m[key], average=average, difference=m[key]-average, games=len(values)))
    notes = []
    if 'damage_share_pct' in m:
        notes.append(f"You dealt {m['damage_share_pct']:.0f}% of your team's champion damage.")
    if 'dead_seconds' in m:
        notes.append(f"Time spent dead: {int(m['dead_seconds'])//60}:{int(m['dead_seconds'])%60:02d} ({m.get('time_dead_pct', 0):.0f}% of this game).")
    if 'cs_difference_at_10' in m:
        notes.append(f"At 10 minutes: {m['cs_difference_at_10']:+.0f} CS versus your confirmed lane opponent.")
    if not notes:
        notes.append('More analysis appears when final match statistics arrive.')
    coverage = ('Riot timeline' if official else 'League client timeline' if record.get('client_events') else 'Live event times + observed progression' if record.get('personal_events')
                else 'Observed inventory / level changes' if events else 'Final stats only • no recorded timeline')
    if record.get('state') != 'complete':
        coverage = 'Partial capture • result not confirmed'
    compact = {k:record.get(k) for k in ('id', 'champion', 'champion_id', 'role', 'queue', 'win', 'state', 'source', 'duration', 'started_at', 'ended_at', 'items')}
    if compact['ended_at'] is None:
        compact.pop('ended_at')
    compact['metrics'] = m
    samples = record.get('official_samples') or record.get('client_samples') or record.get('samples', [])
    sample_source = 'official' if record.get('official_samples') else 'client' if record.get('client_samples') else 'observed'
    if not samples:
        samples = [dict(time=c.get('sample_seconds', int(minute)*60), **{k:c[k] for k in ('cs','gold') if k in c})
                   for minute,c in (record.get('timeline_checkpoints') or record.get('checkpoints', {})).items()
                   if str(minute).isdigit()]
        samples.sort(key=lambda p:p['time'])
        sample_source = 'checkpoints'
    return dict(match=compact, lifetime=lifetime, events=events,
                samples=[{k:p[k] for k in ('time', 'cs', 'gold', 'unspent_gold') if k in p} for p in samples],
                checkpoints=record.get('timeline_checkpoints') or record.get('client_checkpoints') or record.get('checkpoints', {}),
                comparisons=comparisons, notes=notes[:3], coverage=coverage,
                capture_started_seconds=record.get('capture_started_seconds'),
                sample_source=sample_source)
