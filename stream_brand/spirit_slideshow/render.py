"""One finite image-slideshow export through the shared media-job budget."""
from pathlib import Path
import argparse
import json
import shutil
import time
from lib.media_jobs import jobs
from .timeline import load_plan, concat_text, fingerprint
from .presentation import sheets, gallery

SOURCE = Path(__file__).parent
OUTPUT = Path('C:/StreamingMedia/ChannelPresentation/2026-10-03/spirit-slideshow-v1')
STEM = 'sanctuary-slideshow'


def run(args, kind, timeout=300):
    result = jobs.run(args, kind=kind, weight=1, timeout=timeout, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])
    return result


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format',
                         '-of', 'json', str(path)], 'slideshow-probe', 30).stdout)


def verify(path, plan, audio):
    info = probe(path)
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    assert (video['width'], video['height'], video['r_frame_rate'], int(video['nb_frames'])) == (
        plan['width'], plan['height'], '25/1', plan['frames'])
    assert abs(float(info['format']['duration']) - 40) < .04
    if audio:
        sound = next(s for s in info['streams'] if s['codec_type'] == 'audio')
        assert (sound['sample_rate'], sound['channels']) == ('48000', 2)
    run(['ffmpeg', '-nostdin', '-v', 'error', '-threads', '1', '-i', str(path),
         '-threads', '1', '-f', 'null', '-'], 'slideshow-full-decode')
    return dict(size=[video['width'], video['height']], frames=int(video['nb_frames']),
                fps=25, duration_seconds=float(info['format']['duration']),
                bytes=path.stat().st_size, sha256=fingerprint(path), full_decode='passed')


def build(output=OUTPUT, plan_path=SOURCE/'timeline.json'):
    started = time.monotonic()
    output = Path(output).resolve()
    plan_path = Path(plan_path).resolve()
    source_root = plan_path.parent
    plan = load_plan(plan_path)
    music = Path(plan['music_source'])
    before = fingerprint(music)
    assert float(probe(music)['format']['duration']) >= 40
    output.mkdir(parents=True, exist_ok=True)
    (output / 'images').mkdir(exist_ok=True)
    for shot in plan['shots']:
        target = output / shot['file']
        source = source_root / shot['file']
        if source.resolve() != target.resolve():
            shutil.copy2(source, target)
        assert fingerprint(target) == shot['sha256']
    for name in ('timeline.json', 'generation-log.json'):
        if (source_root/name).resolve() != (output/name).resolve():
            shutil.copy2(source_root / name, output / name)
    # Deliver the actual final prompt set, including targeted continuity edits.
    shutil.copy2(source_root / 'generation-log.json', output / 'prompts.json')
    concat = output / 'slides.ffconcat'
    concat.write_text(concat_text(plan), encoding='utf-8')
    silent = output / f'{STEM}-silent-40s.mp4'
    encoding_started = time.monotonic()
    if plan.get('calm_edit'):
        from .calm import encode
        encode(output, plan, silent, run)
    else:
        run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-threads', '1', '-f', 'concat',
         '-safe', '0', '-i', str(concat), '-vf',
         f"scale={plan['width']}:{plan['height']}:flags=lanczos,setsar=1,fps=25",
         '-filter_threads', '1', '-frames:v', str(plan['frames']), '-an', '-c:v', 'libx264',
         '-threads', '1', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
         '-movflags', '+faststart', str(silent)], 'slideshow-encode')
    encode_seconds = round(time.monotonic()-encoding_started, 2)
    final = output / f'{STEM}-40s.mp4'
    run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-threads', '1', '-i', str(silent),
         '-threads', '1', '-i', str(music), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
         '-af', 'afade=t=out:st=39.82:d=0.18,loudnorm=I=-16:TP=-1:LRA=9,aresample=48000',
         '-filter_threads', '1', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
         '-t', '40', '-movflags', '+faststart', str(final)], 'slideshow-music')
    formats = {p.name: verify(p, plan, p == final) for p in (silent, final)}
    assert fingerprint(music) == before
    for shot in plan['shots']:
        assert fingerprint(source_root/shot['file']) == fingerprint(output/shot['file']) == shot['sha256']
    generation_log = json.loads((source_root/'generation-log.json').read_text(encoding='utf-8-sig'))
    calls = generation_log.get('new_generation_calls')
    if calls is None:
        # Older manifests have one selected-image entry, with edits recorded on it.
        calls = sum(1 + (len(item['edits']) if item.get('edits') else
                        int(bool(item.get('continuity_edit')))) for item in generation_log['images'])
    plan.update(generation_mode='built-in image_gen', selected_image_count=len(plan['shots']),
                generation_calls=calls, source_root=str(source_root),
                music_sha256=before, source_music_unchanged=True,
                transitions=('stationary pictures; 0.36-second opacity dissolves; subdued video highlights'
                             if plan.get('calm_edit') else 'hard cuts; each picture holds unchanged'),
                picture_encoding_seconds=encode_seconds, full_decode='passed',
                formats=formats)
    (output / 'slideshow-plan.json').write_text(json.dumps(plan, indent=2), encoding='utf-8')
    sheets(output, plan)
    gallery(output, plan)
    with (output/plan.get('poster', 'images/30-wings-unfurl.png')).open('rb') as image:
        (output/'poster.png').write_bytes(image.read())
    print(json.dumps(dict(movie=str(final), selected_images=len(plan['shots']), duration=40,
                          encode_seconds=encode_seconds,
                          assembly_and_decode_seconds=round(time.monotonic()-started, 2),
                          full_decode='passed')), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--plan', type=Path, default=SOURCE/'timeline.json')
    args = parser.parse_args()
    build(args.output, args.plan)
