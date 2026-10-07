"""OBS viewer responses match the full desk without constructing archive tables."""
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from league_stats import api, analytics, audience, chat_replies, presentation
from league_stats.community import TOPICS
from league_stats.service import Tracker
from league_stats.store import Store
from hub_ui.routes.league_stats import LeagueStatsRoutes


class StatsOverlayTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.now = 1700000500
        self.tracker = Tracker(Store(Path(temp.name)/'stats.db'), Path(temp.name)/'settings.json',
                               clock=lambda: self.now, monotonic=lambda: 10)
        self.tracker.account = 'p'
        self.tracker.records = {f'p:{i}': dict(id=f'p:{i}', account='p', champion='Jinx',
            state='complete', queue=420, win=bool(i%2), started_at=self.now+i, duration=1200,
            metrics=dict(kills=i, deaths=2, assists=5, cs=160), items=[dict(id=1001,name='Boots')]) for i in range(1,5)}

    def test_viewer_fields_match_desk_across_periods_and_spotlights(self):
        tracker = self.tracker
        for topic in [None, *TOPICS]:
            tracker.community.active = None if topic is None else dict(topic=topic,title='Test',requested_by='Viewer',expires_at=self.now+12)
            for period in ('all','today','session'):
                full = tracker.snapshot(period=period)
                overlay = tracker.snapshot(overlay=True,period=period)
                self.assertEqual(overlay, {k:full[k] for k in overlay})
        self.now += 20
        self.assertIsNone(tracker.snapshot(overlay=True)['spotlight'])

    def test_ordinary_overlay_skips_editor_work_and_returns_isolated_data(self):
        with patch.object(analytics,'breakdown',side_effect=AssertionError('archive table')), \
             patch.object(analytics,'items',side_effect=AssertionError('item table')), \
             patch.object(audience,'facts',side_effect=AssertionError('unused viewer facts')), \
             patch.object(chat_replies,'catalog',side_effect=AssertionError('editor previews')), \
             patch.object(presentation,'form',side_effect=AssertionError('editor chart')):
            data = self.tracker.snapshot(overlay=True,period='session')
        data['summary']['wins'] = -1
        self.assertGreaterEqual(self.tracker.snapshot(overlay=True,period='session')['summary']['wins'],0)

    def test_http_overlay_and_export_use_their_public_contract_only(self):
        class Handler(LeagueStatsRoutes):
            path = '/api/league-stats/overlay?period=session'
            wfile = io.BytesIO()
            def _json(self, code, value): self.result = code, value
            def _err(self, *args): raise AssertionError(args)
            def send_response(self, code): self.code = code
            def send_header(self, *args): pass
            def end_headers(self): pass
        handler = Handler()
        with patch.object(api,'overlay_state',return_value={'current':None}) as overlay, \
             patch.object(api,'state',side_effect=AssertionError('full desk requested')), \
             patch.object(api,'export',return_value={'matches':[]}) as export:
            handler._get_league_stats('/api/league-stats/overlay')
            overlay.assert_called_once_with(period='session')
            self.assertEqual(handler.result,(200,{'current':None}))
            handler.path = '/api/league-stats/export?period=all'
            handler._get_league_stats('/api/league-stats/export')
            export.assert_called_once_with(period='all')
            self.assertEqual(handler.code,200)


if __name__ == '__main__':
    unittest.main()
