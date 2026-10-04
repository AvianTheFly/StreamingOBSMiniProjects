"""The shared endpoint must not duplicate requests or serve stale game data."""
import io
import unittest
from unittest.mock import Mock
from lib.league_live_client import SnapshotClient, LiveClientUnavailable


class SnapshotTests(unittest.TestCase):
    def test_shared_snapshot_is_cached_briefly_and_copied(self):
        now = [0]; opener = Mock()
        opener.open.side_effect = lambda *a,**kw: io.BytesIO(b'{"gameData":{"gameTime":100}}')
        client = SnapshotClient(clock=lambda:now[0],opener=opener)
        first = client.fetch(); first['gameData']['gameTime'] = 0
        self.assertEqual(client.fetch()['gameData']['gameTime'],100)
        opener.open.assert_called_once_with('https://127.0.0.1:2999/liveclientdata/allgamedata',timeout=2)
        now[0] = .251; client.fetch(); self.assertEqual(opener.open.call_count,2)

    def test_failed_or_invalid_fetch_never_retains_old_snapshot(self):
        for failure in [OSError('offline'), b'{"gameData":{"gameTime":true}}', b'{"gameData":{"gameTime":NaN}}', b'null']:
            with self.subTest(failure=failure):
                now=[0]; opener=Mock()
                responses=iter([b'{"gameData":{"gameTime":10}}', failure])
                def open_response(*a,**kw):
                    response=next(responses)
                    if isinstance(response,Exception): raise response
                    return io.BytesIO(response)
                opener.open.side_effect=open_response
                client=SnapshotClient(clock=lambda:now[0],opener=opener)
                client.fetch(); now[0]=1
                with self.assertRaises((LiveClientUnavailable,ValueError,AttributeError)): client.fetch()
                self.assertIsNone(client.snapshot)

    def test_disconnected_client_coalesces_retries_without_delaying_reconnect(self):
        now=[0]; opener=Mock()
        opener.open.side_effect=[OSError('offline'), io.BytesIO(b'{"gameData":{"gameTime":10}}')]
        client=SnapshotClient(clock=lambda:now[0],opener=opener)
        with self.assertRaises(LiveClientUnavailable): client.fetch()
        now[0]=.4
        with self.assertRaises(LiveClientUnavailable): client.fetch()
        self.assertEqual(opener.open.call_count,1)
        now[0]=.51
        self.assertEqual(client.fetch()['gameData']['gameTime'],10)
        self.assertEqual(opener.open.call_count,2)


if __name__=='__main__': unittest.main()
