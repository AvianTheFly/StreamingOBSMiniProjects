"""Encode a reviewable video over synthetic before/after scenes, never user capture."""
from pathlib import Path
import os
import subprocess
import json
import sys

MEDIA=Path(os.environ.get('SPIRIT_OUTPUT', 'C:/StreamingMedia/Transitions/udyr-spirits-v11'))
INPUT=MEDIA/'production'
TIMING=json.loads((Path(__file__).resolve().parents[1]/'lib/scene_transitions/web/timing.json').read_text())
NAMES={'bear':'STORMCLAW','turtle':'VERDANT AEGIS','ram':'SUNDERING GOLD','phoenix':'CINDER ASCENSION'}
PERFORMANCES={'bear':['Storm stalker','Thunder ambush'],'turtle':['Lake guardian','Ancient ward'],
              'ram':['Mountain breaker','Golden siege'],'phoenix':['Ash omen','Ember return']}
CLIPS=[f'{spirit}{suffix}' for spirit in NAMES for suffix in ('','-alt')]
IMPACTS={'bear':[(2.18,14),(2.68,17),(3.18,22)],'turtle':[(1.94,5),(3.62,8)],'ram':[(3.65,34)],'phoenix':[(1.12,6),(3.16,17)]}


def build():
    chosen=sys.argv[1:] or CLIPS
    if not set(chosen)<=set(CLIPS):
        raise ValueError('Specify valid performance IDs for selected review exports')
    for clip in chosen:
        spirit=clip.split('-')[0]
        name=NAMES[spirit]+' / '+PERFORMANCES[spirit][clip.endswith('-alt')]
        cut=TIMING.get('animations',{}).get(spirit,{}).get('cut',TIMING['cut'])
        amp='+'.join(f'if(between(on/60,{t},{t+.45}),{p}*exp(-(on/60-{t})*12),0)' for t,p in IMPACTS[spirit])
        camera=(f"zoompan=z='1+({amp})*.002':x='(iw-iw/zoom)/2-sin(on/60*91)*({amp})/zoom':"
                f"y='(ih-ih/zoom)/2-cos(on/60*113)*({amp})*.6/zoom':d=1:s=1920x1080:fps=60")
        def scene(label, tint):
            return (f'drawbox=x=85:y=80:w=1750:h=920:color={tint}@0.35:t=2,'
                f"drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='{label}':fontsize=56:fontcolor=white:x=(w-tw)/2:y=(h-th)/2")
        filters=(f'[1:v]{scene("SCENE A", "0x9dd0ce")}[a];'
            f'[2:v]{scene("SCENE B", "0xd6bad3")}[b];'
            f'[a][b]concat=n=2:v=1:a=0,{camera}[bg];'
            '[bg][0:v]overlay=0:0:shortest=1:format=auto,'
            f"drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='{name}':fontsize=22:fontcolor=white:x=32:y=28,format=yuv420p[out]")
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',
            '-threads','4','-c:v','libvpx-vp9','-i',str(INPUT/f'{clip}.webm'),
            '-f','lavfi','-i',f"color=c=0x102635:s=1920x1080:r=60:d={cut}",
            '-f','lavfi','-i',f"color=c=0x302136:s=1920x1080:r=60:d={TIMING['duration']-cut}",
            '-filter_complex',filters,'-map','[out]','-map','0:a',
            '-c:v','libx264','-crf','21','-preset','fast','-threads','4','-c:a','aac','-b:a','160k',
            '-t',str(TIMING['duration']),'-movflags','+faststart',str(MEDIA/f'{clip}-preview.mp4')],check=True)
        print(f'{clip} preview encoded',flush=True)
    if not all((MEDIA/f'{clip}-preview.mp4').is_file() for clip in CLIPS):
        raise RuntimeError('All eight review clips must exist before combining the showcase')
    listing=MEDIA/'showcase-concat.txt'
    listing.write_text(''.join(f"file '{clip}-preview.mp4'\n" for clip in CLIPS))
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(MEDIA/'Spirit Showcase.mp4')],check=True)
    print(MEDIA/'Spirit Showcase.mp4')


if __name__=='__main__':build()

