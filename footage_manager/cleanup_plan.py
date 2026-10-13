"""Storage cleanup policy over existing observations; never decodes or deletes."""
import hashlib
import json
from pathlib import Path

BUFFER = 30
VOICE_MINIMUM = 4


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def merge(spans, duration):
    merged = []
    for start, end in sorted((max(0, a), min(duration, b)) for a, b in spans if b > a):
        if end <= start:
            continue
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def gaps(spans, duration):
    position = 0
    for start, end in spans:
        if start > position:
            yield position, start
        position = end
    if position < duration:
        yield position, duration


def personal_signature(ranges):
    fields = ('id','start','end','title','decision','tags','purpose','usage','collection','notes')
    return digest([{key: row.get(key) for key in fields} for row in ranges if not is_cleanup(row)])


def is_cleanup(row):
    try:
        return json.loads(row.get('notes','')).get('storage_cleanup') == 1
    except (ValueError, AttributeError):
        return False


def source_plan(video, result, ranges, voice_minimum=VOICE_MINIMUM, win_voice_minimum=0, unknown_voice_minimum=0):
    """Apply explicit outcome vocal thresholds; protect unmeasured audio and desktop gaps."""
    duration = video['duration']
    observations = result.get('observations', [])
    if not result.get('games') and not (
            observations and sum(bool(s.get('between_games')) for s in observations)/len(observations) >= .95
            and not any(s.get('active') or s.get('clock') is not None for s in observations)):
        raise ValueError('No declared games or continuous confirmed lobby; recording left untouched')
    if any(row['decision'] in ('maybe','rereview') for row in ranges):
        raise ValueError('Personal Later/Re-review decisions need resolution')
    keep, quiet, decisions = [], [], []
    for index, game in enumerate(result['games']):
        count = sum(m.get('kind') == 'voice_spike' for m in game.get('moments', []))
        audio_known = 'spike_count' in game.get('metrics', {}) or result.get('audio', {}).get('label') == 'No audio track'
        threshold = {'defeat':voice_minimum,'victory':win_voice_minimum,'unknown':unknown_voice_minimum}.get(game.get('outcome','unknown'),0)
        remove = audio_known and count < threshold
        decisions.append({'index':index,'outcome':game.get('outcome','unknown'),
                          'spikes':count,'decision':'remove' if remove else 'keep',
                          'start':game['start'],'end':game['end']})
        if remove:
            quiet.append([game['start'], game['end']])
        else:
            keep.append([game['start']-BUFFER, game['end']+BUFFER])
    keep += [[row['start'],row['end']] for row in ranges if row['decision']=='keep' and not is_cleanup(row)]
    keep = merge(keep, duration)
    protected = []
    for start, end in gaps(keep, duration):
        # Separate proven quiet defeats from unknown gaps in the game chronology.
        remaining = list(gaps(merge([[max(start,a)-start,min(end,b)-start] for a,b in quiet
                                    if a < end and b > start], end-start), end-start))
        for a, b in remaining:
            left, right = start+a, start+b
            samples = [s for s in result.get('observations',[]) if left <= s['time'] <= right]
            positive = [s['time'] for s in samples if s.get('between_games') or s.get('loading') or s.get('outcome') or s.get('continue')]
            gameplay = any((s.get('active') or s.get('clock') is not None) and not s.get('player') and not s.get('replay') for s in samples)
            if not positive or gameplay:
                protected.append([left, right])
            else:
                # Unknown desktop time preceding/following a lobby observation
                # does not become deletable just because a later lobby is seen.
                half_step = result.get('sample_seconds',60)/2
                first, last = max(left,min(positive)-half_step), min(right,max(positive)+half_step)
                protected += [[left,first],[last,right]]
    keep = merge(keep+protected, duration)
    retained = sum(end-start for start,end in keep)
    return {'video_id':video['id'],'source_path':video['path'],
            'source_size':video['size'],'source_mtime_ns':video['mtime_ns'],
            'analysis_digest':digest(result),'personal_signature':personal_signature(ranges),
            'intervals':keep,'protected_gaps':protected,'games':decisions,
            'estimated_saved_bytes':round(video['size']*(1-retained/duration)),
            'estimated_export_bytes':round(video['size']*retained/duration),
            'output':str(Path(video['path']).parent/'.footage-kept'/str(video['id']))}
