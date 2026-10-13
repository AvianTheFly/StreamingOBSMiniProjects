"""Retired artwork and animation identity must not disturb scene privacy."""
import json
import tempfile
import unittest
from pathlib import Path
from .champ_select import ChampSelectState, THEMES
from .client_scenes import ClientScenes, route


class DraftWorldTests(unittest.TestCase):
    def test_tree_is_retired_and_saved_choice_has_lossless_fallback(self):
        self.assertEqual(THEMES, ('bear', 'turtle', 'ram', 'phoenix'))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'settings.json'
            original = {'theme': 'verdant', 'personal-extra': {'keep': 1}}
            path.write_text(json.dumps(original))
            owner = ClientScenes(path)
            self.assertEqual(owner.settings['theme'], 'turtle')
            self.assertEqual(json.loads(path.read_text()), original)

    def test_generation_changes_only_for_new_drafts(self):
        with tempfile.TemporaryDirectory() as folder:
            owner = ChampSelectState(folder)
            session = {'gameId': 41}
            owner.update('ChampSelect', session)
            first = owner.snapshot(True)['generation']
            owner.update('ChampSelect', session)
            self.assertEqual(owner.snapshot(True)['generation'], first)
            owner.update('Lobby', None)
            owner.update('ChampSelect', {'gameId': 42})
            self.assertGreater(owner.snapshot(True)['generation'], first)

    def test_automatic_banning_stays_private(self):
        draft = {'timer': {'phase': 'BAN_PICK'}, 'actions': [[
            {'type': 'ban', 'completed': False, 'championId': 238},
            {'type': 'pick', 'completed': False},
        ]]}
        self.assertEqual(route('ChampSelect', draft), 'queue')
        draft['actions'][0][0]['completed'] = True
        self.assertEqual(route('ChampSelect', draft), 'champions')
