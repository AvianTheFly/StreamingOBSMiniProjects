import unittest
from .engine import Engine
from .test_engine import snapshot, event


class DeathReactionTests(unittest.TestCase):
    def setUp(self):
        self.now = 0
        self.engine = Engine(clock=lambda: self.now)
        self.engine.ingest(snapshot())

    def ingest(self, t, events=(), dead=True, baseline=False):
        data = snapshot(t, list(events))
        data['allPlayers'][0]['isDead'] = dead
        self.engine.ingest(data, baseline=baseline)
        return self.engine.death_reactions

    def test_splash_rotation_and_delayed_assist(self):
        self.assertIsNone(self.ingest(101).alert)
        self.now = 3
        state = self.ingest(104)
        self.assertFalse(state.worth)
        old = state.alert['id']
        self.now = 4
        state = self.ingest(105, [event(1, 'ChampionKill', 105,
            KillerName='Ally', VictimName='Enemy#NA1', Assisters=['OldName'])])
        self.assertTrue(state.worth)
        self.assertNotEqual(old, state.alert['id'])
        self.assertIsNone(self.ingest(106, dead=False).alert)

    def test_enemy_objective_and_old_kill_do_not_count(self):
        state = self.ingest(101, [event(1, 'BaronKill', 101, KillerName='Enemy#NA1'),
            event(2, 'ChampionKill', 50, KillerName='OldName')])
        self.assertFalse(state.worth)

    def test_recent_kill_and_reconnect(self):
        state = self.ingest(101, [event(1, 'ChampionKill', 99, KillerName='OldName')])
        self.assertTrue(state.worth)
        self.now = 3
        self.assertIsNone(self.ingest(104, baseline=True).alert)

    def test_team_objective_counts_and_clear_removes(self):
        state = self.ingest(101, [event(1, 'DragonKill', 101, KillerName='OldName')])
        self.assertTrue(state.worth)
        self.now = 3
        self.ingest(104)
        self.engine.clear()
        self.assertIsNone(self.engine.death_reactions.alert)
