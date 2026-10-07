"""Game admission defers optional archive work without losing live data or intent."""
import threading
import unittest
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from league_stats.collector import Collector


class BackgroundTests(unittest.TestCase):
    def make_collector(self):
        tracker = Mock(lock=threading.RLock(), enrichment_requested=True, import_requested=True,
                       catalog={}, item_catalog={})
        collector = Collector(tracker, threading.Event(), client=Mock(), fetch=Mock(return_value={}))
        self.addCleanup(collector.http.close)
        collector.next_client = float('inf')
        collector.account = {'puuid': 'owner'}
        collector.session = {'gameData': {'gameId': 42}}
        collector.pending.append(('owner', 23, 0))
        collector.enrichment = Mock()
        collector.enrichment.snapshot.return_value = {'configured': True, 'pending': 2, 'detail': 'Ready'}
        collector.plan_history, collector.sync_one, collector.catalogs = Mock(), Mock(), Mock()
        return collector, tracker

    def test_matches_defer_optional_work_but_continue_live_and_chat(self):
        for phase in ('InProgress', 'Reconnect'):
            with self.subTest(phase=phase):
                collector, tracker = self.make_collector()
                collector.phase = phase
                with patch('league_stats.collector.same_player', return_value=True):
                    collector.step()
                tracker.ingest.assert_called_once()
                tracker.drain_chat.assert_called_once()
                collector.enrichment.retry.assert_called_once()
                collector.enrichment.tick.assert_not_called()
                collector.plan_history.assert_not_called()
                collector.sync_one.assert_not_called()
                collector.catalogs.assert_not_called()
                tracker.observe_rank.assert_not_called()
                self.assertEqual(list(collector.pending), [('owner', 23, 0)])
                self.assertTrue(tracker.import_requested)
                self.assertTrue(tracker.enrichment_status['deferred_for_gameplay'])

    def test_queued_work_resumes_after_game_without_another_request(self):
        collector, tracker = self.make_collector()
        collector.phase = 'Reconnect'
        with patch('league_stats.collector.same_player', return_value=True):
            collector.step()
        collector.phase = 'Lobby'
        collector.step()
        collector.enrichment.tick.assert_called_once()
        collector.plan_history.assert_called_once_with(100)
        collector.sync_one.assert_called_once()
        collector.catalogs.assert_called_once()
        tracker.observe_rank.assert_called_once()
        self.assertFalse(tracker.import_requested)
        self.assertNotIn('deferred_for_gameplay', tracker.enrichment_status)

    def test_disconnected_live_feed_does_not_start_backfill_mid_game(self):
        from lib.league_live_client import LiveClientUnavailable
        collector, tracker = self.make_collector()
        collector.phase = 'InProgress'
        collector.fetch.side_effect = LiveClientUnavailable()
        collector.step()
        tracker.disconnected.assert_called_once()
        collector.enrichment.tick.assert_not_called()
        collector.sync_one.assert_not_called()
