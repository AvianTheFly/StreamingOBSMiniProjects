"""Finite intro exporter. Generated art and source music stay read-only."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from lib.media_jobs import jobs
from stream_brand.intro.audio import analyze, compose_effects
from stream_brand.intro.cinema import Cinema
from stream_brand.intro.timeline import validate


def run(args, kind, timeout=300):
    result=jobs.run(args,kind=kind,weight=1,timeout=timeout,text=True)
    if result.returncode:
        raise RuntimeError(f'{kind}: {result.stderr[-3000:]}')
    return result


def fingerprint(path):
    digest=hashlib.sha256()
    with open(path,'rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):
            digest.update(block)
    return digest.hexdigest()


def probe(path):
    return json.loads(run(['ffprobe','-v','error','-show_streams','-show_format',
                          '-of','json',str(path)],'intro-probe',30).stdout)


def export_picture(cinema, plan, path, frames):
    args=['ffmpeg','-nostdin','-v','error','-y','-f','rawvideo','-pixel_format','rgb24',
          '-video_size',f"{plan['width']}x{plan['height']}",'-framerate',str(plan['fps']),
          '-i','pipe:0','-an','-c:v','libx264','-threads','1','-preset','fast','-crf','18',
          '-pix_fmt','yuv420p','-g','120','-movflags','+faststart',str(path)]
    log=path.with_suffix('.encoder.log')
    start=time.monotonic()
    # A single finite renderer and encoder own this source until final process cleanup.
    with jobs.slot('intro-picture',weight=2), open(log,'wb') as errors:
        process=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,
            stderr=errors,creationflags=(getattr(subprocess,'CREATE_NO_WINDOW',0)|
                                        getattr(subprocess,'BELOW_NORMAL_PRIORITY_CLASS',0)))
        try:
            for fi in range(frames):
                process.stdin.write(cinema.render(fi).tobytes())
                if fi%120==0:
                    print(json.dumps(dict(rendered=fi,total=frames,
                                          elapsed_seconds=round(time.monotonic()-start,1))),flush=True)
            process.stdin.close()
            if process.wait(timeout=120):
                raise RuntimeError(log.read_text(errors='replace')[-2000:])
        finally:
            if process.stdin and not process.stdin.closed:
                try:
                    process.stdin.close()
                except BrokenPipeError:
                    pass
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=2)


def verify(path, plan, with_audio):
    info=probe(path)
    video=next(s for s in info['streams'] if s['codec_type']=='video')
    expected=round(plan['duration_seconds']*plan['fps'])
    if (video['codec_name'],video['width'],video['height'],video['r_frame_rate'],
        int(video.get('nb_frames',0))) != ('h264',plan['width'],plan['height'],'60/1',expected):
        raise ValueError('Unexpected delivered picture format or frame count')
    if abs(float(info['format']['duration'])-plan['duration_seconds'])>.03:
        raise ValueError('Unexpected delivered duration')
    if with_audio:
        audio=next(s for s in info['streams'] if s['codec_type']=='audio')
        if (audio['codec_name'],audio['sample_rate'],audio['channels']) != ('aac','48000',2):
            raise ValueError('Unexpected delivered audio format')
    run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(path),
         '-threads','1','-f','null','-'],'intro-full-decode',300)
    result=dict(file=str(path),width=video['width'],height=video['height'],
        frames=expected,fps=60,duration_seconds=float(info['format']['duration']),
        bytes=path.stat().st_size,sha256=fingerprint(path),full_decode='passed')
    if with_audio:
        response=run(['ffmpeg','-nostdin','-v','info','-threads','1','-i',str(path),'-vn',
                      '-af','loudnorm=I=-16:TP=-1:LRA=9:print_format=json',
                      '-filter_threads','1','-f','null','-'],'intro-audio-check',120)
        index=response.stderr.rfind('{')
        loudness=json.JSONDecoder().raw_decode(response.stderr[index:])[0]
        result['integrated_lufs']=float(loudness['input_i'])
        result['true_peak_dbfs']=float(loudness['input_tp'])
        if result['true_peak_dbfs'] > -.05:
            raise ValueError('Delivered audio exceeds the permitted peak')
    return result


def review_frames(cinema,plan,output):
    from PIL import Image,ImageDraw,ImageFont
    indices=plan.get('review_frames',[90,240,390,510,720,900,1130,1250,1520,1710,2020,2300])
    rows=(len(indices)+2)//3
    sheet=Image.new('RGB',(1440,rows*298),(8,14,20))
    draw=ImageDraw.Draw(sheet)
    font=ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',18)
    for j,fi in enumerate(indices):
        frame=Image.fromarray(cinema.render(fi))
        x,y=(j%3)*480,(j//3)*298
        sheet.paste(frame.resize((480,270)),(x,y))
        shot=next(s for s in plan['shots'] if s['start_frame']<=fi<s['end_frame'])
        draw.text((x+12,y+275),f"{fi/60:.2f}s  /  {shot['asset'][3:].upper()}",font=font,fill='#b7ccce')
    sheet.save(output/'storyboard.jpg',quality=94)
    Image.fromarray(cinema.render(2290)).save(output/'poster.jpg',quality=95)
    if plan.get('pose_groups'):
        for name,assets in plan['pose_groups'].items():
            strip=Image.new('RGB',(480*len(assets),298),(8,14,20))
            caption=ImageDraw.Draw(strip)
            for j,asset in enumerate(assets):
                shot=next(s for s in plan['shots'] if s['asset']==asset)
                fi=shot['start_frame']+min(8,(shot['end_frame']-shot['start_frame'])//2)
                strip.paste(Image.fromarray(cinema.render(fi)).resize((480,270)),(480*j,0))
                caption.text((480*j+8,275),asset[3:].upper(),font=font,fill='#b7ccce')
            strip.save(output/(name+'-poses.jpg'),quality=94)


def main():
    parser=argparse.ArgumentParser(description='Render the authored forty-second Udyr intro')
    parser.add_argument('--output-dir')
    parser.add_argument('--plan',default=str(Path(__file__).with_name('plan.json')))
    parser.add_argument('--preview-only',action='store_true')
    parser.add_argument('--reuse-picture',action='store_true',
                        help='Explicitly reuse an existing verified picture after an audio-only change')
    args=parser.parse_args()
    plan=json.loads(Path(args.plan).read_text(encoding='utf-8'))
    output=Path(args.output_dir or plan['output_dir']).resolve()
    output.mkdir(parents=True,exist_ok=True)
    frames=validate(plan,output)
    source=Path(plan['music_source'])
    stem=plan.get('export_stem','udyr-rift-intro')
    if Path(stem).name!=stem or not stem or stem.startswith('.'):
        raise ValueError('Export name must be a safe filename stem')
    if source.resolve() in {(output/name).resolve() for name in (
            'music-first-40s.wav','spirit-effects-40s.wav',stem+'-40s.mp4',
            stem+'-picture-40s.mp4',stem+'-effects-only-40s.mp4')}:
        raise ValueError('Source music cannot be a generated delivery target')
    info=probe(source)
    if float(info['format']['duration']) < plan['music_start_seconds']+plan['duration_seconds']:
        raise ValueError('The source recording is shorter than the requested excerpt')
    sources=[source]+list((output/'art').glob('*.png'))
    hashes={str(p):fingerprint(p) for p in sources}
    cinema=Cinema(output,plan,(plan['width'],plan['height']))
    review_frames(cinema,plan,output)
    if args.preview_only:
        print('Preview frames complete',flush=True)
        return
    excerpt=output/'music-first-40s.wav'
    run(['ffmpeg','-nostdin','-v','error','-y','-threads','1','-ss',str(plan['music_start_seconds']),
         '-i',str(source),'-t',str(plan['duration_seconds']),'-vn','-ar','48000','-ac','2',
         '-c:a','pcm_s16le',str(excerpt)],'intro-audio-excerpt',60)
    analysis=analyze(excerpt,plan['duration_seconds'])
    (output/'audio-analysis.json').write_text(json.dumps(analysis,indent=2),encoding='utf-8')
    if abs(analysis['bpm']-plan['bpm']) > .3:
        raise ValueError('The supplied music tempo differs from the authored edit; review timing')
    impacts=[s['start_frame']/plan['fps'] for s in plan['shots']
             if s['transition'] in ('impact','finale')]
    transitions=[s['start_frame']/plan['fps'] for s in plan['shots'][1:]]
    effects=output/'spirit-effects-40s.wav'
    sfx=compose_effects(effects,plan['duration_seconds'],impacts,transitions)
    picture=output/(stem+'-picture-40s.mp4')
    if args.reuse_picture:
        verification=verify(picture,plan,False)
    else:
        temporary=output/'.picture-rendering.mp4'
        export_picture(cinema,plan,temporary,frames)
        verification=verify(temporary,plan,False)
        os.replace(temporary,picture)
    verification['file']=str(picture)
    deliveries={'picture':verification}
    for variant,filename in [('music',stem+'-40s.mp4'),
                              ('effects-only',stem+'-effects-only-40s.mp4')]:
        final=output/filename
        temporary=output/('.'+filename)
        cmd=['ffmpeg','-nostdin','-v','error','-y','-threads','1','-i',str(picture)]
        if variant=='music':
            cmd+=['-i',str(excerpt),'-i',str(effects)]
            audio=('[1:a]volume=.92[m];[2:a]volume=.42[s];'
                   '[m][s]amix=inputs=2:duration=first:normalize=0,'
                   f"afade=t=out:st={plan['duration_seconds']-.18}:d=0.18,"
                   'loudnorm=I=-16:TP=-1:LRA=9,aresample=48000[a]')
        else:
            cmd+=['-i',str(effects)]
            audio='[1:a]volume=.65,alimiter=limit=.9:level=false,aresample=48000[a]'
        cmd+=['-filter_complex_threads','1','-filter_complex',audio,
              '-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k',
              '-ar','48000','-ac','2','-t',str(plan['duration_seconds']),
              '-movflags','+faststart',str(temporary)]
        run(cmd,'intro-soundtrack-delivery',120)
        verified=verify(temporary,plan,True)
        os.replace(temporary,final)
        verified['file']=str(final)
        deliveries[variant]=verified
    for name,original in hashes.items():
        if fingerprint(name)!=original:
            raise RuntimeError('A source changed during rendering: '+name)
    manifest=dict(title=plan['title'],channel=plan['channel'],duration_seconds=plan['duration_seconds'],
        generated_source_pixels=[1672,941],composite_pixels=[1920,1080],
        technique=plan.get('technique','Generated still artwork, approximate depth parallax, alpha hero, camera paths, procedural atmosphere and original effects'),
        rigged_character_animation=False,video_generation_model_used=False,
        soundtrack=dict(source=str(source),start_seconds=plan['music_start_seconds'],end_seconds=plan['music_start_seconds']+plan['duration_seconds'],
                        source_sha256=hashes[str(source)],bpm=analysis['bpm']),
        original_effects=sfx,originals_unchanged=True,source_hashes=hashes,
        deliveries=deliveries,shots=plan['shots'],pose_groups=plan.get('pose_groups',{}),
        assets=plan.get('assets',{}))
    (output/'delivery-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    build=output/'build'
    build.mkdir(exist_ok=True)
    for path in Path(__file__).parent.glob('*'):
        if path.is_file() and path.suffix in ('.py','.json','.md','.html'):
            shutil.copy2(path,build/path.name)
    print(json.dumps(dict(complete=True,deliveries=deliveries)),flush=True)


if __name__=='__main__':
    raise SystemExit(main())
