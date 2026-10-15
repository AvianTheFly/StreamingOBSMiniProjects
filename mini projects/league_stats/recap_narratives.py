"""A bounded deck of short match stories derived only from covered evidence."""
import math


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def time(seconds):
    return f'{int(seconds)//60}:{int(seconds)%60:02d}'


def project(report):
    match = report.get('match') or {}
    metrics = match.get('metrics') or {}
    stories, analysis = report.get('stories') or {}, report.get('analysis') or {}
    deck = []

    def add(key, title, value, unit, text, facts=()):
        deck.append(dict(id=key, title=title, value=value, unit=unit, text=text,
                         facts=[dict(label=label, value=value) for label, value in facts]))

    burst = stories.get('burst')
    if burst:
        add('burst', 'The minute you were everywhere', burst['kills']+burst['assists'], 'takedowns',
            f"From {time(burst['start'])} to {time(burst['end'])}, your recorded fights packed "
            f"in {burst['kills']} kills and {burst['assists']} assists.",
            [('Kills', str(burst['kills'])), ('Assists', str(burst['assists']))])
    farm = analysis.get('farm_window')
    if farm:
        add('farm', 'Your farming hit another gear', round(farm['rate'], 1), 'CS/min',
            f"Your fastest sampled 3–5 minute stretch ran from {time(farm['start'])} "
            f"to {time(farm['end'])}: {farm['cs']} CS collected.",
            [('Window', time(farm['end']-farm['start'])), ('CS collected', str(farm['cs']))])
    for comparison in stories.get('comparisons', []):
        change = comparison['change']
        add('baseline-'+comparison['key'], comparison['label']+' · your usual vs this game',
            round(change), '%',
            f"{abs(change):.0f}% {'above' if change >= 0 else 'below'} your average across "
            f"{comparison['games']} earlier games on the same champion, role and queue.",
            [('This game', f"{comparison['value']:.1f} {comparison['unit']}"),
             ('Your usual', f"{comparison['average']:.1f} {comparison['unit']}")])
    lane = stories.get('lane', [])
    if lane:
        best = max(lane, key=lambda point: point['gold'])
        add('lane', 'The lane ledger', f"{best['gold']:+,.0f}", 'gold',
            f"Your strongest recorded checkpoint against your confirmed lane opponent "
            f"was at {time(best['time']) if number(best.get('time')) else str(best['minute'])+':00'}.",
            [('Checkpoints', str(len(lane))), ('Comparison', 'Confirmed opponent')])
        if lane[0]['gold'] < 0 < lane[-1]['gold']:
            swing = lane[-1]['gold']-lane[0]['gold']
            add('swing', 'From chasing to leading', f'{swing:,.0f}', 'gold swing',
                'Your sampled lane gap moved from behind to ahead. These checkpoints '
                'show the change, without guessing which play caused it.',
                [('Earlier gap', f"{lane[0]['gold']:+,.0f}"), ('Later gap', f"{lane[-1]['gold']:+,.0f}")])
    kp = metrics.get('kill_participation')
    if number(kp) and 0 <= kp <= 100:
        add('participation', 'How often you joined the fight', round(kp), '% participation',
            'Your kills and assists accounted for this share of your team’s kills.',
            [('Your takedowns', str(metrics['kills']+metrics['assists'])),
             ('Team kills', str(metrics['team_kills']))])
    damage = metrics.get('damage_share_pct')
    if number(damage) and 0 <= damage <= 100:
        add('damage', 'Your share of the firepower', round(damage), '% of team damage',
            'This is your measured share of your team’s damage to champions.',
            [('Champion damage', f"{metrics['damage_champions']:,.0f}")] if number(metrics.get('damage_champions')) else [])
    alive = stories.get('alive_pct')
    if number(alive):
        add('alive', 'Time to keep making plays', round(alive, 1), '% time alive',
            f"You spent {time(metrics['dead_seconds'])} dead across {time(match['duration'])} of play.",
            [('Match length', time(match['duration'])), ('Deaths', str(metrics.get('deaths', '—')))])
    for badge in stories.get('badges', []):
        add('feat-'+badge['kind'], 'A detail worth the replay', badge['value'], badge['label'],
            badge['note']+' · recorded in this match.', [('Champion', match.get('champion') or '—')])
    casts = {key: metrics.get(key+'_casts') for key in 'qwer'}
    if all(number(value) and value >= 0 for value in casts.values()) and sum(casts.values()) > 0:
        key = max(casts, key=casts.get)
        total = sum(casts.values())
        add('casts', 'Your most-used button', casts[key], key.upper()+' casts',
            f"{key.upper()} made up {casts[key]/total*100:.0f}% of your recorded Q/W/E/R casts. "
            'Cast totals do not reveal exact cast timings.', [('All casts', f'{total:,.0f}')])
    build = report.get('visuals') or {}
    purchases = build.get('build') or []
    if purchases:
        first = purchases[0]
        add('build', 'The opening of your build', time(first['time']),
            'first purchase' if build.get('exact_build') else 'first observed item',
            f"{first.get('name') or 'An item'} {'was purchased' if build.get('exact_build') else 'first appeared'} "
            'at this captured time. The Build page follows the rest of the order.',
            [('Recorded items', str(len(purchases)))])
    objectives = analysis.get('objectives') or []
    sides = {side: sum(event.get('side') == side for event in objectives) for side in ('ally', 'enemy')}
    if objectives:
        add('objectives', 'The map had its own story', len(objectives), 'objective events',
            'Recorded towers and neutral objectives from both teams. Team events '
            'are context; they do not imply you personally secured them.',
            [('Your team', str(sides['ally'])), ('Enemy team', str(sides['enemy']))])
    wallet = analysis.get('peak_wallet')
    if wallet:
        add('wallet', 'The biggest shopping pocket', f"{wallet['wallet']:,.0f}", 'gold held',
            f"Your highest sampled unspent balance was at {time(wallet['time'])}. "
            'This is a snapshot, rather than an exact recall or shopping timestamp.')
    if not deck and number(match.get('duration')):
        add('capture', 'A new chapter is on the board', time(match['duration']), 'played',
            'The captured match is ready. More stories appear as verified final stats '
            'and timeline details arrive.', [('Champion', match.get('champion') or '—')])
    return deck[:20]
