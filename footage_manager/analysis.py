"""Finite archive analysis jobs. Persistence is published only after source revalidation."""
import math
from footage_manager.jobs import JobContinuation, JobYielded
try:
    from .media import check_cancelled, unchanged, Cancelled
    from .visual_analysis import VisualDetector, FrameReader
    from .temporal import detect_games
    from .audio_analysis import analyze_audio
    from .analysis_store import AnalysisStore, VERSION
    from .analysis_cache import cache_path, read, save, content_hash
    from .analysis_sampling import desktop_transition_times, game_refinement_times
    from .analysis_migrations import upgraded_samples, prior_visual_work
except ImportError:
    from media import check_cancelled, unchanged, Cancelled
    from visual_analysis import VisualDetector, FrameReader
    from temporal import detect_games
    from audio_analysis import analyze_audio
    from analysis_store import AnalysisStore, VERSION
    from analysis_cache import cache_path, read, save, content_hash
    from analysis_sampling import desktop_transition_times, game_refinement_times
    from analysis_migrations import upgraded_samples, prior_visual_work


def candidates(store, ids=None):
    from footage_manager.review_pool import candidates as review_candidates
    videos=store.rows("SELECT * FROM videos WHERE availability='online' AND duration>=600 AND error='' ORDER BY duration ASC")
    videos=review_candidates(videos)
    return [v for v in videos if ids is None or v['id'] in {int(i) for i in ids}]


def reuse_identical(store, video, job, options):
    """Share observations only after full-file identity and both source signatures pass."""
    repository=AnalysisStore(store)
    possible=repository.duplicate_candidates(video,options)
    if not possible:
        return None
    digest=content_hash(store.directory,video,job)
    for candidate,result in possible:
        try:
            unchanged(candidate)
        except (OSError,ValueError):
            continue
        if content_hash(store.directory,candidate,job)!=digest:
            continue
        unchanged(candidate)
        unchanged(video)
        result['verified_duplicate']={'video_id':candidate['id'],'sha256':digest}
        repository.save(video,options,result)
        return {'video_id':video['id'],'games':len(result['games']),'replays':len(result['replays']),
                'reused_analysis':True,'verified_from':candidate['id']}
    return None


