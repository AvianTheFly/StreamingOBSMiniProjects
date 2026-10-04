"""Normalize observed live data and authoritative post-game records without guesses."""
import math

# Every missing field stays absent, so coverage/averages never invent zeroes.
FIELDS = {
    'kills':'kills', 'deaths':'deaths', 'assists':'assists', 'goldEarned':'gold_earned',
    'goldSpent':'gold_spent', 'visionScore':'vision_score', 'wardsPlaced':'wards_placed',
    'wardsKilled':'wards_killed', 'detectorWardsPlaced':'control_wards',
    'totalDamageDealtToChampions':'damage_champions', 'totalDamageTaken':'damage_taken',
    'totalHeal':'healing', 'totalHealsOnTeammates':'healing_allies',
    'totalDamageShieldedOnTeammates':'shielding_allies', 'damageSelfMitigated':'damage_mitigated',
    'damageDealtToObjectives':'damage_objectives', 'damageDealtToTurrets':'damage_turrets',
    'timeCCingOthers':'cc_seconds', 'totalTimeSpentDead':'dead_seconds',
    'turretKills':'turret_kills', 'inhibitorKills':'inhibitor_kills',
    'dragonKills':'dragon_kills', 'baronKills':'baron_kills', 'nexusKills':'nexus_last_hits',
    'nexusTakedowns':'nexus_takedowns', 'objectivesStolen':'objectives_stolen',
    'objectivesStolenAssists':'objective_steal_assists',
    'doubleKills':'double_kills', 'tripleKills':'triple_kills', 'quadraKills':'quadra_kills',
    'pentaKills':'penta_kills', 'killingSprees':'killing_sprees',
    'largestKillingSpree':'largest_killing_spree', 'largestMultiKill':'largest_multi_kill',
    'firstBloodKill':'first_bloods', 'firstBloodAssist':'first_blood_assists',
    'firstTowerKill':'first_towers', 'firstTowerAssist':'first_tower_assists',
    'champLevel':'level', 'totalMinionsKilled':'lane_cs', 'neutralMinionsKilled':'jungle_cs',
    'consumablesPurchased':'consumables_purchased', 'itemsPurchased':'items_purchased',
    'spell1Casts':'q_casts','spell2Casts':'w_casts','spell3Casts':'e_casts','spell4Casts':'r_casts',
    'summoner1Casts':'summoner_1_casts','summoner2Casts':'summoner_2_casts',
    'physicalDamageDealtToChampions':'physical_damage_champions',
    'magicDamageDealtToChampions':'magic_damage_champions','trueDamageDealtToChampions':'true_damage_champions',
    'physicalDamageTaken':'physical_damage_taken','magicDamageTaken':'magic_damage_taken',
    'trueDamageTaken':'true_damage_taken','totalDamageDealt':'damage_all_targets',
    'totalTimeCCDealt':'total_cc_seconds','longestTimeSpentLiving':'longest_life_seconds',
    'largestCriticalStrike':'largest_critical_strike','champExperience':'experience',
    'turretTakedowns':'turret_takedowns','inhibitorTakedowns':'inhibitor_takedowns',
    'sightWardsBoughtInGame':'stealth_wards_bought','visionWardsBoughtInGame':'control_wards_bought',
    'gameEndedInSurrender':'surrender_games','gameEndedInEarlySurrender':'early_surrender_games',
}
CHALLENGES = {'soloKills':'solo_kills', 'skillshotsDodged':'skillshots_dodged',
              'skillshotsHit':'skillshots_hit', 'turretPlatesTaken':'turret_plates',
              'perfectGame':'perfect_games', 'saveAllyFromDeath':'allies_saved',
              'teamElderDragonKills':'team_elder_dragons', 'teamRiftHeraldKills':'team_heralds',
              'teamBaronKills':'team_barons', 'enemyJungleMonsterKills':'enemy_jungle_cs'}


def number(value):
    if isinstance(value, bool):
        return int(value)
    return value if isinstance(value, (float, int)) and math.isfinite(value) and value>=0 else None


def aliases(player):
    result = {str(player.get(k, '')).casefold() for k in ('summonerName','riotId','riotIdGameName','gameName','displayName')}
    name, tag = player.get('riotIdGameName') or player.get('gameName'), player.get('riotIdTagLine') or player.get('tagLine')
    if name and tag:
        result.add((name+'#'+tag).casefold())
    return result-{''}


def same_player(a,b):
    def full(p):
        name,tag = p.get('riotIdGameName') or p.get('gameName'), p.get('riotIdTagLine') or p.get('tagLine')
        return (name+'#'+tag).casefold() if name and tag else str(p.get('riotId','')).casefold()
    first,second = full(a),full(b)
    if '#' in first and '#' in second:
        return first==second
    return bool(aliases(a)&aliases(b))


