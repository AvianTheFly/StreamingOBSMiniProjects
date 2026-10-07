"""Finite read-only comparison of driver counter reads versus process launches."""
import argparse
import json
from pathlib import Path
import statistics
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.gpu_metrics import GpuMetrics, GPU_FIELDS, parse_gpu_csv


def benchmark():
    sampler = GpuMetrics()
    try:
        initial = sampler.sample()
        if initial['gpu_backend'] != 'nvml':
            raise RuntimeError('Native counters unavailable; no native comparison possible')
        samples = {}
        for label, read in (
            ('subprocess', lambda: parse_gpu_csv(subprocess.run(
                [sampler.smi, '--query-gpu=' + ','.join(GPU_FIELDS), '--format=csv,noheader,nounits'],
                capture_output=True, text=True, timeout=2, check=True,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)).stdout)),
            ('native', lambda: sampler.sample()['gpu']),
        ):
            timings = []
            for _ in range(12):
                began = time.perf_counter(); rows = read()
                timings.append((time.perf_counter()-began)*1000)
                assert rows and all(set(row) == set(GPU_FIELDS) for row in rows)
                assert [r['memory.total'] for r in rows] == [r['memory.total'] for r in initial['gpu']]
            samples[label] = dict(median_ms=statistics.median(timings), calls=len(timings),
                                  processes=len(timings) if label == 'subprocess' else 0)
        return samples
    finally:
        sampler.close()


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output', type=Path, required=True)
    args=parser.parse_args();result=benchmark();args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result,indent=2))
