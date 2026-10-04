"""Real cross-process suite admission; queued tests do not compete for CPU."""
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

from tools.offline_test_resources import configure_test_process, test_run_slot


class OfflineResourcesTests(unittest.TestCase):
    def test_defaults_precede_library_imports_and_respect_explicit_limits(self):
        import psutil
        with patch.dict(os.environ, {}, clear=True), patch.object(psutil, 'Process'):
            configure_test_process()
            self.assertEqual(os.environ['OPENBLAS_NUM_THREADS'], '2')
            self.assertEqual(os.environ['OMP_NUM_THREADS'], '2')
            os.environ['MKL_NUM_THREADS'] = '1'
            configure_test_process()
            self.assertEqual(os.environ['MKL_NUM_THREADS'], '1')

    def test_second_suite_waits_and_crash_releases_slot(self):
        with tempfile.TemporaryDirectory() as root:
            code = ('import sys; from tools.offline_test_resources import test_run_slot;'
                    '\nwith test_run_slot(sys.argv[1]):'
                    '\n print("acquired",flush=True); sys.stdin.read()')
            children, readers = [], []
            inbox = queue.Queue()
            try:
                for index in range(2):
                    child = subprocess.Popen([sys.executable, '-u', '-c', code, root],
                        cwd=Path(__file__).resolve().parents[1],
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True,
                        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                    children.append(child)
                    def lines(process=child, ident=index):
                        for line in process.stdout:
                            inbox.put((ident, line.strip()))
                    reader = threading.Thread(target=lines, daemon=True)
                    reader.start()
                    readers.append(reader)
                    ident, line = inbox.get(timeout=5)
                    self.assertEqual(ident, index)
                    self.assertEqual(line, 'acquired' if index == 0 else
                        'Another offline suite is running for this checkout; waiting for its CPU slot.')
                with self.assertRaises(queue.Empty):
                    inbox.get(timeout=.3)
                children[0].kill()
                children[0].wait(timeout=3)
                self.assertEqual(inbox.get(timeout=5), (1, 'acquired'))
                children[1].stdin.close()
                self.assertEqual(children[1].wait(timeout=3), 0)
                # Normal exit also releases the OS-owned slot.
                with test_run_slot(root):
                    pass
            finally:
                for child in children:
                    if child.poll() is None:
                        child.kill()
                        child.wait(timeout=3)
                    if not child.stdin.closed:
                        child.stdin.close()
                for reader in readers:
                    reader.join(timeout=2)
                for child in children:
                    child.stdout.close()


if __name__ == '__main__':
    unittest.main()
