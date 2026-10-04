"""Public analysis contract used by HTTP adapters and maintenance tools."""
import importlib.util
import json
try:
    from .analysis_store import AnalysisStore
    from .analysis import candidates, AnalysisBatch
    from .scoring import METRICS, DEFAULT_WEIGHTS, rank
    from .temporal import intervals
except ImportError:
    from analysis_store import AnalysisStore
    from analysis import candidates, AnalysisBatch
    from scoring import METRICS, DEFAULT_WEIGHTS, rank
    from temporal import intervals


def summary(store, weights=None):
    repository=AnalysisStore(store)
    games,replays,analyzed=[],[],[]
    from footage_manager.review_pool import candidates as review_candidates
    for video in review_candidates(store.rows('SELECT * FROM videos')):
        result=repository.load(video)
        if not result:
            continue
        analyzed.append({'video_id':video['id'],'name':video['name'],'stale':result['stale'],'updated':result['updated'],
                         'game_count':len(result['games']),'audio':result.get('audio',{})})
        for index,game in enumerate(result['games']):
            games.append({**game,'index':index,'video_id':video['id'],'source_name':video['name'],'source_path':video['path'],
                          'stale':result['stale'],'availability':video['availability']})
        replays.extend({**r,'video_id':video['id'],'source_name':video['name'],'stale':result['stale']} for r in result['replays'])
    return {'games':rank(games,weights),'replays':replays,'analyzed':analyzed,'metrics':METRICS,'weights':DEFAULT_WEIGHTS,
            'candidate_count':len(candidates(store)),
            'dependencies':{name:importlib.util.find_spec(name) is not None for name in ('cv2','rapidocr_onnxruntime','faster_whisper')}}


def prepare(store,payload):
    missing=[name for name in ('cv2','rapidocr_onnxruntime','faster_whisper') if importlib.util.find_spec(name) is None]
    if missing:
        raise ValueError('Install footage_manager/requirements-analysis.txt first. Missing: '+', '.join(missing))
    if payload.get('ids') is not None and not candidates(store,payload['ids']):
        raise ValueError('Choose an online video at least 10 minutes long')
    store.backup()
    return AnalysisBatch(store,payload)


def voice_marks(store, video_id):
    """Read derived clip candidates without creating personal review decisions."""
    video=store.video(video_id)
    result=AnalysisStore(store).load(video)
    response={'video_id':video['id'],'availability':video['availability'],
              'state':'pending','audio_label':'','markers':[]}
    if video['duration']<600:
        response['state']='ineligible'
        return response
    if not result:
        return response
    response.update(state='outdated' if result['stale'] else 'current',
                    updated=result['updated'],audio_label=result.get('audio',{}).get('label',''))
    if not result['source_current']:
        response['state']='source_changed'
        return response
    for game_index,game in enumerate(result['games']):
        for moment_index,moment in enumerate(game['moments']):
            if moment['kind']!='voice_spike':
                continue
            response['markers'].append({'id':f'{game_index}:{moment_index}',
                'game_index':game_index,'time':moment['time'],
                'start':max(0,game['start'],moment['time']-10),
                'end':min(video['duration'],game['end'],moment['end']+15),
                'above_baseline_db':moment['above_baseline_db']})
    response['markers'].sort(key=lambda marker:marker['time'])
    return response


def between_marks(store, video_id):
    """Group consecutive background matches into approximate navigation cues."""
    video=store.video(video_id)
    result=AnalysisStore(store).load(video)
    response={'video_id':video['id'],'state':'pending','markers':[]}
    if video['duration']<600:
        response['state']='ineligible'
    elif result:
        response['state']='outdated' if result['stale'] else 'current'
        if not result['source_current']:
            response['state']='source_changed'
        else:
            samples=sorted(result.get('observations',[]),key=lambda s:s['time'])
            response['markers']=intervals(samples,'between_games',result.get('sample_seconds',30),video['duration'])
    return response


def game_marks(store, video_id):
    """Small source-scoped timeline snapshot; never creates review markers."""
    video=store.video(video_id)
    result=AnalysisStore(store).load(video)
    response={'video_id':video['id'],'state':'pending','games':[]}
    if video['duration']<600:
        response['state']='ineligible'
    elif result:
        response['state']='outdated' if result['stale'] else 'current'
        if not result['source_current']:
            response['state']='source_changed'
        else:
            response['games']=[{'index':index,'start':game['start'],
                'end':game['end'],'outcome':game.get('outcome','unknown')}
                for index,game in enumerate(result['games'])]
    return response


def keep(store,payload):
    store.backup()
    return AnalysisStore(store).keep_game(int(payload['video_id']),int(payload['index']))


def mark_replay(store,payload):
    video=store.video(payload['video_id'])
    result=AnalysisStore(store).load(video)
    if not result or result['stale']:
        raise ValueError('Analyze the current source first')
    replay=result['replays'][int(payload['index'])]
    browser=replay.get('kind')=='browser_playback'
    return store.save_range({'video_id':video['id'],'start':replay['start'],'end':replay['end'],
        'title':('Browser clip playback' if browser else 'Instant Replay')+' · deletion candidate',
        'decision':'reject','tags':('browser-playback' if browser else 'instant-replay')+', auto-analysis',
        'notes':'Repeated footage; verify before excluding. Original timestamps are retained.'})
