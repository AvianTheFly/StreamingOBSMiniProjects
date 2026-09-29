import unittest
from .engine import Engine, defaults
from .test_engine import snapshot

class PacingTests(unittest.TestCase):
    def setUp(self):
        self.now=0
        c=defaults(); c.update(autoplay_gap_seconds=18,max_alerts=1,death_reactions_enabled=False)
        self.engine=Engine(c,clock=lambda:self.now)
    def submit(self,key,family=None,**extra):
        return self.engine.submit([dict(key=key,family=family or key,**extra)])
    def test_cross_event_spacing_and_no_backlog(self):
        self.submit('kill')
        self.now=7
        self.assertEqual(self.submit('baron'),[])
        self.assertIn('Spacing',self.engine.history[-1]['result'])
        self.now=19
        self.assertEqual(self.engine.active(),[])
        self.assertEqual(self.submit('baron')[0]['key'],'baron')
    def test_multikill_upgrade_but_no_duplicate_restart(self):
        first=self.submit('kill','combat_local')[0]
        self.now=1
        self.assertEqual(self.submit('kill','combat_local')[0]['id'],first['id'])
        self.assertEqual(self.submit('double_kill','combat_local')[0]['key'],'double_kill')
        self.assertEqual(self.submit('pentakill','combat_local')[0]['key'],'pentakill')
    def test_match_result_interrupts(self):
        self.submit('kill')
        self.assertEqual(self.submit('victory')[0]['key'],'victory')
    def test_preview_bypasses_spacing(self):
        self.submit('kill')
        self.assertEqual(self.submit('baron',confidence='preview')[0]['key'],'baron')
    def test_level_sprite_can_remain_without_meme(self):
        self.engine.config['events']['level_up']['autoplay']=False
        self.engine.ingest(snapshot())
        data=snapshot(101); data['allPlayers'][0]['level']=6
        self.engine.ingest(data)
        self.assertIsNotNone(self.engine.sprite)
        self.assertEqual(self.engine.active(),[])
    def test_one_death_clip_without_rotation(self):
        self.engine.ingest(snapshot())
        for i in range(1,35):
            self.now=i
            data=snapshot(100+i);data['allPlayers'][0]['isDead']=True
            self.engine.ingest(data)
            self.assertIsNone(self.engine.death_reactions.alert)
        shown=[h for h in self.engine.history if h['key']=='death' and h['result']=='Displayed']
        self.assertEqual(len(shown),1)