def position(player):
    timeline = player.get('timeline') or {}
    value = player.get('teamPosition') or player.get('individualPosition') or player.get('position')
    if value:
        return {'UTILITY':'SUPPORT', 'MIDDLE':'MID'}.get(value, value)
    if timeline.get('role') == 'DUO_SUPPORT':
        return 'SUPPORT'
    return {'BOTTOM':'BOTTOM', 'TOP':'TOP', 'MIDDLE':'MID', 'JUNGLE':'JUNGLE'}.get(timeline.get('lane'), '')


def champion(player, catalog):
    return player.get('championName') or catalog.get(str(player.get('championId')), {}).get('name') or ('Champion '+str(player.get('championId')))


def matchups(players, own, catalog):
    result = {}
    for key, team, role in [('enemy_adc', False, 'BOTTOM'), ('enemy_support',False,'SUPPORT'),
                            ('ally_support',True,'SUPPORT'), ('ally_adc',True,'BOTTOM')]:
        candidates = [p for p in players if p is not own and
                      (p.get('teamId',p.get('team')) == own.get('teamId',own.get('team'))) == team and position(p)==role]
        if len(candidates)==1:
            result[key] = champion(candidates[0], catalog)
    return result


def postgame(data, puuid, catalog=None, item_catalog=None):
    catalog, item_catalog = catalog or {}, item_catalog or {}
    info = data.get('info', data)
    identities = {i.get('participantId'): i.get('player', {}) for i in info.get('participantIdentities', [])}
    players = info.get('participants', [])
    own = next((p for p in players if p.get('puuid')==puuid or identities.get(p.get('participantId'),{}).get('puuid')==puuid), None)
    if own is None:
        return None
    stats = own if 'info' in data else own.get('stats', own)
    values = {target:number(stats[source]) for source,target in FIELDS.items() if source in stats and number(stats[source]) is not None}
    if 'lane_cs' in values and 'jungle_cs' in values:
        values['cs'] = values['lane_cs'] + values['jungle_cs']
    for source, target in CHALLENGES.items():
        v = number((own.get('challenges') or {}).get(source))
        if v is not None:
            values[target] = v
    team_kills = sum(number(p.get('stats',p).get('kills')) or 0 for p in players if p.get('teamId')==own.get('teamId'))
    teammates=[p for p in players if p.get('teamId')==own.get('teamId')]
    if len(players)>1:
        values['team_kills'] = team_kills
    # Shares require a complete five-player team, not a partial client response.
    if len(teammates)==5:
        for source,target in [('totalDamageDealtToChampions','team_damage_champions'),('goldEarned','team_gold_earned')]:
            parts=[number((p if 'info' in data else p.get('stats',p)).get(source)) for p in teammates]
            if all(v is not None for v in parts):values[target]=sum(parts)
    for team in info.get('teams', []):
        if team.get('teamId') != own.get('teamId'):
            continue
        for source, target in [('dragon','team_dragons'), ('baron','team_barons'), ('riftHerald','team_heralds'),
                               ('horde','team_grubs'), ('atakhan','team_atakhans'), ('tower','team_turrets'), ('inhibitor','team_inhibitors')]:
            v = number((team.get('objectives',{}).get(source) or {}).get('kills'))
            legacy = {'dragon':'dragonKills','baron':'baronKills','riftHerald':'riftHeraldKills','tower':'towerKills','inhibitor':'inhibitorKills'}.get(source)
            if v is None and legacy:
                v = number(team.get(legacy))
            if v is not None:
                values[target] = v
    items = []
    for i in range(7):
        item = stats.get('item'+str(i), 0)
        if item:
            items.append({'id':item, 'name':item_catalog.get(str(item), {}).get('name') or 'Item '+str(item), 'slot':i})
    duration = number(info.get('gameDuration'))
    if duration is None or not info.get('gameId'):
        return None
    # Old Match-v4/LCU records use seconds; pre-11.20 Match-v5 used milliseconds.
    if 'info' in data and info.get('gameVersion','').split('.')[:2] and duration>86400:
        duration /= 1000
    win = stats.get('win')
    win = win if isinstance(win, bool) else None
    opponent=[p for p in players if p.get('teamId')!=own.get('teamId') and position(own) and position(p)==position(own)]
    return dict(id=f'{puuid}:{info["gameId"]}', account=puuid, game_id=str(info['gameId']), schema_version=2,
                participant_id=own.get('participantId'), opponent_id=opponent[0].get('participantId') if len(opponent)==1 else None,
                started_at=(number(info.get('gameCreation') or info.get('gameStartTimestamp')) or 0)/1000,
                duration=duration, queue=info.get('queueId'), map=info.get('mapId'),
                mode=info.get('gameMode',''), patch=info.get('gameVersion',''),
                champion=champion(own,catalog), role=position(own), win=win,
                state='complete', source='match_v5' if 'info' in data else 'league_client',
                metrics=values, items=items, matchups=matchups(players,own,catalog), raw_postgame=data)


