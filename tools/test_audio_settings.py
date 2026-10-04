import sys
from pathlib import Path
from types import SimpleNamespace
import unittest
import tempfile
import json
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from hub_ui import server, audio


class AudioSettingsTests(unittest.TestCase):
    def test_idle_sync_skips_repeat_obs_lookup_but_rechecks_changed_asset(self):
        profile = {'file_volume_offsets': {'a': -12}}
        context = (None, {'profiles': {'default': profile}}, 'default', 'a', 'player')
        with patch('lib.project_registry.discover_editor_projects', return_value={'soundboard': Mock()}), \
             patch.object(audio, 'runtime_audio_bindings', return_value={}), \
             patch.object(audio, 'project_audio_context', return_value=context), \
             patch.object(audio, 'obs_source_matches_runtime_stem', return_value=True) as matches, \
             patch('obs.get_input_volume', return_value={'db': -12}), \
             patch.object(audio, 'write_json_object') as save:
            audio.sync_audio_memory_from_obs('soundboard')
            matches.assert_called_once_with('player', 'a')
            save.assert_not_called()
            matches.reset_mock()
            # Swapping the file during a fader read must not save the new file's
            # volume against the old asset.
            matches.side_effect = [True, False]
            with patch('obs.get_input_volume', return_value={'db': -6}):
                audio.sync_audio_memory_from_obs('soundboard')
            self.assertEqual(matches.call_count, 2)
            save.assert_not_called()
            self.assertEqual(profile['file_volume_offsets'], {'a': -12})

    def test_asset_fader_recalls_each_file_independently(self):
        from lib.asset_fader import AssetFader
        with tempfile.TemporaryDirectory() as folder:
            fader = AssetFader('replay', Path(folder) / 'levels.json')
            with patch.object(fader, 'loaded', return_value=str(Path('a.mkv').resolve()).casefold()), \
                 patch('obs.get_input_volume', return_value={'db': -12}):
                fader.capture()
            with patch.object(fader, 'loaded', return_value=str(Path('b.mkv').resolve()).casefold()), \
                 patch('obs.get_input_volume', return_value={'db': -6}):
                fader.capture()
            with patch.object(fader, 'loaded', return_value=str(Path('a.mkv').resolve()).casefold()), \
                 patch('obs.set_input_volume_db') as write:
                fader.apply('a.mkv')
            write.assert_called_once_with('replay', -12)

    def test_music_adjustment_does_not_change_other_songs(self):
        from lib.project_settings import shift_asset_volume_db
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'hotkeys_editor.json'
            path.write_text(json.dumps({'live_profile': 'default', 'profiles': {'default': {
                'project_volume_db': -10, 'file_volume_offsets': {'A': -2, 'B': -7}}}}))
            shift_asset_volume_db(Path(folder), 'a', 3)
            saved = json.loads(path.read_text())['profiles']['default']
            self.assertEqual(saved['project_volume_db'], -10)
            self.assertEqual(saved['file_volume_offsets'], {'A': 1, 'B': -7})

    def test_idle_soundboard_uses_loaded_asset(self):
        project = SimpleNamespace(config_defaults={'obs_source_prefix': 'sb__'})
        state = {'live_profile': 'default', 'profiles': {'default': {}}}
        with patch.object(audio, 'editor_state_file_for_project', return_value=Path('unused')), \
             patch.object(audio, 'read_json_object', return_value=state), \
             patch.object(audio, 'obs_input_settings', return_value={'local_file': 'hooray.mp4'}):
            context = audio.project_audio_context('soundboard', project)
        self.assertEqual(context[-2:], ('hooray', 'sb__player'))

    def test_idle_music_ui_write_includes_category_and_does_not_revert(self):
        profile = {'project_volume_db': -10, 'profile_volume_db': -2,
                   'sound_categories': {'Cat Rave': ['fun']},
                   'category_volume_db': {'fun': -3}, 'file_volume_offsets': {'Cat Rave': -4}}
        state = {'profiles': {'default': profile}}
        project = SimpleNamespace(path=Path('unused'), hotkeys_file=Path('unused/hotkeys.json'))
        context = (None, state, 'default', 'cat rave', 'ss__player')
        with patch('lib.project_registry.discover_editor_projects', return_value={'specific_song': project}), \
             patch.object(audio, 'runtime_audio_bindings', return_value={'specific_song': {'shared_volume': True}}), \
             patch.object(audio, 'project_audio_context', return_value=context), \
             patch.object(audio, 'obs_input_settings', return_value={'local_file': 'cat rave.mp4'}), \
             patch('obs.set_input_volume_db') as write, \
             patch('obs.get_input_volume', return_value={'db': -19}), \
             patch.object(audio, 'write_json_object') as save:
            self.assertTrue(audio.apply_live_audio_to_obs('specific_song'))
            write.assert_called_once_with('ss__player', -19)
            audio.sync_audio_memory_from_obs('specific_song')
            save.assert_not_called()
            # A subsequent manual OBS move wins, without corrupting category gain.
            with patch('obs.get_input_volume', return_value={'db': -16}):
                audio.sync_audio_memory_from_obs('specific_song')
            self.assertEqual(profile['file_volume_offsets']['cat rave'], -1)
            self.assertEqual(profile['project_volume_db'], -10)
            save.assert_called_once()

    def test_zero_db_is_not_silence(self):
        handler = Mock()
        client = Mock()
        client.get_input_list.return_value = SimpleNamespace(inputs=[{'inputName': 'music'}])
        with patch('obs.get_obs', return_value=client), \
             patch('obs.get_input_volume', return_value={'db': 0, 'mul': 1}), \
             patch('obs.get_input_mute', return_value=False), \
             patch('obs.get_input_audio_monitor_type', return_value=None):
            server._Handler._get_obs_audio(handler)
        self.assertEqual(handler._json.call_args.args[1]['inputs'][0]['volume_db'], 0)

    def test_nonfinite_ui_volume_rejected_before_saving(self):
        handler = Mock()
        handler._body.return_value = {'project': 'specific_song', 'project_volume_db': 'NaN'}
        server._Handler._post_audio(handler)
        self.assertEqual(handler._err.call_args.args[0], 400)


if __name__ == '__main__':
    unittest.main()
