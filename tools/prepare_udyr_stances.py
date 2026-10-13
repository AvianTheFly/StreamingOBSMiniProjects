"""Finite original-footage loop authoring; never edits OBS or the source movie."""
from pathlib import Path
import argparse
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.media_jobs import jobs
from lib.json_store import write_json


# Settled poses only: exclude each stance's entrance and the next transformation.
WINDOWS = {'q': ('bear', 7.2, 11.65), 'w': ('turtle', 13.3, 17.65),
           'e': ('ram', 1.3, 5.65), 'r': ('phoenix', 19.25, 22.9)}


def ffmpeg(args):
    result = jobs.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                       '-threads', '2', '-filter_complex_threads', '2',
                       '-filter_threads', '2', *args], kind='udyr-loops',
                      weight=2, timeout=180, check=True)
    return result.stdout


def main():
    import numpy as np
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    args.destination.mkdir(parents=True, exist_ok=True)
    raw = ffmpeg(['-i', str(args.source), '-vf', 'fps=30,scale=320:180',
                  '-an', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'])
    frames = np.frombuffer(raw, np.uint8).reshape(-1, 180, 320, 3)
    # Weight the actual central character while still scoring the spirit/aura.
    sample = frames[:, ::3, ::3].astype(np.float32) / 255
    weight = np.ones(sample.shape[1:3], np.float32)
    weight[15:55, 25:85] = 3
    fade_frames = 12
    manifest = {'source': str(args.source.resolve()),
                'sha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
                'method': 'matched 0.4s forward dissolve, original footage only',
                'fps': 60, 'stances': {}}
    for key, (name, lo, hi) in WINDOWS.items():
        best = None
        for start in range(round(lo*30), round((hi-2.7)*30)):
            head = sample[start:start+fade_frames]
            for end in range(start+81, round(hi*30)):
                tail = sample[end-fade_frames:end]
                score = float(np.mean((head-tail)**2 * weight[None, :, :, None]))
                # Favor a useful long cycle when matches are equally good.
                score *= 1 + .04 * (4 - (end-start)/30)
                if best is None or score < best[0]:
                    best = score, start, end
        score, start, end = best
        s, e, fade = start/30, end/30, fade_frames/30
        destination = args.destination / f'{key}-{name}-v1.mp4'
        graph = (f'[0:v]split=2[a][b];'
                 f'[a]trim=start={s+fade:.6f}:end={e:.6f},setpts=PTS-STARTPTS[main];'
                 f'[b]trim=start={s:.6f}:end={s+fade:.6f},setpts=PTS-STARTPTS[head];'
                 f'[main][head]xfade=transition=fade:duration={fade-1/60:.6f}:'
                 f'offset={e-s-2*fade:.6f},format=yuv420p[v]')
        ffmpeg(['-i', str(args.source), '-filter_complex', graph, '-map', '[v]',
                '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast',
                '-crf', '17', '-r', '60', '-movflags', '+faststart', str(destination)])
        ffmpeg(['-i', str(destination), '-f', 'null', '-'])
        manifest['stances'][key] = dict(name=name, file=destination.name,
            start=s, end=e, blend=fade, duration=e-s-fade, match_rmse=score**.5)
        print(key, manifest['stances'][key], flush=True)
    write_json(args.destination / 'manifest.json', manifest)


if __name__ == '__main__':
    main()
