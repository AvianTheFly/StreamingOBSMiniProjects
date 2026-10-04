"""Finite, reversible cleanup of the soundboard's original Mom Frog audio."""
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


def prepare(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    ffmpeg, probe = shutil.which('ffmpeg'), shutil.which('ffprobe')
    if not ffmpeg or not probe:
        raise RuntimeError('FFmpeg and FFprobe are required')
    if source.name != 'mom frog.mp4' or not source.is_file():
        raise ValueError('Expected the existing soundboard Mom Frog clip')
    SettingsBackups().snapshot()
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    backup_dir = Path(os.environ['LOCALAPPDATA']) / 'StreamingHub' / 'asset-history' / 'mom-frog'
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = backup_dir / (digest + '.mp4')
    if not backup.exists():
        shutil.copy2(source, backup)
    output.mkdir(parents=True, exist_ok=True)
    metadata = jobs.run([probe, '-v', 'error', '-show_entries', 'format=duration',
                         '-of', 'json', str(source)], kind='mom-frog-probe',
                        text=True, check=True, timeout=10)
    duration = float(json.loads(metadata.stdout)['format']['duration'])
    filters = ('highpass=f=80,lowpass=f=3600:p=2,'
               'afftdn=nr=10:nf=-36:tn=1,'
               f'afade=t=in:d=0.004,afade=t=out:st={max(0, duration-.004):.6f}:d=0.004')
    clean = output / 'mom-frog-clean.wav'
    jobs.run([ffmpeg, '-nostdin', '-v', 'error', '-y', '-threads', '1',
              '-filter_threads', '1', '-i', str(backup), '-vn', '-af', filters,
              '-t', str(duration), '-c:a', 'pcm_s16le', str(clean)],
             kind='mom-frog-cleanup', check=True, timeout=30)
    with tempfile.NamedTemporaryFile(dir=source.parent, suffix='.mp4', delete=False) as stream:
        staged = Path(stream.name)
    try:
        jobs.run([ffmpeg, '-nostdin', '-v', 'error', '-y', '-threads', '1',
                  '-i', str(backup), '-i', str(clean), '-map', '0:v:0', '-map', '1:a:0',
                  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-threads', '1',
                  '-t', str(duration), '-movflags', '+faststart', str(staged)],
                 kind='mom-frog-remux', check=True, timeout=30)
        staged.replace(source)
    finally:
        staged.unlink(missing_ok=True)
    write_json(output / 'audio-recipe.json', dict(source=str(source), backup=str(backup),
               source_sha256=digest, cleaned_wave=str(clean), duration=duration, filters=filters,
               normalized=False, video_copied=True))
    print(f'Cleaned {duration:.3f}s croak; original backed up to {backup}')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    arguments = parser.parse_args()
    prepare(arguments.source, arguments.output)
