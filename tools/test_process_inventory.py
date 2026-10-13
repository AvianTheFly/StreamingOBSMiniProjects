"""Shared process discovery stays bounded, complete and read-only."""
import os
import threading
import unittest
from unittest.mock import Mock
from lib.process_inventory import ProcessEntry, ProcessInventory, _windows_snapshot


class InventoryTests(unittest.TestCase):
    def test_concurrent_readers_share_one_complete_generation(self):
        now = [0]
        reader = Mock(return_value=[ProcessEntry(1, 'old.exe', 0, 2)])
        inventory = ProcessInventory(read=reader, clock=lambda: now[0])
        barrier = threading.Barrier(8)
        rows = []
        def read():
            barrier.wait(2)
            rows.append(inventory.snapshot())
        workers = [threading.Thread(target=read) for _ in range(8)]
        for worker in workers: worker.start()
        for worker in workers: worker.join(3)
        self.assertEqual(len(rows), 8)
        self.assertTrue(all(row is rows[0] for row in rows))
        reader.assert_called_once()
        reader.return_value = [ProcessEntry(2, 'new.exe', 1, 3)]
        now[0] = 1
        self.assertEqual(inventory.snapshot()[0].pid, 2)
        self.assertEqual(rows[0][0].pid, 1)

    def test_failed_partial_scan_is_not_published_and_failures_back_off(self):
        now = [0]
        def broken():
            yield ProcessEntry(1, 'partial.exe', 0, 1)
            raise OSError('snapshot failed')
        reader = Mock(side_effect=broken)
        inventory = ProcessInventory(read=reader, clock=lambda: now[0])
        for _ in range(3):
            with self.assertRaises(OSError): inventory.snapshot()
        reader.assert_called_once()
        reader.side_effect = None
        reader.return_value = ()
        now[0] = 1
        self.assertEqual(inventory.snapshot(), ())

    @unittest.skipUnless(os.name == 'nt', 'Windows Toolhelp contract')
    def test_native_rows_and_handle_release(self):
        import psutil
        process = psutil.Process()
        before = process.num_handles()
        for _ in range(8):
            rows = _windows_snapshot()
            own = next(row for row in rows if row.pid == process.pid)
            self.assertEqual(own.name.lower(), process.name().lower())
            self.assertEqual(own.parent, process.ppid())
            self.assertGreater(own.threads, 0)
            self.assertEqual(len(rows), len({row.pid for row in rows}))
        self.assertLessEqual(process.num_handles(), before + 2)


if __name__ == '__main__': unittest.main()
