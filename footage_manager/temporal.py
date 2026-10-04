"""League chronology policy over visual observations, independent of decoders/UI."""
try:
    from .temporal_playback import playback_intervals, excluded_seconds
except ImportError:
    from temporal_playback import playback_intervals, excluded_seconds


def intervals(samples, key, step, duration):
    result, current = [], None
    for index,sample in enumerate(samples):
        if not sample.get(key):
            if current:
                result.append(current)
                current=None
            continue
        before=samples[index-1]['time'] if index else max(0,sample['time']-step)
        after=samples[index+1]['time'] if index+1<len(samples) else min(duration,sample['time']+step)
        start,end=(before+sample['time'])/2,(after+sample['time'])/2
        if current:
            current['end']=end
        else:
            current={'start':start,'end':end,'kind':key}
    if current:
        result.append(current)
    return result


def _clock_progresses(sample, previous, step, *, same_tick=True):
    if previous is None or sample.get('clock') is None or previous.get('clock') is None:
        return False
    elapsed=sample['time']-previous['time']
    advance=sample['clock']-previous['clock']
    return (same_tick and advance==0 and 0<elapsed<1) or (
        elapsed>0 and advance>0 and abs(advance-elapsed)<=max(2,step))


def detect_games(samples, duration, step=10, buffer=60):
    """Absence of a HUD alone never closes a game (desktop/Alt-Tab is neutral)."""
    samples = sorted(samples, key=lambda s: s['time'])
    replays = intervals(samples, 'replay', step, duration)
    # A turning/fading banner can disappear from OCR briefly between replay cuts.
    # Join only gaps bounded by positive evidence on both sides.
    joined=[]
    for replay in replays:
        if joined and replay['start']-joined[-1]['end']<=step:
            joined[-1]['end']=replay['end']
        else:
            joined.append(dict(replay))
    # Keep a sampling interval around each banner run for its entrance/exit
    # animation. These are review candidates; no source footage is deleted.
    replays=[{**r,'start':max(0,r['start']-step),'end':min(duration,r['end']+step)} for r in joined]
    replays.extend(playback_intervals(samples,duration,step))
    replays.sort(key=lambda r:r['start'])
    def is_replay(sample):
        return sample.get('replay') or any(r['start']<=sample['time']<=r['end'] for r in replays)
    games, current, loading, previous, pending_reset, pending_kda = [], None, None, None, None, None
    pending_loading=None
    soft_reference=None

    def finish(end, reason, confidence, partial=False):
        nonlocal current, previous, pending_reset, pending_kda, pending_loading, soft_reference
        if current is None:
            return
        current.update(end=min(duration, max(current['start']+.1, end)),
                       end_reason=reason, confidence=min(current['confidence'], confidence),
                       partial_end=partial)
        current['trim_start'] = max(0, current['start']-buffer)
        current['trim_end'] = min(duration, current['end']+buffer)
        games.append(current)
        soft_reference=(current,previous) if reason=='Portrait without gameplay HUD' else None
        current, previous, pending_reset, pending_kda = None, None, None, None
        pending_loading=None

    for s in samples:
        t = s['time']
        if is_replay(s):
            continue
        if not s.get('loading') or s.get('continue') or s.get('outcome'):
            pending_loading=None
        # A result is attributable only before another game has started.
        outcome = s.get('outcome')
        clock=s.get('clock')
        if (current is None and games and s.get('continue') and soft_reference
                and soft_reference[0] is games[-1] and 0<=t-games[-1]['end']<=300):
            games[-1]['end_reason']='Portrait without gameplay HUD; Continue confirms end'
            soft_reference=None
        if current is None and loading is None and games and clock is not None and not (outcome or s.get('continue') or s.get('loading')):
            last=games[-1]
            inferred=max(0,t-clock)
            support=soft_reference[1] if soft_reference and soft_reference[0] is last else None
            if (last['end_reason']=='Portrait without gameplay HUD' and not last['outcome_evidence']
                    and abs(inferred-last['start'])<=90 and inferred<last['end']
                    and (s.get('active') or _clock_progresses(s,support,step,same_tick=False))):
                # Death effects can conceal KDA throughout several clock ticks.
                # A continuing independent HUD clock revokes only a soft end;
                # actual Continue/results/loading boundaries remain closed.
                current=games.pop()
                current.pop('end',None)
                current.pop('partial_end',None)
                previous=support
                soft_reference=None
        if outcome and not s.get('active'):
            if current:
                finish(t, 'Post-game '+outcome, .9)
            if games and 0 <= t-games[-1]['end'] <= 300:
                old = games[-1]['outcome']
                if old not in ('unknown',outcome):
                    games[-1]['outcome_conflict']=True
                games[-1]['outcome'] = ('unknown' if games[-1].get('outcome_conflict') else outcome)
                games[-1]['outcome_evidence'].append(t)
        if s.get('between_games') and not s.get('active'):
            if current:
                finish(t, 'Likely between games: reference background', .6)
            continue
        if s.get('desktop') and not s.get('active') and not s.get('continue') and not outcome and not s.get('loading'):
            # The OBS champion portrait can remain over the desktop after Alt-Tab.
            # Taskbar + portrait alone never confirms a game ending.
            continue
        if s.get('loading') and not (s.get('continue') or outcome):
            if current and t-current['start'] >= 900:
                # Purple Nexus/death effects can resemble card-border columns.
                # Only separate loading readings may close a known game; a
                # single flash cannot discard its remaining play or speech.
                if pending_loading is not None and 2<=t-pending_loading<=step*3:
                    first_loading=pending_loading
                    finish(previous['time'] if previous else t, 'Next loading screen; end uncertain', .5, True)
                    loading=first_loading
                elif pending_loading is None or t-pending_loading>step*3:
                    pending_loading=t
            if current is None:
                loading = t if loading is None else loading
            continue
        if s.get('active'):
            clock = s.get('clock')
            # Two chronological readings are required before accepting a clock reset.
            if current and clock is not None and previous and previous.get('clock') is not None:
                # A return from an inflated OCR minute still belongs to the
                # original game. A genuine reset implies a later game origin,
                # not another overlapping range with the same inferred start.
                later_origin = t-clock > current['start']+step*3
                if clock < previous['clock']-120 and later_origin:
                    if pending_reset and clock >= pending_reset.get('clock', 0) and t-pending_reset['time'] <= step*3:
                        finish(previous['time'], 'Confirmed game-clock reset; end uncertain', .55, True)
                    else:
                        pending_reset = s
                        continue
                else:
                    pending_reset = None
            if current is None:
                inferred = max(0, t-clock) if clock is not None else t
                start = min(t, max(loading, inferred)) if loading is not None else inferred
                # An old clip or an inflated clock cannot create a new game
                # overlapping one that has already ended. Wait for evidence
                # whose inferred origin is chronologically possible.
                if games and start<games[-1]['end']:
                    continue
                current = {'start': start, 'start_evidence': t, 'start_reason': 'Loading + gameplay' if loading is not None else 'Gameplay HUD / game clock',
                           'confidence': .9 if loading is not None else .75, 'partial_start': inferred <= 0 and (clock or 0) > t+step,
                           'outcome': 'unknown', 'outcome_evidence': [], 'moments': [], 'metrics': {}}
                loading = None
            # Confirm an early KDA reading with the next chronological HUD. A
            # sword icon can otherwise turn 0/0/0 into a one-frame 20/0/0 OCR error.
            if pending_kda and clock is not None and s.get('kda'):
                delta=t-pending_kda['time']
                if 0<delta<=step*3 and 0<=clock-pending_kda['clock']<=step*3 and all(a>=b for a,b in zip(s['kda'],pending_kda['kda'])):
                    k,d,a=pending_kda['kda']
                    existing=[m for m in current['moments'] if m['kind']=='early_kda']
                    if not existing or existing[-1]['kda'] != [k,d,a]:
                        moment_time=pending_kda['time'];moment_clock=pending_kda['clock']
                        current['moments'].append({'kind':'early_kda','time':moment_time,'start':max(current['start'],moment_time-20),'end':min(duration,moment_time+15),
                                                  'clock':moment_clock,'kda':[k,d,a],'label':f'Early KDA {k}/{d}/{a} at {int(moment_clock//60)}:{int(moment_clock%60):02}'})
            pending_kda=None
            if clock is not None and 0 <= clock <= 300 and s.get('kda'):
                k, d, a = s['kda']
                if k > 1 or a > 1:
                    pending_kda=s
            previous = s
            continue
        if current:
            elapsed = t-current['start']
            if s.get('continue'):
                finish(t, 'Continue / Nexus end screen', .95)
            elif s.get('no_hud') and (elapsed <= 180 or elapsed >= 900):
                clock=s.get('clock')
                if _clock_progresses(s,previous,step):
                    # Death overlays can obscure KDA and darken empty health/mana
                    # bars. A clock advancing with recording time still proves
                    # that the known game is progressing behind the overlay.
                    # Fractional probes can share a one-second clock reading.
                    # Advance the reference only on a new tick; otherwise a
                    # frozen end-screen clock could be retained indefinitely.
                    if clock>previous['clock']:
                        previous=s
                    continue
                # Require a second no-HUD observation; a single animation flicker is insufficient.
                prev = next((p for p in reversed(samples) if p['time'] < t and not is_replay(p) and not p.get('desktop')), None)
                if prev and prev.get('no_hud') and t-prev['time'] <= step*3:
                    # Brief death effects can hide two fractional clock reads.
                    # A nearby advancing independent clock still proves play,
                    # even when its KDA field remains unreadable.
                    if previous and previous.get('clock') is not None and any(
                        t<p['time']<=t+3 and not is_replay(p) and p.get('clock') is not None
                        and p['clock']>previous['clock']
                        and abs(p['clock']-previous['clock']-(p['time']-previous['time']))<=max(2,step)
                        for p in samples):
                        continue
                    finish(prev['time'], 'Portrait without gameplay HUD', .7)
    if current:
        finish(duration, 'Recording ends without a confirmed game end', .4, True)
    for g in games:
        # Apply this only after soft boundaries have had a chance to reopen.
        g['moments']=[{**m,'start':max(g['start'],m['start']),
                      'end':min(g['end'],m['end'])} for m in g['moments']
                      if g['start']<=m['time']<g['end']]
        g['replay_seconds'] = excluded_seconds(g['start'],g['end'],replays)
        g['metrics']['early_kda'] = float(any(m['kind']=='early_kda' for m in g['moments']))
        g['metrics']['victory'] = float(g['outcome']=='victory')
    return games, replays
