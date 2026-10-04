"""Derived performance, records and trends from covered, completed match evidence."""

PER_MINUTE = {'damage_per_minute':'damage_champions', 'gold_per_minute':'gold_earned',
              'vision_per_minute':'vision_score', 'wards_per_minute':'wards_placed',
              'healing_per_minute':'healing', 'damage_taken_per_minute':'damage_taken'}
RATIOS = {'damage_share_pct', 'gold_share_pct', 'time_dead_pct', 'gold_spent_pct'}
RECORD_FIELDS = ('kills','assists','cs','cs_per_minute','damage_champions','damage_per_minute',
                 'vision_score','gold_earned','solo_kills','turret_plates','penta_kills')


def derived(record):
    metrics = dict(record.get('metrics',{}))
    duration = record.get('duration',0)
    if duration>0:
        for target,source in {**PER_MINUTE,'cs_per_minute':'cs'}.items():
            if source in metrics:
                metrics[target] = 60*metrics[source]/duration
        if 'dead_seconds' in metrics:
            metrics['time_dead_pct'] = 100*metrics['dead_seconds']/duration
    for target,part,total in [('gold_spent_pct','gold_spent','gold_earned'),
                              ('damage_share_pct','damage_champions','team_damage_champions'),
                              ('gold_share_pct','gold_earned','team_gold_earned')]:
        if part in metrics and metrics.get(total,0)>0:
            metrics[target] = 100*metrics[part]/metrics[total]
    return {**record,'metrics':metrics}


def is_rate(key):
    return key in PER_MINUTE or key in RATIOS or key=='cs_per_minute'


def report(records):
    finished = sorted([derived(r) for r in records if r.get('state')=='complete'],key=lambda r:r.get('started_at',0))
    best = []
    for key in RECORD_FIELDS:
        covered = [r for r in finished if key in r['metrics']]
        if covered:
            r = max(covered,key=lambda r:r['metrics'][key])
            best.append(dict(metric=key,value=r['metrics'][key],game_id=r.get('game_id'),
                             champion=r.get('champion'),started_at=r.get('started_at'),games=len(covered)))
    longest_win = longest_loss = run = 0
    kind = None
    for r in finished:
        outcome = r.get('win')
        if not isinstance(outcome,bool):
            run,kind = 0,None
            continue
        run = run+1 if outcome==kind else 1
        kind = outcome
        if outcome:
            longest_win=max(longest_win,run)
        else:
            longest_loss=max(longest_loss,run)
    recent,previous = finished[-10:],finished[-20:-10]
    trends = []
    for key in ('cs_per_minute','kills','deaths','damage_per_minute','vision_per_minute','gold_per_minute'):
        a=[r['metrics'][key] for r in recent if key in r['metrics']]
        b=[r['metrics'][key] for r in previous if key in r['metrics']]
        if a:
            now=sum(a)/len(a);before=sum(b)/len(b) if b else None
            trends.append(dict(metric=key,recent=now,previous=before,change=now-before if b else None,
                               recent_games=len(a),previous_games=len(b)))
    return dict(records=best,streak=dict(kind='wins' if kind is True else 'losses' if kind is False else None,
                                       current=run,longest_wins=longest_win,longest_losses=longest_loss),
                trends=trends,deathless_games=sum(r['metrics'].get('deaths')==0 for r in finished),
                deathless_coverage=sum('deaths' in r['metrics'] for r in finished))
