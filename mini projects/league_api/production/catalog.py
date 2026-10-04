"""Declarative border shows. Detection and rendering do not live in this table."""
import re

GROUPS = {'combat':'Kills & combat', 'objectives':'Dragons & objectives',
          'structures':'Structures', 'survival':'Health & respawn',
          'progression':'Levels & abilities', 'economy':'Items, farming & vision',
          'lifecycle':'Match milestones', 'inferred':'Optional signals',
          'custom_rules':'Your custom rules'}
NAMES = {'earth':'MOUNTAIN DRAGON', 'fire':'INFERNAL DRAGON', 'water':'OCEAN DRAGON',
         'air':'CLOUD DRAGON', 'hextech':'HEXTECH DRAGON', 'chemtech':'CHEMTECH DRAGON',
         'elder':'ELDER DRAGON'}
STREAKS = {'double_kill':2, 'triple_kill':3, 'quadra_kill':4, 'pentakill':5}


def definition(title, category, kind, theme, priority, seconds=2, cooldown=8,
               rank=1, enabled=True):
    return dict(title=title, category=category, kind=kind, theme=theme, priority=priority,
                seconds=seconds, cooldown=cooldown, rank=rank, enabled=enabled, family=category)


CATALOG = {
    'kill': definition('TAKEDOWN', 'combat', 'blades', 'blood', 55, 1.4, 3),
    'assist': definition('ASSIST', 'combat', 'link', 'mint', 35, 1.1, 5),
    'first_blood': definition('FIRST BLOOD', 'combat', 'blades', 'blood', 87, 3, 0, 3),
    'low_hp_kill': definition('CLUTCH KILL', 'combat', 'blades', 'blood', 91, 3, 0, 4),
    'low_hp_multikill': definition('CLUTCH MULTIKILL', 'combat', 'streak', 'blood', 97, 3.7, 0, 4),
    'ace': definition('TEAM ACE', 'objectives', 'crown', 'gold', 94, 3.5, 0, 4),
    'dragon': definition('DRAGON SECURED', 'objectives', 'dragon', 'gold', 98, 3, 0),
    'baron': definition('BARON SECURED', 'objectives', 'void', 'void', 96, 3.7, 0, 4),
    'herald': definition('HERALD SECURED', 'objectives', 'eye', 'void', 89, 3, 0, 3),
    'void_grub': definition('VOID GRUB', 'objectives', 'grubs', 'void', 62, 1.8, 1, 2),
    'objective_steal': definition('OBJECTIVE STOLEN', 'objectives', 'crown', 'cyan', 99, 3.7, 0, 4),
    'atakhan_legacy': definition('ATAKHAN', 'objectives', 'void', 'blood', 95, 3.7, 0, enabled=False),
    'turret_destroyed': definition('TOWER DOWN', 'structures', 'structure', 'earth', 70, 2.5, 3),
    'first_turret': definition('FIRST TOWER', 'structures', 'structure', 'gold', 82, 3, 0, 3),
    'inhibitor_destroyed': definition('INHIBITOR DOWN', 'structures', 'structure', 'hextech', 84, 3, 0, 3),
    'inhibitor_respawning_soon': definition('INHIBITOR RETURNING', 'structures', 'portal', 'hextech', 40, 1.5, 10),
    'inhibitor_respawned': definition('INHIBITOR RESTORED', 'structures', 'portal', 'hextech', 45, 1.8, 10),
    'death': definition('BACK IN A MOMENT', 'survival', 'fracture', 'ash', 61, 1.6, 8),
    'respawn': definition('BACK IN THE FIGHT', 'survival', 'wings', 'mint', 74, 2, 8),
    'low_health': definition('ON THE EDGE', 'survival', 'pulse', 'blood', 64, 1.6, 20),
    'heavy_health_loss': definition('IMPACT', 'survival', 'fracture', 'blood', 48, 1.3, 12),
    'large_heal': definition('SECOND WIND', 'survival', 'wings', 'mint', 49, 1.6, 12),
    'resource_spent': definition('ENERGY', 'progression', 'runes', 'cyan', 15, .8, 15, enabled=False),
    'level_up': definition('LEVEL UP', 'progression', 'runes', 'gold', 73, 2, 0, 2),
    'ultimate_learned': definition('ULTIMATE UNLOCKED', 'progression', 'runes', 'arcane', 83, 3, 0, 4),
    'ability_rank_up': definition('ABILITY UPGRADED', 'progression', 'runes', 'cyan', 38, 1.2, 5),
    'inventory_added': definition('ITEM GAINED', 'economy', 'treasure', 'gold', 42, 1.3, 10),
    'inventory_removed': definition('INVENTORY CHANGED', 'economy', 'treasure', 'ash', 20, 1, 12, enabled=False),
    'cs_milestone': definition('HARVEST', 'economy', 'harvest', 'gold', 52, 1.8, 15),
    'vision_activity': definition('VISION SCORE', 'economy', 'vision', 'cyan', 30, 1.2, 20),
    'manpower_advantage': definition('NUMBERS ADVANTAGE', 'combat', 'link', 'mint', 50, 1.5, 20),
    'game_start': definition('WELCOME TO THE RIFT', 'lifecycle', 'portal', 'arcane', 65, 3, 0, 3),
    'minions_spawning': definition('THE MARCH BEGINS', 'lifecycle', 'march', 'cyan', 60, 2.4, 0),
    'victory': definition('VICTORY', 'lifecycle', 'crown', 'gold', 110, 4.5, 0, 5),
    'defeat': definition('NEXT GAME. NEXT CHAPTER.', 'lifecycle', 'fracture', 'ash', 110, 3.5, 0, 3),
    'game_end': definition('MATCH COMPLETE', 'lifecycle', 'crown', 'cyan', 105, 3, 0, 2),
}
for theme, name in NAMES.items():
    CATALOG['dragon_'+theme] = definition(name+' SECURED', 'objectives', 'dragon', theme,
                                        98 if theme!='elder' else 103, 3.2, 0, 3)
