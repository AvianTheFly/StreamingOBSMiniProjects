"""Exercise real profile routes using temporary files and no HTTP server or OBS."""
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from lib.hotkey_editor import profiles, server


class EditorProfileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        folder = Path(self.temp.name)
        self.project = {"state_file": folder / 'hotkeys_editor.json',
                        "hotkeys_file": folder / 'hotkeys.json'}
        live = {**profiles.default_profile(), 'hotkeys': {'@': 'hooray'},
                'project_volume_db': -5.5, 'file_volume_offsets': {'hooray': -11.1},
                'custom_asset_data': {'hooray': {'filters': ['color'], 'scale': 1.2}}}
        editing = {**profiles.default_profile(), 'hotkeys': {'x': ['one', 'two']},
                   'project_volume_db': 2.5, 'category_volume_db': {'fun': -3.0}}
        self.state = {'live_profile': 'default', 'active_profile': 'editing',
                      'profiles': {'default': live, 'editing': editing}, 'custom_root': [1, 2]}
        self.project['state_file'].write_text(json.dumps(self.state), encoding='utf-8')
        self.project['hotkeys_file'].write_text(json.dumps(live['hotkeys']), encoding='utf-8')
        handler = server._make_handler(current={'proj': self.project},
                                       all_projects=[self.project], server_ref=[None])
        self.handler = object.__new__(handler)
        self.handler._json_ok = Mock()
        self.handler._json_err = Mock()
        self.handler.send_error = Mock()

    def request(self, action, data):
        body = json.dumps(data).encode()
        self.handler.path = '/api/profile/' + action
        self.handler.headers = {'Content-Length': str(len(body))}
        self.handler.rfile = io.BytesIO(body)
        self.handler.do_POST()
        return json.loads(self.project['state_file'].read_text(encoding='utf-8'))

    def mirrored_hotkeys(self):
        return json.loads(self.project['hotkeys_file'].read_text(encoding='utf-8'))

    def test_create_copies_active_and_duplicate_can_copy_live_without_changing_playback(self):
        state = self.request('create', {'name': '  new  '})
        self.assertEqual(state['profiles']['new'], self.state['profiles']['editing'])
        state = self.request('duplicate', {'name': 'live copy', 'source': 'default'})
        self.assertEqual(state['profiles']['live copy'], self.state['profiles']['default'])
        self.assertEqual(state['active_profile'], 'live copy')
        self.assertEqual(state['live_profile'], 'default')
        self.assertEqual(state['custom_root'], [1, 2])
        self.assertEqual(self.mirrored_hotkeys(), {'@': 'hooray'})
        self.handler._json_err.assert_not_called()

    def test_copies_are_independent_including_unknown_nested_asset_data(self):
        state = copy.deepcopy(self.state)
        profiles.change_profile(state, 'duplicate', {'name': 'copy', 'source': 'default'})
        state['profiles']['copy']['custom_asset_data']['hooray']['filters'].append('new')
        state['profiles']['copy']['file_volume_offsets']['hooray'] = -20
        self.assertEqual(state['profiles']['default'], self.state['profiles']['default'])

    def test_defaults_are_independent_and_failed_transitions_do_not_mutate_state(self):
        first, second = profiles.default_editor_state(), profiles.default_editor_state()
        first['profiles']['default']['hotkeys']['@'] = 'hooray'
        self.assertEqual(second['profiles']['default']['hotkeys'], {})
        for action, data in [('delete', {'name': 'default'}),
                             ('rename', {'from': 'default', 'to': 'default'}),
                             ('duplicate', {'name': 'new', 'source': 'missing'}),
                             ('unknown', {})]:
            with self.subTest(action=action):
                state = copy.deepcopy(first)
                with self.assertRaises(ValueError):
                    profiles.change_profile(state, action, data)
                self.assertEqual(state, first)

    def test_switch_only_changes_editor_selection_and_set_live_only_changes_playback(self):
        state = self.request('switch', {'name': 'default'})
        self.assertEqual(state['active_profile'], 'default')
        state = self.request('set_live', {'name': 'editing'})
        self.assertEqual(state['active_profile'], 'default')
        self.assertEqual(state['live_profile'], 'editing')
        self.assertEqual(self.mirrored_hotkeys(), {'x': ['one', 'two']})
        self.handler._json_ok.assert_called_with({'ok': True, 'live_profile': 'editing'})

    def test_delete_live_chooses_insertion_order_and_updates_legacy_hotkeys(self):
        self.request('create', {'name': 'aaa'})
        state = self.request('delete', {'name': 'default'})
        self.assertEqual(state['live_profile'], 'editing')
        self.assertEqual(state['active_profile'], 'aaa')
        self.assertEqual(self.mirrored_hotkeys(), {'x': ['one', 'two']})
        self.assertEqual(state['profiles']['editing'], self.state['profiles']['editing'])

    def test_delete_active_returns_editor_to_live_without_changing_hotkeys(self):
        state = self.request('delete', {'name': 'editing'})
        self.assertEqual(state['active_profile'], 'default')
        self.assertEqual(self.mirrored_hotkeys(), {'@': 'hooray'})
        reply = self.handler._json_ok.call_args.args[0]
        self.assertEqual(reply['file_volume_offsets'], {'hooray': -11.1})
        self.assertEqual(reply['project_volume_db'], -5.5)

    def test_rename_preserves_profile_data_and_response_shape(self):
        for original, renamed in [('default', 'live renamed'), ('editing', 'edit renamed')]:
            state = self.request('rename', {'from': original, 'to': renamed})
            self.assertEqual(state['profiles'][renamed], self.state['profiles'][original])
            self.assertEqual(set(self.handler._json_ok.call_args.args[0]),
                             {'ok', 'profile_names', 'active_profile', 'live_profile'})
        self.assertEqual(state['live_profile'], 'live renamed')
        self.assertEqual(state['active_profile'], 'edit renamed')
        self.assertEqual(self.mirrored_hotkeys(), {'@': 'hooray'})

    def test_invalid_requests_leave_both_files_untouched(self):
        cases = [('create', {}, 'Name required'),
                 ('create', {'name': 'default'}, "Profile 'default' already exists"),
                 ('duplicate', {'name': 'new', 'source': 'missing'}, "Profile 'missing' not found"),
                 ('rename', {'from': 'default'}, 'from and to required'),
                 ('rename', {'from': 'default', 'to': 'editing'}, "Profile 'editing' already exists")]
        cases += [(action, {'name': 'missing'}, "Profile 'missing' not found")
                  for action in ('delete', 'switch', 'set_live')]
        before = {path: path.read_bytes() for path in self.project.values()}
        for action, data, message in cases:
            with self.subTest(action=action, data=data):
                self.request(action, data)
                self.handler._json_err.assert_called_with(message)
                self.assertEqual({path: path.read_bytes() for path in before}, before)
        self.handler._json_ok.assert_not_called()

    def test_last_profile_and_unknown_actions_are_rejected(self):
        self.request('delete', {'name': 'editing'})
        before = self.project['state_file'].read_bytes()
        self.request('delete', {'name': 'default'})
        self.handler._json_err.assert_called_with('Cannot delete the last profile')
        self.assertEqual(self.project['state_file'].read_bytes(), before)
        self.request('anything', {})
        self.handler.send_error.assert_called_with(404)

    def test_response_normalizes_numbers_but_retains_raw_non_numeric_fields(self):
        response = profiles.profile_response_fields({
            'trigger_sequences': '++', 'project_volume_db': '-5.5', 'profile_volume_db': 'bad',
            'category_volume_db': {'fun': '-2', 'bad': 'x'},
            'file_volume_offsets': {'hooray': '-11.1'}, 'categories': None})
        self.assertEqual(response['profile_trigger_sequences'], '++')
        self.assertEqual(response['project_volume_db'], -5.5)
        self.assertEqual(response['profile_volume_db'], 0)
        self.assertEqual(response['category_volume_db'], {'fun': -2})
        self.assertEqual(response['file_volume_offsets'], {'hooray': -11.1})
        self.assertIsNone(response['categories'])
        self.assertNotIn('trigger_sequences', response)


if __name__ == '__main__':
    unittest.main()
