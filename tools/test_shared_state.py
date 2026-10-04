"""Exercise concurrent shared state and real persistence without touching user data."""
import json
from pathlib import Path
import tempfile
import threading
import unittest

from lib.json_store import update_json, write_json
from lib.snapshots import SnapshotMap
from lib.shared_media.random_playlist import RandomPlaylist


class SharedStateTests(unittest.TestCase):
    def test_independent_updates_do_not_lose_fields(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'settings.json'
            write_json(path, {'personal': 'keep', 'count': 0})
            def increment():
                for _ in range(20):
                    update_json(path, lambda old: {**old, 'count': old['count'] + 1})
            threads = [threading.Thread(target=increment) for _ in range(4)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(5)
                self.assertFalse(thread.is_alive())
            self.assertEqual(json.loads(path.read_text()), {'personal': 'keep', 'count': 80})
            self.assertFalse(list(Path(folder).glob('*.tmp')))

    def test_invalid_existing_data_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'settings.json'
            path.write_text('{unfinished')
            with self.assertRaises(ValueError):
                update_json(path, lambda value: {}, default={})
            self.assertEqual(path.read_text(), '{unfinished')

    def test_readers_retain_complete_mapping_generation(self):
        values = SnapshotMap({'old': 1, 'also old': 2})
        old = values.items()
        values.replace({'new': 3})
        self.assertEqual(dict(old), {'old': 1, 'also old': 2})
        self.assertEqual(dict(values), {'new': 3})
        snapshot = values.snapshot()
        snapshot.clear()
        self.assertEqual(values['new'], 3)

    def test_random_playlist_waits_for_coordination_and_cleanup(self):
        stop, cancel = threading.Event(), threading.Event()
        requested, completed = threading.Event(), threading.Event()
        played = []
        def play(stem):
            played.append(stem)
            requested.set()
            return completed
        playlist = RandomPlaylist('test', stop, {'a': 1, 'b': 2}, lambda: None, play)
        worker = threading.Thread(target=playlist.run, kwargs={'cancelled': cancel})
        worker.start()
        try:
            self.assertTrue(requested.wait(2))
            self.assertEqual(len(played), 1)
            cancel.set()
        finally:
            completed.set()
            worker.join(2)
        self.assertFalse(worker.is_alive())


if __name__ == '__main__':
    unittest.main()
