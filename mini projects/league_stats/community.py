"""Bounded viewer-requested stat spotlights; never change recorded game statistics."""
from collections import OrderedDict
import copy

TOPICS={'cs':'Farming', 'kda':'K / D / A', 'record':'Stream record',
        'dragons':'Dragons', 'misses':'Reported missed minions', 'damage':'Champion damage',
        'vision':'Vision', 'streak':'Current streak','rank':'Rank progress','recap':'Last game','goal':'Farming goal',
        'live':'Current game','averages':'Per-game averages','lifetime':'Lifetime record','objectives':'Objectives',
        'items':'Common final items','matchup':'Current lane matchup','nexus':'Nexus reports','helpers':'Helper guide','help':'Command guide'}


class Community:
    def __init__(self,clock):
        self.clock=clock
        self.users=OrderedDict()
        self.seen=OrderedDict()
        self.last=-1000
        self.active=None
        self.activity=[]

    def request(self,topic,actor,identity,settings):
        if not settings.get('viewer_requests',True):
            raise ValueError('Viewer stat requests are disabled')
        if topic not in TOPICS:
            raise ValueError('Unknown stat topic')
        now=self.clock()
        if identity and identity in self.seen:
            return False
        if now-self.last<settings.get('request_cooldown_seconds',10) or now-self.users.get(actor,-1000)<60:
            return False
        self.last=now
        self.users[actor]=now;self.users.move_to_end(actor)
        if identity:self.seen[identity]=now
        while len(self.users)>512:self.users.popitem(last=False)
        while len(self.seen)>1024:self.seen.popitem(last=False)
        if topic not in ('help','helpers'):
            self.active=dict(topic=topic,title=TOPICS[topic],requested_by=actor,expires_at=now+12)
        self.activity.append(dict(topic=topic,actor=actor,at=now))
        self.activity=self.activity[-20:]
        return True

    def clear(self):
        self.active=None

    def snapshot(self):
        return copy.deepcopy(self.active) if self.active and self.active['expires_at']>self.clock() else None


def spotlight(active,summary,insights,current,*,ranked=None,recap=None,progress=None,lifetime=None,finished_items=None,lane=None):
    if not active:return None
    topic=active['topic'];metrics=summary['metrics']
    def value(key):return metrics.get(key,{}).get('total')
    def fmt(value):return '—' if value is None else f'{value:,.1f}'.removesuffix('.0')
    if topic in ('live','averages','lifetime','objectives','items','matchup','nexus'):
        from .chat_replies import stat
        text=stat(topic,summary,insights,current=current,lifetime=lifetime,finished_items=finished_items,lane=lane).partition(' ')[2]
    elif topic=='cs':text=f'{fmt(value("cs"))} CS · {fmt(summary["cs_per_minute"])} / min'
    elif topic=='kda':text=' / '.join(fmt(value(k)) for k in ('kills','deaths','assists'))
    elif topic=='record':text=f'{summary["wins"]} W · {summary["losses"]} L · {fmt(summary["win_rate"])}%'
    elif topic=='dragons':text=f'{fmt(value("dragon_kills"))} personal · {fmt(value("team_dragons"))} team'
    elif topic=='misses':text=f'{fmt(value("missed_minions"))} reported misses'
    elif topic=='damage':text=f'{fmt(value("damage_champions"))} champion damage'
    elif topic=='vision':text=f'{fmt(value("vision_score"))} vision score'
    elif topic=='rank':
        rank=next((r for r in ranked or [] if r['queue']=='RANKED_SOLO_5x5'),None)
        text=f'{rank["tier"].title()} {rank["division"]} · {fmt(rank["lp"])} LP' if rank else 'Rank not observed yet'
    elif topic=='recap':
        m=recap.get('metrics',{}) if recap else {}
        text=f'{recap["champion"]} · '+('W' if recap['win'] is True else 'L' if recap['win'] is False else 'Finished')+' · '+' / '.join(fmt(m.get(k)) for k in ('kills','deaths','assists')) if recap else 'No completed game in this session yet'
    elif topic=='goal':
        p=progress or {};text=f'{fmt(p.get("cs_target"))} CS/min target · {p.get("reached_games",0)} / {p.get("covered_games",0)} games reached it'
    else:
        streak=insights['streak'];text=f'{streak["current"]} {streak["kind"] or "completed results"}'
    from .chat_replies import scope
    return {**active,'text':text,'scope':scope(topic)}
