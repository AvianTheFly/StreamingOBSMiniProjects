"""Exercise real cuts on disposable recordings, never the personal library."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay import editing as replay_trim
from instant_replay import library
from lib.asset_fader import AssetFader
from lib.media_jobs import MediaJobBudget, MediaJobCancelled
import threading
import time


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg required")
class ReplayTrimTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "sample.mp4"
        subprocess.run([
            "ffmpeg", "-nostdin", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=440", "-t", "4",
            "-map", "0:v", "-map", "1:a", "-map", "1:a",
            "-c:v", "libx264", "-g", "120", "-c:a", "aac", str(self.source),
        ], capture_output=True, check=True, creationflags=replay_trim._flags)
        self.original = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.state_patch = patch.object(library, "STATE_FILE", self.root / "library.json")
        self.state_patch.start(); self.addCleanup(self.state_patch.stop)
        with replay_trim._lock:
            replay_trim._jobs.clear()

    def cut(self, start=1.3, end=2.8):
        job = replay_trim.start_trim(dict(path=str(self.source), start=start, end=end, title="The moment"), self.root)
        try:
            replay_trim._jobs[job["job"]].result(timeout=30)
        except (ValueError, OSError):
            pass
        return replay_trim.trim_status(job["job"])

    def test_cut_preserves_original_resolution_audio_tracks_and_labels(self):
        library.mutate(dict(action="clip", revision=0, path=str(self.source), title="Source", notes="nice play", favorite=True), self.root)
        result = self.cut()
        self.assertEqual(result["status"], "ready")
        output = Path(result["path"])
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(output)],
                               capture_output=True, text=True, check=True, creationflags=replay_trim._flags)
        media = json.loads(probe.stdout)
        video = next(s for s in media["streams"] if s["codec_type"] == "video")
        self.assertEqual((video["width"], video["height"]), (320, 180))
        self.assertEqual(sum(s["codec_type"] == "audio" for s in media["streams"]), 2)
        self.assertAlmostEqual(float(media["format"]["duration"]), 1.5, delta=0.12)
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(), self.original)
        data = library.read()
        meta = data["clips"][library.clip_id(output)]
        self.assertEqual((meta["title"], meta["notes"], meta["favorite"]), ("The moment", "nice play", True))
        self.assertTrue(meta["kept"])
        self.assertTrue(data["clips"][library.clip_id(self.source)]["kept"])
        self.assertEqual(meta["trim_source"], str(self.source))
        self.assertEqual(len(library.disk_rows(self.root)), 2)
        self.assertEqual(list(self.root.rglob("*.partial")), [])
        group = library.mutate(dict(action="group", revision=data["revision"], name="Intro", paths=[str(output)]), self.root)["groups"][0]
        self.assertEqual(library.group_paths(group["id"], self.root), [str(output)])

    def test_invalid_ranges_and_out_of_bounds_leave_source_intact(self):
        for start, end in [(2, 1), (-1, 2), (1, 1), (float("nan"), 2), (0, float("inf"))]:
            with self.assertRaises(ValueError): self.cut(start, end)
        self.assertEqual(self.cut(1, 99)["status"], "error")
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(), self.original)
        self.assertEqual(list(self.root.rglob("*.partial")), [])

    def test_encoder_failure_does_not_publish_partial_clip(self):
        with patch.object(replay_trim, "_duration", return_value=4), \
             patch.object(replay_trim.jobs, "run", return_value=subprocess.CompletedProcess([], 1)):
            self.assertEqual(self.cut()["status"], "error")
        self.assertEqual(len(library.disk_rows(self.root)), 1)

    def test_cut_waits_for_shared_conversion_capacity(self):
        budget = MediaJobBudget(capacity=3)
        with patch.object(replay_trim, "jobs", budget):
            with budget.slot("other-conversions", weight=3):
                request = replay_trim.start_trim(dict(path=str(self.source), start=1.3, end=2.8), self.root)
                deadline = time.monotonic() + 3
                while budget.status()["queued"] == 0 and time.monotonic() < deadline:
                    time.sleep(.01)
                self.assertEqual(budget.status()["queued"], 1)
                self.assertEqual(replay_trim.trim_status(request["job"])["status"], "saving")
                self.assertEqual(len(library.disk_rows(self.root)), 1)
            replay_trim._jobs[request["job"]].result(timeout=30)
            self.assertEqual(replay_trim.trim_status(request["job"])["status"], "ready")

    def test_shutdown_cancels_queued_cut_without_creating_output(self):
        budget = MediaJobBudget(capacity=3)
        stop = threading.Event(); budget.bind(stop)
        with patch.object(replay_trim, "jobs", budget), budget.slot("other-conversions", weight=3):
            request = replay_trim.start_trim(dict(path=str(self.source), start=1.3, end=2.8), self.root)
            deadline = time.monotonic() + 3
            while budget.status()["queued"] == 0 and time.monotonic() < deadline:
                time.sleep(.01)
            self.assertEqual(budget.status()["queued"], 1)
            stop.set()
            with self.assertRaises(MediaJobCancelled):
                replay_trim._jobs[request["job"]].result(timeout=3)
            self.assertEqual(replay_trim.trim_status(request["job"])["status"], "error")
            self.assertEqual(len(library.disk_rows(self.root)), 1)

    def test_cut_uses_source_volume_until_adjusted_independently(self):
        result = self.cut()
        output = Path(result["path"])
        key = lambda p: str(p.resolve()).casefold()
        levels = {key(self.source): -12}
        labels = library.read()["clips"]
        self.assertEqual(library.volume_source(output, labels, levels), str(self.source))
        fader = AssetFader("replay", self.root / "levels.json")
        with patch.object(fader, "values", return_value=levels), \
             patch.object(fader, "loaded", return_value=key(output)), \
             patch("obs.set_input_volume_db") as volume:
            fader.apply(output, fallback=self.source)
            volume.assert_called_with("replay", -12)
            levels[key(output)] = -7
            fader.apply(output, fallback=self.source)
            volume.assert_called_with("replay", -7)
        self.assertEqual(levels[key(self.source)], -12)


if __name__ == "__main__":
    unittest.main()
