"""Watching a League replay must survive background client phase changes."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
from lib.coordination.scenes import SceneDirector
from .client_scenes import ClientScenes, DEFAULTS
from .test_client_scenes import FakeOBS, session


class ReplayViewingTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        path = Path(folder.name) / 'client_scenes.json'
        path.write_text(json.dumps({**DEFAULTS, 'enabled': True}))
        self.reader = Mock()
        self.reader.snapshot.return_value = ('Lobby', None)
        self.reader.replay_active.return_value = False
        self.obs = FakeOBS()
        self.now = [0]
        self.director = SceneDirector(lambda: self.obs)
        self.watcher = ClientScenes(path, reader=self.reader, obs_factory=lambda: self.obs,
                                    clock=lambda: self.now[0], director=self.director)
        self.watcher.tick()

    def start_replay(self):
        self.reader.replay_active.return_value = True
        self.watcher.tick()
        self.assertEqual(self.obs.scene, 'Test')

    def test_replay_overrides_lobby_queue_and_draft_until_process_closes(self):
        self.start_replay()
        writes = len(self.obs.writes)
        for phase, draft in [('Lobby', None), ('Matchmaking', None), ('ReadyCheck', None),
                             ('ChampSelect', session('PICK'))]:
            self.reader.snapshot.return_value = (phase, draft)
            self.now[0] += 60  # Long pauses and seeks do not expire replay viewing.
            self.watcher.tick()
            self.assertEqual(self.obs.scene, 'Test')
            self.assertTrue(self.watcher.snapshot()['watching_replay'])
        self.assertEqual(len(self.obs.writes), writes)
        self.reader.snapshot.return_value = ('Matchmaking', None)
        self.reader.replay_active.return_value = False
        self.watcher.tick()
        self.assertEqual(self.obs.scene, 'Lobbies')
        self.assertEqual(self.watcher.applied, 'queue')
        self.assertFalse(self.watcher.snapshot()['watching_replay'])

    def test_replay_closure_resumes_unchanged_lobby(self):
        self.start_replay()
        self.reader.replay_active.return_value = False
        self.watcher.tick()
        self.assertEqual(self.obs.scene, 'just screen')

    def test_replay_works_when_launcher_api_is_unavailable(self):
        self.reader.snapshot.side_effect = OSError('client closed')
        self.start_replay()
        self.assertTrue(self.watcher.routes_lobbies())
        self.watcher.game_ended()
        self.watcher.apply_pending()
        self.assertEqual(self.obs.scene, 'Test')
        self.reader.replay_active.return_value = None
        self.watcher.tick()
        self.assertEqual(self.obs.scene, 'Test')
        self.reader.replay_active.return_value = False
        self.watcher.tick()
        self.watcher.apply_pending()
        self.assertEqual(self.obs.scene, 'Test')
        self.reader.snapshot.side_effect = None
        self.watcher.tick()
        self.assertEqual(self.obs.scene, 'just screen')

    def test_manual_scene_during_replay_survives_exit_and_client_recovery(self):
        self.start_replay()
        self.director.request('User choice', owner='user', automatic=False)
        self.reader.snapshot.return_value = ('Matchmaking', None)
        self.watcher.tick()
        self.reader.snapshot.side_effect = OSError('client unavailable')
        self.reader.replay_active.return_value = False
        self.watcher.tick()
        self.reader.snapshot.side_effect = None
        self.watcher.tick()
        self.assertEqual(self.obs.scene, 'User choice')
        # A genuinely new phase after replay exit may resume normal automation.
        self.reader.snapshot.return_value = ('ChampSelect', session('PICK'))
        self.watcher.tick()
        self.assertEqual(self.obs.scene, 'Lobbies')

    def test_newer_manual_choice_during_detection_rejects_replay_entry(self):
        def detect():
            self.director.request('Newer choice', owner='user', automatic=False)
            return True
        self.reader.replay_active.side_effect = detect
        self.watcher.tick()
        self.assertEqual(self.obs.scene, 'Newer choice')

    def test_temporary_presentation_finishes_before_replay_entry(self):
        lease = self.director.reserve('clip', 'InstantReplay', 'Test')
        self.director.activate(lease)
        self.reader.replay_active.return_value = True
        self.watcher.tick()
        self.assertEqual(self.obs.scene, 'InstantReplay')
        self.director.finish(lease)
        self.watcher.apply_pending()
        self.assertEqual(self.obs.scene, 'Test')

    def test_shutdown_discards_deferred_replay_entry(self):
        token = self.director.hold_automatic('streamer')
        self.reader.replay_active.return_value = True
        self.watcher.tick()
        self.watcher.replay_viewing.close()
        self.director.release_automatic(token, resume=True)
        self.assertEqual(self.obs.scene, 'just screen')
