"""Keep existing personal sounds while suppressing cumulative-history replay."""
import unittest
from unittest.mock import Mock
from lib.paths import ensure_import_paths
ensure_import_paths()
from league.core.game_state_detector import GameStateDetector


class EventBaselineTests(unittest.TestCase):
    def setUp(self):
        self.events=Mock(); self.detector=GameStateDetector(self.events)

    def process(self,time,events):
        self.detector.process({'isDead':False,'level':5},
                              {'gameData':{'gameTime':time},'events':{'Events':events}},'Me')

    def kill(self,i,t):
        return dict(EventID=i,EventTime=t,EventName='ChampionKill',KillerName='Me')

    def test_initial_and_reconnect_history_are_silent(self):
        self.process(100,[self.kill(0,99),self.kill(1,10)])
        self.events.emit.assert_not_called()
        self.process(101,[self.kill(0,99),self.kill(2,101)])
        self.events.emit.assert_called_once_with('champion_kill',self.kill(2,101))
        self.events.reset_mock();self.detector.reset()
        self.process(102,[self.kill(2,101),self.kill(3,102)])
        self.events.emit.assert_not_called()

    def test_batch_order_duplicates_and_stale_events(self):
        self.process(100,[])
        batch=[self.kill(3,101),self.kill(1,101),self.kill(2,10)]
        self.process(101,batch);self.process(102,batch)
        self.assertEqual([c.args[1]['EventID'] for c in self.events.emit.call_args_list],[1,3])

    def test_clock_rewind_baselines_a_new_game(self):
        self.process(100,[self.kill(9,99)])
        self.process(1,[self.kill(0,1)]);self.events.emit.assert_not_called()
        self.process(2,[self.kill(0,1),self.kill(1,2)])
        self.events.emit.assert_called_once_with('champion_kill',self.kill(1,2))


if __name__=='__main__': unittest.main()
