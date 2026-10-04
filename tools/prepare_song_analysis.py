"""Prepare compact visualizer measurements without changing or playing media.

Run with --all while not streaming/recording, or supply individual file paths.
The Hub can play uncached files normally and learns their analysis on completion.
"""
from __future__ import annotations

import argparse
from array import array
from pathlib import Path
import subprocess
import sys
import time

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths()
load_project_env()
from specific_song.bass_detector import BassDetector
from specific_song.analysis_cache import MAX_FILE_BYTES, close_analysis
from specific_song.config import ASSETS_DIR, BASS_LOW_HZ, BASS_HIGH_HZ


def prepare(path, should_stop=lambda: False):
    detector = BassDetector(audio_file=Path(path), bass_low_hz=BASS_LOW_HZ,
                            bass_high_hz=BASS_HIGH_HZ)
    cache = detector.analysis_cache()
    if cache is None:
        raise ValueError('Analysis cache unavailable or disabled')
    cached = cache.load()
    if cached is not None:
        close_analysis(cached)
        return 'cached'
    values = array('d')
    decoder = subprocess.Popen(
        ['ffmpeg', '-nostdin', '-v', 'error', '-threads', '1', '-i', str(path),
         '-map', '0:a:0', '-vn', '-threads', '1', '-filter_threads', '1',
         '-ac', '1', '-ar', str(detector.sample_rate), '-f', 'f32le', 'pipe:1'],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        creationflags=(getattr(subprocess, 'CREATE_NO_WINDOW', 0) |
                       getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)))
    try:
        checked_at = -float('inf')
        while True:
            if time.monotonic() - checked_at >= 1:
                if should_stop():
                    raise InterruptedError('Preparation stopped because streaming or recording started')
                checked_at = time.monotonic()
            raw = decoder.stdout.read(detector.block_size * 4)
            if not raw:
                break
            chunk = np.frombuffer(raw, dtype='<f4')
            if len(chunk) < detector.block_size:
                chunk = np.pad(chunk, (0, detector.block_size-len(chunk)))
            values.extend(detector.frame_features(chunk))
            if len(values) * 8 + 1024 > MAX_FILE_BYTES:
                raise ValueError('Track exceeds bounded analysis cache size')
        if decoder.wait(timeout=5) != 0:
            raise ValueError('Audio decoding failed')
        if not cache.save(values):
            raise ValueError('Could not save complete analysis')
        return f'prepared {len(values)//7} frames, {len(values)*8/1048576:.2f} MiB'
    finally:
        if decoder.poll() is None:
            decoder.terminate()
            try:
                decoder.wait(timeout=2)
            except subprocess.TimeoutExpired:
                decoder.kill()
                decoder.wait()
        decoder.stdout.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('paths', type=Path, nargs='*')
    parser.add_argument('--all', action='store_true', help='Prepare the configured song library')
    args = parser.parse_args()
    paths = args.paths
    if args.all:
        paths += sorted(p for p in ASSETS_DIR.iterdir()
                        if p.suffix.lower() in {'.mp4','.mp3','.m4a','.wav','.flac','.ogg','.aac','.webm'})
    if not paths:
        parser.error('Supply file paths or --all')
    try:
        import psutil
        if hasattr(psutil, 'BELOW_NORMAL_PRIORITY_CLASS'):
            psutil.Process().nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
    except (ImportError, OSError):
        pass
    import obs
    def live_output():
        try:
            client = obs.get_obs()
        except Exception:
            return False  # OBS is closed.
        return client.get_stream_status().output_active or client.get_record_status().output_active
    if live_output():
        raise SystemExit('Prepare analysis when streaming and recording are stopped.')
    failed = 0
    for index, path in enumerate(paths, 1):
        try:
            result = prepare(path, live_output)
            print(f'[{index}/{len(paths)}] {path.name}: {result}', flush=True)
        except InterruptedError as exc:
            raise SystemExit(str(exc))
        except Exception as exc:
            failed += 1
            print(f'[{index}/{len(paths)}] {path.name}: {exc}', flush=True)
    raise SystemExit(1 if failed else 0)


if __name__ == '__main__':
    main()
