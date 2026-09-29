"""Regression scenarios for context-sensitive automatic reactions."""
import unittest
from .engine import Engine
from .test_engine import snapshot, event


class ContextTests(unittest.TestCase):
    def engine(self):
        engine = Engine()
        engine.ingest(snapshot())
        return engine

    def test_enemy_and_unknown_objectives_do_not_celebrate(self):
        for actor in ('Enemy#NA1', 'unresolved'):
            engine = self.engine()
            out = engine.ingest(snapshot(101, [event(1, 'BaronKill', 101, KillerName=actor, Stolen=True)]))
            self.assertFalse({'baron', 'objective_steal'} & {a['key'] for a in out})

    def test_enemy_first_blood_and_ace_do_not_celebrate(self):
        engine = self.engine()
        out = engine.ingest(snapshot(101, [event(1, 'FirstBlood', 101, Recipient='Enemy#NA1'),
            event(2, 'Ace', 101, AcingTeam='CHAOS')]))
        self.assertFalse({'first_blood', 'ace'} & {a['key'] for a in out})

    def test_explicit_custom_enemy_trigger_is_preserved(self):
        engine = self.engine()
        engine.config['events']['custom'] = dict(enabled=True, priority=50, duration=5,
            trigger=dict(type='event', event_name='BaronKill', scope='any'))
        out = engine.ingest(snapshot(101, [event(1, 'BaronKill', 101, KillerName='Enemy#NA1')]))
        self.assertIn('custom', {a['key'] for a in out})

    def test_remote_deaths_are_not_personal_teamfight(self):
        engine = self.engine()
        out = engine.ingest(snapshot(101, [event(i, 'ChampionKill', 101,
            KillerName='Enemy#NA1', VictimName='Other') for i in range(3)]))
        self.assertNotIn('possible_teamfight', {a['key'] for a in out})

    def test_late_event_does_not_claim_low_hp_kill(self):
        engine = self.engine()
        data = snapshot(105, [event(1, 'ChampionKill', 101, KillerName='OldName')])
        data['activePlayer']['championStats']['currentHealth'] = 100
        self.assertNotIn('low_hp_kill', {a['key'] for a in engine.ingest(data)})

    def test_unrelated_team_payoff_does_not_make_death_worth(self):
        engine = self.engine()
        data = snapshot(101, [event(1, 'ChampionKill', 101, KillerName='Ally', VictimName='Enemy#NA1'),
            event(2, 'BaronKill', 101, KillerName='Ally')])
        data['allPlayers'].append(dict(riotId='Ally', team='ORDER'))
        data['allPlayers'][0]['isDead'] = True
        engine.ingest(data)
        self.assertFalse(engine.death_reactions.worth)

    def test_immediate_trade_of_killer_is_worth(self):
        engine = self.engine()
        data = snapshot(101, [event(1, 'ChampionKill', 101, KillerName='Enemy#NA1', VictimName='OldName')])
        data['allPlayers'].append(dict(riotId='Ally', team='ORDER'))
        data['allPlayers'][0]['isDead'] = True
        engine.ingest(data)
        data['gameData']['gameTime'] = 103
        data['events']['Events'].append(event(2, 'ChampionKill', 103, KillerName='Ally', VictimName='Enemy#NA1'))
        engine.ingest(data)
        self.assertTrue(engine.death_reactions.worth)

    def test_low_hp_without_recent_damage_is_not_escape(self):
        engine = Engine()
        for t in range(100, 115):
            data = snapshot(t)
            data['activePlayer']['championStats']['currentHealth'] = 100 if t < 104 else 400
            self.assertNotIn('possible_low_hp_escape', {a['key'] for a in engine.ingest(data)})
