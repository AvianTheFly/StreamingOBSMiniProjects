"""Confirmed local rank observations; never infer LP changes from match results."""
import copy
from .normalize import number

QUEUES={'RANKED_SOLO_5x5':'Solo / Duo','RANKED_FLEX_SR':'Flex'}
TIERS=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER']
DIVISIONS={'IV':0,'III':1,'II':2,'I':3}


def entries(data):
    if not isinstance(data,dict):raise ValueError('Rank data is unavailable')
    raw=data.get('queueMap')
    if isinstance(raw,dict):items=[{**v,'queueType':k} for k,v in raw.items() if isinstance(v,dict)]
    elif isinstance(data.get('queues'),list):items=data['queues']
    else:raise ValueError('Rank queues are unavailable')
    result=[]
    for entry in items:
        queue=entry.get('queueType');tier=entry.get('tier')
        if queue not in QUEUES or tier not in [*TIERS,'NONE','UNRANKED']:continue
        result.append(dict(queue=queue,label=QUEUES[queue],tier=tier,division=entry.get('division',''),
                           lp=number(entry.get('leaguePoints')),wins=number(entry.get('wins')),
                           losses=number(entry.get('losses')),provisional=entry.get('isProvisional') is True))
    return result


def score(entry):
    if entry['provisional'] or entry['lp'] is None or entry['tier'] not in TIERS:return None
    tier=TIERS.index(entry['tier'])
    if tier>=7:return 2800+entry['lp']
    division=DIVISIONS.get(entry['division'])
    return tier*400+division*100+entry['lp'] if division is not None else None


class Ranked:
    def __init__(self,store,clock):
        self.store=store;self.clock=clock
        self.history=store.metadata('rank_history') or []
        if not isinstance(self.history,list):raise ValueError('Malformed rank archive; original data preserved')

    def observe(self,account,data,session_id=''):
        values=entries(data);now=self.clock();history=copy.deepcopy(self.history)
        for value in values:
            old=next((r for r in reversed(history) if r['account']==account and r['queue']==value['queue']),None)
            observation={**value,'account':account,'at':now,'session_id':session_id}
            if old and old.get('session_id')==session_id and all(old.get(k)==v for k,v in value.items()):
                old['checked_at']=now
            else:history.append({**observation,'checked_at':now})
        # Rank-only journal is compact and kept across restarts; no settings reset.
        self.store.metadata('rank_history',history)
        self.history=history

    def snapshot(self,account,start,end=None):
        result=[]
        for queue in QUEUES:
            available=[r for r in self.history if r['account']==account and r['queue']==queue and (end is None or r['at']<end)]
            if not available:continue
            current=available[-1]
            baseline=next((r for r in available if r['at']>=start),None)
            a,b=score(current),score(baseline) if baseline else None
            delta=a-b if a is not None and b is not None else None
            # Lower-tier ranks should never claim exact LP movement across a season reset.
            sequence=[r for r in available if baseline and r['at']>=baseline['at']]
            for previous,following in zip(sequence,sequence[1:]):
                if all(r.get(k) is not None for r in (previous,following) for k in ('wins','losses')) and (
                    following['wins']+following['losses']<previous['wins']+previous['losses']):
                    delta=None
            result.append({**current,'session_movement':delta,'baseline_at':baseline['at'] if baseline else None,
                           'baseline_in_session':bool(baseline and baseline['at']>=start)})
        return result
