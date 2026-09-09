"""Validated, atomic frontend settings and human-readable detector descriptions."""
import copy
import json
import math
import re
from .engine import defaults

FIELDS = {'health_percent':'Health (%)','current_gold':'Current gold','level':'Level',
          'cs':'Creep score','ward_score':'Vision score','resource':'Resource amount',
          'kills':'Kills','deaths':'Deaths','assists':'Assists'}
OPERATORS = {'crosses_below','crosses_above','increases_by','decreases_by'}
EVENT_NAMES = ['GameStart','MinionsSpawning','ChampionKill','FirstBlood','Multikill','Ace','TurretKilled',
               'FirstBrick','InhibKilled','InhibRespawningSoon','InhibRespawned','DragonKill','HordeKill',
               'HeraldKill','BaronKill','GameEnd','AtakhanKill']
DIRECT_HELP = {
 'game_start':('GameStart','Game start from the event feed. A fresh connection only displays it in the first five game seconds.'),
 'minions_spawning':('MinionsSpawning','The initial minion spawn event; this is not every wave.'),
 'first_blood':('FirstBlood','Recipient identifies who earned first blood. Global event, including the other team.'),
 'ace':('Ace','AcingTeam identifies the team that scored the ace. Global event.'),
 'turret_destroyed':('TurretKilled','The destroyed turret identifier is shown without guessing its lane from an outdated ID format.'),
 'first_turret':('FirstBrick','The first turret of the match. Replaces a generic turret alert in the same slot.'),
 'inhibitor_destroyed':('InhibKilled','The inhibitor identifier comes directly from the event.'),
 'inhibitor_respawning_soon':('InhibRespawningSoon','Riot reports the warning; no estimated respawn timer is used.'),
 'inhibitor_respawned':('InhibRespawned','Riot reports the respawn directly.'),
 'void_grub':('HordeKill','One event per individual Void Grub, not the entire group. Killer resolves team when possible.'),
 'herald':('HeraldKill','Killer resolves team when possible.'), 'baron':('BaronKill','Killer resolves team when possible.'),
 'atakhan_legacy':('AtakhanKill','Legacy trigger, disabled by default. Only fires if the client actually emits it.'),
 'kill':('ChampionKill','KillerName matches your local Riot ID or summoner alias.'),
 'death':('ChampionKill / isDead','VictimName matches you, or your local isDead changes from false to true.'),
 'assist':('ChampionKill','Your name is in Assisters, and you are neither the killer nor victim.'),
 'victory':('GameEnd','Result is Win, relative to the local game context.'),
 'defeat':('GameEnd','Result is Lose, relative to the local game context.'),
 'game_end':('GameEnd','Fallback only when Result is neither Win nor Lose.'),
 'objective_steal':('Objective event + Stolen','Dragon, Grub, Herald, Baron or legacy Atakhan with Stolen equal to true (boolean or string). Replaces its generic objective alert.'),
}
DIFF_HELP = {
 'level_up':'Your player level increases between snapshots.',
 'ultimate_learned':'Your R abilityLevel changes from 0 to a positive rank. This detects learning R, not casting it.',
 'ability_rank_up':'Your Q/W/E/R or other supplied ability rank increases; learning R for the first time uses Ultimate Learned instead.',
 'respawn':'Your isDead changes from true to false.',
 'inventory_added':'The total count for an itemID increases. Inventory slot reordering is ignored. This does not prove a purchase.',
 'inventory_removed':'The total count for an itemID decreases. Could be a sale, consumption, upgrade or other inventory effect.',
 'low_health':'While alive, your health crosses from above 20% to 20% or lower.',
 'heavy_health_loss':'While alive in both samples, net health falls by more than 20% of current maximum health in one poll interval. Damage source is unknown.',
 'large_heal':'While alive in both samples, net health rises by more than 20% of current maximum health in one poll interval. Healing source is unknown.',
 'resource_spent':'Your resourceValue drops by more than 30 in one poll interval. This cannot identify an ability cast.',
 'cs_milestone':'Your creepScore crosses a multiple of 50 (50, 100, 150…).',
 'vision_activity':'Your wardScore increases by at least 1 in one poll interval. It does not identify ward placements.',
 'manpower_advantage':'Your team has at least two more living players than the enemy team, after previously having an advantage below two.',
 'low_hp_kill':'A ChampionKill credits you while the current snapshot shows you alive at 20% health or less. Health is sampled, not measured at the exact kill instant.',
 'low_hp_multikill':'A Multikill credits you while the current snapshot shows you alive at 20% health or less.',
}
POSSIBLE_HELP = {
 'possible_purchase':'Inventory gains an item and your currentGold falls by more than 50 in the same interval. Other inventory/gold effects can resemble shopping.',
 'possible_item_upgrade':'At least one item count increases and another decreases in the same interval. Recipes are not checked, so completion is not confirmed.',
 'possible_consumable_use':'A consumable item count decreases, nothing is added, and gold rises by no more than 5. Consumption is not confirmed.',
 'possible_base_visit':'Inventory gains an item, gold drops by more than 50, and health increases by more than 15% of max health while alive. This does not confirm a recall or fountain location.',
 'possible_combat':'While alive, net health falls by more than 5% of max health in one poll interval. Could be minions, monsters, towers or other health costs.',
 'possible_low_hp_escape':'You were at 20% health or less, then remained alive for eight seconds after the last low-health sample, with no health loss greater than 5% of max HP during the last eight seconds. No position or combat-end signal is available.',
 'possible_teamfight':'At least three champion deaths occur within 20 game seconds, with the newest no more than two seconds old. Separate fights may be grouped because positions are unavailable.',
 'possible_objective_fight':'A champion death and an objective event are within 12 seconds of one another; both remain in the 20-second window. Their physical locations are unknown.',
 'possible_power_spike':'Your level increases in the same interval that inventory both adds and removes items. No champion-specific power model is used.',
 'possible_roam':'A champion kill involves killer/assisters with three or more different assigned roles. Roles do not reveal where the fight happened.',
 'possible_jungle_activity':'Your assigned role is JUNGLE and CS rises by at least four in one interval. No specific camp can be identified.',
}

