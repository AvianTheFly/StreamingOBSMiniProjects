"""Personal combat and global objectives; pure projections of observed events."""
import json
from .normalize import aliases, number

OBJECTIVES = {'DragonKill': 'Dragon', 'BaronKill': 'Baron Nashor', 'HeraldKill': 'Rift Herald',
              'HordeKill': 'Void grub', 'AtakhanKill': 'Atakhan', 'TurretKilled': 'Tower',
              'InhibKilled': 'Inhibitor'}


def row(time, kind, label, detail='', side='personal', source='live'):
    return dict(time=time, kind=kind, label=label, detail=detail, side=side, source=source)


def live_events(data, own):
    players = data.get('allPlayers', [])
    # Ambiguous name-only aliases must not credit another player to the streamer.
    names = {name for name in aliases(own) if sum(name in aliases(p) for p in players) == 1}
    def player(value):
        candidates = [p for p in players if str(value).casefold() in aliases(p)]
        return candidates[0] if len(candidates) == 1 else {}
    def champion(value):
        return player(value).get('championName', 'opponent')
    result = []
    for e in data.get('events', {}).get('Events', []):
        t = number(e.get('EventTime'))
        if t is None:
            continue
        kind = e.get('EventName')
        killer, victim = e.get('KillerName', ''), e.get('VictimName', '')
        me = str(killer).casefold() in names
        assist = any(str(a).casefold() in names for a in e.get('Assisters', []))
        if kind == 'ChampionKill':
            if str(victim).casefold() in names:
                result.append(row(t, 'death', 'You died', champion(killer)))
            elif me:
                result.append(row(t, 'kill', 'You got a kill', champion(victim)))
            elif assist:
                result.append(row(t, 'assist', 'You assisted', champion(victim)))
        elif kind in OBJECTIVES:
            label = OBJECTIVES[kind]
            if kind == 'DragonKill' and e.get('DragonType'):
                label = str(e['DragonType']).title() + ' dragon'
            team = player(killer).get('team')
            # Structure IDs identify the destroyed team's structure, even for minion kills.
            target = str(e.get('TurretKilled') or e.get('InhibKilled') or '')
            if team is None and kind in {'TurretKilled', 'InhibKilled'}:
                team = 'CHAOS' if '_T1_' in target else 'ORDER' if '_T2_' in target else None
            side = 'ally' if team == own.get('team') else 'enemy' if team else 'unknown'
            detail = 'Your last hit' if me else 'You assisted' if assist else {'ally':'Your team', 'enemy':'Enemy team', 'unknown':'Team unconfirmed'}[side]
            result.append(row(t, 'objective', label, detail, side))
        elif kind == 'Multikill' and me:
            label = {2:'Double kill', 3:'Triple kill', 4:'Quadra kill', 5:'Pentakill'}.get(e.get('KillStreak'))
            if label:
                result.append(row(t, 'milestone', label))
        elif kind in {'FirstBlood', 'FirstBrick'} and str(e.get('Recipient', killer)).casefold() in names:
            result.append(row(t, 'milestone', 'First blood' if kind == 'FirstBlood' else 'First tower'))
    return merge([], result)


def merge(previous, incoming):
    values = {json.dumps(e, sort_keys=True): e for e in [*previous, *incoming]}
    return sorted(values.values(), key=lambda e: e['time'])


def official_events(events, record, catalog):
    own = record['participant_id']
    team = record.get('team_id')
    roster = record.get('participants', {})
    result = []
    def champion(pid):
        return roster.get(str(pid), {}).get('champion', 'opponent')
    for e in events:
        stamp = number(e.get('timestamp'))
        if stamp is None:
            continue
        t, kind = stamp / 1000, e.get('type')
        me = e.get('killerId') == own
        assist = own in (e.get('assistingParticipantIds') or [])
        if kind == 'CHAMPION_KILL':
            if e.get('victimId') == own:
                result.append(row(t, 'death', 'You died', champion(e.get('killerId')), source='official'))
            elif me or assist:
                result.append(row(t, 'kill' if me else 'assist', 'You got a kill' if me else 'You assisted', champion(e.get('victimId')), source='official'))
        elif kind in {'ELITE_MONSTER_KILL', 'BUILDING_KILL'}:
            label = str(e.get('monsterSubType') or e.get('monsterType') or e.get('buildingType') or 'Objective').replace('_', ' ').title()
            killer_team = e.get('killerTeamId') or roster.get(str(e.get('killerId')), {}).get('team')
            if kind == 'BUILDING_KILL' and not killer_team and e.get('teamId') in (100, 200):
                killer_team = 300 - e['teamId']
            side = 'ally' if team and killer_team == team else 'enemy' if team and killer_team else 'unknown'
            detail = 'Your last hit' if me else 'You assisted' if assist else {'ally':'Your team','enemy':'Enemy team','unknown':'Team unconfirmed'}[side]
            result.append(row(t, 'objective', label, detail, side, 'official'))
        elif e.get('participantId') == own:
            if kind == 'LEVEL_UP':
                result.append(row(t, 'level', f"Level {e.get('level', '?')}", source='official'))
            elif kind == 'SKILL_LEVEL_UP':
                result.append(dict(row(t, 'skill', 'Ability upgraded', {1:'Q',2:'W',3:'E',4:'R'}.get(e.get('skillSlot'), 'Ability'), source='official'), skill_slot=e.get('skillSlot')))
            elif kind in {'ITEM_PURCHASED', 'ITEM_SOLD', 'ITEM_UNDO'}:
                item = catalog.get(str(e.get('itemId')), {}).get('name', 'Item ' + str(e.get('itemId', '')))
                result.append(dict(row(t, 'item', {'ITEM_PURCHASED':'Purchased','ITEM_SOLD':'Sold','ITEM_UNDO':'Purchase undo'}[kind], item if kind != 'ITEM_UNDO' else '', source='official'),item_id=e.get('itemId'), action=kind))
        elif kind in {'WARD_PLACED', 'WARD_KILL'} and e.get('creatorId' if kind == 'WARD_PLACED' else 'killerId') == own:
            result.append(row(t, 'vision', 'Ward placed' if kind == 'WARD_PLACED' else 'Ward cleared', str(e.get('wardType', '')).replace('_', ' ').title(), source='official'))
    return merge([], result)
