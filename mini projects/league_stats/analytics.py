"""Coverage-aware aggregates and descriptive matchup/item summaries."""
from datetime import datetime
import math
from .insights import derived, is_rate

PEAKS = {'largest_killing_spree', 'largest_multi_kill', 'level','longest_life_seconds','largest_critical_strike'}


def public(record):
    return {k:v for k,v in record.items() if not k.startswith('raw_')}


def select(records, *, account='', period='all', session_start=0, session_end=None, champion='', queue='',include_excluded=False):
    if period not in ('all','today','session'):
        raise ValueError('Unknown time period')
    midnight = datetime.now().astimezone().replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
    start = {'all':0, 'today':midnight, 'session':session_start}[period]
    return [r for r in records if (not account or r['account']==account) and
            (include_excluded or not r.get('review',{}).get('excluded')) and
            r.get('started_at',0)>=start and (not champion or r.get('champion')==champion) and
            (period!='session' or session_end is None or r.get('started_at',0)<session_end) and
            (not queue or str(r.get('queue'))==str(queue))]


def aggregate(records):
    records=[derived(r) for r in records]
    complete = [r for r in records if r.get('state')=='complete']
    decided = [r for r in complete if isinstance(r.get('win'),bool)]
    wins = sum(r['win'] for r in decided)
    keys = set().union(*(r.get('metrics',{}).keys() for r in records)) if records else set()
    metrics = {}
    for key in sorted(keys):
        observed = [r['metrics'][key] for r in records if key in r.get('metrics',{})]
        finished = [r['metrics'][key] for r in complete if key in r.get('metrics',{})]
        metrics[key] = dict(total=None if is_rate(key) else sum(observed), average=sum(finished)/len(finished) if finished else None,
                            games=len(observed), completed_games=len(finished),
                            maximum=max(observed) if observed else None, is_peak=key in PEAKS,is_rate=is_rate(key))
    cs_records = [r for r in complete if 'cs' in r.get('metrics',{}) and r.get('duration',0)>0]
    duration = sum(r['duration'] for r in cs_records)
    kda_records = [r for r in complete if all(k in r.get('metrics',{}) for k in ('kills','deaths','assists'))]
    deaths = sum(r['metrics']['deaths'] for r in kda_records)
    takedowns = sum(r['metrics']['kills']+r['metrics']['assists'] for r in kda_records)
    kp_records = [r for r in complete if all(k in r.get('metrics',{}) for k in ('kills','assists','team_kills')) and r['metrics']['team_kills']>0]
    lengths = [r['duration'] for r in complete if r.get('duration',0)>0]
    return dict(recorded_games=len(records), completed_games=len(complete), live_or_partial_games=len(records)-len(complete),
                result_games=len(decided), wins=wins, losses=len(decided)-wins,
                win_rate=100*wins/len(decided) if decided else None,
                average_game_seconds=sum(lengths)/len(lengths) if lengths else None,
                cs_per_minute=60*sum(r['metrics']['cs'] for r in cs_records)/duration if duration else None,
                average_match_cs_per_minute=sum(60*r['metrics']['cs']/r['duration'] for r in cs_records)/len(cs_records) if cs_records else None,
                kda=takedowns/max(1,deaths) if kda_records else None,
                kill_participation=100*sum((r['metrics']['kills']+r['metrics']['assists'])/r['metrics']['team_kills'] for r in kp_records)/len(kp_records) if kp_records else None,
                metrics=metrics)


def breakdown(records, field):
    groups = {}
    for record in records:
        name = record.get('champion') if field=='champion' else record.get('matchups',{}).get(field)
        if name and record.get('state')=='complete':
            groups.setdefault(name, []).append(record)
    return sorted([dict(name=k, **aggregate(v)) for k,v in groups.items()], key=lambda r:(-r['completed_games'],r['name']))


def items(records):
    groups = {}
    for record in records:
        if record.get('state')!='complete':
            continue
        seen = set()
        for item in record.get('items',[]):
            identity = str(item.get('id'))
            if identity in seen:
                continue
            seen.add(identity)
            group = groups.setdefault(identity, dict(id=item.get('id'), name=item.get('name',''), games=0,wins=0,result_games=0))
            group['games'] += 1
            if isinstance(record.get('win'),bool):
                group['result_games'] += 1
                group['wins'] += int(record['win'])
    return sorted([dict(g,win_rate=100*g['wins']/g['result_games'] if g['result_games'] else None) for g in groups.values()], key=lambda r:-r['games'])
