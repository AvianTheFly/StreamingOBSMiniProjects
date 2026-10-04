"""Finite channel trailer exporter. Read-only originals; bounded shared media jobs."""
from pathlib import Path
import hashlib
import json
import os
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib.json_store import write_json
from lib.media_jobs import jobs
from stream_brand.trailer.timeline import validate
from stream_brand.trailer.soundtrack import compose


def run(args, kind, timeout=300):
    result = jobs.run(args, kind=kind, weight=1, timeout=timeout, text=True)
    if result.returncode:
        raise RuntimeError(f'{kind}: {result.stderr[-3000:]}')
    return result


def probe(source):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format',
                           '-of', 'json', str(source)], 'trailer-probe', 30).stdout)


def fingerprint(source):
    digest = hashlib.sha256()
    with open(source, 'rb') as file:
        for block in iter(lambda: file.read(1024*1024), b''):
            digest.update(block)
    return digest.hexdigest()


def parse_loudness(stderr):
    # FFmpeg can append its final muxing summary after the filter's JSON block.
    start = stderr.rfind('{')
    if start < 0:
        raise ValueError('FFmpeg did not return a loudness measurement')
    result, _ = json.JSONDecoder().raw_decode(stderr[start:])
    if not {'input_i', 'input_tp', 'input_lra'} <= result.keys():
        raise ValueError('Incomplete loudness measurement')
    return result


def encode_segment(segment, destination):
    frames = segment['frames']
    args = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-threads', '1']
    if segment['kind'] == 'video':
        args += ['-ss', str(segment.get('start', 0)), '-i', segment['source']]
        video = 'fps=60,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p'
    else:
        args += ['-i', segment['source']]
        video = f"zoompan=z='1+.022*on/{frames}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={frames}:s=1920x1080:fps=60,setsar=1,format=yuv420p"
    if segment['has_audio']:
        audio_map = '0:a:0'
    else:
        args += ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
        audio_map = '1:a:0'
    args += ['-map', '0:v:0', '-map', audio_map, '-vf', video,
             '-af', 'loudnorm=I=-19:TP=-3:LRA=7,aresample=48000',
             '-filter_threads', '1', '-filter_complex_threads', '1',
             '-frames:v', str(frames), '-t', str(frames/60), '-r', '60',
             '-c:v', 'libx264', '-threads', '1', '-preset', 'veryfast', '-crf', '20',
             '-maxrate', '9000k', '-bufsize', '9000k',
             '-pix_fmt', 'yuv420p', '-g', '120', '-c:a', 'aac', '-b:a', '192k',
             '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(destination)]
    run(args, 'trailer-segment', 600)


def verify(destination, expected_frames):
    info = probe(destination)
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in info['streams'] if s['codec_type'] == 'audio')
    if (video['codec_name'], video['width'], video['height'], video['r_frame_rate']) != ('h264', 1920, 1080, '60/1'):
        raise RuntimeError('Unexpected delivery picture format')
    if int(video.get('nb_frames', 0)) != expected_frames:
        raise RuntimeError('Unexpected timeline frame count')
    if audio['codec_name'] != 'aac' or audio['channels'] != 2 or audio['sample_rate'] != '48000':
        raise RuntimeError('Unexpected delivery audio format')
    if float(info['format']['duration']) > 60 or int(info['format']['bit_rate']) > 10000000:
        raise RuntimeError('Delivery exceeds Twitch trailer duration or bitrate limits')
    run(['ffmpeg', '-nostdin', '-v', 'error', '-threads', '1', '-i', str(destination),
         '-map', '0:v:0', '-map', '0:a:0', '-threads', '1', '-f', 'null', '-'],
        'trailer-full-decode', 300)
    measured = run(['ffmpeg', '-nostdin', '-v', 'info', '-threads', '1', '-i', str(destination),
                    '-vn', '-af', 'loudnorm=I=-16:TP=-1:LRA=9:print_format=json',
                    '-filter_threads', '1', '-f', 'null', '-'], 'trailer-loudness-check', 120)
    loudness = parse_loudness(measured.stderr)
    if not (-18 <= float(loudness['input_i']) <= -14) or float(loudness['input_tp']) > -.1:
        raise RuntimeError('Delivery audio is outside the authored loudness/peak range')
    return {'duration': float(info['format']['duration']), 'frames': int(video['nb_frames']),
            'width': video['width'], 'height': video['height'], 'fps': video['r_frame_rate'],
            'audio': audio['codec_name'], 'bit_rate': int(info['format']['bit_rate']),
            'bytes': destination.stat().st_size,
            'video_codec': video['codec_name'], 'audio_sample_rate': int(audio['sample_rate']),
            'integrated_lufs': float(loudness['input_i']), 'true_peak_dbfs': float(loudness['input_tp'])}


def main():
    plan = json.loads(Path(__file__).with_name('plan.json').read_text(encoding='utf-8'))
    segments, frame_count = validate(plan, ROOT, probe)
    output = Path(plan['output_dir']).resolve()
    output.mkdir(parents=True, exist_ok=True)
    work = output / ('render-' + uuid.uuid4().hex[:12])
    work.mkdir()
    sources = {s['source']: fingerprint(s['source']) for s in segments}
    files = []
    for index, segment in enumerate(segments):
        path = work / f'{index:02d}.mp4'
        encode_segment(segment, path)
        files.append(path)
        print(json.dumps({'segment': segment['id'], 'complete': index+1, 'of': len(segments)}), flush=True)
    listing = work / 'concat.txt'
    listing.write_text(''.join("file '" + p.as_posix().replace("'", "'\\''") + "'\n"
                              + f"duration {segment['frames']/60}\n"
                              for p, segment in zip(files, segments)), encoding='utf-8')
    joined = work / 'timeline.mp4'
    run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0',
         '-i', str(listing), '-c', 'copy', str(joined)], 'trailer-assemble')
    score = work / 'original-score.wav'
    with jobs.slot('trailer-score', weight=1):
        score_info = compose(score, frame_count/60)
    score_info['file'] = str(score)
    results = {}
    for variant in ('music', 'voice-review'):
        temporary = work / ('channel-trailer-' + variant + '.mp4')
        audio = ('[1:a]loudnorm=I=-16:TP=-1:LRA=9,aresample=48000[a]' if variant == 'music' else
                 '[0:a]volume=1[voice];[1:a]volume=.28[bed];[voice][bed]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1:LRA=9,aresample=48000[a]')
        run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-threads', '1', '-i', str(joined),
             '-i', str(score), '-filter_complex_threads', '1', '-filter_complex', audio,
             '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
             '-ar', '48000', '-ac', '2', '-t', str(frame_count/60), '-movflags', '+faststart',
             str(temporary)], 'trailer-audio-delivery')
        results[variant] = verify(temporary, frame_count)
        destination = output / temporary.name
        os.replace(temporary, destination)
        results[variant]['file'] = str(destination)
    if any(fingerprint(source) != digest for source, digest in sources.items()):
        raise RuntimeError('A source changed during rendering; review this export before use')
    write_json(output / 'trailer-manifest.json', {
        'title': plan['title'], 'segments': segments, 'source_sha256': sources,
        'score': score_info, 'deliveries': results,
        'publication': 'Local review only. No Twitch upload was performed.',
        'voice_review': 'Original mixed source audio is retained; listen before publishing.'
    })
    print(json.dumps({'output': str(output), 'deliveries': results}), flush=True)


if __name__ == '__main__':
    main()
