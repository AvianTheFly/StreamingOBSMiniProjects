"""Offline cutoff and central scene handoff regressions."""
import sys
import tempfile
import subprocess
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay.main import _trim_from_end
from coordinator import SceneSession
from shared import VoicePTT, ProjectStatus
from voice.service import VoiceService

class SceneTests(unittest.TestCase):
    def setUp(self):
        from lib.coordination.scenes import SceneDirector
        from lib.coordination.playback import PlayCoordinator
        from lib.project_runtime import _ProjectRegistry
        self.scene = 'Game'
        client = Mock()
        client.get_current_program_scene.side_effect = lambda: SimpleNamespace(current_program_scene_name=self.scene)
        self.changed = client.set_current_program_scene
        self.changed.side_effect = lambda scene: setattr(self, 'scene', scene)
        self.director = SceneDirector(lambda: client)
        self.iface = Mock(name='other')
        self.iface.name = 'music'
        self.iface.get_status.return_value = ProjectStatus('music', True, 'playing', ['Music'], True)
        registry = _ProjectRegistry()
        registry.register(self.iface)
        self.coordinator = PlayCoordinator(registry)
        self.addCleanup(self.coordinator.shutdown)

    def session(self):
        return SceneSession('instant_replay', 'Replay', 'Fallback', director=self.director,
                            coordinator=self.coordinator)

    def test_external_scene_cannot_be_reclaimed_or_restored(self):
        session = self.session()
        self.assertTrue(session.activate())
        self.scene = "New choice"
        self.assertFalse(session.activate())
        session.finish(); session.finish()
        self.assertEqual(self.scene, "New choice")
        self.iface.resume.assert_not_called()
        self.changed.assert_called_once_with("Replay")

    def test_normal_finish_returns_once(self):
        session = self.session()
        session.activate(); session.finish(); session.finish()
        self.assertEqual(self.scene, "Game")
        self.iface.pause.assert_called_once()
        self.iface.resume.assert_called_once()

    def test_controller_return_takes_priority(self):
        session = self.session()
        session.activate()
        self.iface.resume.side_effect = lambda: setattr(self, "scene", "Lobby")
        session.finish()
        self.assertEqual(self.scene, "Lobby")

    def test_already_paused_project_is_not_resumed(self):
        self.iface.get_status.return_value.is_paused = True
        session = self.session()
        session.activate(); session.finish()
        self.iface.pause.assert_not_called(); self.iface.resume.assert_not_called()

class ScopedTransitionTests(unittest.TestCase):
    def test_cursor_zero_cannot_release_scoped_return_early(self):
        from lib.coordination.scene_session import SceneSession
        clock=[10.0];revision=[1];lease=SimpleNamespace(previous='Game',activated=False)
        director=Mock();director.reserve.return_value=lease
        director.snapshot.side_effect=lambda:{'manual_revision':revision[0]}
        director.activate.side_effect=lambda owned:setattr(lease,'activated',True) or True
        director.finish.return_value=True
        coordinator=Mock();released=[]
        coordinator.release_pauses.side_effect=lambda *a,**k:released.append((clock[0],k['resume']))
        client=Mock();client.get_current_scene_transition_cursor.return_value.transition_cursor=0
        with patch('lib.coordination.scene_session.time.monotonic',side_effect=lambda:clock[0]),patch('lib.coordination.scene_session.time.sleep',side_effect=lambda d:clock.__setitem__(0,clock[0]+d)),patch('obs.get_obs',return_value=client):
            session=SceneSession('replay','Replay','Game',director=director,coordinator=coordinator,transition=('Move',320))
            session.activate();self.assertAlmostEqual(session.entry_transition_remaining(),.32)
            session.finish(wait_for_transition=True)
        self.assertGreaterEqual(released[0][0],10.32);self.assertTrue(released[0][1])

    def test_new_manual_choice_during_return_prevents_resume(self):
        from lib.coordination.scene_session import SceneSession
        lease=SimpleNamespace(previous='Game',activated=True)
        director=Mock();director.reserve.return_value=lease;director.finish.return_value=True
        director.snapshot.side_effect=[{'manual_revision':1},{'manual_revision':2}]
        coordinator=Mock();client=Mock()
        with patch('obs.get_obs',return_value=client):
            session=SceneSession('replay','Replay','Game',director=director,coordinator=coordinator,transition=('Move',320))
            session.finish(wait_for_transition=True)
        self.assertFalse(coordinator.release_pauses.call_args.kwargs['resume'])

class CutoffTests(unittest.TestCase):
    def test_voice_capture_paths_keep_the_original_button_time(self):
        import queue
        from contextlib import ExitStack
        from unittest.mock import call
        from instant_replay import main as runtime, interface
        stop=threading.Event();capture=Mock();selection=Mock()
        def delivered(**options):
            self.assertNotIn('play_sequence',interface._live,'Do not publish playback controls before startup completes')
            callback=options['on_timed_transcript']
            callback('save and replay',123)
            callback('quick replay 30',123)
            callback('save 30',123)
            stop.set()
            return Mock()
        with ExitStack() as stack:
            stack.enter_context(patch.dict(interface._live,{'unknown':'preserve'},clear=True))
            for name in ('KillTracker','ReplayInventory','ReplayPlayback','start_deferred',
                         'subscribe_global_hotkeys','unsubscribe_global_hotkeys','_unmute_desktop'):
                stack.enter_context(patch.object(runtime,name))
            stack.enter_context(patch.object(runtime,'ReplayCapture',return_value=capture))
            stack.enter_context(patch.object(runtime,'ReplaySelection',return_value=selection))
            stack.enter_context(patch.object(runtime,'VoicePTT',side_effect=delivered))
            stack.enter_context(patch.object(runtime.stage,'install'))
            runtime.run(queue.Queue(),stop)
            self.assertEqual(interface._live,{'unknown':'preserve'},'Shutdown must remove its callbacks and state without clearing unrelated fields')
        self.assertEqual(selection.capture_and_replay.call_args_list,[
            call(capture,pressed_at=123),
            call(capture,seconds=30,purpose='replay_only',pressed_at=123)])
        capture._on_save.assert_called_once_with(tag='',clip_seconds=30,full_save=False,pressed_at=123)

    def test_timestamp_survives_stop_and_transcription_delay(self):
        voice = Mock()
        voice.is_ready.return_value = True
        voice.start_recording.return_value = True
        callback = Mock()
        delivered = threading.Event()
        ptt = VoicePTT(2, Mock(), on_timed_transcript=callback,
                       on_complete=lambda text: delivered.set(), voice_service=VoiceService(voice))
        with patch("voice.service.threading.Timer"), patch("voice.service.time.time", return_value=123):
            ptt._on_trigger_sync()
            ptt._do_stop()
            voice.stop_and_transcribe.call_args.args[0]("save")
            voice.stop_and_transcribe.call_args.kwargs['on_complete']()
            self.assertTrue(delivered.wait(2))
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
