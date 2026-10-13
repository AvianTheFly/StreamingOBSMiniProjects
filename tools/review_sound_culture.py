"""Finite, read-only context review of the requested soundboard performances.

Extracts review frames, speech timing and sound envelopes from original media.
No microphones, Hub workers, settings writes or OBS connections are involved.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from lib.paths import ensure_import_paths, load_project_env

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/sound-culture'
KEYS = ['!', '2', '#', 'Z', 'T', 't', 'h', 'H']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--speech', action='store_true', help='Review speech with one already-cached CPU model')
    parser.add_argument('--write-timing', action='store_true', help='Regenerate authored, non-personal visual timing data')
    parser.add_argument('--keys', nargs='+', default=KEYS, help='Exact case-sensitive hotkeys to review; unbound keys are preserved and skipped')
    parser.add_argument('--out', type=Path, default=OUT, help='Read-only media review output directory')
    options = parser.parse_args()
    out = options.out
    ensure_import_paths()
    load_project_env()
    from soundboard.config import CONFIG
    from lib.browser_effects.catalog import load_catalog
    out.mkdir(parents=True, exist_ok=True)
    hotkeys = json.loads((ROOT / 'mini projects/soundboard/hotkeys_editor.json').read_text())['profiles']['default']['hotkeys']
    names = list(dict.fromkeys(name for key in options.keys for name in (hotkeys.get(key, []) if isinstance(hotkeys.get(key, []), list) else [hotkeys[key]]) if name))
    catalog = load_catalog(ROOT / 'mini projects/soundboard')
    files = {p.stem.casefold(): p for p in Path(CONFIG.asset_dir).iterdir() if p.suffix.lower() in CONFIG.valid_extensions}
    review, thumbnails = [], []
    for index, name in enumerate(names):
        source = files[name.casefold()]
        meta = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(source)]))
        pcm = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source), '-vn', '-ac', '1', '-ar', '12000', '-f', 'f32le', '-']), dtype='<f4')
        duration = len(pcm) / 12000
        blocks = [np.sqrt(np.mean(block ** 2)) if len(block) else 0 for block in np.array_split(pcm, 160)]
        peak = max(blocks) or 1
        envelope = [round(float(v / peak), 3) for v in blocks]
        row = {'name': name, 'effect': catalog[name], 'path': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'duration': duration, 'envelope': envelope, 'tags': meta.get('format', {}).get('tags', {})}
        if duration > 2 and (row['effect'].get('style') in {'disco', 'coffin', 'mash', 'crabs', 'balloons', 'rats', 'shades', 'equalizer', 'nyan', 'raccoon', 'racing'}):
            # Ten-ms spectral flux: measure the local clip, including edits/speed.
            windows = np.lib.stride_tricks.sliding_window_view(pcm, 512)[::120]
            spectrum = np.abs(np.fft.rfft(windows*np.hanning(512), axis=1))
            flux = np.maximum(0, np.diff(spectrum, axis=0)).sum(axis=1)
            centered = flux - flux.mean()
            correlation = np.correlate(centered, centered, mode='full')[len(centered)-1:]
            peaks = sorted([(correlation[n]/correlation[0], n) for n in range(33, 86) if correlation[n] >= correlation[n-1] and correlation[n] >= correlation[n+1]], reverse=True)
            confidence, period = peaks[0]
            # Resolve a clear half-time peak only if its double is also supported.
            if period > 70:
                doubled = next(((score, lag) for score, lag in peaks if abs(lag-period/2) < 2 and score > confidence*.5), None)
                if doubled:
                    confidence, period = doubled
            if confidence > .25:
                offset = max(range(period), key=lambda k: flux[k::period].sum())*.01+.03133
                row['cadence'] = {'bpm': round(6000/period, 4), 'offset': round(offset, 5), 'confidence': round(float(confidence), 3), 'method': '10-ms positive spectral flux/autocorrelation of original PCM'}
        review.append(row)
        if any(s['codec_type'] == 'video' for s in meta['streams']):
            card = Image.new('RGB', (660, 152), '#1c293c')
            ImageDraw.Draw(card).text((10, 5), name, fill='white')
            for j, fraction in enumerate([.15, .48, .8]):
                target = out / f'original-{index}-{j}.png'
                subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(duration*fraction), '-i', str(source), '-frames:v', '1', '-vf', 'scale=210:118:force_original_aspect_ratio=decrease,pad=210:118:(ow-iw)/2:(oh-ih)/2', '-y', str(target)], check=True)
                card.paste(Image.open(target).convert('RGB'), (j*220, 28))
            thumbnails.append(card)
        print(name, round(duration, 3), source.suffix, flush=True)
    for start in range(0, len(thumbnails), 8):
        sheet = Image.new('RGB', (1320, 608), '#111a28')
        for n, card in enumerate(thumbnails[start:start+8]):
            sheet.paste(card, (n%2*660, n//2*152))
        sheet.save(out / f'originals-{start+1}.png')
    (out / 'media-context.json').write_text(json.dumps(review, indent=2), encoding='utf-8')
    if options.write_timing:
        timing = {(row['effect'].get('scene') or row['effect'].get('style') or 'muffins'): {
            'duration': round(row['duration'], 5), 'sha256': row['sha256'], 'envelope': row['envelope'],
            **({key: row['cadence'][key] for key in ['bpm', 'offset', 'confidence']} if 'cadence' in row else {})
        } for row in review}
        (ROOT / 'lib/browser_effects/art/culture-timing.json').write_text(json.dumps(timing, separators=(',', ':'))+'\n', encoding='utf-8')
    if not options.speech:
        return
    # The existing local cache is sufficient; never download a model for review.
    from faster_whisper import WhisperModel
    model = WhisperModel('base.en', device='cpu', compute_type='int8', cpu_threads=2, num_workers=1, local_files_only=True)
    speech = {'dang it', 'im cooked', 'OH NO NO NO NO', 'I shouldve seen that coming', 'woops', 'leave me alone', 'you saved me', 'what just happened'}
    for row in review:
        if row['name'] not in speech:
            continue
        segments, _ = model.transcribe(row['path'], beam_size=3, word_timestamps=True)
        row['speech'] = [{'start': s.start, 'end': s.end, 'text': s.text, 'words': [{'start': w.start, 'end': w.end, 'word': w.word} for w in (s.words or [])]} for s in segments]
        print(row['name'], row['speech'], flush=True)
    (out / 'media-context.json').write_text(json.dumps(review, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
