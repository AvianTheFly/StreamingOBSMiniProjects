"""Finite, low-cost sketch exporter. No Hub runtime or source settings edits."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import argparse

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from lib.media_jobs import jobs
from stream_brand.intro.render import fingerprint
from stream_brand.sketch_journey.choreography import DURATION,FPS,WIDTH,HEIGHT,SCENES,REFERENCES
from stream_brand.sketch_journey.paint import Sketch

OUTPUT=Path('C:/StreamingMedia/ChannelPresentation/2026-10-03/spirit-journey-sketch-v1')
MUSIC=Path('C:/StreamingMedia/twitch downloads/CCR - Fortunate Son (MOONLGHT Remix).mp3')


def run(args):
    r=jobs.run(args,kind='spirit-sketch',weight=1,timeout=180,text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-2500:])
    return r


def export(sketch,output,stem,scenes,references,times,plan_name):
    output.mkdir(parents=True,exist_ok=True)
    before=fingerprint(MUSIC)
    silent=output/f'{stem}-silent.mp4'
    cmd=['ffmpeg','-nostdin','-v','error','-y','-f','rawvideo','-pixel_format','rgb24',
         '-video_size',f'{WIDTH}x{HEIGHT}','-framerate',str(FPS),'-i','pipe:0',
         '-an','-c:v','libx264','-threads','1','-preset','fast','-crf','22',
         '-pix_fmt','yuv420p','-movflags','+faststart',str(silent)]
    with jobs.slot('spirit-sketch-picture',weight=1),open(output/'encoder.log','wb') as log:
        child=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log,stdout=subprocess.DEVNULL,
            creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0)|getattr(subprocess,'BELOW_NORMAL_PRIORITY_CLASS',0))
        try:
            for fi in range(DURATION*FPS):
                child.stdin.write(sketch.render(fi/FPS).tobytes())
                if fi%(FPS*5)==0:
                    print(json.dumps(dict(rendered_seconds=fi/FPS,total_seconds=DURATION)),flush=True)
            child.stdin.close()
            if child.wait(timeout=60):
                raise RuntimeError((output/'encoder.log').read_text(errors='replace'))
        finally:
            if child.stdin and not child.stdin.closed:
                child.stdin.close()
            if child.poll() is None:
                child.terminate()
                try:child.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    child.kill();child.wait(timeout=2)
    final=output/f'{stem}-40s.mp4'
    run(['ffmpeg','-nostdin','-v','error','-y','-threads','1','-i',str(silent),'-i',str(MUSIC),
         '-map','0:v','-map','1:a','-c:v','copy','-filter_threads','1',
         '-af','afade=t=out:st=39.82:d=0.18,loudnorm=I=-16:TP=-1:LRA=9,aresample=48000',
         '-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-t','40','-movflags','+faststart',str(final)])
    for path in (silent,final):
        info=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]).stdout)
        v=next(s for s in info['streams'] if s['codec_type']=='video')
        if (v['width'],v['height'],v['r_frame_rate'],int(v['nb_frames']))!=(WIDTH,HEIGHT,'30/1',1200):
            raise ValueError('Wrong delivered sketch format')
        if abs(float(info['format']['duration'])-40)>.04:
            raise ValueError('Wrong delivered sketch duration')
        run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(path),'-threads','1','-f','null','-'])
    if fingerprint(MUSIC)!=before:
        raise RuntimeError('Source music changed')
    plan=dict(duration=40,fps=30,size=[WIDTH,HEIGHT],bpm=128,phase=.03,
              scenes=[dict(id=s[0],start=s[1],end=s[2],name=s[3],action=s[4],reference=references[s[0]]) for s in scenes],
              new_ai_images=getattr(sketch,'generated_image_count',0),music_source=str(MUSIC),music_start_seconds=0,music_sha256=before,
              full_decode='passed',frames=1200,source_unchanged=True)
    plan.update(getattr(sketch,'delivery_metadata',{}))
    (output/plan_name).write_text(json.dumps(plan,indent=2),encoding='utf-8')
    from PIL import Image,ImageDraw,ImageFont
    sheet=Image.new('RGB',(1280,((len(times)+2)//3)*270),'#f3f0e8')
    for j,t in enumerate(times):
        sheet.paste(sketch.render(t).resize((426,240)),((j%3)*426,(j//3)*270))
    draw=ImageDraw.Draw(sheet);font=ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',16)
    for j,t in enumerate(times):
        s=next(s for s in scenes if s[1]<=t<s[2])
        draw.text(((j%3)*426+10,(j//3)*270+245),f'{t:.1f}s / {s[3]}',font=font,fill='#29313a')
    sheet.save(output/'storyboard.jpg',quality=92)
    sketch.render(times[-2]).save(output/'poster.jpg',quality=92)
    build=output/'editable-source';build.mkdir(exist_ok=True)
    for path in Path(__file__).parent.glob('*'):
        if path.is_file():shutil.copy2(path,build/path.name)
    print(json.dumps(dict(complete=True,file=str(final),bytes=final.stat().st_size,frames=1200,full_decode='passed')),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--concept',choices=('journey','escape','cinematic','illustrated','motion','art'),default='journey')
    parser.add_argument('--art-dir',type=Path,help='Generated asset directory for the cinematic art pass')
    args=parser.parse_args()
    if args.concept=='art':
        from .art_paint import CinematicArtSketch
        from .art_assets import ART_ROOT
        from .art_timeline import SCENES as scenes,REFERENCES as refs,REVIEW_TIMES,BEAR_CONTACT
        output=OUTPUT.parent/'spirit-cinematic-art-v1'
        export(CinematicArtSketch(args.art_dir or ART_ROOT),output,'spirit-cinematic-art-v1',scenes,refs,REVIEW_TIMES,'cinematic-plan.json')
        from .motion_audio import mix_movie
        print(json.dumps(dict(contact_audio=mix_movie(output,'spirit-cinematic-art-v1','cinematic-plan.json',BEAR_CONTACT+.055))),flush=True)
    elif args.concept=='motion':
        from stream_brand.sketch_journey.motion_paint import MotionSketch
        from stream_brand.sketch_journey.motion_timeline import SCENES as scenes, REFERENCES as refs, REVIEW_TIMES
        output=OUTPUT.parent/'spirit-motion-mvp-v5'
        export(MotionSketch(),output,'spirit-motion-mvp',scenes,refs,REVIEW_TIMES,'motion-plan.json')
        from stream_brand.sketch_journey.motion_audio import mix_movie
        print(json.dumps(dict(contact_audio=mix_movie(output))),flush=True)
    elif args.concept=='illustrated':
        from stream_brand.sketch_journey.illustrated_paint import IllustratedSketch
        from stream_brand.sketch_journey.illustrated_timeline import SCENES as scenes, REFERENCES as refs, REVIEW_TIMES
        output=OUTPUT.parent/'spirit-illustrated-mvp-v4'
        export(IllustratedSketch(),output,'spirit-colour-motion',scenes,refs,REVIEW_TIMES,'illustrated-plan.json')
    elif args.concept=='cinematic':
        from stream_brand.sketch_journey.cinematic_paint import CinematicSketch
        from stream_brand.sketch_journey.cinematic_timeline import SCENES as scenes, REFERENCES as refs, REVIEW_TIMES
        output=OUTPUT.parent/'spirit-cinematic-sketch-v3'
        export(CinematicSketch(),output,'spirit-cinematic-sketch',scenes,refs,REVIEW_TIMES,'cinematic-plan.json')
    elif args.concept=='escape':
        from stream_brand.sketch_journey.escape_paint import EscapeSketch
        from stream_brand.sketch_journey.escape_choreography import SCENES as scenes, REFERENCES as refs, REVIEW_TIMES
        output=OUTPUT.parent/'spirit-sanctuary-sketch-v2'
        export(EscapeSketch(),output,'spirit-sanctuary-sketch',scenes,refs,REVIEW_TIMES,'escape-plan.json')
    else:
        export(Sketch(),OUTPUT,'spirit-journey-sketch',SCENES,REFERENCES,
               [2,8.5,11.4,15.8,21.7,24.4,29.5,34.8,38.8],'journey-plan.json')


if __name__=='__main__':main()
