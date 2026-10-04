"""Pure editorial validation; never mutates original media or live settings."""
from pathlib import Path
import math


def number(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{name} must be a finite number')
    return value


def validate(plan, root, probe):
    """Resolve inputs and prove every cut lies within its real source."""
    root = Path(root).resolve()
    if plan.get('fps') != 60 or plan.get('width') != 1920 or plan.get('height') != 1080:
        raise ValueError('This export requires a 1920x1080, 60 fps timeline')
    segments = plan.get('segments')
    if not isinstance(segments, list) or not segments:
        raise ValueError('The timeline needs at least one segment')
    output = Path(plan['output_dir']).resolve()
    rows, seen, cursor = [], set(), 0
    for segment in segments:
        ident = segment.get('id')
        if not isinstance(ident, str) or not ident or ident in seen:
            raise ValueError('Segment identifiers must be unique and nonempty')
        seen.add(ident)
        kind = segment.get('kind')
        if kind not in {'video', 'still'}:
            raise ValueError('Unknown segment kind')
        source = (root / segment['source']).resolve()
        if not source.is_file():
            raise FileNotFoundError(source)
        if output == source or output in source.parents:
            raise ValueError('Keep source media outside the generated-output directory')
        duration = number(segment['duration'], 'duration')
        frames = round(duration * 60)
        if duration <= 0 or not math.isclose(frames / 60, duration, abs_tol=1e-7):
            raise ValueError('Durations must contain an exact positive number of frames')
        start = number(segment.get('start', 0), 'start')
        if start < 0:
            raise ValueError('Source starts must be nonnegative')
        info = probe(source)
        if not any(s.get('codec_type') == 'video' for s in info['streams']):
            raise ValueError(f'No picture in {source.name}')
        if kind == 'video' and start + duration > float(info['format']['duration']) + 1 / 60:
            raise ValueError(f'Cut exceeds source duration: {ident}')
        if kind == 'still' and start:
            raise ValueError('Still images have no source start')
        rows.append({**segment, 'source': str(source), 'frames': frames,
                     'timeline_start': cursor / 60, 'has_audio': any(
                         s.get('codec_type') == 'audio' for s in info['streams'])})
        cursor += frames
    return rows, cursor
