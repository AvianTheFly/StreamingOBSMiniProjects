"""Border ownership and death state are independent from saved meme/audio banks."""
import copy
import threading
import unittest
from .engine import Engine, defaults
from .main import Service, ROOT
from .match_screens import MatchScreens
from .production.config import DEFAULTS
from .test_engine import snapshot, event


class AuxiliaryArtTests(unittest.TestCase):
    def setUp(self):
        self.now=0
        self.engine=Engine(clock=lambda:self.now,production_settings={**DEFAULTS,'enabled':True})
        self.engine.ingest(snapshot())

    def service(self):
        service=Service.__new__(Service)
        service.lock=threading.RLock();service.engine=self.engine
        service.match_screens=MatchScreens(ROOT/'media'/'match-screens',self.engine.production.settings,lambda:self.now)
        service.status='Test';service.error=None;service.media_errors=[]
        return service

    def dead(self, timer=None):
        data=snapshot(101)
        data['allPlayers'][0].update(isDead=True,respawnTimer=timer)
        self.engine.ingest(data)
        return data

    def test_death_stays_until_actual_respawn_and_never_injects_a_meme(self):
        data=self.dead(21)
        initial=self.engine.death_visual['started']
        self.now=4
        data['gameData']['gameTime']=105;data['allPlayers'][0]['respawnTimer']=17
        self.engine.ingest(data)
        state=self.service().snapshot()
        self.assertEqual(state['production']['death']['elapsed'],4)
        self.assertEqual(state['production']['death']['remaining'],17)
        self.assertEqual(self.engine.death_visual['started'],initial)
        self.assertEqual(state['alerts'],[])
        data['allPlayers'][0]['respawnTimer']=0
        self.engine.ingest(data)
        self.assertIsNotNone(self.service().snapshot()['production']['death'])
        data['allPlayers'][0]['isDead']=False
        self.engine.ingest(data)
        self.assertIsNone(self.service().snapshot()['production']['death'])

    def test_unknown_countdown_pause_disable_disconnect_and_game_end(self):
        self.dead(float('nan'))
        self.assertIsNone(self.service().snapshot()['production']['death']['remaining'])
        self.engine.config['paused']=True
        self.assertFalse(self.service().snapshot()['production']['enabled'])
        self.assertIsNone(self.service().snapshot()['production']['death'])
        self.engine.config['paused']=False
        self.engine.production.settings['event_options']={'death':{'enabled':False}}
        self.assertIsNone(self.service().snapshot()['production']['death'])
        self.engine.production.settings['event_options']={}
        self.engine.clear()
        self.assertIsNone(self.engine.death_visual)
        data=self.dead(12)
        data['events']['Events']=[event(5,'GameEnd',102,Result='Win')]
        self.engine.ingest(data)
        self.assertIsNone(self.engine.death_visual)

    def test_border_ownership_preserves_clip_settings_and_explicit_preview(self):
        before=copy.deepcopy(self.engine.config)
        self.engine.submit([{'key':'kill','confidence':'observed'}])
        self.assertEqual(self.engine.active(),[])
        self.assertEqual(self.engine.config,before)
        self.engine.submit([{'key':'kill','confidence':'preview'}])
        self.assertEqual(self.engine.active()[0]['key'],'kill')

    def test_disabled_production_retains_legacy_clip_path(self):
        self.engine.production.settings['enabled']=False
        self.engine.submit([{'key':'kill','confidence':'observed'}])
        self.assertEqual(self.engine.active()[0]['key'],'kill')

    def test_clip_overlay_off_does_not_disable_borders_or_death_state(self):
        self.engine.config['overlay_enabled']=False
        self.dead(20)
        self.now=4
        state=self.service().snapshot()
        self.assertFalse(state['overlay_enabled'])
        self.assertTrue(state['production']['enabled'])
        self.assertIsNotNone(state['production']['death'])
        self.assertEqual(state['alerts'],[])
        self.assertEqual(self.engine.config['overlay_enabled'],False)

    def test_baseline_dead_is_visual_evidence_without_inventing_payoff(self):
        data=self.dead(15)
        self.engine.ingest(data,baseline=True)
        state=self.service().snapshot()['production']['death']
        self.assertIsNotNone(state)
        self.assertFalse(state['worth'])

