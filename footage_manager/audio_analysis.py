"""Chunked speech activity and speech-only loudness relative to each game's median."""
import json
import math
import tempfile
from pathlib import Path

try:
    from .media import run, check_cancelled
    from .analysis_cache import cache_path, read, save
    from .scoring import spike_signal
except ImportError:
    from media import run, check_cancelled
    from analysis_cache import cache_path, read, save
    from scoring import spike_signal


def select_track(video, requested=None):
    tracks = [s for s in json.loads(video['streams']) if s['type']=='audio']
    if not tracks:
        return None, 'No audio track'
    if requested is not None and requested != 'auto':
        index = int(requested)
        if not 0 <= index < len(tracks):
            raise ValueError('Audio track does not exist')
    else:
        index = next((i for i,s in enumerate(tracks) if any(word in str(s.get('tags',{})).lower() for word in ('mic','microphone','voice'))),0)
    isolated = any(word in str(tracks[index].get('tags',{})).lower() for word in ('mic','microphone'))
    return index, 'Microphone track' if isolated else 'Mixed audio — speech estimate includes other voices'


def summarize(bins, start, end, replays=()):
    import numpy as np
    selected = [b for b in bins if start <= b['time'] < end and not any(r['start']<=b['time']<=r['end'] for r in replays)]
    voiced = [b['db'] for b in selected if b['speech']>.15 and b['db']>-65]
    baseline = float(np.median(voiced)) if voiced else None
    spread = float(np.median(np.abs(np.array(voiced)-baseline))) if voiced else 0
    threshold = max(6.0,spread*2.5)
    spikes=[]
    for b in selected:
        if baseline is not None and b['speech']>.2 and b['db']-baseline>=threshold:
            if spikes and b['time']-spikes[-1]['end']<=2:
                spikes[-1]['end']=min(end,b['time']+1)
                spikes[-1]['above_baseline_db']=max(spikes[-1]['above_baseline_db'],round(b['db']-baseline,2))
            else:
                spikes.append({'kind':'voice_spike','time':b['time'],'start':max(start,b['time']-8),'end':min(end,b['time']+1),
                               'above_baseline_db':round(b['db']-baseline,2),'label':'Voice intensity spike'})
    speech_seconds=sum(b['speech'] for b in selected)
    ratio=speech_seconds/max(1,len(selected))
    strength=max((s['above_baseline_db'] for s in spikes),default=0)
    return {'speaking_seconds':round(speech_seconds,1),'speaking_fraction':round(ratio,4),
            'baseline_db':round(baseline,2) if baseline is not None else None,'spike_threshold_db':round(threshold,2),
            'spike_count':len(spikes),'strongest_spike_db':strength,
            'speaking':ratio,'voice_spikes':spike_signal(spikes,len(selected))},spikes


def analyze_audio(video, games, replays, directory, job, requested='auto'):
    import numpy as np
    from faster_whisper.vad import get_speech_timestamps, VadOptions
    track,label=select_track(video,requested)
    if track is None:
        return {'label':label,'track':None}
    checkpoint=cache_path(directory,video,'silero-speech-v1',{'track':track})
    cache=read(checkpoint)
    bins=cache.get('bins',[])
    completed=cache.get('completed_seconds',0)
    # Older checkpoints covered a contiguous prefix. New checkpoints may have
    # holes because hours between games do not contribute to any game metric.
    # Keep actual coverage so a later boundary adjustment can fill those holes.
    completed_chunks=set(cache.get('completed_chunks',range(0,math.ceil(completed),300)))
    # At most five minutes of mono audio in memory; no full-stream WAV/cache duplication.
    with tempfile.TemporaryDirectory(prefix='speech-',dir=directory) as temporary:
        for start in range(0,math.ceil(video['duration']),300):
            check_cancelled()
            seconds=min(300,video['duration']-start)
            if start in completed_chunks or not any(
                    g['start']<start+seconds and g['end']>start for g in games):
                continue
            job['progress']=f'Speech analysis {start/60:.0f}/{video["duration"]/60:.0f} min · {video["name"]}'
            target=Path(temporary)/'chunk.f32'
            run(['ffmpeg','-nostdin','-v','error','-threads','2','-ss',str(start),'-i',video['path'],'-t',str(seconds),
                 '-map',f'0:a:{track}','-vn','-ac','1','-ar','16000','-f','f32le','-y',str(target)],max(90,seconds*2))
            audio=np.fromfile(target,dtype=np.float32)
            speech=get_speech_timestamps(audio,VadOptions(threshold=.6,min_speech_duration_ms=200,speech_pad_ms=0))
            for offset in range(math.ceil(len(audio)/16000)):
                a,b=offset*16000,min(len(audio),(offset+1)*16000)
                voiced=[]
                count=0
                for segment in speech:
                    left,right=max(a,segment['start']),min(b,segment['end'])
                    if right>left:
                        count+=right-left
                        voiced.append(audio[left:right])
                rms=float(np.sqrt(np.mean(np.concatenate(voiced)**2))) if voiced else 0
                bins.append({'time':start+offset,'speech':count/16000,'db':20*math.log10(max(rms,1e-8))})
            completed_chunks.add(start)
            contiguous=0
            while contiguous<video['duration'] and contiguous in completed_chunks:
                contiguous=min(video['duration'],contiguous+300)
            save(checkpoint,{'bins':bins,'completed_seconds':contiguous,
                             'completed_chunks':sorted(completed_chunks)})
    # Filling an earlier skipped chunk can append bins out of source order.
    # Burst merging always consumes chronological seconds.
    bins.sort(key=lambda b:b['time'])
    for g in games:
        metrics,spikes=summarize(bins,g['start'],g['end'],replays)
        g['metrics'].update(metrics)
        g['moments'].extend(spikes)
        g['audio_label']=label
    return {'track':track,'label':label,'seconds_analyzed':len(bins),
            'scope':'Five-minute chunks overlapping detected games'}
