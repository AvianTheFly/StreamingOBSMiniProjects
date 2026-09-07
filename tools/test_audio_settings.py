import sys
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from hub_ui import server


class AudioSettingsTests(unittest.TestCase):
    def test_idle_soundboard_uses_loaded_asset(self):
        project = SimpleNamespace(config_defaults={'obs_source_prefix': 'sb__'})
        state = {'live_profile': 'default', 'profiles': {'default': {}}}
        with patch.object(server, '_editor_state_file_for_project', return_value=Path('unused')), \
             patch.object(server, '_read_json_object', return_value=state), \
             patch.object(server, '_obs_input_settings', return_value={'local_file': 'hooray.mp4'}):
            context = server._project_audio_context('soundboard', project)
        self.assertEqual(context[-2:], ('hooray', 'sb__player'))

    def test_idle_music_ui_write_includes_category_and_does_not_revert(self):
        profile = {'project_volume_db': -10, 'profile_volume_db': -2,
                   'sound_categories': {'Cat Rave': ['fun']},
                   'category_volume_db': {'fun': -3}, 'file_volume_offsets': {'Cat Rave': -4}}
        state = {'profiles': {'default': profile}}
        project = SimpleNamespace(path=Path('unused'), hotkeys_file=Path('unused/hotkeys.json'))
        context = (None, state, 'default', 'cat rave', 'ss__player')
        with patch('lib.project_registry.discover_editor_projects', return_value={'specific_song': project}), \
             patch.object(server, '_runtime_audio_bindings', return_value={'specific_song': {'shared_volume': True}}), \
             patch.object(server, '_project_audio_context', return_value=context), \
             patch.object(server, '_obs_input_settings', return_value={'local_file': 'cat rave.mp4'}), \
             patch('obs.set_input_volume_db') as write, \
             patch('obs.get_input_volume', return_value={'db': -19}), \
             patch('lib.project_settings.shift_project_volume_db') as shift:
            self.assertTrue(server._apply_live_audio_to_obs('specific_song'))
            write.assert_called_once_with('ss__player', -19)
            server._sync_audio_memory_from_obs('specific_song')
            shift.assert_not_called()
            # A subsequent manual OBS move wins, without corrupting category gain.
            with patch('obs.get_input_volume', return_value={'db': -16}):
                server._sync_audio_memory_from_obs('specific_song')
            self.assertEqual(shift.call_args.args[1], 3)

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
