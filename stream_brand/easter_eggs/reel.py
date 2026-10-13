"""Finite 40-second visual index: three actual exported acts per character."""
from pathlib import Path
import json
from encode import ffmpeg


def main():
    root = Path(__file__).parent / 'v1'
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    films = []
    for character in manifest['characters']:
        args = ['-loop', '1', '-framerate', '24', '-i',
                str(root / 'review' / (character['id'] + '-stage.png'))]
        for clip in [c for c in manifest['clips'] if c['character'] == character['id']]:
            args += ['-c:v', 'libvpx-vp9', '-threads', '1', '-i', str(root / clip['file'])]
        graph = ('[1:v]scale=360:360[a];[2:v]scale=360:360[b];[3:v]scale=360:360[c];'
                 '[0:v][a]overlay=12:90:shortest=1[d];'
                 '[d][b]overlay=396:90:shortest=1[e];'
                 '[e][c]overlay=780:90:shortest=1,format=yuv420p[out]')
        film = root / 'review' / (character['id'] + '.mp4')
        ffmpeg([*args, '-filter_complex', graph, '-map', '[out]', '-t', '5',
                '-r', '24', '-an', '-c:v', 'libx264', '-threads', '2',
                '-crf', '18', '-preset', 'fast', '-movflags', '+faststart', str(film)])
        films.append(film)
        print('Previewed', character['id'], flush=True)
    listing = root / 'review' / 'concat.txt'
    listing.write_text(''.join("file '" + p.resolve().as_posix().replace("'", "'\\''") + "'\n" for p in films), encoding='utf-8')
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', str(listing), '-c', 'copy',
            '-movflags', '+faststart', str(root / 'preview-reel.mp4')])


if __name__ == '__main__':
    main()
