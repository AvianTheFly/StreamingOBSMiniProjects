"""Offline cutoff and central scene handoff regressions."""
import sys
import tempfile
import subprocess
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay.main import _trim_from_end
from coordinator import SceneSession
from shared import VoicePTT

class SceneTests(unittest.TestCase):
    def setUp(self):
        self.scene = "Game"
        self.obs = patch("obs.get_current_scene", side_effect=lambda: self.scene)
        self.obs.start(); self.addCleanup(self.obs.stop)
        self.switch = patch("obs.switch_scene", side_effect=lambda s: setattr(self, "scene", s))
        self.changed = self.switch.start(); self.addCleanup(self.switch.stop)
        self.iface = Mock(name="other")
        self.iface.name = "music"
        self.iface.get_status.return_value = SimpleNamespace(is_paused=False)
        self.reg = patch("shared.project_registry.all", return_value=[self.iface])
        self.reg.start(); self.addCleanup(self.reg.stop)

    def test_external_scene_cannot_be_reclaimed_or_restored(self):
        session = SceneSession("instant_replay", "Replay", "Fallback")
        self.assertTrue(session.activate())
        self.scene = "New choice"
        self.assertFalse(session.activate())
        session.finish(); session.finish()
        self.assertEqual(self.scene, "New choice")
        self.iface.resume.assert_not_called()
        self.changed.assert_called_once_with("Replay")

    def test_normal_finish_returns_once(self):
        session = SceneSession("instant_replay", "Replay", "Fallback")
        session.activate(); session.finish(); session.finish()
        self.assertEqual(self.scene, "Game")
        self.iface.resume.assert_called_once()

    def test_controller_return_takes_priority(self):
        session = SceneSession("instant_replay", "Replay", "Fallback")
        session.activate()
        self.iface.resume.side_effect = lambda: setattr(self, "scene", "Lobby")
        session.finish()
        self.assertEqual(self.scene, "Lobby")

    def test_already_paused_project_is_not_resumed(self):
        self.iface.get_status.return_value.is_paused = True
        session = SceneSession("instant_replay", "Replay", "Fallback")
        session.activate(); session.finish()
        self.iface.pause.assert_not_called(); self.iface.resume.assert_not_called()

class CutoffTests(unittest.TestCase):
    def test_timestamp_survives_stop_and_transcription_delay(self):
        voice = Mock()
        voice.start_recording.return_value = True
        callback = Mock()
        ptt = VoicePTT(99, Mock(), on_timed_transcript=callback)
        with patch.dict(sys.modules, {"voice.listener": voice}), patch("shared.threading.Timer"), patch("shared.time.time", return_value=123):
            ptt._on_trigger_sync()
            ptt._do_stop()
            voice.stop_and_transcribe.call_args.args[0]("save")
        callback.assert_called_once_with("save", 123)

    def test_real_media_end_and_multiple_audio_tracks(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "source.mkv"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i",
                "color=c=blue:s=64x64:r=30:d=4", "-f", "lavfi", "-i",
                "sine=frequency=1000:duration=4", "-map", "0:v", "-map", "1:a",
                "-map", "1:a", "-c:v", "libx264", "-threads", "2", "-c:a", "aac", str(source)], check=True, capture_output=True)
            original = source.read_bytes()
            for keep, expected in [(None, 2), (1, 1)]:
                output = _trim_from_end(str(source), keep, tail_seconds=2)
                self.assertIsNotNone(output)
                result = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", output], capture_output=True, text=True, check=True)
                self.assertAlmostEqual(float(result.stdout), expected, delta=0.1)
                tracks = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", output], capture_output=True, text=True, check=True)
                self.assertEqual(len(tracks.stdout.strip().splitlines()), 2)
            self.assertEqual(source.read_bytes(), original)
            self.assertIsNone(_trim_from_end(str(source), None, tail_seconds=10))
            self.assertEqual(source.read_bytes(), original)

if __name__ == "__main__": unittest.main()
