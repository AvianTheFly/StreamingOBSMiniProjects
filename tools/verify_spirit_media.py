"""Verify the decoded native files, including the actual encoded alpha plane."""
import json
import hashlib
from pathlib import Path
import os
import subprocess

MEDIA=Path(os.environ.get('SPIRIT_OUTPUT', 'C:/StreamingMedia/Transitions/udyr-spirits-v11'))/'production'


def verify():
    manifest=json.loads((MEDIA/"manifest.json").read_text())
    count=round(manifest["duration"]*manifest["fps"])
    start=round(manifest["opaque_from_ms"]*manifest["fps"]/1000)
    end=round(manifest["opaque_until_ms"]*manifest["fps"]/1000)
    results=[]
    expected={f'{spirit}{suffix}' for spirit in ('bear','turtle','ram','phoenix') for suffix in ('','-alt')}
    assert set(manifest['clips'])==expected, 'All eight independent performances must exist'
    for clip in manifest['clips']:
        spirit=clip.split('-')[0]
        config=manifest.get('animations',{}).get(spirit,{})
        start=round(config.get('coveredFrom',manifest['opaque_from_ms']/1000)*manifest['fps'])
        end=round(config.get('coveredUntil',manifest['opaque_until_ms']/1000)*manifest['fps'])
        cut=config.get('cut',manifest['cut_ms']/1000)
        assert start+2 < cut*manifest['fps'] < end-2, 'Cut requires opaque-frame margins'
        file=MEDIA/f'{clip}.webm'
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(file)]))
        video=next(s for s in probe['streams'] if s['codec_type']=='video')
        assert (video['width'],video['height'],video['r_frame_rate'])==(1920,1080,'60/1')
        assert {k.lower():v for k,v in video.get('tags',{}).items()}.get('alpha_mode')=='1'
        assert abs(float(probe['format']['duration'])-manifest['duration'])<.05
        raw=subprocess.check_output(['ffmpeg','-v','error','-c:v','libvpx-vp9','-i',str(file),
            # Nearest sampling avoids bicubic border overshoot in gray alpha maps.
            '-vf','alphaextract,scale=64:36:flags=neighbor','-f','rawvideo','-pix_fmt','gray','pipe:1'])
        frame_bytes=64*36
        frames=[raw[n:n+frame_bytes] for n in range(0,len(raw),frame_bytes)]
        assert len(frames)==count
        assert max(frames[0])==max(frames[-1])==0
        assert all(min(f)==255 for f in frames[start:end+1]), 'Encoded cut plateau has holes'
        plateau=subprocess.check_output(['ffmpeg','-v','error','-threads','4','-c:v','libvpx-vp9','-i',str(file),
            '-vf',f'select=between(n\\,{start}\\,{end}),alphaextract','-fps_mode','passthrough',
            '-f','rawvideo','-pix_fmt','gray','pipe:1'])
        assert len(plateau)==1920*1080*(end-start+1) and min(plateau)==255, 'Full-resolution encoded plateau has holes'
        assert max(frames[96])>0, 'Missing continuous buildup'
        assert min(frames[330])<255, 'Missing reveal'
        results.append({'clip':clip,'frames':len(frames),'full_resolution_opaque_frames':end-start+1,'cut_window_alpha':255,'transparent_boundaries':True,
                        'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'covered_from':config['coveredFrom'],'covered_until':config['coveredUntil']})
        print(f'{clip}: encoded alpha, cut plateau, reveal, {count} frames verified',flush=True)
    (MEDIA/'encoded-validation.json').write_text(json.dumps(results,indent=2))


if __name__=='__main__':verify()

