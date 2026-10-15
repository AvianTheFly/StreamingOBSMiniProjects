"""OBS media-clock anchors, including encoder startup delay and observed pauses."""


def offset_at(session, at):
    segments = session.get('clock_segments', [])
    segment = next((s for s in reversed(segments) if at >= s['at']), None)
    origin = segment['origin'] if segment else session.get('timeline_origin', session['started_at'])
    return max(0, at - origin)


def observe_clock(session, at, duration, paused=False):
    """Initialize from the first written frame; never shift earlier pause segments."""
    segments = session.setdefault('clock_segments', [])
    origin = at - duration
    if not segments and duration > 0:
        segments.append({'at': session['started_at'], 'origin': origin})
        session['timeline_origin'] = origin
        # Marks pressed before OBS received its first shared encoder keyframe
        # belong to time zero, not several seconds into the finished file.
        for marker in session.get('markers', []):
            previous = marker['offset_seconds']
            marker['offset_seconds'] = round(offset_at(session, marker['at']), 3)
            if 'range_start_seconds' in marker:
                length = previous - marker['range_start_seconds']
                marker['range_start_seconds'] = round(max(0, marker['offset_seconds'] - length), 3)
    elif segments and paused:
        segments.append({'at': at, 'origin': origin})
    session['duration_seconds'] = duration
