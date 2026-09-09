"""Pure snapshot detector and bounded alert scheduler. No OBS or network I/O."""
from collections import Counter
import copy
import time
from .media_pool import MediaPicker

DIRECT = {'GameStart': ('game_start', 45), 'MinionsSpawning': ('minions_spawning', 25),
          'FirstBlood': ('first_blood', 85), 'Ace': ('ace', 88),
          'TurretKilled': ('turret_destroyed', 55), 'FirstBrick': ('first_turret', 70),
          'InhibKilled': ('inhibitor_destroyed', 65), 'InhibRespawningSoon': ('inhibitor_respawning_soon', 30),
          'InhibRespawned': ('inhibitor_respawned', 35), 'HordeKill': ('void_grub', 48),
          'HeraldKill': ('herald', 65), 'BaronKill': ('baron', 90), 'AtakhanKill': ('atakhan_legacy', 65)}
EXTRA = {'kill':70,'death':72,'assist':50,'double_kill':82,'triple_kill':88,'quadra_kill':94,'pentakill':100,
         'dragon':68,'dragon_air':68,'dragon_earth':68,'dragon_fire':68,'dragon_water':68,
         'dragon_hextech':68,'dragon_chemtech':68,'dragon_elder':92,'victory':99,'defeat':99,'game_end':99,
         'objective_steal':96,'level_up':35,'ultimate_learned':60,'ability_rank_up':25,'respawn':40,
         'inventory_added':30,'inventory_removed':20,'possible_purchase':40,'possible_item_upgrade':50,
         'possible_consumable_use':20,'possible_base_visit':58,'low_health':60,'heavy_health_loss':55,
         'large_heal':35,'resource_spent':15,'possible_combat':40,'low_hp_kill':91,'low_hp_multikill':97,
         'possible_low_hp_escape':85,'possible_teamfight':75,'possible_objective_fight':80,
         'possible_power_spike':55,'cs_milestone':30,'vision_activity':20,'manpower_advantage':45,
         'possible_roam':30,'possible_jungle_activity':20}

def defaults():
    priorities = {key: priority for key, priority in DIRECT.values()} | EXTRA
    quiet = {'ability_rank_up','inventory_removed','resource_spent','possible_consumable_use',
             'possible_roam','possible_jungle_activity','vision_activity','atakhan_legacy'}
    return {'poll_seconds':0.5, 'max_alerts':3, 'events': {
        key: {'enabled':key not in quiet,'priority':priority,'duration':6 if priority<90 else 9,
              'cooldown':20 if key.startswith('possible_') or key in {'low_health','heavy_health_loss','large_heal','resource_spent','vision_activity','manpower_advantage'} else 0,
              'media':'','volume':0.7} for key,priority in priorities.items()}}

def aliases(player):
    result = {str(player.get(k,'')) for k in ('summonerName','riotId','riotIdGameName')}
    if player.get('riotIdGameName') and player.get('riotIdTagLine'):
        result.add(player['riotIdGameName']+'#'+player['riotIdTagLine'])
    return result-{''}

def inventory(player):
    result=Counter()
    for item in player.get('items',[]):
        result[str(item.get('itemID'))]+=int(item.get('count',1))
    return result

