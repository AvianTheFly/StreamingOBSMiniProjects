"""Short, evidence-backed match stories. No invented grades or causal claims."""
from .insights import derived


def project(report, records):
    match = report['match']
    m = match['metrics']
    peers = [derived(r) for r in records if match.get('role') and match.get('queue') is not None and r.get('state') == 'complete' and
             r.get('started_at',0) < match.get('started_at',0) and r.get('champion') == match['champion'] and
             r.get('queue') == match.get('queue') and r.get('role') == match.get('role')]
    peers = sorted(peers,key=lambda r:r.get('started_at',0),reverse=True)[:20]
    comparisons = []
    for key, label, unit in [('cs_per_minute','Farm pace','CS/min'),('damage_per_minute','Damage pace','/min'),
                             ('vision_per_minute','Vision pace','/min')]:
        values = [p['metrics'][key] for p in peers if key in p['metrics']]
        if match.get('state')=='complete' and len(values) >= 3 and key in m and sum(values)>0:
            average = sum(values)/len(values)
            comparisons.append(dict(key=key,label=label,unit=unit,value=m[key],average=average,
                                     change=100*(m[key]/average-1),games=len(values),
                                     rank=1+sum(v>m[key] for v in values)))
    standout = max(comparisons,key=lambda c:c['change'],default=None)
    # Always show the comparison's actual direction, even for an off game.
    badges = []
    if match.get('state')=='complete' and m.get('deaths') == 0:
        badges.append(dict(kind='deathless',value=0,label='Deaths',note='Deathless',icon='shield'))
    for key,label,note,icon in [('skillshots_dodged','Dodged','Skillshots','dodge'),
                               ('turret_plates','Plates','Taken','tower'),
                               ('solo_kills','Solo kills','On your own','swords'),
                               ('allies_saved','Allies saved','Riot recorded','heart')]:
        if m.get(key,0)>0:
            badges.append(dict(kind=key,value=m[key],label=label,note=note,icon=icon))
    if len(badges)<3 and 'cc_seconds' in m:
        badges.append(dict(kind='cc',value=m['cc_seconds'],label='CC seconds',note='On champions',icon='clock'))
    combat = [e for e in report.get('events',[]) if e['kind'] in {'kill','assist'}]
    burst = None
    for first in combat:
        group = [e for e in combat if first['time']<=e['time']<=first['time']+60]
        candidate = dict(start=first['time'],end=min(match.get('duration',0),first['time']+60),
                         kills=sum(e['kind']=='kill' for e in group),assists=sum(e['kind']=='assist' for e in group),
                         events=group)
        if burst is None or len(group)>len(burst['events']):
            burst=candidate
    lane=[]
    for minute in (5,10,15,20,30):
        key=f'gold_difference_at_{minute}'
        if key in m and minute*60<=match.get('duration',0):
            sample = report.get('checkpoints', {}).get(str(minute), {}).get('sample_seconds')
            lane.append(dict(minute=minute,time=sample,gold=m[key],cs=m.get(f'cs_difference_at_{minute}')))
    duration=match.get('duration',0)
    alive=100*(1-m['dead_seconds']/duration) if duration>0 and 0<=m.get('dead_seconds',-1)<=duration else None
    moments=[e for e in report.get('events',[]) if e['kind'] in {'kill','death','assist','objective','milestone'}]
    return dict(standout=standout,comparisons=comparisons,badges=badges[:3],burst=burst,lane=lane,
                alive_pct=alive,moments=moments,baseline='Earlier games · same champion, role & queue')
