"""Auditable manual-counter policy, independent of transport and archive writes."""
import copy
import uuid
from .commands import COMMANDS


def metrics(record):
    if not record.get('helper_tracking') and not record.get('observations'):return
    values=record.setdefault('metrics',{})
    names=set(COMMANDS.values())|{o['metric'] for o in record.get('observations',[])}
    for name in names:
        values[name]=sum(1 for o in record.get('observations',[]) if o['metric']==name and not o.get('undone'))
    values['missed_minions']=sum(values[k] for k in ('missed_melee','missed_ranged','missed_cannon'))


def apply(record,action,metric,*,settings,now,fresh,actor,message_id='',moderator=True,observation_id=None):
    if not record:raise ValueError('No tracked game for this observation')
    record=copy.deepcopy(record)
    journal=record.setdefault('observations',[])
    if message_id and any(message_id in (o.get('message_id'),o.get('undo_message_id')) for o in journal):
        raise ValueError('This chat message was already counted')
    if action=='undo':
        target=next((o for o in reversed(journal) if not o.get('undone') and (not observation_id or o['id']==observation_id)
                     and (moderator or o['actor']==actor)),None)
        if target is None:raise ValueError('No observation to undo')
        target.update(undone=True,undone_by=actor,undone_at=now,undo_message_id=message_id)
    elif action=='add':
        if not settings['helper_enabled']:raise ValueError('Viewer helpers are disabled')
        allowed=set(COMMANDS.values())|{'custom_'+k for k in settings.get('custom_counters',{})}
        if metric not in allowed:raise ValueError('Unknown observation type')
        recent_nexus=(metric=='nexus_last_hits_manual' and record.get('state')=='complete' and
                      record.get('ended_at') is not None and 0<=now-record['ended_at']<=120)
        if not recent_nexus and (record.get('state')!='live' or not fresh):
            raise ValueError('Observations require a live tracked game')
        latest=max((o['at'] for o in journal),default=0)
        remaining=settings['cooldown_seconds']-(now-latest)
        if remaining>0:raise ValueError(f'Helper cooldown: {remaining:.0f}s remaining')
        label=settings.get('custom_counters',{}).get(metric.removeprefix('custom_'),metric.replace('_',' '))
        journal.append(dict(id=uuid.uuid4().hex,metric=metric,label=label,actor=actor,at=now,
                            game_time=record['duration'],message_id=message_id))
    else:raise ValueError('Unknown observation action')
    metrics(record)
    return record
