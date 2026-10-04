"""Actual child cancellation and shared admission for normal conversion flows."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

import psutil
from lib.media_jobs import MediaJobBudget, MediaJobCancelled
from lib.browser_effects.audio import prepare_audio


class MediaJobTests(unittest.TestCase):
    def test_foreground_requests_precede_queued_previews_with_bounded_cpu_weight(self):
        budget = MediaJobBudget(capacity=2)
        order = []
        def request(kind, priority):
            with budget.slot(kind, weight=2, priority=priority):
                self.assertEqual(budget.status()['used'], 2)
                order.append(kind)
        with budget.slot('old-cut', weight=2):
            preview = threading.Thread(target=request, args=('preview', 20))
            preview.start()
            deadline = time.monotonic() + 2
            while budget.status()['queued'] != 1 and time.monotonic() < deadline:
                time.sleep(.01)
            foreground = threading.Thread(target=request, args=('new-cut', 0))
            foreground.start()
            deadline = time.monotonic() + 2
            while budget.status()['queued'] != 2 and time.monotonic() < deadline:
                time.sleep(.01)
            self.assertEqual(budget.status()['queued'], 2)
            self.assertEqual(order, [])
        preview.join(2); foreground.join(2)
        self.assertEqual(order, ['new-cut', 'preview'])
        self.assertEqual(budget.status()['used'], 0)

    def test_shutdown_reaps_running_child_and_cancels_waiting_job(self):
        budget = MediaJobBudget(capacity=1)
        stop = threading.Event()
        budget.bind(stop)
        errors = []
        def run():
            try:
                budget.run([sys.executable, '-c', 'import time; time.sleep(30)'],
                           kind='conversion', timeout=40)
            except MediaJobCancelled:
                errors.append('cancelled')
        first = threading.Thread(target=run)
        first.start()
        deadline = time.monotonic() + 3
        child = None
        while time.monotonic() < deadline:
            active = budget.status()['active']
            if active and active[0]['pid']:
                child = active[0]['pid']; break
            time.sleep(.01)
        self.assertIsNotNone(child)
        second = threading.Thread(target=run)
        second.start()
        stop.set()
        first.join(3); second.join(3)
        self.assertFalse(first.is_alive()); self.assertFalse(second.is_alive())
        self.assertEqual(errors, ['cancelled', 'cancelled'])
        self.assertFalse(psutil.pid_exists(child))
        self.assertEqual(budget.status()['used'], 0)
        self.assertEqual(budget.status()['queued'], 0)

    def test_audio_extraction_preserves_original_and_reuses_complete_cache(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'reaction.mkv'
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-f', 'lavfi', '-i',
                'sine=frequency=500:duration=0.2', '-c:a', 'pcm_s16le', str(source)],
                capture_output=True, check=True)
            original = source.read_bytes()
            with patch.dict(os.environ, LOCALAPPDATA=folder):
                first = prepare_audio(source)
                second = prepare_audio(source)
                self.assertEqual(first, second)
                self.assertGreater(first.stat().st_size, 44)
                self.assertEqual(source.read_bytes(), original)
                self.assertFalse(list(first.parent.glob('*.tmp.wav')))
                stream = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                    'stream=codec_name', '-of', 'json', str(first)],
                    capture_output=True, text=True, check=True)
                self.assertEqual(json.loads(stream.stdout)['streams'][0]['codec_name'], 'pcm_s16le')