def analyze_video(store, video, job, options, detector=None):
    source=unchanged(video)
    step=float(options.get('sample_seconds',10))
    if not math.isfinite(step) or not 2 <= step <= 60:
        raise ValueError('Visual interval must be from 2 to 60 seconds')
    quick=step>=30
    refinement_interval=10 if quick else 2
    detector=detector or VisualDetector()
    checkpoint=cache_path(store.directory,video,'visual-v10',{'sample_seconds':step})
    samples={s.get('requested_time',s['time']):s for s in read(checkpoint).get('observations',[])}
    previous_samples,refresh_times=prior_visual_work(store,video,step)
    samples={**previous_samples,**samples}
    reader=FrameReader(source,video['duration'])
    def observe(second):
        frame=reader.frame(second)
        actual=getattr(reader,'actual_time',second)
        observation=detector.observe(frame,actual)
        if actual!=second:
            observation['requested_time']=second
        return observation
    try:
        if hasattr(detector,'context'):
            context_times=sorted(t for t,s in samples.items() if s.get('playback_context')!=1)
            for index,second in enumerate(context_times):
                check_cancelled()
                job['progress']=f'Check browser playback context {index+1}/{len(context_times)} · {video["name"]}'
                samples[second]={**samples[second],**detector.context(reader.frame(second))}
                if index%50==0:
                    save(checkpoint,{'observations':list(samples.values())})
        remaining=sorted(refresh_times-set(samples))
        for index,second in enumerate(remaining):
            check_cancelled()
            job['progress']=f'Validate result-screen context {index+1}/{len(remaining)} · {video["name"]}'
            samples[second]=observe(second)
            if index%20==0:
                save(checkpoint,{'observations':list(samples.values())})
        for second in range(0,math.ceil(video['duration']),math.ceil(step)):
            check_cancelled()
            second=min(second,max(0,video['duration']-.2))
            if second in samples:
                continue
            job['progress']=f'Visual analysis {second/video["duration"]:.0%} · {video["name"]}'
            samples[second]=observe(second)
            if len(samples)%50==0:
                save(checkpoint,{'observations':list(samples.values())})
        initial,excluded=detect_games(list(samples.values()),video['duration'],step)
        # Refine boundaries and the first five game minutes without decoding whole files at full FPS.
        times=game_refinement_times(samples.values(),initial,excluded,video['duration'],step,
                                    interval=refinement_interval)
        # Replays get a local dense pass too, so their transitions can be excluded precisely.
        for s in list(samples.values()):
            if s.get('replay'):
                times.update(range(max(0,int(s['time']-step)),min(math.ceil(video['duration']),int(s['time']+step)+1),refinement_interval))
        remaining=sorted(times-set(samples))
        for index,second in enumerate(remaining):
            check_cancelled()
            second=min(second,max(0,video['duration']-.2))
            job['progress']=f'Refine boundaries / early KDA {index+1}/{len(remaining)} · {video["name"]}'
            samples[second]=observe(second)
            if index%50==0:
                save(checkpoint,{'observations':list(samples.values())})
        # A Nexus/no-HUD transition can last less than a second before Alt-Tab.
        # Inspect only nearby game-to-desktop gaps, retaining their checkpoints.
        for fine in (() if quick else (False, True)):
            probes=desktop_transition_times(samples.values(),initial,step,fine=fine)
            remaining=sorted(probes-set(samples))
            for index,second in enumerate(remaining):
                check_cancelled()
                job['progress']=f'Inspect brief game / desktop transition {index+1}/{len(remaining)} · {video["name"]}'
                samples[second]=observe(second)
                if index%20==0:
                    save(checkpoint,{'observations':list(samples.values())})
    finally:
        reader.close()
        save(checkpoint,{'observations':list(samples.values())})
    observations=sorted(samples.values(),key=lambda s:s['time'])
    games,replays=detect_games(observations,video['duration'],step)
    audio=analyze_audio(video,games,replays,store.directory,job,options.get('audio_track','auto')) if games and options.get('audio',True) else {'label':'Not analyzed'}
    unchanged(video)
    result={'games':games,'replays':replays,'audio':audio,'observations':observations,'version':VERSION,
            'sample_seconds':step,'buffer_seconds':60,'warnings':['Shorter replays or transient screens can fall between visual samples; uncertain boundaries are shown for review.']+getattr(reader,'warnings',[])}
    AnalysisStore(store).save(video,options,result)
    return {'video_id':video['id'],'games':len(games),'replays':len(replays)}


class AnalysisBatch:
    """One recording per queue step; foreground jobs may interrupt at checkpoints."""
    def __init__(self, store, payload):
        self.store, self.payload = store, dict(payload)
        self.repository = AnalysisStore(store)
        self.videos = candidates(store,payload.get('ids'))
        self.options = {k:payload[k] for k in ('sample_seconds','audio_track','audio') if k in payload}
        self.results, self.errors = [], []
        self.index, self.detector = 0, None

    def result(self):
        return {'analyses':self.results,'errors':self.errors,'candidate_count':len(self.videos)}

    def can_reuse_current(self, old):
        if not old or old['stale']:
            return False
        if old['options']==self.options:
            return True
        step=float(self.options.get('sample_seconds',10))
        return (step>=30 and old.get('sample_seconds',10)<=step
                and all(old['options'].get(key,default)==self.options.get(key,default)
                        for key,default in (('audio',True),('audio_track','auto'))))

    def __call__(self, job):
        while self.index < len(self.videos):
            check_cancelled()
            video = self.videos[self.index]
            old = self.repository.load(video)
            if self.can_reuse_current(old) and not self.payload.get('force'):
                self.index += 1
                continue
            try:
                reused=None if self.payload.get('force') else reuse_identical(self.store,video,job,self.options)
                if reused is None:
                    if self.detector is None:
                        self.detector = VisualDetector()
                    reused=analyze_video(self.store,video,job,self.options,self.detector)
                self.results.append(reused)
            except (Cancelled,JobYielded):
                raise
            except Exception as exc:
                self.errors.append(f'{video["name"]}: {exc}')
            self.index += 1
            if self.index < len(self.videos):
                return JobContinuation(self,self.result())
        self.detector = None
        if self.errors:
            job['result'] = self.result()
            raise ValueError('\n'.join(self.errors))
        return self.result()


def analyze_library(store, payload, job):
    """Synchronous maintenance facade; the app uses resumable batch steps."""
    batch = AnalysisBatch(store,payload)
    while True:
        result = batch(job)
        if not isinstance(result,JobContinuation):
            return result
