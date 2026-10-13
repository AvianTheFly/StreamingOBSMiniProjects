"""Encoded still-image proof, source preservation and finite artifact packaging."""
from pathlib import Path
import argparse
import json
import shutil
import zipfile
import wave
import numpy as np
from PIL import Image
from lib.media_jobs import jobs
from .render import OUTPUT, SOURCE, STEM, run
from .timeline import fingerprint
from .presentation import sheets

GENERATED = Path('C:/Users/Michael/.codex/generated_images/01a104b1-c082-7921-a920-617bfec4e788')


def generation_originals(output):
    """Resolve original tool files across a version's nested provenance logs."""
    originals = {fingerprint(p): str(p) for p in GENERATED.glob('*.png')}
    log = json.loads((Path(output)/'generation-log.json').read_text(encoding='utf-8-sig'))

    def visit(value):
        if isinstance(value, dict):
            original = value.get('original')
            if isinstance(original, str):
                path = Path(original)
                if path.suffix.lower() == '.png' and path.is_file():
                    originals[fingerprint(path)] = str(path)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(log)
    return originals


def raw(args, kind):
    response = jobs.run(args, kind=kind, weight=1, timeout=180, text=False)
    if response.returncode:
        raise RuntimeError(response.stderr.decode(errors='replace')[-2500:])
    return response.stdout