class Engine:
    def __init__(self, config=None, clock=time.monotonic):
        self.config=config or defaults(); self.clock=clock
        self.slots=[]; self.serial=0; self.reset()

    def reset(self):
        self.media_picker = MediaPicker()
        self.previous=None; self.game_time=-1; self.seen=set(); self.cooldowns={}
        self.kills=[]; self.objectives=[]; self.low_at=None; self.last_damage=-999
        self.metrics={}; self.slots=[]; self.history=[]

    def clear(self):
        self.slots=[]

    def active(self):
        now=self.clock(); self.slots=[a for a in self.slots if a['expires']>now]
        self.slots=self.slots[:max(1,min(3,self.config.get('max_alerts',3)))]
        return copy.deepcopy(self.slots)

    def submit(self, candidates):
        if not self.config.get('overlay_enabled',True):
            self.clear(); return []
        now=self.clock(); self.active()
        for candidate in sorted(candidates,key=lambda a:self.config['events'].get(a['key'],{}).get('priority',0),reverse=True):
            rule=self.config['events'].get(candidate['key'],{})
            def record(reason):
                self.history.append({**candidate,'title':rule.get('title') or candidate.get('title',candidate['key']),'result':reason,'time':time.time()})
                self.history=self.history[-100:]
            if self.config.get('paused') and candidate.get('confidence')!='preview': record('Paused'); continue
            if not rule.get('enabled',False): record('Disabled'); continue
            key=candidate['key']
            if now-self.cooldowns.get(key,-999999)<rule.get('cooldown',0): record('Cooldown'); continue
            # One reusable slot per semantic family; a penta upgrades a double.
            family=candidate.get('family',key)
            same=next((a for a in self.slots if a['family']==family),None)
            if same and same['priority']>rule['priority']: record('Higher priority in this family'); continue
            if same: self.slots.remove(same)
            self.serial+=1
            variant=self.media_picker.choose(key,rule)
            alert=dict(candidate,id=self.serial,family=family,priority=rule['priority'],
                       expires=now+max(1,min(60,variant['duration'])),
                       remaining=max(1,min(60,variant['duration'])),media=variant['media'],volume=rule.get('volume',0.7),
                       start_time=variant['start_time'],loop=variant['loop'],audio=rule.get('audio',''))
            alert['title']=rule.get('title') or candidate.get('title') or key.replace('_',' ').title()
            self.slots.append(alert)
            self.slots.sort(key=lambda a:(a['priority'],a['id']),reverse=True)
            self.slots=self.slots[:max(1,min(3,self.config.get('max_alerts',3)))]
            self.cooldowns[key]=now
            if alert in self.slots:
                self.media_picker.remember(key,alert['media'])
            record('Displayed' if alert in self.slots else 'Dropped: three higher-priority alerts')
        return self.active()

    def ingest(self, data, baseline=False):
        t=float(data['gameData']['gameTime'])
        if t<self.game_time-2: self.reset()
        events=data.get('events',{}).get('Events',[])
        players=data.get('allPlayers',[]); active=data.get('activePlayer',{})
        names=aliases(active)
        local=next((p for p in players if aliases(p)&names),{})
        names |= aliases(local)
        team=local.get('team')
        def player(name):
            matches=[p for p in players if name in aliases(p)]
            return matches[0] if len(matches)==1 else {}
        def local_name(name): return bool(name and name in names)
        def event_id(e): return (e.get('EventID'),e.get('EventTime'),e.get('EventName'))
        initial=self.previous is None or baseline
        out=[]
        def emit(key,detail='',family=None):
            out.append({'key':key,'title':key.replace('_',' ').title(),'detail':str(detail),
                        'confidence':'possible' if key.startswith('possible_') else 'observed',
                        'family':family or key})
        stats=active.get('championStats',{}); hp=stats.get('currentHealth'); maximum=stats.get('maxHealth')
        ratio=hp/maximum if hp is not None and maximum else None
        self.kills=[e for e in self.kills if t-float(e.get('EventTime',0))<=20]
        self.objectives=[e for e in self.objectives if t-float(e.get('EventTime',0))<=20]
        for e in sorted(events,key=lambda e:(e.get('EventTime',0),e.get('EventID',0))):
            identity=event_id(e)
            if identity in self.seen: continue
            self.seen.add(identity)
            name=e.get('EventName'); et=float(e.get('EventTime',0))
            fresh=not initial and 0<=t-et<=10
            # Joining a running game establishes state, never replays its history.
            if initial and t<=5 and name=='GameStart': fresh=True
            killer=e.get('KillerName',''); killer_team=player(killer).get('team')
            if fresh:
                for custom_key,rule in self.config['events'].items():
                    tr=rule.get('trigger',{})
                    if tr.get('type')!='event' or tr.get('event_name')!=name: continue
                    scope=tr.get('scope','any')
                    actor=e.get('KillerName') or e.get('Recipient') or e.get('Acer')
                    matches={'any':True,'local_killer':local_name(actor),
                             'local_victim':local_name(e.get('VictimName')),
                             'local_assister':any(local_name(n) for n in e.get('Assisters',[])),
                             'local_team':bool(team and (player(actor).get('team') or e.get('AcingTeam'))==team)}
                    field=tr.get('field')
                    if matches.get(scope) and (not field or str(e.get(field,'')).lower()==str(tr.get('equals','')).lower()):
                        emit(custom_key,f'{name} · {actor or "global event"}')
            relation='Your team' if team and killer_team==team else 'Enemy team' if team and killer_team else 'Unknown team'
            if name=='ChampionKill':
                if t-et<=20: self.kills.append(e)
                if not fresh: continue
                if local_name(killer):
                    emit('kill',e.get('VictimName',''),'combat_local')
                    if ratio is not None and 0<ratio<=0.2:
                        emit('low_hp_kill',f'Kill observed at {ratio:.0%} health','combat_local')
                elif local_name(e.get('VictimName')): emit('death',killer,'death')
                elif any(local_name(n) for n in e.get('Assisters',[])): emit('assist',killer)
                roles={player(n).get('position') for n in [killer]+e.get('Assisters',[])}-{'',None}
                if len(roles)>=3: emit('possible_roam','Participants from several assigned roles; location unknown')
            elif name in {'DragonKill','HordeKill','HeraldKill','BaronKill','AtakhanKill'}:
                if t-et<=20: self.objectives.append(e)
                if not fresh: continue
                key='dragon_'+str(e.get('DragonType','')).lower() if name=='DragonKill' else DIRECT[name][0]
                if key not in self.config['events']: key='dragon'
                emit(key,relation+' · '+killer,'objective_'+name)
                if str(e.get('Stolen','')).lower()=='true':
                    emit('objective_steal',relation+' · '+name,'objective_'+name)
            elif not fresh: continue
            elif name=='Multikill' and local_name(killer):
                count=int(e.get('KillStreak',0)); key={2:'double_kill',3:'triple_kill',4:'quadra_kill',5:'pentakill'}.get(count)
                if key: emit(key,killer,'combat_local')
                if key and ratio is not None and 0<ratio<=0.2: emit('low_hp_multikill',f'{count} kills · {ratio:.0%} health','combat_local')
            elif name=='FirstBlood':
                recipient=e.get('Recipient',''); emit('first_blood',recipient,'combat_local' if local_name(recipient) else 'first_blood')
            elif name=='GameEnd': emit({'win':'victory','lose':'defeat'}.get(str(e.get('Result','')).lower(),'game_end'))
            elif name in DIRECT:
                key=DIRECT[name][0]
                detail=e.get('AcingTeam') or e.get(name) or killer or ''
                emit(key,detail,'turret' if name in {'FirstBrick','TurretKilled'} else key)
        if not initial:
            old=self.previous; old_active=old.get('activePlayer',{})
            old_local=next((p for p in old.get('allPlayers',[]) if aliases(p)&names),{})
            dt=t-self.game_time
            if local and old_local and 0<dt<=3:
                def values(a,p):
                    s=a.get('championStats',{}); scores=p.get('scores',{})
                    return {'health_percent':100*s['currentHealth']/s['maxHealth'] if s.get('maxHealth') and s.get('currentHealth') is not None else None,
                            'current_gold':a.get('currentGold'),'level':p.get('level'),
                            'cs':scores.get('creepScore'),'ward_score':scores.get('wardScore'),
                            'resource':s.get('resourceValue'),'kills':scores.get('kills'),
                            'deaths':scores.get('deaths'),'assists':scores.get('assists')}
                before_values=values(old_active,old_local); after_values=values(active,local)
                for custom_key,rule in self.config['events'].items():
                    tr=rule.get('trigger',{})
                    if tr.get('type')!='snapshot': continue
                    field=tr['field']; before=before_values[field]; after=after_values[field]; threshold=tr['value']
                    if before is None or after is None: continue
                    match={'crosses_below':before>threshold>=after,'crosses_above':before<threshold<=after,
                           'increases_by':after>before and after-before>=threshold,
                           'decreases_by':before>after and before-after>=threshold}
                    if match.get(tr['operator']): emit(custom_key,f'{field}: {before:g} → {after:g}')
                level=local.get('level',0); old_level=old_local.get('level',0)
                if level>old_level: emit('level_up',f'Level {level}','power')
                if old_local.get('isDead') and not local.get('isDead'): emit('respawn')
                if not old_local.get('isDead') and local.get('isDead'): emit('death',family='death')
                for slot,ability in active.get('abilities',{}).items():
                    rank=ability.get('abilityLevel',0); before=old_active.get('abilities',{}).get(slot,{}).get('abilityLevel',0)
                    if rank>before: emit('ultimate_learned' if slot=='R' and before==0 else 'ability_rank_up',f'{slot} rank {rank}','power')
                added=inventory(local)-inventory(old_local); removed=inventory(old_local)-inventory(local)
                gold_delta=active.get('currentGold',0)-old_active.get('currentGold',0)
                if added: emit('inventory_added',', '.join(added),'inventory')
                if removed: emit('inventory_removed',', '.join(removed),'inventory')
                if added and gold_delta<-50: emit('possible_purchase','Inventory gained and gold fell','inventory')
                if added and removed:
                    emit('possible_item_upgrade','Inventory replaced items; recipe not verified','inventory')
                    if level>old_level: emit('possible_power_spike','Level and inventory increased','power')
                consumables={str(i.get('itemID')) for i in old_local.get('items',[]) if i.get('consumable')}
                if removed.keys()&consumables and not added and gold_delta<=5:
                    emit('possible_consumable_use','Consumable count decreased','inventory')
                before_stats=old_active.get('championStats',{}); before_hp=before_stats.get('currentHealth')
                alive=not local.get('isDead') and not old_local.get('isDead')
                if hp is not None and before_hp is not None and maximum and alive:
                    delta=hp-before_hp
                    if delta<-maximum*0.05:
                        self.last_damage=t; emit('possible_combat','Net health loss; cause unknown','health')
                    if delta<-maximum*0.2: emit('heavy_health_loss',f'{-delta:.0f} net HP lost','health')
                    if delta>maximum*0.2: emit('large_heal',f'{delta:.0f} net HP gained','health')
                    if ratio<=0.2 and hp>0:
                        self.low_at=t
                        if before_hp/max(1,before_stats.get('maxHealth',maximum))>0.2: emit('low_health',f'{ratio:.0%} HP','health')
                    if self.low_at is not None and t-self.low_at>=8 and t-self.last_damage>=8:
                        emit('possible_low_hp_escape','Survived eight seconds after low health','health'); self.low_at=None
                    if added and gold_delta<-50 and delta>maximum*0.15:
                        emit('possible_base_visit','Shopping signal plus health gain; recall not confirmed','inventory')
                if local.get('isDead'): self.low_at=None
                resource=stats.get('resourceValue'); before_resource=before_stats.get('resourceValue')
                if resource is not None and before_resource is not None and before_resource-resource>30:
                    emit('resource_spent',f'{before_resource-resource:.0f} net resource lost; spell unknown')
                scores=local.get('scores',{}); prior_scores=old_local.get('scores',{})
                cs=scores.get('creepScore',0); prior_cs=prior_scores.get('creepScore',0)
                if cs//50>prior_cs//50: emit('cs_milestone',f'{cs} CS')
                if scores.get('wardScore',0)-prior_scores.get('wardScore',0)>=1: emit('vision_activity','Ward score increased; placement unknown')
                if local.get('position')=='JUNGLE' and cs-prior_cs>=4: emit('possible_jungle_activity','CS jump; specific camp unknown')
            if len(self.kills)>=3 and any(e.get('EventName')=='ChampionKill' and 0<=t-float(e.get('EventTime',0))<=2 for e in self.kills):
                emit('possible_teamfight',f'{len(self.kills)} champion deaths within 20 seconds','fight')
            if self.kills and self.objectives and any(abs(float(k.get('EventTime',0))-float(o.get('EventTime',0)))<=12 for k in self.kills for o in self.objectives):
                emit('possible_objective_fight','Champion death within 12 seconds of an objective','fight')
            if team:
                allies=sum(not p.get('isDead',False) for p in players if p.get('team')==team)
                enemies=sum(not p.get('isDead',False) for p in players if p.get('team')!=team)
                old_adv=self.metrics.get('alive_advantage',0)
                if allies-enemies>=2 and old_adv<2: emit('manpower_advantage',f'{allies} allies vs {enemies} enemies alive')
                self.metrics['alive_advantage']=allies-enemies
        # Read-only summary: objective ownership is unknown when killer cannot be resolved.
        control={}
        for e in events:
            if e.get('EventName') in {'DragonKill','HordeKill','HeraldKill','BaronKill'}:
                owner=player(e.get('KillerName','')).get('team','UNKNOWN')
                counts=control.setdefault(owner,{})
                key=e['EventName']; counts[key]=counts.get(key,0)+1
        self.metrics.update(game_time=t,local_player=local.get('riotId') or local.get('summonerName'),
                            objective_control=control,cs_per_minute=(local.get('scores',{}).get('creepScore',0)/(t/60) if t>0 else 0),
                            unknown_events=sorted({e.get('EventName','') for e in events}-{*DIRECT,'ChampionKill','Multikill','DragonKill','GameEnd'}))
        self.previous=copy.deepcopy(data); self.game_time=t
        self.submit(out)
        return out
