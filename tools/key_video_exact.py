"""Make a lossless RGB+alpha MOV test clip, removing only one exact RGB color.

No similarity threshold, smoothing, spill suppression, or foreground correction.
QTRLE preserves decoded RGB values and alpha; audio is copied unchanged.
Runs offline with one FFmpeg thread at below-normal Windows priority.
"""
import argparse
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--color', required=True, help='RGB hex, e.g. #1DAA12')
    args = parser.parse_args()
    color = args.color.lstrip('#')
    if len(color) != 6:
        parser.error('Color must contain six hexadecimal digits')
    try:
        red, green, blue = (int(color[i:i+2], 16) for i in (0, 2, 4))
    except ValueError:
        parser.error('Invalid hexadecimal color')
    if args.source.resolve() == args.output.resolve() or args.output.suffix.lower() != '.mov':
        parser.error('Use a separate .mov output path')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    alpha = f'if(eq(r(X,Y),{red})*eq(g(X,Y),{green})*eq(b(X,Y),{blue}),0,255)'
    # Convert to packed 8-bit RGB first, matching the sampled RGB pixels.
    # Direct YUV -> planar RGB can round/chroma-upsample differently.
    filters = f"format=rgba,format=gbrap,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='{alpha}',format=argb"
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-n', '-threads', '1',
        '-i', str(args.source), '-map', '0:v:0', '-map', '0:a?',
        '-filter_threads', '1', '-vf', filters,
        '-c:v', 'qtrle', '-threads', '1', '-c:a', 'copy',
        '-movflags', '+faststart', str(args.output),
    ], check=True, creationflags=(getattr(subprocess, 'CREATE_NO_WINDOW', 0)
                                 | getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)))
    print(f'Created {args.output} using exact RGB #{color.upper()}')


if __name__ == '__main__':
    main()