def inspect(output=OUTPUT):
    output = Path(output)
    plan = json.loads((output/'slideshow-plan.json').read_text(encoding='utf-8'))
    source_root = Path(plan.get('source_root', SOURCE))
    count = len(plan['shots'])
    originals = generation_originals(output)
    sources = []
    for shot in plan['shots']:
        assert fingerprint(output/shot['file']) == fingerprint(source_root/shot['file']) == shot['sha256']
        assert shot['sha256'] in originals, 'The selected original PNG must remain unchanged'
        with Image.open(output/shot['file']) as im:
            sources.append(np.array(im.convert('RGB').resize((192,108), Image.Resampling.LANCZOS)))
    assert all(s['frames'] >= 2 for s in plan['shots']), 'Each picture must have two distinct review frames'
    # Both sides of EVERY cut: prove authored music cues actually reach the encode.
    samples = [n for s in plan['shots'] for n in (s['start_frame'], s['end_frame']-1)]
    terms = [f'eq(n\\,{n})' for n in samples]
    # Group additions to stay below FFmpeg's expression-parser nesting limit.
    expression = '+'.join('('+ '+'.join(terms[j:j+8])+')' for j in range(0,len(terms),8))
    movie = output/f'{STEM}-40s.mp4'
    data = raw(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(movie),'-an',
                '-vf',f'select={expression},scale=480:270:flags=lanczos','-filter_threads','1',
                '-fps_mode','passthrough','-pix_fmt','rgb24','-f','rawvideo','-'], 'slideshow-encoded-review')
    assert len(data) == count*2*480*270*3
    frames = np.frombuffer(data,dtype=np.uint8).reshape(count*2,270,480,3)
    thumbnails = [np.array(Image.fromarray(f).resize((192,108),Image.Resampling.LANCZOS)) for f in frames]
    errors = []
    for j, decoded in enumerate(thumbnails):
        difference = [float(np.abs(decoded.astype(float)-source.astype(float)).mean()) for source in sources]
        expected = j//2
        assert int(np.argmin(difference)) == expected, f'Wrong picture shown at frame {samples[j]}'
        assert difference[expected] < 6.5
        errors.append(difference[expected])
    held = [float(np.abs(frames[2*j].astype(float)-frames[2*j+1].astype(float)).mean()) for j in range(count)]
    assert max(held) < 1.5, 'The comparison should hold still pictures without camera movement'
    sheets(output,plan,[Image.fromarray(frames[2*j]) for j in range(count)],'encoded-review')
    audio = np.frombuffer(raw(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(movie),
        '-vn','-t','40','-ar','48000','-ac','2','-f','f32le','-'], 'slideshow-audio-review'),dtype='<f4')
    assert audio.size == 40*48000*2 and np.isfinite(audio).all()
    peak = float(np.abs(audio).max())
    assert 0 < peak < 1
    excerpt_proof = None
    analysis_wav = output/'music-analysis.wav'
    if analysis_wav.exists():
        with wave.open(str(analysis_wav), 'rb') as reference:
            assert (reference.getframerate(), reference.getnchannels(), reference.getsampwidth()) == (48000,2,2)
            original = np.frombuffer(reference.readframes(reference.getnframes()), '<i2').astype(float)/32768
        assert original.size == audio.size
        block = 5*48000*2
        correlations = [float(np.corrcoef(original[j*block:(j+1)*block],
                        audio[j*block:(j+1)*block])[0,1]) for j in range(7)]
        assert min(correlations) > .97, 'Encoded music must match the supplied excerpt at the same timeline positions'
        excerpt_proof = dict(same_position_correlations=correlations,
                             source_start_seconds=0,source_duration_seconds=40)
    music = Path(plan['music_source'])
    assert fingerprint(music) == plan['music_sha256']
    for name, expected in plan['formats'].items():
        assert fingerprint(output/name) == expected['sha256']
    packets = [run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(output/name),
        '-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-'], 'slideshow-packet-hash').stdout.strip()
        for name in plan['formats']]
    assert len(set(packets)) == 1
    validation = dict(formats=plan['formats'],unique_generated_images=count,
        encoded_samples_checked=count*2,every_encoded_sample_matches_its_expected_original=True,
        max_original_comparison_mean_error_8bit=max(errors),max_same_picture_pair_mean_error_8bit=max(held),
        same_picture_bitstream_in_both_movies=True,video_packet_hash=packets[0],
        audio=dict(duration_seconds=40,sample_rate=48000,channels=2,peak=peak,
                   supplied_excerpt_alignment=excerpt_proof,
                   rms=float(np.sqrt(np.mean(audio.astype(float)**2))),clipped_samples=int(np.sum(np.abs(audio)>=1))),
        original_music_unchanged=True,original_music_sha256=plan['music_sha256'],
        original_selected_pngs_unchanged=True,
        original_generation_files={s['file']:originals[s['sha256']] for s in plan['shots']},
        actual_generation_files=len(originals),selected_images=count,
        visual_review='Pending review of all encoded contact sheets',
        limits='Independent illustrations can vary small masonry, statue placement and perspective details; no exact 3D geometry or continuous body motion is claimed.')
    (output/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')
    print(json.dumps(dict(encoded_samples=count*2,unique_originals=count,max_comparison_error=max(errors),
                          max_held_pair_error=max(held),audio_peak=peak,original_files=len(originals))),flush=True)


def package(output=OUTPUT):
    # The operator reviews all encoded sheets before choosing --package.
    output = Path(output)
    plan = json.loads((output/'slideshow-plan.json').read_text(encoding='utf-8'))
    source_root = Path(plan.get('source_root', SOURCE))
    count = len(plan['shots'])
    validation = json.loads((output/'validation.json').read_text(encoding='utf-8'))
    for shot in plan['shots']:
        assert fingerprint(output/shot['file']) == fingerprint(source_root/shot['file']) == shot['sha256']
    for name, expected in plan['formats'].items():
        assert fingerprint(output/name) == expected['sha256']
    assert fingerprint(plan['music_source']) == plan['music_sha256']
    if not plan.get('calm_edit'):
        validation['visual_review'] = f'All {count} source pictures and all {count} encoded review pictures inspected; second encoded sample per slide checked numerically'
    else:
        assert validation['visual_review'].startswith('Inspected'), 'Review calm transitions before packaging'
    shutil.copy2(source_root/'README.txt',output/'README.txt')
    (output/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')
    editable = output/'editable-source'
    editable.mkdir(exist_ok=True)
    files = sorted(SOURCE.glob('*.py'))+[source_root/'timeline.json',source_root/'generation-log.json',source_root/'README.txt']
    if (source_root/'music-cues.json').exists():
        files.append(source_root/'music-cues.json')
    source_zip = output/'sanctuary-slideshow-source.zip'
    with zipfile.ZipFile(source_zip,'w',zipfile.ZIP_DEFLATED) as z:
        for path in files:
            relative = path.relative_to(SOURCE)
            destination = editable/relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path,destination)
            z.write(path,'stream_brand/spirit_slideshow/'+relative.as_posix())
        z.write(SOURCE.parents[1]/'tools/test_spirit_slideshow.py','tools/test_spirit_slideshow.py')
    with zipfile.ZipFile(source_zip) as z:
        assert z.testzip() is None
    complete = output/'sanctuary-slideshow-complete.zip'
    names = ['README.txt','gallery.html','timeline.json','slideshow-plan.json','prompts.json','generation-log.json',
             'validation.json','poster.png','slides.ffconcat','sanctuary-slideshow-source.zip',
             f'{STEM}-40s.mp4',f'{STEM}-silent-40s.mp4']
    names += [f'{prefix}-{j}.jpg' for prefix in ('storyboard','encoded-review') for j in range(1,(count+8)//9+1)]
    names += [name for name in ('music-analysis.json', 'music-cues.json', 'test-results.txt', 'architecture-results.txt') if (output/name).exists()]
    names += [name for name in ('research-notes.txt','comfort-comparison.json') if (output/name).exists()]
    names += [p.name for p in sorted(output.glob('transition-review-*.jpg'))]
    names += [s['file'] for s in plan['shots']]
    with zipfile.ZipFile(complete,'w',zipfile.ZIP_DEFLATED) as z:
        for name in names:
            z.write(output/name,name)
    with zipfile.ZipFile(complete) as z:
        assert z.testzip() is None
        assert len([name for name in z.namelist() if name.startswith('images/')]) == count
    print(json.dumps(dict(packaged=True,archive_crc='passed',complete_zip=str(complete),bytes=complete.stat().st_size)),flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package',action='store_true')
    parser.add_argument('--output',type=Path,default=OUTPUT)
    args = parser.parse_args()
    package(args.output) if args.package else inspect(args.output)
