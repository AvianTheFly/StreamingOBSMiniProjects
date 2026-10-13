"""Compact visual facts; ranking uses measured totals, never invented skill scores."""
from .normalize import number, champion


def scoreboard(record, stored, champions):
    raw=(stored or {}).get('raw_postgame',{})
    info=raw.get('info',raw)
    rows=[]
    for p in info.get('participants',[]):
        s=p.get('stats',p)
        rows.append(dict(champion=champion(p,champions),champion_id=p.get('championId'),
                         own=p.get('participantId')==record.get('participant_id'),team=p.get('teamId'),
                         damage=number(s.get('totalDamageDealtToChampions')),
                         gold=number(s.get('goldEarned')),vision=number(s.get('visionScore'))))
    own=next((p for p in rows if p['own']),None)
    return [p for p in rows if own and p['team']==own['team']]


def project(record, rows):
    skills=[e for e in record.get('official_events',[]) if e['kind']=='skill']
    purchases=record.get('purchase_events') or []
    # Include sold/undone transactions in the full journal; the visual strip
    # is explicitly purchase order, not an inference of completed items.
    build=[dict(id=e.get('item_id'),name=e.get('name'),time=e['time'],exact=True)
           for e in purchases if e.get('type')=='ITEM_PURCHASED']
    if not build:
        build=[dict(id=e.get('id'),name=e.get('name'),time=e['time'],exact=False)
               for e in record.get('item_observations',[])]
    return dict(team=rows,build=build,skills=skills,
                exact_build=bool(purchases), exact_skills='official_events' in record)
