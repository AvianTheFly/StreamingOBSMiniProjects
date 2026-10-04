"""Compact summaries for stream control and viewer-requested recaps."""
import math
from .insights import derived


def recap(records):
    finished=[r for r in records if r.get('state')=='complete']
    if not finished:return None
    last=max(finished,key=lambda r:r.get('started_at',0))
    metrics=derived(last)['metrics']
    return dict(id=last['id'],champion=last.get('champion'),win=last.get('win'),duration=last.get('duration'),
                started_at=last.get('started_at'),source=last.get('source'),
                metrics={k:metrics[k] for k in ('kills','deaths','assists','cs','cs_per_minute','damage_per_minute',
                                               'vision_score','cs_difference_at_10','missed_minions') if k in metrics})


def progress(records,settings):
    finished=[derived(r) for r in records if r.get('state')=='complete']
    target=settings.get('cs_goal',7)
    covered=[r for r in finished if 'cs_per_minute' in r['metrics']]
    reached=sum(r['metrics']['cs_per_minute']>=target for r in covered)
    return dict(cs_target=target,covered_games=len(covered),reached_games=reached,
                success_rate=100*reached/len(covered) if covered else None)


def readiness(records,account):
    selected=[r for r in records if not account or r['account']==account]
    return dict(recorded=len(selected),completed=sum(r.get('state')=='complete' for r in selected),
                official=sum(r.get('api_identity_verified') is True for r in selected),
                timelines=sum(bool(r.get('timeline_version')) for r in selected),
                review_notes=sum(bool(r.get('review',{}).get('note')) for r in selected))


def live_progress(current, settings):
    target = settings.get('cs_goal',7)
    if not current or not current.get('connected') or current.get('duration',0)<=0 or 'cs' not in current.get('metrics',{}):
        return dict(available=False,target=target)
    cs = current['metrics']['cs']
    minutes = current['duration']/60
    expected = target*minutes
    return dict(available=True,target=target,cs=cs,expected_cs=expected,
                cs_per_minute=cs/minutes,difference=cs-expected,
                needed=max(0,math.ceil(expected-cs)),on_target=cs>=expected)


def form(records):
    """At most 12 completed, included matches, ordered for a chronological chart."""
    finished=sorted((r for r in records if r.get('state')=='complete'),key=lambda r:r.get('started_at',0))[-12:]
    keys=('cs_per_minute','kills','deaths','vision_score','damage_per_minute')
    return [dict(id=r['id'],champion=r.get('champion','Unknown'),win=r.get('win'),
                 started_at=r.get('started_at'),duration=r.get('duration'),
                 metrics={k:v for k,v in derived(r)['metrics'].items() if k in keys}) for r in finished]


def account_labels(records, identities, current_account, current_name):
    labels={}
    identities=identities if isinstance(identities,dict) else {}
    for account in {r['account'] for r in records}:
        identity=identities.get(account,{})
        identity=identity if isinstance(identity,dict) else {}
        name=identity.get('name')
        tag=identity.get('tag')
        labels[account]=(str(name)+(('#'+str(tag)) if tag else '') if name else
                         str(current_name) if account==current_account and current_name else 'Account '+account[:8])
    return labels
