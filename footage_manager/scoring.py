"""Selectable, weighted ranking; no audio amplitude is compared across recordings."""
import math

METRICS = {'victory': 'Victory', 'speaking': 'Speaking activity', 'voice_spikes': 'Normalized voice spikes', 'early_kda': 'Early kills / assists'}
DEFAULT_WEIGHTS = {key: 1.0 for key in METRICS}


def spike_signal(spikes, seconds):
    """Bound burst density smoothly, using only dB above the local baseline.

    Ten 6 dB bursts per ten minutes produce 0.5. Stronger or more frequent
    bursts increase the signal without flattening all ordinary games to 1.
    """
    intensity = sum(max(0, spike['above_baseline_db']) / 6 for spike in spikes)
    density = intensity * 600 / max(60, seconds)
    return density / (density + 10)


def rank(games, weights=None):
    weights = DEFAULT_WEIGHTS if weights is None else weights
    if set(weights)-set(METRICS):
        raise ValueError('Unknown ranking metric')
    weights = {k: float(v) for k,v in weights.items()}
    if any(not math.isfinite(v) or not 0 <= v <= 10 for v in weights.values()):
        raise ValueError('Metric weights must be finite numbers from 0 to 10')
    total = sum(weights.values())
    results = []
    for game in games:
        values = dict(game.get('metrics', {}))
        if 'moments' in game and 'spike_count' in values:
            # Derive the ranking signal from retained evidence so completed
            # archives get scoring improvements without decoding them again.
            spikes = [moment for moment in game['moments'] if moment['kind'] == 'voice_spike']
            seconds = game['end'] - game['start'] - game.get('replay_seconds', 0)
            values['voice_spikes'] = spike_signal(spikes, seconds)
        contributions = {key: round(100*weight*max(0,min(1,values.get(key,0)))/total,2) if total else 0 for key,weight in weights.items()}
        results.append({**game, 'metrics': values, 'score': round(sum(contributions.values()),2), 'contributions': contributions})
    return sorted(results, key=lambda g:(-g['score'],g.get('video_id',0),g['start']))