def describe(key, rule):
    if rule.get('trigger'):
        tr=rule['trigger']
        if tr['type']=='event':
            text=f"Riot emits {tr['event_name']}; participant filter: {tr['scope'].replace('_',' ')}."
            if tr.get('field'): text+=f" Field {tr['field']} must equal {tr.get('equals','')}."
            return {'kind':'Custom event','description':text,'fields':[tr['event_name']]}
        text=f"Your {FIELDS[tr['field']]} {tr['operator'].replace('_',' ')} {tr['value']} between consecutive valid snapshots."
        return {'kind':'Custom snapshot','description':text,'fields':[tr['field']]}
    if key in DIRECT_HELP:
        field,text=DIRECT_HELP[key]; return {'kind':'Direct event','description':text,'fields':[field]}
    if key in {'double_kill','triple_kill','quadra_kill','pentakill'}:
        n={'double_kill':2,'triple_kill':3,'quadra_kill':4,'pentakill':5}[key]
        return {'kind':'Direct event','description':f'Multikill credits your local player and KillStreak equals {n}. Upgrades the local kill alert in its reusable slot.','fields':['Multikill','KillerName','KillStreak']}
    if key.startswith('dragon'):
        variant=key.removeprefix('dragon_')
        text=f'DragonKill with DragonType {variant.title()}.' if key!='dragon' else 'Fallback DragonKill for an unrecognized or missing DragonType.'
        return {'kind':'Direct event','description':text+' Killer identifies the team when resolvable.','fields':['DragonKill','DragonType']}
    if key in DIFF_HELP: return {'kind':'Snapshot change','description':DIFF_HELP[key],'fields':['allgamedata']}
    if key in POSSIBLE_HELP: return {'kind':'Possible correlation','description':POSSIBLE_HELP[key],'fields':['allgamedata','event history']}
    raise ValueError('Missing detector description: '+key)

