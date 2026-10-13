"""Bounded personal telemetry on the existing collector cadence; no resources."""
import copy
from .normalize import same_player, number
from .recap_events import live_events, merge, row


def extend(record, old, data):
    own = next(p for p in data['allPlayers'] if same_player(p, data['activePlayer']))
    t = record['duration']
    samples = copy.deepcopy(old.get('samples', []))
    fresh = not samples or t >= samples[-1]['time'] + 10
    if fresh or (record['state'] == 'complete' and samples[-1]['time'] < t):
        active = data.get('activePlayer', {})
        sample = dict(time=t, **record['metrics'])
        for source, key in [('currentGold', 'unspent_gold')]:
            if number(active.get(source)) is not None:
                sample[key] = active[source]
        for key, value in (active.get('championStats') or {}).items():
            if number(value) is not None:
                sample['stat_' + key] = value
        samples.append(sample)
    record['samples'] = samples[-1440:]
    record['capture_started_seconds'] = old.get('capture_started_seconds', t)
    record['personal_events'] = merge(old.get('personal_events', []), live_events(data, own))
    levels = copy.deepcopy(old.get('level_observations', []))
    if old and record['metrics'].get('level', 0) > old.get('metrics', {}).get('level', 0):
        levels.append(row(t, 'level', f"Level {record['metrics']['level']}", 'First observed', source='observed'))
    record['level_observations'] = levels[-30:]
