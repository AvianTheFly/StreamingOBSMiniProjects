"""Local queue reuse and command-line workflow; no personal media or decoding."""
import tempfile
import unittest
from unittest.mock import Mock, patch

from footage_manager.analysis import AnalysisBatch
from footage_manager.analysis_api import plan, prepare
from footage_manager.analysis_store import AnalysisStore
from footage_manager.find_moments import run, wait_for
from footage_manager.store import Store


class NewFootageTests(unittest.TestCase):
    def test_only_new_preserves_older_estimates_and_personal_clips(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(folder)
            try:
                def video(name, duration=600):
                    return store.execute('INSERT INTO videos(path,name,size,mtime_ns,duration) VALUES (?,?,?,?,?)',
                                         (name, name, 5, 10, duration))
                done, changed, new = video('done'), video('changed'), video('new')
                short, offline = video('short', 599), video('offline')
                store.execute("UPDATE videos SET availability='missing' WHERE id=?", (offline,))
                repo = AnalysisStore(store)
                for ident in (done, changed):
                    repo.save(store.video(ident), {'audio_track':'1'}, {'games':[], 'replays':[]})
                store.execute("UPDATE analyses SET version='older-detector'")
                store.execute('UPDATE videos SET mtime_ns=11 WHERE id=?', (changed,))
                store.save_range({'video_id':done,'start':1,'end':10,'notes':'Personal note','decision':'keep'})
                before = store.ranges(done)
                queue = plan(store)
                self.assertEqual({done, changed, new}, set(queue['eligible_ids']))
                self.assertEqual({changed, new}, set(queue['pending_ids']))
                batch = AnalysisBatch(store, {'only_new':True, 'sample_seconds':60})
                self.assertEqual({changed, new}, {v['id'] for v in batch.videos})
                self.assertEqual([], AnalysisBatch(store, {'only_new':True, 'ids':[done]}).videos)
                self.assertEqual(before, store.ranges(done))
                self.assertEqual('older-detector', repo.load(store.video(done))['version'])
                with patch('footage_manager.analysis_api.importlib.util.find_spec', return_value=True), \
                     patch.object(store,'backup') as backup:
                    with self.assertRaisesRegex(ValueError, 'No new'):
                        prepare(store, {'only_new':True,'ids':[done]})
                    backup.assert_not_called()
                with self.assertRaisesRegex(ValueError, 'not both'):
                    prepare(store, {'only_new':True, 'force':True})
            finally:
                store.db.close()


class CommandTests(unittest.TestCase):
    def test_scan_finishes_before_new_recordings_are_selected(self):
        client = Mock(base='http://127.0.0.1:8791')
        client.request.side_effect = [
            {'job':'scan'}, {'jobs':[{'id':'scan','state':'done','result':{'added':1}}]},
            {'eligible_ids':[1,2], 'pending_ids':[2], 'missing_dependencies':[]}, {'job':'analysis'}]
        self.assertEqual('analysis', run(client, scan=True, report=lambda _:None))
        self.assertEqual(['/api/scan','/api/library','/api/analysis-plan','/api/analyze'],
                         [call.args[0] for call in client.request.call_args_list])
        payload = client.request.call_args.args[1]
        self.assertEqual([2], payload['ids'])
        self.assertTrue(payload['only_new'])
        self.assertEqual(60, payload['sample_seconds'])

    def test_status_and_finished_library_never_start_jobs(self):
        for status, pending in ((True,[1]), (False,[])):
            client = Mock()
            client.request.return_value = {'eligible_ids':[1], 'pending_ids':pending,'missing_dependencies':[]}
            self.assertIsNone(run(client, status=status, scan=status, report=lambda _:None))
            client.request.assert_called_once_with('/api/analysis-plan')

    def test_unknown_or_short_id_is_rejected_before_submission(self):
        client = Mock()
        client.request.return_value = {'eligible_ids':[1], 'pending_ids':[1], 'missing_dependencies':[]}
        with self.assertRaisesRegex(RuntimeError,'10 minutes'):
            run(client, ids=[2], report=lambda _:None)
        client.request.assert_called_once_with('/api/analysis-plan')

    def test_partial_failure_cancel_and_restart_do_not_report_success(self):
        for jobs in ([], [{'id':'x','state':'cancelled','error':'Cancelled'}],
                     [{'id':'x','state':'done','result':{'errors':['bad source']}}]):
            client=Mock()
            client.request.return_value={'jobs':jobs}
            with self.assertRaises(RuntimeError):
                wait_for(client,'x',report=lambda _:None)


if __name__ == '__main__':
    unittest.main()
