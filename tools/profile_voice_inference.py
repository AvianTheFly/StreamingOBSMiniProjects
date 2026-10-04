"""Measure cached speech models with explicit audio files and no microphone.

This does not change Hub settings or dispatch commands. Use generated samples
or recordings supplied for testing. Results include local transcripts so model
choices can be checked for both latency and recognition.
"""
from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import sys
import time
import subprocess
import threading

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import load_project_env


class GpuSamples:
    """Read total GPU counters, not per-process attribution or an instantaneous cap."""
    def __init__(self):
        self.samples = []
        self.child = None
        self.thread = None

    def start(self):
        self.child = subprocess.Popen(['nvidia-smi',
            '--query-gpu=utilization.gpu,memory.used,utilization.encoder',
            '--format=csv,noheader,nounits', '--loop-ms=100'],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))

        def read():
            for line in self.child.stdout:
                try:
                    gpu, memory, encoder = (float(x.strip()) for x in line.split(','))
                    self.samples.append(dict(time=time.monotonic(), gpu_percent=gpu,
                                             memory_mb=memory, encoder_percent=encoder))
                except ValueError:
                    continue
        self.thread = threading.Thread(target=read, daemon=True)
        self.thread.start()
        time.sleep(1)

    def close(self):
        if self.child is not None:
            self.child.terminate()
            self.child.wait(timeout=5)
            self.thread.join(timeout=5)
            self.child.stdout.close()


def run(paths, models, beams, threads, device='cpu', compute='int8'):
    import psutil
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio

    process = psutil.Process()
    if hasattr(psutil, 'BELOW_NORMAL_PRIORITY_CLASS'):
        process.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
    rows = []
    gpu = GpuSamples() if device == 'cuda' else None
    try:
        if gpu:
            gpu.start()
        for name in models:
            baseline = gpu.samples[-1] if gpu and gpu.samples else None
            load_started = time.monotonic()
            model = WhisperModel(name, device=device, compute_type=compute,
                                 cpu_threads=threads, num_workers=1, local_files_only=True)
            load_seconds = time.monotonic() - load_started
            for beam in beams:
                for path in paths:
                    audio = decode_audio(str(path), sampling_rate=16000)
                    before = process.cpu_times()
                    started = time.monotonic()
                    segments, _ = model.transcribe(audio, language='en', beam_size=beam,
                        vad_filter=True, vad_parameters={'min_silence_duration_ms': 300})
                    segments = list(segments)  # Inference runs while the iterator is consumed.
                    elapsed = time.monotonic() - started
                    after = process.cpu_times()
                    row = dict(model=name, device=device, compute=compute, beam=beam,
                        threads=threads, asset=path.name, load_seconds=round(load_seconds, 3),
                        audio_seconds=round(len(audio) / 16000, 3),
                        inference_seconds=round(elapsed, 3),
                        cpu_seconds=round(after.user + after.system - before.user - before.system, 3),
                        transcript=' '.join(s.text for s in segments).strip(),
                        log_probabilities=[round(s.avg_logprob, 3) for s in segments])
                    if gpu:
                        observed = [s for s in gpu.samples if load_started <= s['time'] <= time.monotonic()]
                        row['gpu_baseline'] = baseline
                        row['gpu_samples'] = observed
                        row['gpu_total_peak_percent'] = max((s['gpu_percent'] for s in observed), default=None)
                        row['gpu_total_peak_memory_mb'] = max((s['memory_mb'] for s in observed), default=None)
                    rows.append(row)
                    print(json.dumps({k: v for k, v in row.items()
                                  if k not in ('gpu_samples', 'gpu_baseline')}), flush=True)
            del model
    finally:
        if gpu:
            gpu.close()
    folder = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'StreamingHub/diagnostics'
    folder.mkdir(parents=True, exist_ok=True)
    output = folder / ('voice-model-comparison-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.json')
    output.write_text(json.dumps(rows, indent=2), encoding='utf-8')
    print('Saved', output, flush=True)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('audio', nargs='+', type=Path)
    parser.add_argument('--model', action='append', required=True)
    parser.add_argument('--beam', action='append', type=int)
    parser.add_argument('--threads', type=int, default=2)
    parser.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    parser.add_argument('--compute', choices=['int8', 'int8_float16', 'float16'])
    args = parser.parse_args()
    if not 1 <= args.threads <= 4 or any(not 1 <= b <= 5 for b in args.beam or [5]):
        parser.error('Use 1–4 CPU threads and 1–5 beams')
    load_project_env()
    run([p.resolve(strict=True) for p in args.audio], args.model, args.beam or [5], args.threads,
        args.device, args.compute or ('int8_float16' if args.device == 'cuda' else 'int8'))
