"""Finite disposable-library comparison; no personal files, settings or OBS I/O."""
import argparse
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import tempfile
import time
import types
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def benchmark(reference):
    from lib.paths import ensure_import_paths
    from tools.offline_test_resources import configure_test_process
    configure_test_process()
    os.environ.setdefault('REPLAY_DIR', tempfile.gettempdir())
    ensure_import_paths()
    from instant_replay import inventory, library
    source = subprocess.check_output(['git', 'show', reference + ':mini projects/instant_replay/inventory.py'], cwd=ROOT, text=True)
    previous = types.ModuleType('instant_replay._reference_inventory')
    previous.__package__ = 'instant_replay'
    exec(compile(source, '<committed inventory>', 'exec'), previous.__dict__)
    timings, counts = {'before': [], 'after': []}, {}
    with tempfile.TemporaryDirectory() as folder, patch.object(library, 'read', return_value={'clips': {}}):
        root = Path(folder)
        for n in range(1200):
            directory = root/'clips'/str(n//100) if n % 2 else root
            directory.mkdir(parents=True, exist_ok=True)
            path = directory/f'clip-{n}.mp4'
            path.write_bytes(b'fixture')
            os.utime(path, (1000+n, 1000+n))
        expected = previous.replay_files(root)
        assert inventory.replay_files(root) == expected
        original_stat = Path.stat
        for name, scan in [('before', previous.replay_files), ('after', inventory.replay_files)]:
            def counted(path, *args, **kwargs):
                counts[name] += 1
                return original_stat(path, *args, **kwargs)
            counts[name] = 0
            with patch.object(Path, 'stat', counted):
                assert scan(root) == expected
        for n in range(8):
            order = [('before', previous.replay_files), ('after', inventory.replay_files)]
            for name, scan in order[::1 if n % 2 == 0 else -1]:
                started = time.perf_counter()
                assert scan(root) == expected
                timings[name].append((time.perf_counter()-started)*1000)
    medians = {k: statistics.median(v) for k, v in timings.items()}
    return dict(reference=reference, files=len(expected), path_stat_calls=counts,
                median_wall_ms=medians, rounds=timings,
                reduction_percent=100*(1-medians['after']/medians['before']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = benchmark(args.reference)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
