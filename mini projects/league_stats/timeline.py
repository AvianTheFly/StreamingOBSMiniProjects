"""Post-game checkpoints and explicit purchase events from Match-v5 timelines."""
from .normalize import number


def extract(data,record,item_catalog=None):
    match_id=str(data.get('metadata',{}).get('matchId',''))
    if not match_id or match_id.rsplit('_',1)[-1]!=str(record['game_id']) or (record.get('api_match_id') and record['api_match_id']!=match_id):
        raise ValueError('Timeline belongs to another match')
    own=record.get('participant_id')
    if not isinstance(own,int) or own<=0:
        raise ValueError('Timeline requires a confirmed participant identity')
    info=data.get('info',{})
    participants=info.get('participants',[])
    if participants and not any(p.get('participantId')==own and p.get('puuid')==record.get('api_account',record['account']) for p in participants):
        raise ValueError('Timeline player identity does not match the archive')
    frames=info.get('frames')
    if not isinstance(frames,list) or not frames:
        raise ValueError('Timeline contains no frames')
    frames=sorted([f for f in frames if number(f.get('timestamp')) is not None],key=lambda f:f['timestamp'])
    if not frames:
        raise ValueError('Timeline contains no valid frames')
    metrics={};checkpoints={};catalog=item_catalog or {}
    def stats(frame,pid):
        player=frame.get('participantFrames',{}).get(str(pid),{})
        result={}
        for source,target in [('totalGold','gold'),('xp','xp'),('level','level')]:
            if number(player.get(source)) is not None:result[target]=player[source]
        lane,jungle=number(player.get('minionsKilled')),number(player.get('jungleMinionsKilled'))
        if lane is not None and jungle is not None:result['cs']=lane+jungle
        return result
    for minute in (5,10,15,20,30):
        time=minute*60000
        choices=[f for f in frames if time-65000<f['timestamp']<=time]
        if not choices or record.get('duration',0)<minute*60:continue
        frame=choices[-1];values=stats(frame,own)
        if not values:continue
        entry={'sample_seconds':frame['timestamp']/1000,**values}
        enemy=stats(frame,record.get('opponent_id')) if record.get('opponent_id') else {}
        for key in ('cs','gold','xp'):
            if key in values:
                metrics[f'{key}_at_{minute}']=values[key]
                if key in enemy:
                    entry[key+'_difference']=values[key]-enemy[key]
                    metrics[f'{key}_difference_at_{minute}']=entry[key+'_difference']
        checkpoints[str(minute)]=entry
    items=[];events=[]
    for frame in frames:
        for event in frame.get('events',[]):
            events.append(event)
    first_kill=[];first_death=[];first_six=[]
    kills_10=deaths_10=0
    for event in sorted(events,key=lambda e:e.get('timestamp',0)):
        stamp=number(event.get('timestamp'))
        if stamp is None:continue
        seconds=stamp/1000;kind=event.get('type')
        if kind=='CHAMPION_KILL':
            if event.get('killerId')==own:
                first_kill.append(seconds);kills_10+=int(seconds<600)
            if event.get('victimId')==own:
                first_death.append(seconds);deaths_10+=int(seconds<600)
        if kind=='LEVEL_UP' and event.get('participantId')==own and event.get('level')==6:
            first_six.append(seconds)
        if event.get('participantId')==own and kind in ('ITEM_PURCHASED','ITEM_SOLD','ITEM_DESTROYED','ITEM_UNDO'):
            item=event.get('itemId')
            items.append(dict(type=kind,time=seconds,item_id=item,
                              name=catalog.get(str(item),{}).get('name') or ('Item '+str(item) if item else 'Purchase undo'),
                              before_id=event.get('beforeId'),after_id=event.get('afterId')))
    if record.get('duration',0)>=600 and frames[-1]['timestamp']>=600000:
        metrics.update(kills_before_10=kills_10,deaths_before_10=deaths_10)
    for key,values in [('first_kill_seconds',first_kill),('first_death_seconds',first_death),('level_6_seconds',first_six)]:
        if values:metrics[key]=min(values)
    return dict(timeline_version=1,timeline_checkpoints=checkpoints,purchase_events=items,
                metrics=metrics,raw_timeline=data)
