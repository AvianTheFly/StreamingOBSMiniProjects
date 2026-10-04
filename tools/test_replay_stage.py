import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()

from instant_replay import commands, library, stage


class ReplayStageTests(unittest.TestCase):
    def test_recent_single_capture_and_old_clip_have_different_labels(self):
        path = Path('C:/StreamingMedia/Replays/example.mp4')
        key = library.clip_id(path)
        with patch.object(library, 'read', return_value={'clips': {key: {'saved_at': 900}}}):
            self.assertEqual(stage.classify([str(path)], now=1000), 'replay')
            self.assertEqual(stage.classify([str(path)], now=1301), 'clip')
            self.assertEqual(stage.classify([str(path), str(path)], now=1000), 'highlights')

    def test_compact_voice_controls(self):
        expected = {'replay': ('play', 'replay'), 'play clip': ('play', 'last'),
                    'save and replay': ('save_replay', ''), 'showcase': ('play', 'showcase'),
                    'live view': ('view', 'live'),
                    'next clip': ('next', ''), 'screen on': ('screen', 'on'),
                    'hide desktop': ('screen', 'off'), 'stop': ('stop', '')}
        for spoken, result in expected.items():
            with self.subTest(spoken=spoken):
                self.assertEqual(commands.parse_command(spoken)[:2], result)

    def test_library_edit_updates_current_clip_without_changing_playback(self):
        path='C:/fixture/small.mkv'
        original=stage.state()
        with patch.dict(stage._state,active=True,clip_path=path,purpose='replay_only',
                        phase='playing',cursor_ms=2400,revision=7):
            stage.sync_labels({'clips':{library.clip_id(path):{'title':'Worth keeping','purpose':'highlight'}}})
            state=stage.state()
            self.assertEqual(state['purpose'],'highlight')
            self.assertEqual(state['title'],'Worth keeping')
            self.assertEqual((state['phase'],state['cursor_ms'],state['revision']),('playing',2400,7))
        self.assertEqual(stage.state()['clip_path'],original['clip_path'])

    def test_title_search_prefers_exact_label(self):
        root = Path('C:/StreamingMedia/Replays')
        exact = str(root / 'one.mp4')
        partial = str(root / 'two.mp4')
        rows = [{'path': exact, 'name': 'one.mp4', 'saved_at': 1},
                {'path': partial, 'name': 'two.mp4', 'saved_at': 2}]
        data = {'clips': {library.clip_id(exact): {'title': 'baron steal'},
                          library.clip_id(partial): {'title': 'baron steal reaction'}}}
        with patch.object(library, 'read', return_value=data), patch.object(library, 'disk_rows', return_value=rows):
            self.assertEqual(library.search_paths('baron steal', root), [exact])


if __name__ == '__main__':
    unittest.main()
