"""Kill cues cannot replay on scene activation or race replacement cleanup."""
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from league.kill_audio_player import LeagueKillAudioPlayer


class KillAudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.obs = Mock()
        self.obs.ensure_single_source.return_value = 'league__player'
        self.obs.set_media_source_file.return_value = True
        self.gate = threading.Event()
        self.gate.set()
        self.addCleanup(patch.stopall)
        patch('league.kill_audio_player.obs', self.obs).start()
        patch('league.kill_audio_player.coordinator.permission', return_value=self.gate).start()
        self.player = LeagueKillAudioPlayer(project_dir=Path(self.tmp.name),
            asset_dir=Path(self.tmp.name), scene='Sound Effects', source_prefix='league__')

    def test_startup_parks_instead_of_activating_last_cue(self):
        self.player.ensure_ready()
        self.obs.park_media_source.assert_called_once_with('Sound Effects', 'league__player')
        self.obs.show_source.assert_not_called()

    def test_completion_and_load_error_park_source(self):
        for fail in (False, True):
            with self.subTest(fail=fail):
                self.obs.reset_mock()
                self.obs.set_media_source_file.side_effect = RuntimeError('load failed') if fail else None
                self.player._play_owned(Path('kill.mp3'), threading.Event())
                self.assertEqual(self.obs.park_media_source.call_args.args,
                                 ('Sound Effects', 'league__player'))
                self.assertIsNone(self.player.current_stem)
                self.obs.restart_media.assert_not_called()

    def test_replacement_waits_for_old_cleanup(self):
        started = threading.Event()
        cleanup = threading.Event()
        release = threading.Event()
        order = []
        self.player.ensure_ready()
        def wait(*args, **kwargs):
            started.set()
            while not kwargs['cancelled']():
                release.wait(.01)
        def park(*args):
            order.append('park')
            cleanup.set()
            release.wait(2)
        self.obs.wait_for_media_end.side_effect = wait
        self.obs.park_media_source.side_effect = park
        self.obs.set_media_source_file.side_effect = lambda source, path: order.append(path.name) or True
        done = self.player._worker.submit(
            lambda cancelled: self.player._play_owned(Path('first.mp3'), cancelled))
        self.assertTrue(started.wait(2))
        self.player.play_file(Path('second.mp3'))
        self.assertTrue(cleanup.wait(2))
        self.assertEqual(order, ['first.mp3', 'park'])
        self.player.stop()
        release.set()
        self.assertTrue(done.wait(2))


if __name__ == '__main__':
    unittest.main()
