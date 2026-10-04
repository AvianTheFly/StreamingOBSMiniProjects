"""Preparation shares metadata, respects its I/O budget, and yields to playback."""
import json
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from lib import media_metadata
from lib.asset_preparation import AssetPreparation, preparation_budget
from lib.shared_media import layout_rules, media_startup
from obs.media_decode import hardware_decode_for


class AssetPreparationTests(unittest.TestCase):
    def setUp(self):
        media_metadata.clear_metadata_cache()

    def test_preparation_uses_spare_ram_and_reduces_budget_under_memory_pressure(self):
        gib = 1024**3
        for total, available, expected in [(64*gib, 43*gib, 2*gib),
                                            (16*gib, 8*gib, gib//2),
                                            (64*gib, gib, gib//16),
                                            (64*gib, 0, 0)]:
            with self.subTest(total=total, available=available), \
                 patch('psutil.virtual_memory', return_value=SimpleNamespace(
                    total=total, available=available)):
                self.assertEqual(preparation_budget(), expected)

    def test_explicit_preparation_budget_does_not_depend_on_host_memory(self):
        with patch('psutil.virtual_memory', side_effect=AssertionError('unexpected query')):
            preparer = AssetPreparation(budget_bytes=1000)
        self.assertEqual(preparer.status()['budget_mb'], 0.0)
        self.assertEqual(preparer.budget_bytes, 1000)

    def test_layout_and_decode_requests_share_one_probe_even_concurrently(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'clip.mp4'
            path.touch()
            entered, release = threading.Event(), threading.Event()
            results = []
            def probe(*args, **kwargs):
                entered.set()
                self.assertTrue(release.wait(2))
                return SimpleNamespace(returncode=0, stdout=json.dumps({'streams': [{
                    'codec_name': 'h264', 'width': 640, 'height': 360, 'avg_frame_rate': '30/1'}]}))
            with patch.object(media_metadata.subprocess, 'run', side_effect=probe) as run, \
                 patch.dict('os.environ', HUB_MEDIA_DECODE_MODE='auto'):
                first = threading.Thread(target=lambda: results.append(layout_rules.probe_dimension_key(path)))
                second = threading.Thread(target=lambda: results.append(hardware_decode_for(path)))
                first.start()
                self.assertTrue(entered.wait(2))
                second.start()
                release.set()
                first.join(2); second.join(2)
                self.assertCountEqual(results, ['640x360', False])
                run.assert_called_once()

    def test_compressed_prefetch_budget_is_shared_across_assets(self):
        with tempfile.TemporaryDirectory() as folder:
            paths = [Path(folder) / f'{i}.mp3' for i in range(2)]
            for path in paths:
                path.write_bytes(b'original' * 100)
            preparer = AssetPreparation(budget_bytes=1000, head_bytes=700)
            stop = threading.Event()
            for path in paths:
                preparer._prepare(path, stop)
                self.assertEqual(path.read_bytes(), b'original' * 100)
            self.assertEqual(preparer._warmed, 1000)

    def test_background_work_waits_for_live_loading_and_stops_on_shutdown(self):
        stop, entered = threading.Event(), threading.Event()
        results = []
        def work():
            entered.set()
            with media_startup.background_media_slot(stop) as allowed:
                results.append(allowed)
        with media_startup._load_lock:
            worker = threading.Thread(target=work)
            worker.start()
            self.assertTrue(entered.wait(2))
            self.assertEqual(results, [])
            stop.set()
        worker.join(2)
        self.assertFalse(worker.is_alive())
        self.assertEqual(results, [False])
