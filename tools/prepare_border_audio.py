"""Finite, reversible Piuw/Mom Frog audio cleanup; no runtime DSP or fader edits."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.json_store import write_json
from lib.media_jobs import jobs
from lib.settings_backups import SettingsBackups


def filter_chain(name, duration):
    policies = {
        'piuw.mp3': 'highpass=f=160:p=2,lowpass=f=3500:p=2,afftdn=nr=14:nf=-30:tn=1',
        'mom frog.mp4': ('highpass=f=100:p=2,lowpass=f=3200:p=2,afftdn=nr=14:nf=-32:tn=1,'
                         'agate=threshold=0.015:ratio=2:range=0.25:attack=2:release=35'),
    }
    if name not in policies:
        raise ValueError('Only the requested Piuw and Mom Frog assets are supported')
    return (policies[name] + ',afade=t=in:d=0.004,'
            f'afade=t=out:st={max(0, duration-.006):.6f}:d=0.006')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(source, output, *, original=None, install=False):
    source, output = Path(source).resolve(), Path(output).resolve()
    filter_chain(source.name, 1)
    if not source.is_file():
        raise ValueError('The current personal media file must exist')
    previous_recipe = output/'audio-recipe.json'
    if original is None and previous_recipe.exists():
        saved = json.loads(previous_recipe.read_text(encoding='utf-8'))
        if saved.get('candidate_sha256') == digest(source):
            original = saved['backup']
    original = Path(original).resolve() if original else source
    if not original.is_file() or original.suffix != source.suffix:
        raise ValueError('Original backup must exist and have the same media format')
    ffmpeg, probe = shutil.which('ffmpeg'), shutil.which('ffprobe')
    if not ffmpeg or not probe:
        raise RuntimeError('FFmpeg and FFprobe are required')
    SettingsBackups().snapshot()
    history = Path(os.environ['LOCALAPPDATA'])/'StreamingHub'/'asset-history'/'border-audio'
    history.mkdir(parents=True, exist_ok=True)
    current_hash, original_hash = digest(source), digest(original)
    before = history/(current_hash+source.suffix)
    raw = history/(original_hash+source.suffix)
    for path, backup in [(source, before), (original, raw)]:
        if not backup.exists():
            shutil.copy2(path, backup)
    output.mkdir(parents=True, exist_ok=True)
    metadata = jobs.run([probe, '-v', 'error', '-show_entries', 'format=duration',
                         '-of', 'json', str(raw)], kind='border-audio-probe',
                        text=True, check=True, timeout=10)
    duration = float(json.loads(metadata.stdout)['format']['duration'])
    filters = filter_chain(source.name, duration)
    clean = output/(source.stem.replace(' ', '-')+'-clean.wav')
    jobs.run([ffmpeg, '-nostdin', '-v', 'error', '-y', '-threads', '1',
              '-filter_threads', '1', '-i', str(raw), '-map', '0:a:0', '-vn',
              '-af', filters, '-t', str(duration), '-c:a', 'pcm_s16le', str(clean)],
             kind='border-audio-cleanup', check=True, timeout=30)
    candidate = output/(source.stem.replace(' ', '-')+'-clean'+source.suffix)
    args = [ffmpeg, '-nostdin', '-v', 'error', '-y', '-threads', '1']
    if source.suffix == '.mp4':
        args += ['-i', str(raw), '-i', str(clean), '-map', '0:v:0', '-map', '1:a:0',
                 '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart']
    else:
        args += ['-i', str(clean), '-c:a', 'libmp3lame', '-b:a', '192k']
    jobs.run(args+['-threads', '1', '-t', str(duration), str(candidate)],
             kind='border-audio-encode', check=True, timeout=30)
    candidate_metadata = jobs.run([probe, '-v', 'error', '-show_entries', 'format=duration',
                                   '-of', 'json', str(candidate)], kind='border-audio-verify',
                                  text=True, check=True, timeout=10)
    encoded_duration = float(json.loads(candidate_metadata.stdout)['format']['duration'])
    # MP3 container padding is distinct from its gapless decoded audio duration.
    if abs(encoded_duration-duration) > .08:
        raise RuntimeError('Unexpected candidate duration; original remains installed')
    if install:
        if digest(source) != current_hash:
            raise RuntimeError('Media changed during preparation; refusing to overwrite it')
        with tempfile.NamedTemporaryFile(dir=source.parent, suffix=source.suffix, delete=False) as stream:
            staged = Path(stream.name)
        try:
            shutil.copy2(candidate, staged)
            staged.replace(source)
        finally:
            staged.unlink(missing_ok=True)
    recipe = dict(source=str(source), previous_backup=str(before), backup=str(raw),
                  previous_sha256=current_hash, source_sha256=original_hash,
                  candidate=str(candidate), candidate_sha256=digest(candidate),
                  cleaned_wave=str(clean), duration=duration, filters=filters,
                  normalized=False, video_copied=source.suffix == '.mp4', installed=install)
    write_json(output/'audio-recipe.json', recipe)
    print(json.dumps(recipe))
    return recipe


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--original', type=Path)
    parser.add_argument('--install', action='store_true')
    args = parser.parse_args()
    prepare(args.source, args.output, original=args.original, install=args.install)
