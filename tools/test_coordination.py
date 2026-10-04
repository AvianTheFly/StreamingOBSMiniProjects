"""Deterministic concurrency tests without OBS, user settings, or global hooks."""
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from lib.coordination.playback import PlayCoordinator
from lib.coordination.rules import CoordinationRule
from lib.coordination.scenes import SceneDirector
from lib.coordination.scene_session import SceneSession
from lib.project_runtime import _ProjectRegistry, ProjectStatus


class FakeOBS:
    def __init__(self):
        self.scene = 'Game'
        self.writes = []

    def get_current_program_scene(self):
        return SimpleNamespace(current_program_scene_name=self.scene)

    def set_current_program_scene(self, scene):
        self.writes.append(scene)
        self.scene = scene


class CoordinationTests(unittest.TestCase):
    def setUp(self):
        self.registry = _ProjectRegistry()
        self.music = Mock()
        self.music.name = 'music'
        self.music.get_status.return_value = ProjectStatus('music', True, 'song', ['Music'], True)
        self.registry.register(self.music)
        self.coordinator = PlayCoordinator(self.registry)
        self.coordinator.replace_rules([CoordinationRule('a', ['music']), CoordinationRule('b', ['music'])])
        self.addCleanup(self.coordinator.shutdown)
        self.obs = FakeOBS()
        self.director = SceneDirector(lambda: self.obs)

    def test_temporary_session_can_advance_and_return_to_original(self):
        session = SceneSession('a', 'Stage A', 'Game', director=self.director,
                               coordinator=self.coordinator)
        self.assertFalse(session.present('Stage B'))
        self.assertTrue(session.activate())
        self.assertTrue(session.present('Stage B'))
        self.assertTrue(session.owns_scene())
        self.assertEqual(session.previous, 'Game')
        session.finish()
        self.assertEqual(self.obs.writes, ['Stage A', 'Stage B', 'Game'])
        self.assertFalse(session.present('Stage A'))

    def test_temporary_advance_rejects_new_manual_intent(self):
        session = SceneSession('a', 'Stage A', 'Game', director=self.director,
                               coordinator=self.coordinator)
        self.assertTrue(session.activate())
        self.director.request('User choice', owner='user', automatic=False)
        self.assertFalse(session.present('Stage B'))
        session.finish()
        self.assertEqual(self.obs.scene, 'User choice')

    def test_temporary_advance_rejects_external_away_and_back(self):
        session = SceneSession('a', 'Stage A', 'Game', director=self.director,
                               coordinator=self.coordinator)
        self.assertTrue(session.activate())
        self.director.observe('Other')
        self.director.observe('Stage A')
        self.assertFalse(session.present('Stage B'))
        session.finish()
        self.assertEqual(self.obs.writes, ['Stage A'])

    def request(self, name):
        called = threading.Event()
        ticket = self.coordinator.request(name, lambda t: called.set())
        self.assertTrue(called.wait(2))
        return ticket

    def test_overlapping_claims_resume_only_after_last_completion(self):
        a, b = self.request('a'), self.request('b')
        self.music.pause.assert_called_once()
        a.finish().result(2)
        self.music.resume.assert_not_called()
        b.finish().result(2)
        self.music.resume.assert_called_once()
        b.finish().result(2)
        self.music.resume.assert_called_once()

    def test_old_completion_cannot_release_replacement_or_live_rule_change(self):
        old, new = self.request('a'), self.request('a')
        self.coordinator.replace_rules([])
        old.finish().result(2)
        self.music.resume.assert_not_called()
        new.finish().result(2)
        self.music.resume.assert_called_once()

    def test_preexisting_and_manual_pauses_are_preserved(self):
        self.music.get_status.return_value.is_paused = True
        a = self.request('a')
        a.finish().result(2)
        self.music.pause.assert_not_called()
        self.music.resume.assert_not_called()
        self.music.get_status.return_value.is_paused = False
        a = self.request('a')
        self.coordinator.manual_action('music', 'pause')
        a.finish().result(2)
        self.music.resume.assert_not_called()
        self.coordinator.manual_action('music', 'resume')
        self.music.resume.assert_called_once()

    def test_failed_pause_prevents_play_and_rolls_back_successful_pauses(self):
        broken = Mock(name='broken')
        broken.name = 'broken'
        broken.get_status.return_value.is_paused = False
        broken.pause.side_effect = RuntimeError('cannot pause')
        self.registry.register(broken)
        self.coordinator.replace_rules([CoordinationRule('a', ['music', 'broken'])])
        callback = Mock()
        a = self.coordinator.request('a', callback)
        self.assertTrue(a.done.wait(2))
        callback.assert_not_called()
        self.assertIn('cannot pause', a.error)
        self.music.resume.assert_called_once()

    def test_burst_keeps_one_pending_intent_and_cancel_before_ready(self):
        blocked, release = threading.Event(), threading.Event()
        blocker = self.coordinator._actions.submit(lambda: blocked.set() or release.wait(2))
        self.assertTrue(blocked.wait(2))
        callback = Mock()
        try:
            tickets = [self.coordinator.request('a', callback) for _ in range(100)]
            self.assertEqual(len(self.coordinator._pending), 1)
            self.assertTrue(all(t.done.is_set() for t in tickets[:-1]))
            self.coordinator.cancel('a')
        finally:
            release.set()
        blocker.result(2)
        self.assertTrue(tickets[-1].done.wait(2))
        callback.assert_not_called()
        self.music.pause.assert_not_called()

    def test_finish_is_nonblocking_while_project_lock_is_held(self):
        project_lock = threading.Lock()
        a = self.request('a')
        self.music.resume.side_effect = lambda: (project_lock.acquire(), project_lock.release())
        with project_lock:
            future = a.finish()
        future.result(2)

    def test_reciprocal_rules_allow_newer_request_without_deadlock(self):
        for name in ('a', 'b'):
            interface = Mock()
            interface.name = name
            interface.get_status.return_value.is_paused = False
            self.registry.register(interface)
        self.coordinator.replace_rules([CoordinationRule('a', ['b']), CoordinationRule('b', ['a'])])
        a = self.request('a')
        b = self.request('b')
        self.assertFalse(a.allowed.is_set())
        self.assertTrue(b.allowed.is_set())
        b.finish().result(2)
        self.assertTrue(a.allowed.is_set())
        a.finish().result(2)
        self.assertEqual(self.coordinator.snapshot()['pauses'], {})

    def test_layered_permission_and_pending_work_respect_shared_pauses(self):
        gate = self.coordinator.permission('music')
        self.assertTrue(gate.is_set())
        a = self.request('a')
        self.assertFalse(gate.is_set())
        self.coordinator.manual_action('music', 'pause')
        a.finish().result(2)
        self.assertFalse(gate.is_set())
        self.coordinator.manual_action('music', 'resume')
        self.assertTrue(gate.is_set())
        self.coordinator.shutdown()
        self.assertFalse(gate.is_set())

    def test_orderly_event_shutdown_preserves_scene_return(self):
        self.director.observing(True)
        session = self.session()
        session.activate()
        self.director.observing(False, disconnected=False)
        session.finish()
        self.assertEqual(self.obs.scene, 'Game')

    def session(self):
        return SceneSession('replay', 'Replay', 'Fallback', director=self.director,
                            coordinator=self.coordinator)

    def test_loading_reserves_scene_and_return_is_idempotent(self):
        session = self.session()
        prepare = Mock()
        self.assertFalse(self.director.request('Lobby', owner='league', prepare=prepare))
        prepare.assert_not_called()
        self.assertTrue(session.activate())
        session.finish()
        session.finish()
        self.assertEqual(self.obs.writes, ['Replay', 'Game'])
        self.music.resume.assert_called_once()

    def test_deliberate_same_scene_revokes_old_cleanup(self):
        session = self.session()
        session.activate()
        self.director.request('Replay', owner='button', automatic=False)
        self.assertFalse(session.owns_scene())
        session.finish()
        self.assertEqual(self.obs.scene, 'Replay')
        self.music.resume.assert_not_called()

    def test_external_away_and_back_events_revoke_session(self):
        self.director.observing(True)
        session = self.session()
        session.activate()
        self.director.observe('Replay')  # Acknowledges our own write.
        self.director.observe('Other')
        self.director.observe('Replay')
        session.finish()
        self.assertEqual(self.obs.scene, 'Replay')
        self.music.resume.assert_not_called()

    def test_deferred_automatic_intent_and_stale_delayed_return(self):
        session = self.session()
        session.activate()
        self.director.request('Lobby', owner='game', defer=True)
        self.director.request('NewGame', owner='game', defer=True)
        session.finish()
        self.assertEqual(self.obs.scene, 'NewGame')
        revision = self.director.snapshot()['revision']
        self.director.request('Camera', owner='button', automatic=False)
        self.assertFalse(self.director.request('Lobby', owner='game', expected_revision=revision))
        self.assertEqual(self.obs.scene, 'Camera')


if __name__ == '__main__':
    unittest.main()
