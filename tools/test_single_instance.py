"""Real OS lock checks without starting Hub modules or keyboard listeners."""
from contextlib import contextmanager
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import hub
from lib.single_instance import hub_instance


class SingleInstanceTests(unittest.TestCase):
    def test_second_process_is_rejected_and_crash_releases_lock(self):
        with tempfile.TemporaryDirectory() as root:
            code = ('import sys; from lib.single_instance import hub_instance; '
                    '\nwith hub_instance(sys.argv[1]) as acquired:'
                    '\n print(acquired,flush=True); sys.stdin.read()')
            child = subprocess.Popen([sys.executable, '-c', code, root],
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True,
                                     creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            try:
                self.assertEqual(child.stdout.readline().strip(), 'True')
                with hub_instance(root) as acquired:
                    self.assertFalse(acquired)
                child.kill()
                child.wait(timeout=3)
                with hub_instance(root) as acquired:
                    self.assertTrue(acquired)
            finally:
                if child.poll() is None:
                    child.kill()
                    child.wait(timeout=3)
                child.stdin.close()
                child.stdout.close()

    def test_normal_exit_releases_lock(self):
        with tempfile.TemporaryDirectory() as root:
            with hub_instance(root) as acquired:
                self.assertTrue(acquired)
            with hub_instance(root) as acquired:
                self.assertTrue(acquired)

    def test_duplicate_exits_before_starting_modules(self):
        @contextmanager
        def duplicate(root):
            yield False
        with patch.object(hub, '_parse_args'), patch('lib.single_instance.hub_instance', duplicate), \
             patch.object(hub, '_run') as run:
            hub.main()
        run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
