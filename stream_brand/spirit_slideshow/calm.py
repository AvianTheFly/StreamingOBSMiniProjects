"""Finite, stationary illustrated segments with gentle opacity transitions.

Two still inputs at most are decoded per job; original PNGs are never rewritten.
"""
from pathlib import Path
import json


GRADE = 'curves=master=0/0 .35/.34 .65/.60 1/.80,eq=saturation=0.90'


def validate(plan):
    settings = plan['calm_edit']
    frames = settings['dissolve_frames']
    if type(frames) is not int or not 2 <= frames <= 15:
        raise ValueError('Dissolves must span two to fifteen delivery frames')
    if any(s['frames'] < 30 or s['frames'] - frames < 20 for s in plan['shots']):
        raise ValueError('Calm shots require 1.2 seconds and a substantial stationary hold')
    if len(plan['shots']) > 30:
        raise ValueError('Calm edits limit the number of viewpoint changes')


def encode(output, plan, silent, run, *, indices=None):
    """Encode all segments, or repair specified segments in a reviewed export."""
    validate(plan)
    folder = Path(output)/'segments'
    folder.mkdir(exist_ok=True)
    names = []
    width, height = plan['width'], plan['height']
    base = f'scale={width}:{height}:flags=lanczos,setsar=1,format=yuv420p,{GRADE},format=yuv420p'
    d = plan['calm_edit']['dissolve_frames']
    for index in (range(len(plan['shots'])) if indices is None else indices):
        shot = plan['shots'][index]
        args = ['ffmpeg','-nostdin','-v','error','-y']
        if index:
            args += ['-threads','1','-loop','1','-framerate','25','-i',str(Path(output)/plan['shots'][index-1]['file'])]
        args += ['-threads','1','-loop','1','-framerate','25','-i',str(Path(output)/shot['file'])]
        if index:
            # N is one-based in blend: exact previous at N=1, current at N=d.
            weight = f'min((N-1)/{d-1},1)'
            graph = f"[0:v]{base}[a];[1:v]{base}[b];[a][b]blend=all_expr='A*(1-{weight})+B*{weight}'[v]"
        else:
            graph = f'[0:v]{base}[v]'
        target = folder/f'{index:02}.mp4'
        args += ['-filter_complex_threads','1','-filter_complex',graph,'-map','[v]',
                 '-frames:v',str(shot['frames']),'-an','-c:v','libx264','-threads','1',
                 '-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','25',str(target)]
        run(args, 'slideshow-calm-segment', 180)
        print(json.dumps(dict(segment=index+1,total=len(plan['shots']))),flush=True)
    names = [folder/f'{i:02}.mp4' for i in range(len(plan['shots']))]
    if not all(p.is_file() for p in names):
        raise ValueError('A partial repair requires every other reviewed segment')
    concat = folder/'segments.ffconcat'
    concat.write_text('ffconcat version 1.0\n'+''.join(f"file '{p.name}'\n" for p in names),encoding='utf-8')
    run(['ffmpeg','-nostdin','-v','error','-y','-threads','1','-f','concat','-safe','0',
         '-i',str(concat),'-map','0:v:0','-c:v','copy','-movflags','+faststart',str(silent)],
        'slideshow-calm-join')
