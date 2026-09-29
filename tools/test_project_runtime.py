"""Offline interface/registry contracts; no project modules or OBS are loaded."""
import contextlib
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import shared
from lib import project_runtime as runtime


class ProjectRuntimeTests(unittest.TestCase):
    def interface(self, name, *, active=True, scenes=('Gameplay',)):
        iface = Mock(spec=runtime.ProjectInterface)
        iface.name = name
        iface.controlled_scenes = list(scenes)
        iface.get_status.return_value = runtime.ProjectStatus(
            name, active, 'testing', list(scenes), True)
        return iface

    def test_compatibility_exports_use_identical_objects(self):
        for name in ('ProjectStatus', 'ProjectInterface', '_ProjectRegistry', 'project_registry'):
            self.assertIs(getattr(shared, name), getattr(runtime, name))

    def test_conflicts_exclude_requester_idle_and_other_scenes(self):
        registry = runtime._ProjectRegistry()
        for iface in (self.interface('requester'), self.interface('overlap'),
                      self.interface('idle', active=False),
                      self.interface('other', scenes=('Other',))):
            registry.register(iface)
        self.assertEqual(registry.conflicting_projects('requester', ['Gameplay']), ['overlap'])
        snapshot = registry.all()
        snapshot.clear()
        self.assertEqual(len(registry.all()), 4)

    def test_bulk_actions_skip_requester_and_continue_after_failure(self):
        registry = runtime._ProjectRegistry()
        requester, broken, healthy = [self.interface(name) for name in ('requester', 'broken', 'healthy')]
        for iface in (requester, broken, healthy):
            registry.register(iface)
        for action in ('pause', 'resume', 'revert'):
            getattr(broken, action).side_effect = RuntimeError('test failure')
            with contextlib.redirect_stdout(io.StringIO()) as output:
                getattr(registry, action + '_all')(except_='requester')
            self.assertEqual(output.getvalue(),
                             f"[registry] {action} failed for 'broken': test failure\n")
            getattr(requester, action).assert_not_called()
            getattr(healthy, action).assert_called_once_with()

    def test_bulk_actions_use_snapshot_and_release_registry_lock(self):
        for action in ('pause', 'resume', 'revert'):
            with self.subTest(action=action):
                registry = runtime._ProjectRegistry()
                first, second, added = [self.interface(name) for name in ('first', 'second', 'added')]
                visited = []

                def visit_first():
                    # Callbacks may register interfaces; never hold the registry lock here.
                    acquired = registry._lock.acquire(blocking=False)
                    self.assertTrue(acquired)
                    if acquired:
                        registry._lock.release()
                        registry.register(added)
                    visited.append('first')

                getattr(first, action).side_effect = visit_first
                getattr(second, action).side_effect = lambda: visited.append('second')
                registry.register(first)
                registry.register(second)
                getattr(registry, action + '_all')()
                self.assertEqual(visited, ['first', 'second'])
                getattr(added, action).assert_not_called()
                self.assertIs(registry.get('added'), added)

    def test_base_interface_action_dispatch_and_unknown_action(self):
        iface = runtime.ProjectInterface()
        iface.pause = Mock()
        self.assertEqual(iface.run_action('pause'), {'ok': True, 'action': 'pause'})
        iface.pause.assert_called_once_with()
        self.assertFalse(iface.run_action('unknown')['ok'])


if __name__ == '__main__':
    unittest.main()