def live(data, account, game_id, now):
    active = data.get('activePlayer', {})
    names = aliases(active)
    players = data.get('allPlayers', [])
    candidates = [p for p in players if same_player(p,active)]
    if len(candidates)!=1:
        raise ValueError('Active League player could not be identified')
    own = candidates[0]
    scores = own.get('scores', {})
    metrics = {k:number(scores[k]) for k in ('kills','deaths','assists') if k in scores and number(scores[k]) is not None}
    for field,key in [('creepScore','cs'), ('wardScore','vision_score')]:
        if number(scores.get(field)) is not None:
            metrics[key] = number(scores[field])
    metrics['level'] = number(own.get('level')) or 0
    metrics['team_kills'] = sum(number(p.get('scores',{}).get('kills')) or 0 for p in players if p.get('team')==own.get('team'))
    friendly = set().union(*(aliases(p) for p in players if p.get('team')==own.get('team')))
    own_names = aliases(own)
    events = data.get('events', {}).get('Events', [])
    seen = set()
    event_map = {'DragonKill':('dragon_kills','team_dragons'), 'BaronKill':('baron_kills','team_barons'),
                 'HeraldKill':('herald_kills','team_heralds'), 'HordeKill':('grub_kills','team_grubs'),
                 'AtakhanKill':('atakhan_kills','team_atakhans'), 'TurretKilled':('turret_kills','team_turrets'),
                 'InhibKilled':('inhibitor_kills','team_inhibitors'), 'FirstBlood':('first_bloods','team_first_bloods'),
                 'FirstBrick':('first_towers','team_first_towers')}
    for pair in event_map.values():
        metrics.update({key:0 for key in pair})
    for key in ('double_kills','triple_kills','quadra_kills','penta_kills','team_elder_dragons',
                'objective_assists','objectives_stolen','objective_steal_assists',
                'team_aces','first_blood_assists'):
        metrics[key] = 0
    win = None
    for event in events:
        identity = str(sorted(event.items()))
        if identity in seen:
            continue
        seen.add(identity)
        name = event.get('EventName')
        killer = str(event.get('KillerName') or event.get('Recipient') or '').casefold()
        assisting = any(str(a).casefold() in own_names for a in event.get('Assisters',[]))
        if name in event_map:
            personal, team = event_map[name]
            metrics[personal] += int(killer in own_names)
            metrics[team] += int(killer in friendly)
            if name=='FirstBlood':
                metrics['first_blood_assists'] += int(assisting)
            if name in {'DragonKill','BaronKill','HeraldKill','HordeKill','AtakhanKill'}:
                metrics['objective_assists'] += int(assisting)
                if str(event.get('Stolen','')).lower()=='true':
                    metrics['objectives_stolen'] += int(killer in own_names)
                    metrics['objective_steal_assists'] += int(assisting)
            if name=='DragonKill' and str(event.get('DragonType','')).lower()=='elder':
                metrics['team_elder_dragons'] += int(killer in friendly)
        if name=='Multikill' and killer in own_names:
            key = {2:'double_kills',3:'triple_kills',4:'quadra_kills',5:'penta_kills'}.get(event.get('KillStreak'))
            if key:
                metrics[key] += 1
        if name=='GameEnd':
            win = {'win':True,'lose':False,'loss':False}.get(str(event.get('Result','')).lower())
        if name=='Ace':
            metrics['team_aces'] += int(event.get('AcingTeam')==own.get('team'))
    duration = number(data.get('gameData',{}).get('gameTime'))
    if duration is None:
        raise ValueError('Missing game clock')
    return dict(id=f'{account}:{game_id}', account=account, game_id=str(game_id),
                started_at=now-duration, duration=duration, champion=own.get('championName',''),
                role=position(own), win=win, state='complete' if win is not None else 'live',
                source='live_client', metrics=metrics,
                items=[{'id':i.get('itemID'), 'name':i.get('displayName') or 'Item '+str(i.get('itemID')), 'slot':i.get('slot')}
                       for i in own.get('items',[]) if i.get('itemID')],
                matchups=matchups(players,own,{}), raw_events=events)
