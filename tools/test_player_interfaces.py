"""Soundboard/song interface contracts without starting playback or OBS."""
import unittest
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths, load_project_env

ensure_import_paths()
load_project_env()
from soundboard import interface as soundboard
from specific_song import interface as songs


class PlayerInterfaceTests(unittest.TestCase):
    def test_status_preserves_project_labels_and_random_idle(self):
        for module, attribute, noun in (
            (soundboard, 'current_stem', 'clips'),
            (songs, 'current_source', 'songs'),
        ):
            with self.subTest(project=module.interface.name), patch.dict(module._live, {}, clear=True):
                iface = module.interface
                self.assertFalse(iface.get_status().is_active)
                self.assertIsNone(iface.get_status().current_activity)
                player = Mock(is_busy=False, current_stem='stem', current_source='source')
                module._live.update(player=player, rand_active=[True])
                self.assertEqual(iface.get_status().current_activity,
                                 f'random mode (idle between {noun})')
                player.is_busy = True
                for random in (True, False):
                    module._live['rand_active'][0] = random
                    status = iface.get_status()
                    self.assertTrue(status.is_active)
                    self.assertTrue(status.can_revert)
                    self.assertEqual(status.name, iface.name)
                    self.assertEqual(status.controlled_scenes, iface.controlled_scenes)
                    self.assertEqual(status.current_activity,
                                     f'playing: {getattr(player, attribute)}' + (' [random]' if random else ''))
                setattr(player, attribute, None)
                self.assertEqual(iface.get_status().current_activity, 'playing: ')

    def test_controls_use_current_player_and_stop_random_before_abort(self):
        for module in (soundboard, songs):
            with self.subTest(project=module.interface.name), patch.dict(module._live, {}, clear=True):
                iface = module.interface
                for action in (iface.pause, iface.resume, iface.revert):
                    action()  # Safe before module startup.
                calls = Mock()
                module._live.update(player=calls.player, stop_random=calls.stop_random)
                iface.pause()
                iface.resume()
                iface.revert()
                self.assertEqual([call[0] for call in calls.mock_calls],
                                 ['player.pause', 'player.resume', 'stop_random', 'player.abort'])
                replacement = Mock()
                module._live['player'] = replacement
                iface.pause()
                replacement.pause.assert_called_once_with()

    def test_soundboard_action_and_volume_delegation(self):
        with patch.dict(soundboard._live, {}, clear=True):
            iface = soundboard.interface
            self.assertEqual(iface.run_action('pause'),
                             {'ok': False, 'error': f'{iface.name} is not running yet'})
            self.assertEqual([a['key'] for a in iface.action_catalog()], ['pause', 'resume', 'revert'])
            self.assertEqual(iface.volume_state(), {'profile': 'default', 'current_stem': None,
                                                   'source_name': soundboard.SINGLE_SOURCE_NAME})
            runner, catalog, volume = Mock(return_value={'ok': True}), Mock(return_value=[]), Mock(return_value={'profile': 'custom'})
            soundboard._live.update(run_action=runner, action_catalog=catalog, volume_state=volume)
            self.assertEqual(iface.run_action('random', count=2), {'ok': True})
            runner.assert_called_once_with('random', count=2)
            self.assertEqual(iface.action_catalog(), [])
            self.assertEqual(iface.volume_state(), {'profile': 'custom'})

    def test_song_volume_keeps_loaded_asset_and_base_actions(self):
        with patch.dict(songs._live, {}, clear=True):
            iface = songs.interface
            self.assertEqual(iface.volume_state(), {'profile': 'default'})
            player = Mock(current_stem=None, loaded_stem='loaded')
            songs._live['player'] = player
            for current, expected in ((None, 'loaded'), ('playing', 'playing')):
                player.current_stem = current
                self.assertEqual(iface.volume_state(), {'profile': 'default', 'current_stem': expected,
                                                       'source_name': songs.SINGLE_SOURCE_NAME, 'shared_volume': True})
            self.assertEqual(iface.run_action('pause'), {'ok': True, 'action': 'pause'})
            player.pause.assert_called_once_with()
            self.assertFalse(iface.run_action('random')['ok'])


if __name__ == '__main__':
    unittest.main()
