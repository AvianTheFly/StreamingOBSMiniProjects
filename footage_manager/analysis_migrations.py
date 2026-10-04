"""Source-scoped visual checkpoint compatibility and required refresh targets."""
try:
    from .analysis_cache import cache_path, read
    from .analysis_store import AnalysisStore
    from .visual_analysis import replay_text
    from .visual_outcomes import masked_result_words, result_words
except ImportError:
    from analysis_cache import cache_path, read
    from analysis_store import AnalysisStore
    from visual_analysis import replay_text
    from visual_outcomes import masked_result_words, result_words


def _requires_visual_refresh(sample):
    # Moving the result crop to the top edge also changes formerly blank
    # inactive frames. Their old crop may have missed the entire title.
    return not sample.get('active')


def _requires_masked_defeat_refresh(sample):
    return not sample.get('active') and 'defeat' in masked_result_words(sample.get('evidence',''))


def _requires_top_context_refresh(sample):
    text=sample.get('evidence','')
    return (not sample.get('active') and not sample.get('outcome')
            and bool(result_words(text) or masked_result_words(text)))


def upgraded_samples(observations, step):
    """Retain older HUD work while refreshing changed visual evidence policies."""
    normalized=[{**s,'replay':bool(s.get('replay') or replay_text(s.get('evidence','')))} for s in observations]
    transitions=[s['time'] for s in normalized if s['replay']]
    return {s.get('requested_time',s['time']):s for s in normalized
            if not any(abs(s['time']-t)<=step*2 for t in transitions)
            and not (not s.get('active') and (s.get('no_hud') or s.get('continue') or s.get('loading') or s.get('outcome')))}


def prior_visual_work(store, video, step):
    """Preserve compatible frames and refresh every former result timestamp.

    Refresh targets survive interruption even when the new checkpoint is already
    populated. Older positive times may fall outside the new coarse/refine grid.
    """
    compatible_sources=[read(cache_path(store.directory,video,kind,{'sample_seconds':step})).get('observations',[])
                        for kind in ('visual-v6','visual-v5','visual-v4')]
    full_crop=read(cache_path(store.directory,video,'visual-v7',{'sample_seconds':step})).get('observations',[])
    current=read(cache_path(store.directory,video,'visual-v8',{'sample_seconds':step})).get('observations',[])
    contextual=read(cache_path(store.directory,video,'visual-v9',{'sample_seconds':step})).get('observations',[])
    legacy=read(cache_path(store.directory,video,'visual-v3',{'sample_seconds':step})).get('observations',[])
    previous=AnalysisStore(store).load(video)
    stored=(previous.get('observations',[]) if previous and previous['source_current']
            and previous.get('sample_seconds')==step else [])
    stored_current=stored if previous and previous.get('version') in ('league-visual-12','league-visual-13','league-visual-14','league-visual-15','league-visual-16','league-visual-17','league-visual-18') else []
    stored_legacy=[] if stored_current else stored
    refresh={s.get('requested_time',s['time']) for source in (*compatible_sources,legacy,stored_legacy)
             for s in source if _requires_visual_refresh(s)}
    donors=[(full_crop,lambda s:_requires_masked_defeat_refresh(s) or _requires_top_context_refresh(s)),
            (current,_requires_top_context_refresh),(contextual,lambda s:False)]
    if stored_current:
        needs=(donors[0][1] if previous['version']=='league-visual-12' else
               _requires_top_context_refresh if previous['version']=='league-visual-13' else lambda s:False)
        donors.append((stored_current,needs))
    refresh.update(s.get('requested_time',s['time']) for source,needs in donors
                   for s in source if needs(s))
    # Active HUD observations and audio remain compatible; refresh all inactive
    # frames for the expanded result crop, including previous negative readings.
    compatible=next((source for source in compatible_sources if source),[])
    samples=({s.get('requested_time',s['time']):s for s in compatible if not _requires_visual_refresh(s)}
             if compatible else {t:s for t,s in upgraded_samples(legacy or stored_legacy,step).items()
                                 if not _requires_visual_refresh(s)})
    # These crops already include the top edge. Preserve all compatible work;
    # only unclassified result words need the joined header/control geometry.
    for source,needs in donors:
        samples.update({s.get('requested_time',s['time']):s for s in source if not needs(s)})
    # Current visual facts are independent of the sampling grid. Switching an
    # interrupted detailed pass to quick estimates must retain its completed OCR.
    if step>=30:
        for other_step in (5.0,10.0,30.0):
            if other_step>=step:
                continue
            other=read(cache_path(store.directory,video,'visual-v10',{'sample_seconds':other_step}))
            samples.update({s.get('requested_time',s['time']):s for s in other.get('observations',[])})
    return samples,refresh
