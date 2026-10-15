"""Spoken free-form labels reach local metadata and the same Twitch request."""
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from instant_replay import commands, capture, library
from instant_replay.runtime_state import ReplayState


class NamingTests(unittest.TestCase):
    def test_name_shorthand_and_capture_options_are_separate_from_title_words(self):
        for spoken, expected in [
            ('name Dragon steal.', ('save', 'Dragon steal', 0, False)),
            ('Name: Huge Escape!', ('save', 'Huge Escape', 0, False)),
            ('save name Save the day', ('save', 'Save the day', 0, False)),
            ('save 30 name Full 60 second escape', ('save', 'Full 60 second escape', 30, False)),
            ('save full name Play everything', ('save', 'Play everything', 0, True)),
            ('mark name Funny moment', ('mark', 'Funny moment', 0, False)),
            ('save and replay name Close fight', ('save_replay', 'Close fight', 0, False)),
            ('play intro name Dragon', ('play', 'intro name dragon', 0, False)),
        ]:
            with self.subTest(spoken=spoken):
                self.assertEqual(commands.parse_command(spoken), expected)

    def test_empty_name_does_not_save_or_guess_a_tag(self):
        for text in ('name', 'name:', 'save name', 'save name...'):
            self.assertEqual(commands.parse_command(text), (None, '', 0, False))
        self.assertEqual(len(commands.parse_command('name '+('a'*200))[1]), 160)

    def test_capture_persists_title_and_tag_and_requests_one_named_twitch_clip(self):
        with TemporaryDirectory() as folder, patch.object(library, 'STATE_FILE', Path(folder)/'library.json'):
            source=Path(folder)/'replay.mkv';source.write_bytes(b'disposable capture')
            state=ReplayState()
            recorder=capture.ReplayCapture(state, SimpleNamespace(first_kill_wall_time=None, last_death_wall_time=None))
            command,label,seconds,full=commands.parse_command('name Dragon steal')
            self.assertEqual(command,'save')
            def saved(*,timeout,on_save_requested):
                on_save_requested(105)
                return str(source)
            with patch.object(capture,'save_replay_buffer_and_wait',side_effect=saved), \
                 patch.object(capture,'_saved_clip',return_value=str(source)) as trim, \
                 patch.object(capture,'request_clip') as twitch:
                self.assertTrue(recorder._on_save(tag=label,clip_seconds=seconds,full_save=full,pressed_at=100))
                self.assertTrue(state._save_done_event[0].wait(2))
                twitch.assert_called_once_with(title=label)
                self.assertEqual(trim.call_args.kwargs['tail_seconds'],5)
            meta=library.read()['clips'][library.clip_id(source)]
            self.assertEqual(meta['title'],label)
            self.assertEqual(meta['tag'],label)
            self.assertEqual(meta['purpose'],'highlight')
            self.assertEqual(library.search_paths('Dragon steal',folder),[str(source)])

    def test_unnamed_capture_preserves_manual_title_notes_and_unknown_fields(self):
        with TemporaryDirectory() as folder, patch.object(library,'STATE_FILE',Path(folder)/'library.json'):
            source=Path(folder)/'replay.mkv';source.write_bytes(b'disposable capture')
            key=library.clip_id(source)
            library._write(dict(revision=0,groups=[],clips={key:dict(title='Personal title',notes='Keep this',future=17)}))
            library.remember_capture(source,title=None)
            meta=library.read()['clips'][key]
            self.assertEqual(meta['title'],'Personal title')
            self.assertEqual(meta['notes'],'Keep this')
            self.assertEqual(meta['future'],17)
