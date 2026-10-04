"""Cached playback stays responsive while probes remain single-file and bounded."""
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from lib import media_metadata as metadata

RESULT = SimpleNamespace(returncode=0, stdout='{"streams":[{"codec_name":"h264","width":640,"height":360,"avg_frame_rate":"30/1"}]}')


class MediaMetadataConcurrencyTests(unittest.TestCase):
    def setUp(self):
        metadata.clear_metadata_cache()
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.paths = [Path(self.folder.name) / f'{name}.mp4' for name in ('cached', 'slow', 'third')]
        for path in self.paths:
            path.touch()

    def test_cached_playback_returns_while_unrelated_probe_is_still_blocked(self):
        with patch.object(metadata.subprocess, 'run', return_value=RESULT):
            expected = metadata.probe_media(self.paths[0])
        entered, release, done = threading.Event(), threading.Event(), threading.Event()
        results = []
        def slow(*args, **kwargs):
            entered.set()
            if not release.wait(3): raise TimeoutError('fixture release missing')
            return RESULT
        def cached():
            results.append(metadata.probe_media(self.paths[0]))
            done.set()
        with patch.object(metadata.subprocess, 'run', side_effect=slow) as run:
            probe = threading.Thread(target=metadata.probe_media, args=(self.paths[1],))
            hit = threading.Thread(target=cached)
            probe.start()
            try:
                self.assertTrue(entered.wait(2))
                hit.start()
                self.assertTrue(done.wait(1), 'cached playback waited behind an unrelated probe')
                self.assertTrue(probe.is_alive())
                self.assertEqual(results, [expected])
                run.assert_called_once()
            finally:
                release.set()
                probe.join(3)
                if hit.ident is not None: hit.join(3)

    def test_different_misses_still_run_one_probe_at_a_time(self):
        entered, release = threading.Event(), threading.Event()
        active = maximum = calls = 0
        lock = threading.Lock()
        def slow(*args, **kwargs):
            nonlocal active, maximum, calls
            with lock:
                active += 1; maximum = max(maximum, active); calls += 1
            entered.set()
            if not release.wait(3): raise TimeoutError('fixture release missing')
            with lock: active -= 1
            return RESULT
        workers = [threading.Thread(target=metadata.probe_media, args=(path,)) for path in self.paths]
        with patch.object(metadata.subprocess, 'run', side_effect=slow):
            try:
                for worker in workers: worker.start()
                self.assertTrue(entered.wait(2))
            finally:
                release.set()
                for worker in workers:
                    worker.join(3)
                    self.assertFalse(worker.is_alive())
        self.assertEqual(calls, 3)
        self.assertEqual(maximum, 1)

    def test_eviction_keeps_recent_hits_and_reprobes_evicted_files(self):
        with patch.object(metadata, '_CACHE_LIMIT', 2), patch.object(metadata.subprocess, 'run', return_value=RESULT) as run:
            for index in (0, 1, 0, 2, 0): metadata.probe_media(self.paths[index])
            self.assertEqual(run.call_count, 3)
            metadata.probe_media(self.paths[1])
            self.assertEqual(run.call_count, 4)

    def test_clearing_during_probe_does_not_repopulate_invalidated_generation(self):
        entered, release = threading.Event(), threading.Event()
        def slow(*args, **kwargs):
            entered.set()
            if not release.wait(3): raise TimeoutError('fixture release missing')
            return RESULT
        with patch.object(metadata.subprocess, 'run', side_effect=slow) as run:
            worker = threading.Thread(target=metadata.probe_media, args=(self.paths[0],))
            worker.start()
            try:
                self.assertTrue(entered.wait(2))
                metadata.clear_metadata_cache()
            finally:
                release.set(); worker.join(3)
            metadata.probe_media(self.paths[0])
            self.assertEqual(run.call_count, 2)


if __name__ == '__main__':
    unittest.main()
