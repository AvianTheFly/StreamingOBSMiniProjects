"""Replay queue ownership and recoverable deletion on disposable personal data."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
from lib.paths import ensure_import_paths
ensure_import_paths()
from instant_replay.play_queue import ReplayQueue, LOOKAHEAD, LIMIT
from instant_replay import library, api


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.queue = ReplayQueue()
        self.session = self.queue.begin(['a', 'b', 'c'])

    def edit(self, **body):
        snapshot=self.queue.snapshot()
        return self.queue.edit(dict(session=snapshot['session'],revision=snapshot['revision'],**body),body.get('paths',()))

    def test_upcoming_edits_do_not_replace_current(self):
        self.queue.take(self.session)
        before=self.queue.snapshot()
        self.edit(action='move',id=before['upcoming'][1]['id'],before=before['upcoming'][0]['id'])
        self.assertEqual(self.queue.take(self.session)['path'],'c')
        state=self.queue.snapshot()
        self.edit(action='add',paths=['manual'],before=state['upcoming'][0]['id'])
        self.assertEqual(self.queue.snapshot()['current']['path'],'c')
        self.assertEqual(self.queue.take(self.session)['path'],'manual')

    def test_stale_edit_cannot_change_advanced_queue(self):
        before=self.queue.snapshot();self.queue.take(self.session)
        with self.assertRaises(ValueError):self.queue.edit(dict(action='clear',session=before['session'],revision=before['revision']))
        self.assertEqual(len(self.queue.snapshot()['upcoming']),2)

    def test_cannot_remove_current_and_cross_session_finish_is_ignored(self):
        current=self.queue.take(self.session)
        with self.assertRaises(ValueError):self.edit(action='remove',id=current['id'])
        newer=self.queue.begin(['new'])
        self.queue.finish(self.session)
        self.assertTrue(self.queue.snapshot()['active'])
        self.assertIsNone(self.queue.take(self.session))
        self.assertEqual(self.queue.take(newer)['path'],'new')

    def test_random_publishes_actual_next_and_retains_manual_order(self):
        session=self.queue.begin([],shuffle=True)
        pool=['a','b','c','d','e','f','g']
        previous=self.queue.take(session,pool)['path']
        for _ in range(30):
            snapshot=self.queue.snapshot()
            self.assertEqual(len(snapshot['upcoming']),LOOKAHEAD)
            self.assertEqual(snapshot['total'],'∞')
            expected=snapshot['upcoming'][0]['path']
            chosen=self.queue.take(session,pool)['path']
            self.assertEqual(chosen,expected)
            self.assertNotEqual(previous,chosen);previous=chosen
        first=self.queue.snapshot()['upcoming'][0]['id']
        self.edit(action='add',paths=['manual'],before=first)
        self.assertEqual(self.queue.take(session,pool)['path'],'manual')

    def test_remove_and_clear_are_bounded_and_preserve_current(self):
        self.queue.take(self.session)
        self.queue.remove_paths({'b'})
        self.assertEqual([e['path'] for e in self.queue.snapshot()['upcoming']],['c'])
        self.edit(action='clear')
        self.assertEqual(self.queue.snapshot()['current']['path'],'a')
        self.assertIsNone(self.queue.take(self.session))
        self.queue.finish(self.session);self.assertFalse(self.queue.snapshot()['active'])
        self.queue.begin(['a']*LIMIT)
        with self.assertRaises(ValueError):self.edit(action='add',paths=['extra'])

    def test_final_cleanup_rejects_edits_before_clearing_current(self):
        self.queue.take(self.session);self.queue.close(self.session)
        self.assertTrue(self.queue.snapshot()['active'])
        self.assertEqual(self.queue.snapshot()['current']['path'],'a')
        with self.assertRaises(ValueError):self.edit(action='add',paths=['late'])
        self.queue.finish(self.session);self.assertIsNone(self.queue.snapshot()['current'])


class TrashTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        self.root=Path(temp.name);self.a=self.root/'a.mp4';self.b=self.root/'b.mp4'
        self.a.write_bytes(b'original-a');self.b.write_bytes(b'original-b')
        for target,value in [(library,'STATE_FILE'),(api,'REPLAY_DIR')]:
            p=patch.object(target,value,self.root/'library.json' if value=='STATE_FILE' else self.root);p.start();self.addCleanup(p.stop)
        p=patch('lib.settings_backups.SettingsBackups.snapshot');self.backup=p.start();self.addCleanup(p.stop)
        p=patch.dict(api._live,{},clear=True);p.start();self.addCleanup(p.stop)
        library.remember_capture(self.a,purpose='review_later')
        data=library.read();meta=data['clips'][library.clip_id(self.a)]
        meta.update(title='Personal title',notes='Remember this',favorite=True,custom={'keep':'all'},kept=False)
        data['groups']=[dict(id='intro',name='My montage',paths=[str(self.a),str(self.b)],custom='preserved')]
        data['custom']='top-level';library._write(data)

    def mutate(self, action, paths):
        return api.mutate_library(dict(action=action,paths=paths,revision=library.read()['revision']))

    def test_delete_restore_preserve_all_data_and_originals(self):
        before=library.read();key=library.clip_id(self.a)
        self.mutate('trash',[str(self.a)])
        data=library.read();self.assertTrue(data['clips'][key]['trashed']);self.assertFalse(data['clips'][key]['kept'])
        self.assertEqual(data['groups'],before['groups']);self.assertEqual(data['custom'],'top-level')
        self.assertEqual(self.a.read_bytes(),b'original-a')
        self.assertEqual(library.replay_paths([self.a]),[])
        rows=library.decorate([dict(path=str(self.a),name='a.mp4'),dict(path=str(self.b),name='b.mp4')])
        self.assertEqual(len(rows['clips']),1);self.assertEqual(len(rows['trash']),1)
        with self.assertRaises(ValueError):library.group_paths('intro',self.root)
        with self.assertRaises(ValueError):api._validate_playable([str(self.a)])
        self.mutate('restore',[str(self.a)])
        restored=library.read()['clips'][key]
        for field,value in before['clips'][key].items():self.assertEqual(restored[field],value)
        self.assertEqual(library.group_paths('intro',self.root),[str(self.a),str(self.b)])
        self.assertEqual(self.backup.call_count,2)

    def test_loading_current_cannot_be_trashed_and_upcoming_is_removed(self):
        queue=ReplayQueue();session=queue.begin([str(self.a),str(self.b)]);queue.take(session)
        api._live.update(queue_state=queue.snapshot,queue_remove_paths=queue.remove_paths)
        before=library.STATE_FILE.read_bytes()
        with self.assertRaises(api.NotReady):self.mutate('trash',[str(self.a)])
        self.assertEqual(library.STATE_FILE.read_bytes(),before)
        self.mutate('trash',[str(self.b)])
        self.assertEqual(queue.snapshot()['upcoming'],[])
        self.assertEqual(queue.snapshot()['current']['path'],str(self.a))

    def test_bulk_invalid_or_stale_delete_is_atomic(self):
        before=library.STATE_FILE.read_bytes()
        with self.assertRaises(ValueError):self.mutate('trash',[str(self.a),str(self.root/'missing.mp4')])
        self.assertEqual(library.STATE_FILE.read_bytes(),before)
        with self.assertRaises(library.Conflict):api.mutate_library(dict(action='trash',paths=[str(self.a)],revision=-1))
        self.assertEqual(library.STATE_FILE.read_bytes(),before)

    def test_existing_source_worker_consumes_edits_before_reuse_and_clears_after_cleanup(self):
        from instant_replay.runtime_state import ReplayState
        from instant_replay.playback import ReplayPlayback
        third=self.root/'c.mp4';third.write_bytes(b'third')
        state=ReplayState();session=Mock();session.activated=False;session.owns_scene.return_value=True
        loaded=[]
        with patch('instant_replay.playback.AssetFader'),patch('instant_replay.playback.stage') as stage, \
             patch('instant_replay.playback.coordinator') as coordinator, \
             patch('instant_replay.playback.obs') as obs,patch('instant_replay.playback._unmute_desktop'), \
             patch('instant_replay.playback._start_replay_clip') as start:
            coordinator.scene_session.return_value=session
            stage.state.return_value={'mode':'showcase'}
            player=ReplayPlayback(state,{})
            def load(path,*args,**kwargs):
                loaded.append(str(path));session.activated=True
                if path==self.a:
                    snapshot=player.queue.snapshot()
                    victim=next(e for e in snapshot['upcoming'] if e['path']==str(self.b))
                    player.edit_queue(dict(action='remove',id=victim['id'],session=snapshot['session'],revision=snapshot['revision']))
                    state._skip_clip.set()
                else:state._cancel_watcher.set()
            start.side_effect=load
            player._play_all_clips_sequential([str(self.a),str(self.b),str(third)],mode='showcase')
            self.assertEqual(loaded,[str(self.a),str(third)])
            session.finish.assert_called_once();obs.park_media_source.assert_called_once()
            self.assertFalse(player._playback_gate.locked());self.assertFalse(player.queue.snapshot()['active'])


if __name__=='__main__':unittest.main()
