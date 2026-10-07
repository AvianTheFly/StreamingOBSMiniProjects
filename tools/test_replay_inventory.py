"""Real filesystem coverage for replay selection and fresh inventory metadata."""
import os
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from instant_replay import inventory, library


class ReplayInventoryTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.labels = {}
        reader = patch.object(library, 'read', side_effect=lambda: {'clips': self.labels})
        self.read = reader.start()
        self.addCleanup(reader.stop)

    def file(self, name, time=100):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'fixture')
        os.utime(path, (time, time))
        return path

    def test_scopes_linked_copies_and_highlight_intent_remain_live(self):
        raw = self.file('raw.mp4')
        cut = self.file('raw'+inventory.TRIMMED_SUFFIX)
        nested = self.file('clips/game/nested.MP4', 200)
        source = self.file('source.mkv')
        linked = self.file('replay-only/link.mp4', 300)
        self.file('unrelated/ignored.mp4')
        self.file('clips/not-media.txt')
        self.labels[library.clip_id(linked)] = dict(path=str(linked), capture_source=str(source), purpose='replay_only')
        self.assertEqual(inventory.replay_files(self.root), [linked, nested, cut])
        self.assertEqual(inventory.replay_files(self.root, highlights_only=True), [nested, cut])
        # Deletions/replacements are observed on the very next request.
        linked.unlink()
        cut.unlink()
        self.assertEqual(set(inventory.replay_files(self.root)), {raw, nested, source})
        self.assertEqual(inventory.replay_files(self.root/'missing'), [])

    def test_ui_uses_one_labels_generation_and_fresh_sizes(self):
        clip = self.file('clips/one.mp4')
        self.labels[library.clip_id(clip)] = dict(tag='win', saved_at=111)
        state = SimpleNamespace(_lock=threading.RLock(), _clip_registry=[], _previous_game_clips=[])
        with patch.object(inventory, 'REPLAY_DIR', self.root), patch.object(inventory, 'EDITED_DIR', self.root/'edited'):
            rows = inventory.ReplayInventory(state)._list_clips()
            self.read.assert_called_once()
            self.assertEqual((rows[0]['tag'], rows[0]['saved_at'], rows[0]['size_bytes']), ('win', 111, 7))
            clip.write_bytes(b'replaced with longer media')
            self.assertEqual(inventory.ReplayInventory(state)._list_clips()[0]['size_bytes'], 26)


if __name__ == '__main__':
    unittest.main()
