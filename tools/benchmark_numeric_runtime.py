"""Finite fresh-process benchmark of the real Whisper audio frontend.

No microphone, model download, transcription, settings writes or live commands.
Compare native-pool CPU time as well as elapsed time; wall time alone can hide
oversubscription. Outputs are synthetic features, never personal audio.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def worker(output):
    started, cpu = time.perf_counter(), time.process_time()
    import numpy as np
    from faster_whisper.feature_extractor import FeatureExtractor
    from threadpoolctl import threadpool_info
    imported = dict(wall_seconds=time.perf_counter()-started,
                    cpu_seconds=time.process_time()-cpu)
    extractor = FeatureExtractor()
    audio = (.15*np.sin(2*np.pi*440*np.arange(48000)/16000)).astype(np.float32)
    features = extractor(audio)
    started, cpu = time.perf_counter(), time.process_time()
    for _ in range(500):
        features = extractor(audio)
    measured = dict(wall_seconds=time.perf_counter()-started,
                    cpu_seconds=time.process_time()-cpu, iterations=500)
    np.save(output, features)
    print(json.dumps(dict(imports=imported, features=measured,
                         pools=[{k:p[k] for k in ('internal_api','num_threads')}
                                for p in threadpool_info()])))


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    rows = []
    for threads in ('inherited', '2', '1'):
        env = os.environ.copy()
        if threads != 'inherited':
            for key in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):
                env[key] = threads
        result = subprocess.run([sys.executable, '-X', 'utf8', __file__,
                                 '--worker', str(output/f'{threads}.npy')],
                                env=env, capture_output=True, text=True, timeout=90,
                                creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),
                                check=True)
        row = dict(threads=threads, **json.loads(result.stdout))
        rows.append(row)
        print(json.dumps(row), flush=True)
    import numpy as np
    reference = np.load(output/'inherited.npy')
    for row in rows:
        actual = np.load(output/f"{row['threads']}.npy")
        np.testing.assert_allclose(actual, reference, rtol=1e-5, atol=1e-6)
        row['max_feature_error'] = float(np.max(np.abs(actual-reference)))
    (output/'numeric-runtime.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.worker:
        worker(args.worker)
    elif args.output:
        run(args.output)
    else:
        parser.error('--output is required')
