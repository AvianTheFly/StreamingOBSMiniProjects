import copy
import unittest
from .engine import Engine, defaults

def snapshot(t=100,events=None):
    return {'gameData':{'gameTime':t},'activePlayer':{'riotId':'Michael#NA1','level':5,'currentGold':1000,
        'championStats':{'currentHealth':1000,'maxHealth':1000,'resourceValue':500},
        'abilities':{'R':{'abilityLevel':0}}},
        'allPlayers':[{'riotId':'Michael#NA1','summonerName':'OldName','team':'ORDER','level':5,'isDead':False,'items':[], 'scores':{'creepScore':49}},
                      {'riotId':'Enemy#NA1','team':'CHAOS','level':5,'isDead':False,'items':[]}],
        'events':{'Events':events or []}}

def event(i,name,t,**fields): return dict(EventID=i,EventName=name,EventTime=t,**fields)

class EngineTests(unittest.TestCase):
    def test_join_and_duplicate(self):
        e=Engine(); history=[event(1,'ChampionKill',99,KillerName='OldName',VictimName='Enemy#NA1')]
        self.assertEqual(e.ingest(snapshot(events=history)),[])
        fresh=history+[event(2,'ChampionKill',100.5,KillerName='OldName',VictimName='Enemy#NA1')]
        self.assertIn('kill',[a['key'] for a in e.ingest(snapshot(101,fresh))])
        self.assertNotIn('kill',[a['key'] for a in e.ingest(snapshot(102,fresh))])

    def test_priority_expiry_and_family_upgrade(self):
        clock=[0]; e=Engine(clock=lambda:clock[0])
        e.submit([{'key':k} for k in ['level_up','ace','pentakill','objective_steal','minions_spawning']])
        self.assertEqual([a['key'] for a in e.active()],['pentakill','objective_steal','ace'])
        clock[0]=11; self.assertEqual(e.active(),[])
        e.submit([{'key':'double_kill','family':'combat'},{'key':'pentakill','family':'combat'}])
        self.assertEqual([a['key'] for a in e.active()],['pentakill'])

    def test_local_filter_and_multikill(self):
        e=Engine(); e.ingest(snapshot())
        events=[event(1,'ChampionKill',101,KillerName='Enemy#NA1',VictimName='SomeoneElse'),
                event(2,'Multikill',101,KillerName='OldName',KillStreak=5)]
        keys=[a['key'] for a in e.ingest(snapshot(101,events))]
        self.assertNotIn('kill',keys); self.assertIn('pentakill',keys)

    def test_reset_and_reconnect_baseline(self):
        e=Engine(); e.ingest(snapshot())
        data=snapshot(101,[event(1,'FirstBlood',101,Recipient='OldName')]); e.ingest(data)
        self.assertTrue(e.active())
        e.ingest(snapshot(1)); self.assertEqual(e.active(),[])
        reconnect=snapshot(50,[event(2,'ChampionKill',49,KillerName='OldName')])
        self.assertEqual(e.ingest(reconnect,baseline=True),[])

    def test_snapshot_deltas_and_no_inventory_reorder(self):
        e=Engine(); a=snapshot(); a['allPlayers'][0]['items']=[{'itemID':1001,'count':1},{'itemID':1002,'count':2}]; e.ingest(a)
        b=copy.deepcopy(a); b['gameData']['gameTime']=101; b['allPlayers'][0]['items'].reverse()
        self.assertEqual(e.ingest(b),[])
        c=copy.deepcopy(b); c['gameData']['gameTime']=102; c['allPlayers'][0]['level']=6
        c['activePlayer']['abilities']['R']['abilityLevel']=1; c['allPlayers'][0]['scores']['creepScore']=50
        keys={a['key'] for a in e.ingest(c)}
        self.assertTrue({'level_up','ultimate_learned','cs_milestone'}<=keys)

    def test_steal_string_false_and_unknown_team(self):
        e=Engine(); e.ingest(snapshot())
        keys={a['key'] for a in e.ingest(snapshot(101,[event(1,'DragonKill',101,KillerName='unknown',DragonType='Fire',Stolen='False')]))}
        self.assertNotIn('objective_steal',keys); self.assertEqual(e.metrics['objective_control']['UNKNOWN']['DragonKill'],1)
        keys={a['key'] for a in e.ingest(snapshot(102,[event(2,'BaronKill',102,KillerName='OldName',Stolen=True)]))}
        self.assertIn('objective_steal',keys)

    def test_respawn_is_not_healing_and_gaps_not_combat(self):
        e=Engine(); a=snapshot(); a['allPlayers'][0]['isDead']=True; a['activePlayer']['championStats']['currentHealth']=0; e.ingest(a)
        keys={a['key'] for a in e.ingest(snapshot(101))}
        self.assertIn('respawn',keys); self.assertNotIn('large_heal',keys)
        a=snapshot(120); a['activePlayer']['championStats']['currentHealth']=50
        self.assertNotIn('heavy_health_loss',{a['key'] for a in e.ingest(a)})

    def test_disabled_and_cooldown(self):
        now=[0]; e=Engine(clock=lambda:now[0]); e.submit([{'key':'resource_spent'},{'key':'low_health'}])
        self.assertEqual(len(e.active()),1); self.assertIn('Disabled',[h['result'] for h in e.history])
        e.submit([{'key':'low_health'}]); self.assertEqual(e.history[-1]['result'],'Cooldown')
        now[0]=21; e.submit([{'key':'low_health'}]); self.assertEqual(e.history[-1]['result'],'Displayed')

if __name__=='__main__': unittest.main()
