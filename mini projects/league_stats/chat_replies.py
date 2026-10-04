"""Short, consistent Twitch copy and local previews; no transport or credentials."""
from .community import TOPICS

ICONS = dict(cs='🌾',kda='⚔️',record='🏆',dragons='🐉',misses='🎯',damage='💥',
             vision='👁️',streak='🔥',rank='📈',recap='🧾',goal='🌱',help='📖',live='🎮',averages='📊',
             lifetime='🗂️',objectives='🐲',items='🛠️',matchup='🤝',nexus='🏰',helpers='🤝')


def number(value, digits=0):
    if value is None:
        return 'unknown'
    text = f'{value:,.{digits}f}'
    return text.rstrip('0').rstrip('.') if digits else text


def scope(topic):
    return ('Current live game' if topic=='live' else 'All recorded · current account' if topic in ('lifetime','items') else
            'Current lane · same queue history' if topic=='matchup' else 'Command guide' if topic in ('help','helpers') else 'Current saved session')


def stat(topic, summary, insights, *, ranked=None, recap=None, progress=None,current=None,lifetime=None,finished_items=None,lane=None):
    m = summary['metrics']
    def total(key):
        return number(m.get(key,{}).get('total'))
    if topic == 'help':
        return '📖 Stats → !stats <topic> · '+ ' / '.join(t for t in TOPICS if t!='help')
    if topic == 'helpers':
        return '🤝 Trusted helpers → !melee / !range / !cannon · Undo your last report: !statundo · Broadcaster, allowed mods and named helpers only'
    if topic == 'live':
        if not current or not current.get('connected'):
            return '🎮 Current game · No live game being tracked'
        v=current['metrics']
        return f'🎮 Live {current["champion"]} · '+ '/'.join(number(v.get(k)) for k in ('kills','deaths','assists'))+f' · {number(v.get("cs"))} CS · {number(current.get("cs_per_minute"),2)}/min'
    if topic == 'lifetime':
        a=lifetime or {}
        def count(key):return number(a.get('metrics',{}).get(key,{}).get('total'))
        return f'🗂️ All recorded · {a.get("completed_games",0)} completed · {a.get("wins",0)}W–{a.get("losses",0)}L · {count("kills")} kills · {count("deaths")} deaths · {count("cs")} CS'
    if topic == 'items':
        text=' · '.join(f'{i["name"]} ({i["games"]} '+('game' if i['games']==1 else 'games')+')' for i in finished_items or [])
        return '🛠️ All recorded · Common final items · '+(text or 'No completed inventories yet')
    if topic == 'matchup':
        if not current or not current.get('connected'):
            return '🤝 Lane matchup · No live game being tracked'
        if not lane:
            return '🤝 Lane matchup · Waiting for confirmed ADC / support roles'
        def comparison(r):
            outcome=('queue not reported' if not r.get('queue_known',True) else
                     f'{r["wins"]}W–{r["losses"]}L in {r["result_games"]} '+('game' if r['result_games']==1 else 'games') if r['result_games'] else 'no completed results yet')
            return f'{r["label"]} {r["champion"]}: {outcome}'
        return ('🤝 Same queue history · ' if all(r.get('queue_known',True) for r in lane) else '🤝 Current lane · ')+' · '.join(comparison(r) for r in lane)
    if topic == 'rank':
        rank = next((r for r in ranked or [] if r['queue']=='RANKED_SOLO_5x5'),None)
        if not rank:
            return '📈 Solo/Duo · Rank not observed yet'
        if rank['tier'] in ('NONE','UNRANKED'):
            return '📈 Solo/Duo · Unranked'+(' · Placements' if rank.get('provisional') else '')
        movement = rank.get('session_movement')
        change = f' · {movement:+,} LP observed this session' if movement is not None else ''
        return f'📈 Solo/Duo · {rank["tier"].title()} {rank["division"]} · {number(rank["lp"])} LP{change}'
    if topic == 'recap':
        if not recap:
            return '🧾 Last game · No completed game in this session yet'
        v = recap['metrics']
        result = 'Win' if recap['win'] is True else 'Loss' if recap['win'] is False else 'Finished'
        return f'🧾 Last game · {recap["champion"]} {result} · '+ '/'.join(number(v.get(k)) for k in ('kills','deaths','assists'))+f' · {number(v.get("cs_per_minute"),2)} CS/min'
    if topic == 'goal':
        p = progress or {}
        return f'🌱 Session CS goal · {number(p.get("cs_target"),1)}/min · {p.get("reached_games",0)}/{p.get("covered_games",0)} completed games on target'
    if not summary['completed_games'] and not summary['live_or_partial_games']:
        return f'{ICONS[topic]} Session {TOPICS[topic].lower()} · No games tracked yet'
    if topic == 'averages':
        def average(key):return number(m.get(key,{}).get('average'),1)
        seconds=summary.get('average_game_seconds')
        length=f'{int(seconds//60)}:{int(seconds%60):02d}' if seconds is not None else 'unknown'
        return f'📊 Session averages · K/D/A '+ '/'.join(average(k) for k in ('kills','deaths','assists'))+f' · Game {length} · {number(summary["cs_per_minute"],2)} CS/min · Completed games with coverage'
    if topic == 'objectives':
        return f'🐲 Session objectives · You: Dragons {total("dragon_kills")} · Barons {total("baron_kills")} · Towers {total("turret_kills")} · First bloods {total("first_bloods")}'
    if topic == 'nexus':
        return f'🏰 Session Nexus · API kills {total("nexus_last_hits")} · Helper-confirmed +50g reports {total("nexus_last_hits_manual")}'
    if topic == 'cs':
        text = f'CS · {total("cs")} total · {number(summary["cs_per_minute"],2)}/min (completed)'
    elif topic == 'kda':
        text = 'K/D/A · '+' / '.join(total(k) for k in ('kills','deaths','assists'))+f' · {number(summary["kda"],2)} KDA (completed)'
    elif topic == 'record':
        rate='WR unknown' if summary['win_rate'] is None else number(summary['win_rate'],1)+'% WR'
        text = f'Record · {summary["wins"]}W–{summary["losses"]}L · {rate}'
    elif topic == 'dragons':
        text = f'Dragons · You {total("dragon_kills")} · Team {total("team_dragons")}'
    elif topic == 'misses':
        text = f'Reported misses · Melee {total("missed_melee")} · Ranged {total("missed_ranged")} · Cannon {total("missed_cannon")}'
    elif topic == 'damage':
        text = f'Damage to champions · {total("damage_champions")}'
    elif topic == 'vision':
        text = f'Vision score · {total("vision_score")}'
    else:
        streak = insights['streak']
        text = f'Streak · {streak["current"]} {streak["kind"] or "completed results"}'
    return f'{ICONS[topic]} Session {text}'


def catalog(summary, insights, **facts):
    return [dict(command='!stats' if topic=='help' else '!stats '+topic,topic=topic,
                 label=ICONS[topic]+' '+title,scope=scope(topic),text=stat(topic,summary,insights,**facts))
            for topic,title in TOPICS.items()]


def helper(action, metric, record, settings, *, observation=None):
    if action == 'undo':
        if observation:
            name=observation.get('label') or observation['metric'].replace('_',' ')
            return f'↩️ Last report undone · {name} · This game: {number(record["metrics"].get(observation["metric"]))}'
        return f'↩️ Last report undone · This game: {number(record["metrics"].get("missed_minions"))} reported minion misses'
    labels = dict(missed_melee='Melee miss',missed_ranged='Ranged miss',missed_cannon='Cannon miss',
                  nexus_last_hits_manual='Nexus last hit')
    label = labels.get(metric,settings.get('custom_counters',{}).get(metric.removeprefix('custom_'),'Observation'))
    return f'✅ {label} +1 · This game: {number(record["metrics"].get(metric))} · Undo: !statundo'
