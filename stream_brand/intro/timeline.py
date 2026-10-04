"""Authored shot timing and delivery validation for the finite intro exporter."""
from pathlib import Path
import math


def make_shots(bpm=128., phase=.03, fps=60, duration=40):
    beat = 60/bpm
    def frame(n):
        return round((phase+n*beat)*fps)
    # asset, starting beat, ending beat, zoom from/to, focal center, camera orbit,
    # optional overlaid foreground character, transition accent.
    authored = [
        ('01-rift', 0, 8, 1.04, 1.16, .50, .50, -.018, True, 'fade'),
        ('02-awakening', 8, 12, 1.07, 1.17, .56, .49, .016, False, 'cut'),
        ('02-awakening', 12, 16, 1.33, 1.49, .43, .64, -.016, False, 'snap'),
        ('03-bear', 16, 24, 1.17, 1.04, .52, .50, -.028, False, 'impact'),
        ('03-bear', 24, 28, 1.35, 1.52, .56, .43, .014, False, 'snap'),
        ('04-turtle', 28, 36, 1.15, 1.04, .50, .50, .026, False, 'impact'),
        ('04-turtle', 36, 40, 1.33, 1.42, .56, .54, -.014, False, 'snap'),
        ('05-ram', 40, 48, 1.18, 1.04, .50, .50, -.024, False, 'impact'),
        ('05-ram', 48, 52, 1.39, 1.50, .41, .41, .012, False, 'snap'),
        ('06-phoenix', 52, 60, 1.13, 1.04, .50, .50, .023, False, 'impact'),
        ('06-phoenix', 60, 64, 1.32, 1.43, .50, .38, -.016, False, 'snap'),
        ('01-rift', 64, 68, 1.12, 1.25, .50, .50, .010, True, 'breath'),
        ('03-bear', 68, 70, 1.15, 1.27, .53, .49, -.012, False, 'impact'),
        ('04-turtle', 70, 72, 1.16, 1.30, .53, .49, .012, False, 'cut'),
        ('05-ram', 72, 74, 1.20, 1.38, .45, .49, -.012, False, 'impact'),
        ('06-phoenix', 74, 76, 1.16, 1.30, .50, .44, .010, False, 'cut'),
        ('02-awakening', 76, 77, 1.26, 1.38, .61, .41, -.008, False, 'snap'),
        ('03-bear', 77, 78, 1.42, 1.50, .59, .41, .006, False, 'cut'),
        ('05-ram', 78, 79, 1.41, 1.52, .41, .41, -.006, False, 'cut'),
        ('06-phoenix', 79, 80, 1.39, 1.49, .51, .37, .006, False, 'snap'),
        ('07-convergence', 80, None, 1.15, 1.03, .50, .50, -.010, False, 'finale'),
    ]
    shots=[]
    for i, (asset, start, end, z0, z1, x, y, orbit, hero, transition) in enumerate(authored):
        shots.append(dict(id=f'{i+1:02d}-{asset[3:]}', asset=asset,
            start_frame=0 if i == 0 else frame(start),
            end_frame=round(duration*fps) if end is None else frame(end),
            zoom=[z0,z1], focus=[x,y], orbit=orbit, hero=hero, transition=transition))
    return shots


def validate(plan, output):
    fps=plan['fps']
    frames=round(plan['duration_seconds']*fps)
    if fps != 60 or not math.isfinite(plan['duration_seconds']) or frames <= 0:
        raise ValueError('The delivery must have a finite duration and 60 fps')
    prior=0
    if plan.get('assets'):
        from stream_brand.intro.cinema import PALETTES
        for asset,spec in plan['assets'].items():
            if Path(asset).name != asset or spec.get('style') not in PALETTES:
                raise ValueError('Invalid asset style contract')
            for region in spec.get('depth',[]):
                if (len(region)!=5 or not all(math.isfinite(v) for v in region)
                    or not all(0<=v<=1 for v in region[:2])
                    or not all(0<v<=1 for v in region[2:])):
                    raise ValueError('Invalid approximate depth region')
    for shot in plan['shots']:
        if shot['start_frame'] != prior or shot['end_frame'] <= prior:
            raise ValueError('Shot timeline must be contiguous, increasing, and frame-aligned')
        if Path(shot['asset']).name != shot['asset']:
            raise ValueError('Asset identifiers cannot contain paths')
        if not (Path(output)/'art'/(shot['asset']+'.png')).is_file():
            raise FileNotFoundError(shot['asset'])
        if not all(math.isfinite(v) for v in shot['zoom']+shot['focus']+[shot['orbit']]):
            raise ValueError('Camera values must be finite')
        if min(shot['zoom']) < 1 or not all(0 < v < 1 for v in shot['focus']):
            raise ValueError('Invalid camera framing')
        for field,limit in [('travel',.12),('impact_point',1)]:
            value=shot.get(field,[0,0])
            if len(value)!=2 or not all(math.isfinite(v) and abs(v)<=limit for v in value):
                raise ValueError('Invalid motion or impact coordinate')
            if field=='impact_point' and min(value)<0:
                raise ValueError('Impact must lie inside the picture')
        for field in ('impact_frames','hit_stop_frames'):
            value=shot.get(field,0)
            if not isinstance(value,int) or not 0<=value<=12 or value>=shot['end_frame']-prior:
                raise ValueError('Contact treatment must fit its shot')
        prior=shot['end_frame']
    if prior != frames:
        raise ValueError('Shots must cover the entire requested excerpt')
    if not (Path(output)/'art'/'08-hero-layer.png').is_file():
        raise FileNotFoundError('Foreground character layer')
    return frames