def number(value, low, high, label):
    if isinstance(value,bool): raise ValueError(label+' must be a number')
    try: value=float(value)
    except (TypeError,ValueError): raise ValueError(label+' must be a number')
    if not math.isfinite(value) or not low<=value<=high: raise ValueError(f'{label} must be between {low} and {high}')
    return value

def validate_rule(rule, custom=False):
    r=copy.deepcopy(rule)
    for k,lo,hi in [('priority',0,100),('duration',1,60),('cooldown',0,600),('volume',0,1),('start_time',0,86400)]:
        r[k]=number(r.get(k,0 if k=='start_time' else 1),lo,hi,k)
    for k in ['enabled','loop']:
        if not isinstance(r.get(k,False),bool): raise ValueError(k+' must be true or false')
        r[k]=r.get(k,False)
    r['title']=str(r.get('title',''))[:100]
    r['audio']=str(r.get('audio',''))
    if len(r['audio'])>2048: raise ValueError('Audio path too long')
    r['media']=str(r.get('media',''))
    if len(r['media'])>2048: raise ValueError('Media path too long')
    if not isinstance(r.get('pool_enabled',True),bool): raise ValueError('Pool enabled must be true or false')
    pool=r.get('media_pool',[])
    if not isinstance(pool,list) or len(pool)>30: raise ValueError('Use at most 30 alternatives per event')
    r['media_pool']=[]
    seen={r['media']}
    for item in pool:
        if not isinstance(item,dict) or set(item)-{'media','duration','start_time','loop'}:
            raise ValueError('Invalid media pool entry')
        media=item.get('media')
        if not isinstance(media,str) or not media or len(media)>2048: raise ValueError('Choose a media file for each alternative')
        if media in seen: continue
        seen.add(media)
        loop=item.get('loop',False)
        if not isinstance(loop,bool): raise ValueError('Loop must be true or false')
        r['media_pool'].append({'media':media,'duration':number(item.get('duration',2),1,60,'Variant duration'),
                              'start_time':number(item.get('start_time',0),0,86400,'Variant start'),'loop':loop})
    if custom:
        tr=r.get('trigger',{})
        if not isinstance(tr,dict): raise ValueError('Choose a valid trigger')
        if tr.get('type')=='event':
            if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,79}',str(tr.get('event_name',''))): raise ValueError('Enter a valid Riot event name')
            if tr.get('scope') not in {'any','local_killer','local_victim','local_assister','local_team'}: raise ValueError('Invalid participant filter')
            if tr.get('field','') not in {'','DragonType','KillStreak','Result','Stolen','AcingTeam'}: raise ValueError('Invalid event field')
            tr['equals']=str(tr.get('equals',''))[:100]
        elif tr.get('type')=='snapshot':
            if tr.get('field') not in FIELDS or tr.get('operator') not in OPERATORS: raise ValueError('Invalid snapshot condition')
            tr['value']=number(tr.get('value'),0,1000000,'Threshold')
        else: raise ValueError('Choose a trigger type')
    elif 'trigger' in r: raise ValueError('Built-in detectors cannot be replaced; add a custom rule instead')
    return r

class SettingsStore:
    def __init__(self,path): self.path=path
    def load(self):
        config=defaults(); config.update(revision=0,paused=False)
        if self.path.exists():
            saved=json.loads(self.path.read_text(encoding='utf-8'))
            for key,rule in saved.get('events',{}).items():
                if key in config['events']: config['events'][key].update(rule)
                elif key.startswith('custom_'): config['events'][key]=validate_rule(rule,True)
            config.update({k:v for k,v in saved.items() if k!='events'})
        return config
    def save(self,config):
        new=copy.deepcopy(config); new['revision']=new.get('revision',0)+1
        temp=self.path.with_suffix('.tmp')
        temp.write_text(json.dumps(new,indent=2,ensure_ascii=False)+'\n',encoding='utf-8'); temp.replace(self.path)
        return new
