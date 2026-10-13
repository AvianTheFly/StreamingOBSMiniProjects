"""Finite original-media timing study. No runtime imports, settings or OBS access."""
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/border-lineup-audit'
KEYS = ['Z', 'T', 't', '1', '!', '2', '@', '3', '#', '4', '$', '%']


def spectrum(pcm, size=1024, hop=120):
    frames = np.lib.stride_tricks.sliding_window_view(pcm, size)[::hop]
    fft = np.abs(np.fft.rfft(frames * np.hanning(size), axis=1))
    flux = np.maximum(0, np.diff(fft, axis=0))
    # Bass attacks are a separate witness; vocal consonants cannot alone select a beat.
    bass = flux[:, 3:27].sum(axis=1)
    full = flux.sum(axis=1)
    return full, bass, (np.arange(len(full)) * hop + hop + size/2) / 12000


def beat_fit(full, bass, times, authored):
    if not authored.get('bpm'):
        return None
    period, offset = 60 / authored['bpm'], authored['offset']
    def norm(x):
        return x / max(float(np.quantile(x, .95)), 1e-8)
    strength = .45 * norm(full) + .55 * norm(bass)
    peaks, _ = find_peaks(strength, distance=9, prominence=.22)
    peaks = [i for i in peaks if strength[i] > .45]
    grid = np.arange(offset, times[-1], period)
    # Keep this cue's existing pulse interpretation. Refine only nearby attacks,
    # not its tempo family or half/double-time from a short excerpt.
    observations = []
    for number, tick in enumerate(grid):
        nearby = [i for i in peaks if abs(times[i]-tick) < min(.12, period*.24)]
        if nearby:
            i = max(nearby, key=lambda i: strength[i] * (1-abs(times[i]-tick)/period))
            observations.append((number, float(times[i]), float(strength[i]), float(norm(bass)[i])))
    if len(observations) < 5:
        return {'supported': False, 'reason': 'fewer than five independently observed attacks'}
    indices, onsets, weights, low = np.asarray(observations).T
    keep = np.ones(len(onsets), dtype=bool)
    for _ in range(3):
        matrix = np.column_stack([np.ones(keep.sum()), indices[keep]])
        weight = np.sqrt(np.minimum(weights[keep], 3))
        fit = np.linalg.lstsq(matrix*weight[:, None], onsets[keep]*weight, rcond=None)[0]
        errors = abs(onsets-(fit[0]+indices*fit[1]))
        keep = errors < .065
        if keep.sum() < 5:
            return {'supported': False, 'reason': 'attacks do not form a stable nearby pulse'}
    old = np.sqrt(np.mean((onsets[keep]-(offset+indices[keep]*period))**2))
    new = np.sqrt(np.mean((onsets[keep]-(fit[0]+indices[keep]*fit[1]))**2))
    supported = bool(keep.sum()/len(grid) >= .6 and np.median(low[keep]) > .35 and
                     abs(fit[1]-period)/period < .04 and new < .045)
    return {'supported': supported, 'bpm': round(float(60/fit[1]), 5),
            'offset': round(float(fit[0]), 5), 'old_rms_ms': round(float(old*1000), 2),
            'new_rms_ms': round(float(new*1000), 2), 'matched': int(keep.sum()),
            'ticks': len(grid), 'bass_support': round(float(np.median(low[keep])), 3),
            'observed_attacks': [round(float(x), 5) for x in onsets[keep]],
            'grid_indices': [int(x) for x in indices[keep]]}


def build():
    rows = json.loads((ROOT/'output/thematic-borders/media-context.json').read_text())
    profile = json.loads((ROOT/'mini projects/soundboard/hotkeys_editor.json').read_text())['profiles']['default']
    selected = list(dict.fromkeys(n for k in KEYS for n in
                    (profile['hotkeys'].get(k, []) if isinstance(profile['hotkeys'].get(k, []), list)
                     else [profile['hotkeys'][k]])))
    assert selected == [r['name'] for r in rows] and len(rows) == 40
    timing = json.loads((ROOT/'lib/browser_effects/art/culture-timing.json').read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    for row in rows:
        key = 'hooray' if row['effect']['renderer']=='hooray' else row['effect'].get('scene') or row['effect'].get('style') or 'muffins'
        path = Path(row['path'])
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256'], row['name']
        pcm = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', '12000', '-f', 'f32le', '-']), dtype='<f4')
        frame_size = 120
        rms = np.sqrt(np.mean(pcm[:len(pcm)//frame_size*frame_size].reshape(-1, frame_size)**2, axis=1))
        audible = np.flatnonzero(rms > max(float(rms.max())*.065, .001))
        full, bass, times = spectrum(pcm)
        peaks, _ = find_peaks(full, distance=9, prominence=max(full.max()*.055, 1e-6))
        strongest = sorted(peaks, key=lambda i: full[i], reverse=True)[:24]
        # The first transient can lie on the FFT boundary and is not a scipy
        # local peak. Keep the direct PCM energy witness too (Bonk's main hit).
        energy_peak = int(rms.argmax())
        result = {'name':row['name'], 'key':key, 'sha256':row['sha256'],
                  'container_duration':row['duration'], 'pcm_duration':round(len(pcm)/12000, 6),
                  'first_audible':round(float(audible[0]*.01), 5),
                  'last_audible':round(float((audible[-1]+1)*.01), 5),
                  'pcm_energy_peak':round(energy_peak*.01, 5),
                  'strong_attacks':sorted(round(float(times[i]),5) for i in strongest),
                  'strongest_attack':round(float(times[max(peaks, key=lambda i: full[i])]),5),
                  # Review context retains the pre-audit authored grid. Using it
                  # makes the before/after comparison reproducible on reruns.
                  'baseline_grid':row.get('cadence'),
                  'beat_fit':beat_fit(full, bass, times, row.get('cadence') or timing[key])}
        results.append(result)
        print(f"{key:12} onset {result['first_audible']:.3f}s strongest {result['strongest_attack']:.3f}s"+
              (f" | pulse {result['beat_fit']}" if result['beat_fit'] else ''), flush=True)
    (OUT/'original-timing-study.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print('Studied all 40 original files; original hashes intact.')


if __name__ == '__main__':
    build()
