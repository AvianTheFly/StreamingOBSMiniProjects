"""Validate authored still coverage and quantize its cuts to delivery frames."""
from pathlib import Path
import hashlib
import json
import math


def fingerprint(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def load_plan(path):
    from PIL import Image
    path = Path(path).resolve()
    root = path.parent
    plan = json.loads(path.read_text(encoding='utf-8-sig'))
    fps, duration = plan['fps'], plan['duration_seconds']
    if fps != 25 or duration != 40 or not plan['shots']:
        raise ValueError('A nonempty illustrated sequence must cover forty seconds at 25 fps')
    total = round(duration * fps)
    cursor = 0
    hashes = set()
    seen = set()
    for shot in plan['shots']:
        start, end = shot['start_seconds'], shot['end_seconds']
        if not all(math.isfinite(v) for v in (start, end)) or not 0 <= start < end <= duration:
            raise ValueError('Invalid shot interval')
        first, last = math.floor(start * fps + .5), math.floor(end * fps + .5)
        if first != cursor or last <= first:
            raise ValueError('Pictures must cover every frame without gaps or overlap')
        asset = (root / shot['file']).resolve()
        if root not in asset.parents or asset.suffix.lower() != '.png':
            raise ValueError('Every picture must be a local PNG in the artifact')
        if asset in seen:
            raise ValueError('Each story moment needs its own generated image')
        with Image.open(asset) as image:
            image.verify()
        with Image.open(asset) as image:
            width, height = image.size
            if width < 1400 or not 1.7 < width / height < 1.85:
                raise ValueError('A full cinematic landscape image is required')
            mode = image.mode
        digest = fingerprint(asset)
        if digest in hashes:
            raise ValueError('Repeated images cannot substitute for distinct story moments')
        shot.update(start_frame=first, end_frame=last, frames=last-first,
                    actual_start_seconds=first/fps, actual_end_seconds=last/fps,
                    native_size=[width, height], native_mode=mode, sha256=digest)
        cursor = last
        seen.add(asset)
        hashes.add(digest)
    if cursor != total:
        raise ValueError('Slideshow is shorter than the requested forty seconds')
    plan['frames'] = total
    if plan.get('calm_edit'):
        from .calm import validate
        validate(plan)
    return plan


def concat_text(plan):
    lines = ['ffconcat version 1.0']
    for shot in plan['shots']:
        # Authored identifiers contain no shell/concat quoting characters.
        if any(c in shot['file'] for c in "'\r\n\\"):
            raise ValueError('Unsafe concat filename')
        lines += [f"file '{shot['file']}'", f"duration {shot['frames']/plan['fps']:.8f}"]
    lines.append(f"file '{plan['shots'][-1]['file']}'")
    return '\n'.join(lines) + '\n'