for key, rank in STREAKS.items():
    CATALOG[key] = definition(key.replace('_',' ').upper(), 'combat', 'streak', 'gold',
                              83+rank*3, 2.6+rank*.3, 0, rank)
SIGNALS = {
    'possible_purchase': ('SHOPPING SIGNAL','treasure','gold'),
    'possible_item_upgrade': ('ITEM CHANGE SIGNAL','treasure','arcane'),
    'possible_consumable_use': ('CONSUMABLE SIGNAL','wings','mint'),
    'possible_base_visit': ('BASE VISIT SIGNAL','portal','cyan'),
    'possible_combat': ('COMBAT SIGNAL','blades','blood'),
    'possible_low_hp_escape': ('SURVIVAL SIGNAL','wings','mint'),
    'possible_teamfight': ('FIGHT SIGNAL','link','blood'),
    'possible_objective_fight': ('OBJECTIVE FIGHT SIGNAL','void','void'),
    'possible_power_spike': ('POWER SIGNAL','runes','arcane'),
    'possible_roam': ('ROAM SIGNAL','portal','air'),
    'possible_jungle_activity': ('JUNGLE SIGNAL','harvest','mint'),
}
for key, (title, kind, theme) in SIGNALS.items():
    CATALOG[key] = definition(title,'inferred',kind,theme,28,1.2,25)


def valid_key(key):
    return key in CATALOG or bool(re.fullmatch(r'custom_[a-z0-9_]{1,64}',key))


def show_for(candidate, settings, preview=False):
    key=candidate['key']; spec=CATALOG.get(key)
    if spec is None and valid_key(key):
        spec=definition(str(candidate.get('title') or 'CUSTOM RULE')[:60], 'custom_rules',
                        'runes','arcane',45,1.8,10,enabled=False)
    if spec is None: return None
    override=settings.get('event_options',{}).get(key,{})
    if not preview and (not settings.get(spec['category'],True) or not override.get('enabled',spec['enabled'])):
        return None
    duration=override.get('duration',spec['seconds']*settings['burst_seconds']/2.7)
    title=spec['title']
    if key=='level_up' and re.fullmatch(r'Level \d+',str(candidate.get('detail',''))): title=candidate['detail'].upper()
    if key=='cs_milestone' and re.fullmatch(r'\d+ CS',str(candidate.get('detail',''))): title=candidate['detail']+' · HARVEST'
    return {**spec,'key':key,'title':title,
            'family':'ending' if key in {'victory','defeat','game_end'} else spec['family'],
            # Legacy short overrides remain personal data; the presentation
            # contract now gives every event a readable two-to-five-second act.
            'duration':max(2,min(5,duration)), 'intensity':override.get('intensity',1),
            'confidence':'possible' if key.startswith('possible_') else 'observed'}


def manifest(settings, custom_rules=None):
    keys=list(CATALOG)+[key for key in custom_rules or {} if key.startswith('custom_')]
    result=[]
    for key in keys:
        candidate={'key':key,'title':(custom_rules or {}).get(key,{}).get('title')}
        spec=show_for(candidate,settings,preview=True)
        spec['default_enabled']=CATALOG.get(key,{}).get('enabled',False)
        spec['default_duration']=max(2,min(5,CATALOG.get(key,{}).get('seconds',1.8)*settings['burst_seconds']/2.7))
        spec['event_enabled']=settings.get('event_options',{}).get(key,{}).get('enabled',CATALOG.get(key,{}).get('enabled',False))
        spec['enabled']=bool(show_for(candidate,settings));result.append(spec)
    return result
