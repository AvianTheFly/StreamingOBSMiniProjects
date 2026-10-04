"""Check personalized song selection across loading and live edits."""
import json
import tempfile
import unittest
from pathlib import Path

from lib.paths import ensure_import_paths
ensure_import_paths()
from specific_song.library import load_library, load_categories, load_manual_triggers
from specific_song.commands import parse_command, match_category


class SongLibraryTests(unittest.TestCase):
    def test_personal_phrases_merge_without_rewriting_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            songs = root / 'songs.json'
            songs.write_text(json.dumps([dict(id='favorite', name='Favorite',
                                             source='favorite', aliases=['original'])]),
                             encoding='utf-8')
            phrases = root / 'phrases.json'
            phrases.write_text(json.dumps({'_comment': 'personal',
                                           'favorite': ['my song', ' original ']}),
                               encoding='utf-8')
            before = {p: p.read_bytes() for p in (songs, phrases)}
            library = load_library(songs, root)
            self.assertEqual(library[0]['aliases'], ['my song', 'original'])
            for path, contents in before.items():
                self.assertEqual(path.read_bytes(), contents)

    def test_editor_categories_and_manual_bindings_refresh_from_disk(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            editor = root / 'hotkeys_editor.json'
            editor.write_text(json.dumps({'live_profile': 'personal', 'profiles': {
                'default': {'categories': ['Old']},
                'personal': {'categories': ['Favorites'],
                             'sound_categories': {'favorite': ['Favorites']}}}}),
                              encoding='utf-8')
            hotkeys = root / 'hotkeys.json'
            hotkeys.write_text(json.dumps({'@': 'favorite'}), encoding='utf-8')
            self.assertEqual(load_categories(root), {'Favorites': ['favorite']})
            self.assertEqual(match_category('from favorites', load_categories(root)),
                             'Favorites')
            self.assertEqual(load_manual_triggers(root, {}), {'@': 'favorite'})
            hotkeys.write_text(json.dumps({'@': 'new favorite'}), encoding='utf-8')
            self.assertEqual(load_manual_triggers(root, {}), {'@': 'new favorite'})
            self.assertEqual(parse_command('skip song'), ('next', ''))
            self.assertEqual(parse_command('refresh'), ('reload', ''))
