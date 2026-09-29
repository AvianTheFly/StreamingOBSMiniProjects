"""Editor previews retain scores, aliases, and ordering without OBS or models."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from lib.hotkey_editor import server
from lib.paths import ensure_import_paths
from lib.shared_media.phrase_scoring import coverage_score, normalize_phrase

ensure_import_paths()
from specific_song import matcher


class EditorMatchingTests(unittest.TestCase):
    def test_song_playback_and_editor_share_coverage_scoring(self):
        self.assertIs(matcher._score_pair, coverage_score)
        self.assertIs(matcher._norm, normalize_phrase)
        library = [{'name': 'Running Up That Hill', 'aliases': ['Kate Bush']},
                   {'name': 'Run', 'aliases': []}, {'name': 'Star Boy', 'aliases': ['Starboy']}]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'phrases.json'
            path.write_text(json.dumps({s['name'].lower(): s['aliases'] for s in library}), encoding='utf-8')
            for query in ('KATE BUSH!', 'running hill', 'run', 'starboy', '!!!', '  '):
                with self.subTest(query=query):
                    expected = [{'stem': song['name'], 'score': round(score, 3)}
                                for song, score in matcher.rank_matches(query, library)]
                    self.assertEqual(server._score_phrase(query, [s['name'] for s in library], path,
                                                         strategy='coverage_difflib'), expected)

    def test_rapidfuzz_and_fallback_keep_aliases_and_zero_score_candidates(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'phrases.json'
            path.write_text(json.dumps({'first': ['alias'], 'second': ['alias']}), encoding='utf-8')
            for fallback in (False, True):
                with self.subTest(fallback=fallback), patch.dict(sys.modules, {'rapidfuzz': None} if fallback else {}):
                    scores = server._score_phrase('alias', ['First', 'Second', 'zzz'], path)
                    # Later aliases own collisions, matching the existing editor behavior.
                    self.assertEqual(scores[0], {'stem': 'Second', 'score': 1.0})
                    self.assertEqual(scores[-1], {'stem': 'zzz', 'score': 0.0})
                    self.assertEqual(len(scores), 3)

    def test_empty_inputs_and_ties_keep_existing_behavior(self):
        self.assertEqual(server._score_phrase('', ['one']), [])
        self.assertEqual(server._score_phrase('one', []), [])
        for strategy in (None, 'coverage_difflib'):
            self.assertEqual(server._score_phrase('!!!', ['bbb', 'aaa'], strategy=strategy),
                             [{'stem': 'bbb', 'score': 0.0}, {'stem': 'aaa', 'score': 0.0}])

    def test_project_normalization_preserves_paths_and_metadata(self):
        payload = {'key': 'custom', 'name': 'Custom', 'asset_dir': 'assets',
                   'hotkeys_file': 'project/keys.json', 'extensions': ['.mp3'],
                   'config_defaults': {'project_volume_db': -5.5},
                   'features': {'voice_commands_enabled': False},
                   'profile_store_file': 'project/profiles.json', 'can_create_profiles': True,
                   'phrases_file': 'elsewhere/phrases.json'}
        result = server._normalize_project(payload)
        for field in ('key', 'name', 'config_defaults', 'features', 'can_create_profiles'):
            self.assertEqual(result[field], payload[field])
        for field in ('asset_dir', 'hotkeys_file', 'profile_store_file', 'phrases_file'):
            self.assertEqual(result[field], Path(payload[field]))
        self.assertEqual(result['extensions'], {'.mp3'})
        self.assertEqual(result['state_file'], Path('project/keys_editor.json'))
        minimal = server._normalize_project({'name': 'Sound Board', 'asset_dir': 'assets',
                                             'hotkeys_file': 'keys.json', 'valid_extensions': {'.wav'}})
        self.assertEqual(minimal['key'], 'sound_board')
        self.assertEqual(minimal['phrases_file'], Path('phrases.json'))
        self.assertEqual(minimal['extensions'], {'.wav'})
        self.assertIsNone(minimal['profile_store_file'])


if __name__ == '__main__':
    unittest.main()
