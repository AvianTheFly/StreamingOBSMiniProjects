"""Contract tests for ownership, timer evidence, pacing and settings isolation."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from .engine import Engine, defaults
from .production import ProductionDirector, ProductionSettings
from .production.config import DEFAULTS, validate
from .production.objectives import dragon_state
from .test_engine import snapshot, event


def game(t=1300, kills=None):
    data = snapshot(t, kills or [
        event(1, 'DragonKill', 400, DragonType='Air', KillerName='OldName'),
        event(2, 'DragonKill', 700, DragonType='Water', KillerName='Enemy#NA1'),
        event(3, 'DragonKill', 1000, DragonType='Earth', KillerName='OldName')])
    data['gameData'].update(mapNumber=11, gameMode='CLASSIC', mapTerrain='Default')
    return data


class ProductionTests(unittest.TestCase):
    def setUp(self):
        self.now = [0]
        self.settings = {**DEFAULTS, 'enabled': True}
        self.director = ProductionDirector(self.settings, lambda: self.now[0])

    def test_timer_requires_evidence_and_never_guesses_early_type(self):
        data = game()
        self.assertEqual(dragon_state(data)['theme'], 'earth')
        data['gameData']['gameTime'] = 1299.9
        self.assertIsNone(dragon_state(data))
        data['gameData']['gameTime'] = 1300
        data['events']['Events'].pop()
        # Default terrain, including Swiftplay's two kills, never means Earth.
        self.assertIsNone(dragon_state(data))
        data['gameData']['mapTerrain'] = 'Mountain'
        self.assertIsNone(dragon_state(data))
        data = game(); data['gameData']['mapTerrain'] = 'Infernal'
        self.assertIsNone(dragon_state(data))  # Conflicting element evidence.

    def test_unknown_modes_soul_elder_and_unresolved_ownership(self):
        for patch in [{'mapNumber': 12}, {'gameMode': 'ARAM'}]:
            data = game(); data['gameData'].update(patch)
            self.assertIsNone(dragon_state(data))
        data = game(1700)
        data['events']['Events'].append(event(4, 'DragonKill', 1400, DragonType='Earth', KillerName='unknown'))
        self.assertIsNone(dragon_state(data))
        for kill in data['events']['Events']: kill['KillerName'] = 'OldName'
        self.assertIsNone(dragon_state(data))  # One team has four: Soul.
        data['events']['Events'][-1]['DragonType'] = 'Elder'
        self.assertIsNone(dragon_state(data))

    def test_deduplicated_history_and_stable_cycle(self):
        data = game(); data['events']['Events'] += copy.deepcopy(data['events']['Events'])
        self.director.ingest(data, [], baseline=True)
        first = self.director.snapshot()['ambient']
        self.assertEqual(first['theme'], 'earth'); self.assertEqual(first['elapsed'], 2)
        self.now[0] = 4; self.director.ingest(data, [])
        self.assertEqual(self.director.snapshot()['ambient']['id'], first['id'])
        self.assertEqual(self.director.snapshot()['ambient']['elapsed'], 6)

    def test_friendly_earth_kill_crumble_and_enemy_quiet_release(self):
        for killer, expected in [('OldName', 'dragon'), ('Enemy#NA1', 'release'), ('unknown', 'release')]:
            with self.subTest(killer=killer):
                engine = Engine({**defaults(), 'overlay_enabled': False}, lambda: self.now[0], self.settings)
                engine.ingest(game())
                self.assertTrue(engine.production.snapshot()['ambient'])
                data = game(1301)
                data['events']['Events'].append(event(4, 'DragonKill', 1301, DragonType='Mountain', KillerName=killer))
                engine.ingest(data)
                state = engine.production.snapshot()
                self.assertIsNone(state['ambient']); self.assertEqual(state['effect']['kind'], expected)
                if killer == 'OldName': self.assertEqual(state['effect']['theme'], 'earth')
                self.assertEqual(engine.active(), [])  # Video alerts stay off.

    def test_steal_upgrades_dragon_and_transition_beats_spacing(self):
        self.director.preview('pentakill')
        self.now[0] = .1
        self.director.ingest(game(), [{'key': 'dragon_earth', 'confidence': 'observed'},
                                     {'key': 'objective_steal', 'confidence': 'observed'}])
        effect = self.director.snapshot()['effect']
        self.assertEqual(effect['kind'], 'dragon'); self.assertIn('STOLEN', effect['title'])
        self.assertEqual(effect['priority'], 99)

    def test_one_show_pacing_and_streak_upgrade(self):
        observed = lambda key: {'key': key, 'confidence': 'observed'}
        self.director.ingest(game(), [observed('double_kill')])
        self.now[0] = .2; self.director.ingest(game(), [observed('pentakill')])
        self.assertEqual(self.director.snapshot()['effect']['rank'], 5)
        effect_id = self.director.snapshot()['effect']['id']
        self.now[0] = .3; self.director.ingest(game(), [observed('turret_destroyed')])
        self.assertEqual(self.director.snapshot()['effect']['id'], effect_id)
        self.now[0] = 3; self.director.ingest(game(), [observed('turret_destroyed')])
        self.assertIsNone(self.director.snapshot()['effect'])
        self.now[0] = 5; self.director.ingest(game(), [observed('baron')])
        self.assertEqual(self.director.snapshot()['effect']['kind'], 'baron')

    def test_no_replay_after_baseline_duplicates_and_new_game(self):
        engine = Engine(clock=lambda: self.now[0], production_settings=self.settings)
        data = game()
        engine.ingest(data)
        self.assertIsNone(engine.production.snapshot()['effect'])
        data['gameData']['gameTime'] = 1301
        data['events']['Events'].append(event(4, 'Multikill', 1301, KillerName='OldName', KillStreak=5))
        engine.ingest(data); self.assertTrue(engine.production.snapshot()['effect'])
        self.now[0] = 4; engine.ingest(data)
        self.assertIsNone(engine.production.snapshot()['effect'])
        engine.production.preview('baron'); engine.ingest(data, baseline=True)
        self.assertIsNone(engine.production.snapshot()['effect'])
        engine.ingest(game(1, [])); self.assertIsNone(engine.production.snapshot()['ambient'])

    def test_clear_suppresses_current_cycle_but_accepts_next_event(self):
        self.director.ingest(game(), [])
        self.director.clear(); self.director.ingest(game(), [])
        self.assertIsNone(self.director.snapshot()['ambient'])
        self.director.ingest(game(), [{'key':'baron','confidence':'observed'}])
        self.assertTrue(self.director.snapshot()['effect'])
        data = game(1700); data['events']['Events'].append(event(4, 'DragonKill', 1400, DragonType='Earth', KillerName='Enemy#NA1'))
        self.director.ingest(data, [])
        self.assertTrue(self.director.snapshot()['ambient'])

    def test_possible_events_audio_and_disabled_categories_never_display(self):
        self.director.ingest(game(), [{'key':'baron','confidence':'possible'},
                                     {'key':'kill','confidence':'observed'},
                                     {'key':'death','confidence':'observed'}])
        self.assertIsNone(self.director.snapshot()['effect'])
        self.director.configure({**self.settings, 'objectives':False, 'dragon_ambience':False})
        self.director.ingest(game(), [{'key':'baron','confidence':'observed'}])
        self.assertIsNone(self.director.snapshot()['effect']); self.assertIsNone(self.director.snapshot()['ambient'])
        self.director.configure({**self.settings, 'enabled':False})
        with self.assertRaises(ValueError): self.director.preview('earth_cycle')

    def test_preview_is_bounded_and_returns_to_live_state(self):
        self.director.ingest(game(), []); live = self.director.snapshot()['ambient']['id']
        self.director.preview('earth_cycle')
        self.assertTrue(self.director.snapshot()['ambient']['id'].startswith('preview-'))
        self.now[0] = 3.5
        self.assertIsNone(self.director.snapshot()['ambient']); self.assertEqual(self.director.snapshot()['effect']['kind'], 'dragon')
        self.now[0] = 8
        self.assertEqual(self.director.snapshot()['ambient']['id'], live)

    def test_settings_validation_conflicts_and_separate_persistence(self):
        with tempfile.TemporaryDirectory() as folder, patch('lib.settings_backups.SettingsBackups.snapshot') as backup:
            path = Path(folder)/'production.json'; store = ProductionSettings(path)
            self.assertFalse(store.load()['enabled'])
            saved = store.save(store.load(), {'revision':0,'settings':{'enabled':True}})
            backup.assert_called_once(); self.assertEqual(store.load(), saved)
            with self.assertRaises(ValueError): store.save(saved, {'revision':0,'settings':{'opacity':.5}})
            with self.assertRaises(ValueError): store.save(saved, {'revision':1,'settings':{'volume':.1}})
            self.assertEqual(json.loads(path.read_text())['revision'], 1)
        for patch_value in [{'opacity':True}, {'edge_width':float('nan')}, {'burst_seconds':60}, {'enabled':'yes'}]:
            with self.assertRaises(ValueError): validate({**DEFAULTS, **patch_value})

    def test_obs_repair_preserves_existing_transform_filters_and_audio(self):
        from .production.obs_source import repair_overlay
        client = Mock(); client.send.return_value = {'inputs':[{'inputName':'League API Alerts','inputKind':'browser_source'}]}
        with patch('league_api.production.obs_source.obs.get_obs',return_value=client), patch('lib.settings_backups.SettingsBackups.snapshot'):
            repair_overlay(Mock(),existing_only=True)
        requests = [(call.args[0], call.args[1]) for call in client.send.call_args_list]
        self.assertEqual([name for name,_ in requests], ['GetInputList','SetInputSettings','PressInputPropertiesButton'])
        settings = requests[1][1]['inputSettings']
        self.assertNotIn('reroute_audio',settings)
        self.assertNotIn('volume',settings)
    def test_explicit_obs_repair_links_missing_item_without_repositioning(self):
        from .production.obs_source import repair_overlay
        client=Mock();client.send.return_value={'inputs':[{'inputName':'League API Alerts','inputKind':'browser_source'}], 'sceneItems':[]}
        with patch('league_api.production.obs_source.obs.get_obs',return_value=client), patch('league_api.production.obs_source.obs.create_scene_if_missing'), patch('lib.settings_backups.SettingsBackups.snapshot'):
            repair_overlay(Mock())
        names=[call.args[0] for call in client.send.call_args_list]
        self.assertIn('CreateSceneItem',names)
        self.assertNotIn('SetSceneItemTransform',names)


if __name__ == '__main__': unittest.main()
