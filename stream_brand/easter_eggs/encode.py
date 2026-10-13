"""Finite cameo encoding, alpha validation and portable package assembly."""
from pathlib import Path
import json
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib.media_jobs import jobs


def ffmpeg(args):
    return jobs.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                     '-threads', '2', '-filter_threads', '2',
                     '-filter_complex_threads', '2', *args],
                    kind='cameo-artifact', weight=2, timeout=180, check=True)


def main():
    pack = Path(__file__).parent / 'v1'
    manifest = json.loads((pack / 'manifest.json').read_text(encoding='utf-8'))
    (pack / 'clips').mkdir(exist_ok=True)
    checks = []
    for clip in manifest['clips']:
        dest = pack / clip['file']
        ffmpeg(['-framerate', '24', '-i', str(pack / clip['sequence']), '-an',
                '-c:v', 'libvpx-vp9', '-threads', '2', '-row-mt', '0',
                '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0',
                '-lossless', '1', '-crf', '0', '-deadline', 'good', '-cpu-used', '4', str(dest)])
        # Native FFmpeg VP9 may omit alpha; explicitly validate via libvpx.
        decoded = ffmpeg(['-c:v', 'libvpx-vp9', '-i', str(dest), '-vf',
                          'alphaextract', '-pix_fmt', 'gray',
                          '-f', 'rawvideo', 'pipe:1']).stdout
        pixels = manifest['width'] * manifest['height']
        count = len(decoded) // pixels
        assert count == 120, (clip['id'], count)
        assert not any(decoded[:pixels]) and not any(decoded[-pixels:]), clip['id']
        assert any(decoded[30 * pixels:90 * pixels]), clip['id']
        sequence = pack / 'frames' / clip['id']
        with zipfile.ZipFile(sequence.with_suffix('.zip'), 'w', zipfile.ZIP_STORED) as archive:
            for p in sorted(sequence.glob('*.png')):
                archive.write(p, p.name)
            archive.writestr('timing.json', json.dumps({**clip, 'canvas': [512, 512],
                'anchor': [256, 419.84], 'alpha': True, 'audio': False}, indent=2))
        checks.append({'id': clip['id'], 'decoded_frames': count,
                       'transparent_endpoints': True, 'alpha_content': True,
                       'bytes': dest.stat().st_size})
        print('Encoded and verified', clip['id'], flush=True)
    (pack / 'encode-check.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
    package(pack)


def package(pack):
    with zipfile.ZipFile(pack / 'easter-eggs-v1.zip', 'w', zipfile.ZIP_STORED) as archive:
        for p in sorted(pack.rglob('*')):
            if not p.is_file() or p.name == 'easter-eggs-v1.zip':
                continue
            if p.parent.parent.name == 'frames':
                continue  # Individual sequences are already included as per-act ZIPs.
            archive.write(p, str(p.relative_to(pack)))
    print('Saved', pack / 'easter-eggs-v1.zip', flush=True)


if __name__ == '__main__':
    main()
