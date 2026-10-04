"""Extend visible browser controls through their recorded-game HUD run."""


def playback_intervals(samples, duration, step):
    groups,group,previous=[],[],None
    for index,sample in enumerate(samples):
        clock=sample.get('clock')
        # A confirmed live end separates a subsequent review of that same
        # match, whose timer may otherwise look like continuous gameplay.
        live_end=(sample.get('continue') or sample.get('outcome')) and not sample.get('player')
        if sample.get('loading') or (live_end and not any(samples[i].get('player') for i in group)):
            if group:groups.append(group)
            group,previous=[],None
        if clock is None:
            continue
        if previous:
            elapsed=sample['time']-previous['time']
            if elapsed>max(60,step*3) or abs(clock-previous['clock']-elapsed)>120:
                groups.append(group)
                group=[]
        group.append(index)
        previous=sample
    if group:groups.append(group)
    result=[]
    for group in groups:
        first,last=group[0],group[-1]
        if not any(s.get('player') for s in samples[first:last+1]):
            continue
        # Midpoints retain the first genuine HUD after the player closes; a
        # whole sampling-interval pad here could swallow a new game at 0:00.
        before=samples[first-1]['time'] if first else max(0,samples[first]['time']-step)
        after=samples[last+1]['time'] if last+1<len(samples) else duration
        start=(before+samples[first]['time'])/2
        end=(after+samples[last]['time'])/2
        if result and start-result[-1]['end']<=step:
            result[-1]['end']=end
        else:
            result.append({'start':max(0,start),'end':min(duration,end),'kind':'browser_playback'})
    return result


def excluded_seconds(start, end, intervals):
    """Count the union when a browser clip also contains an Instant Replay."""
    total,right=0,start
    for interval in sorted(intervals,key=lambda r:r['start']):
        left=max(start,interval['start'],right)
        stop=min(end,interval['end'])
        if stop>left:
            total+=stop-left
            right=stop
    return total
