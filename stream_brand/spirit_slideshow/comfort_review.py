"""Audit encoded calm-edit holds, blends, audio and image-change measurements."""
from pathlib import Path
import argparse
import json
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from .calm import GRADE
from .render import STEM, run
from .review import raw, generation_originals
from .timeline import fingerprint
from .presentation import sheets


def frames(path):
    data = raw(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(path),'-an',
                '-vf','scale=320:180:flags=lanczos','-filter_threads','1','-pix_fmt','rgb24',
                '-f','rawvideo','-'], 'slideshow-calm-review')
    assert len(data) == 1000*320*180*3
    return np.frombuffer(data,np.uint8).reshape(1000,180,320,3)


def measurements(decoded):
    # These are pixel-change measurements, not a medical or accessibility test.
    change = np.array([np.abs(decoded[i].astype(np.int16)-decoded[i-1].astype(np.int16)).mean()
                       for i in range(1,len(decoded))])
    luma = decoded.mean(axis=(1,2,3))
    return dict(max_frame_rgb_change_8bit=float(change.max()),
                p99_frame_rgb_change_8bit=float(np.percentile(change,99)),
                max_frame_mean_brightness_change_8bit=float(np.abs(np.diff(luma)).max()),
                frames_with_mean_rgb_change_above_10=int(np.sum(change>10)))


def inspect(output, previous):
    output = Path(output)
    plan = json.loads((output/'slideshow-plan.json').read_text(encoding='utf-8'))
    originals = generation_originals(output)
    current = frames(output/f'{STEM}-40s.mp4')
    d = plan['calm_edit']['dissolve_frames']
    sources, errors, holds = [], [], []
    for shot in plan['shots']:
        assert fingerprint(output/shot['file']) == fingerprint(Path(plan['source_root'])/shot['file']) == shot['sha256']
        assert shot['sha256'] in originals
        data = raw(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(output/shot['file']),
                    '-vf',f'scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p,{GRADE},format=yuv420p,scale=320:180:flags=lanczos',
                    '-filter_threads','1','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'], 'slideshow-calm-reference')
        sources.append(np.frombuffer(data,np.uint8).reshape(180,320,3))
    for i, shot in enumerate(plan['shots']):
        start, end = shot['start_frame'], shot['end_frame']
        for local in ((0,4,9,15) if i else (0,15)):
            alpha = min(local/(d-1),1) if i else 1
            expected = sources[i].astype(float)*alpha
            if i:
                expected += sources[i-1].astype(float)*(1-alpha)
            error = float(np.abs(current[start+local].astype(float)-expected).mean())
            assert error < 4, f'Unexpected dissolve at {start+local}: {error}'
            errors.append(error)
        hold_error = float(np.abs(current[start+15].astype(float)-current[end-1].astype(float)).mean())
        assert hold_error < 1.5, f'Unwanted motion during stationary hold {i}'
        holds.append(hold_error)
    sheets(output,plan,[Image.fromarray(current[s['start_frame']+15]) for s in plan['shots']],'encoded-review')
    # Actual boundary frames, including blend midpoint and settled new picture.
    font = ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',16)
    for page in range(5):
        canvas = Image.new('RGB',(1280,1020),'#080f1b')
        draw = ImageDraw.Draw(canvas)
        for row, i in enumerate(range(page*5+1,min(page*5+6,len(plan['shots'])))):
            start = plan['shots'][i]['start_frame']
            for col, offset in enumerate((-1,0,4,9)):
                canvas.paste(Image.fromarray(current[start+offset]),(col*320,row*204))
                draw.text((col*320+6,row*204+182),f'{(start+offset)/25:.2f}s / boundary {i}',font=font,fill='#c6d5e5')
        canvas.save(output/f'transition-review-{page+1}.jpg',quality=94)
    new_stats = measurements(current)
    old_stats = measurements(frames(Path(previous)/f'{STEM}-40s.mp4'))
    assert new_stats['max_frame_rgb_change_8bit'] < old_stats['max_frame_rgb_change_8bit']*.5
    comparison = dict(previous=old_stats,calm=new_stats,previous_shots=58,calm_shots=len(plan['shots']),
                      minimum_shot_seconds=min(s['frames']/25 for s in plan['shots']),
                      interpretation='Measures pixel changes only; viewing comfort requires personal feedback.')
    (output/'comfort-comparison.json').write_text(json.dumps(comparison,indent=2),encoding='utf-8')
    audio = np.frombuffer(raw(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(output/f'{STEM}-40s.mp4'),
                              '-vn','-ar','48000','-ac','2','-f','f32le','-'], 'slideshow-calm-audio'),dtype='<f4')
    assert audio.size == 40*48000*2 and np.isfinite(audio).all() and 0 < np.abs(audio).max() < 1
    with wave.open(str(Path(previous)/'music-analysis.wav'),'rb') as reference:
        assert (reference.getframerate(),reference.getnchannels(),reference.getsampwidth()) == (48000,2,2)
        original = np.frombuffer(reference.readframes(reference.getnframes()),'<i2').astype(float)/32768
    block=5*48000*2
    correlations=[float(np.corrcoef(original[j*block:(j+1)*block],audio[j*block:(j+1)*block])[0,1]) for j in range(7)]
    assert min(correlations)>.97
    assert fingerprint(plan['music_source'])==plan['music_sha256']
    packet_hashes=[run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(output/name),
                       '-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-'], 'slideshow-calm-packet-hash').stdout.strip()
                   for name in plan['formats']]
    assert len(set(packet_hashes))==1
    validation=dict(formats=plan['formats'],selected_images=len(plan['shots']),
                    original_selected_pngs_unchanged=True,original_music_unchanged=True,
                    original_generation_files={s['file']:originals[s['sha256']] for s in plan['shots']},
                    audio=dict(peak=float(np.abs(audio).max()),same_position_correlations=correlations,
                               source_start_seconds=0,duration_seconds=40,clipped_samples=0),
                    stationary_hold_pairs_checked=len(holds),max_stationary_hold_error_8bit=max(holds),
                    dissolve_samples_checked=len(errors),max_dissolve_comparison_error_8bit=max(errors),
                    same_picture_bitstream_in_both_movies=True,comfort_comparison=comparison,
                    visual_review='Pending inspection of three encoded sheets and five actual transition strips',
                    limits='Independent illustrations and dissolves, not continuous 3D animation; comfort has not been confirmed by the viewer.')
    (output/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')
    print(json.dumps(dict(comparison=comparison,blend_error=max(errors),hold_error=max(holds),audio_alignment=min(correlations))),flush=True)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--previous',type=Path,required=True)
    args=parser.parse_args()
    inspect(args.output,args.previous)
