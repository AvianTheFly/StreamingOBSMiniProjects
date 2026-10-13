"""Destructive cleanup regressions operate only on disposable generated media."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from footage_manager.cleanup_plan import source_plan
from footage_manager.cleanup import CleanupBatch, preview, prepare, AUTHORIZATION
from footage_manager.store import Store
from footage_manager.analysis_store import AnalysisStore
from footage_manager.media import run, probe


def game(start,end,outcome='victory',spikes=0):
    return {'start':start,'end':end,'outcome':outcome,'metrics':{'spike_count':spikes},
            'moments':[{'kind':'voice_spike'} for _ in range(spikes)]}


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.video={'id':1,'path':'C:/disposable/source.mp4','duration':1000,'size':1000,'mtime_ns':1}

    def plan(self,games,observations=(),ranges=()):
        return source_plan(self.video,{'games':games,'observations':observations,'sample_seconds':60},ranges)

    def test_keep_wins_unknowns_and_vocal_losses_remove_quiet_defeats(self):
        p=self.plan([game(100,200),game(300,400,'defeat',3),game(500,600,'defeat',4),game(700,800,'unknown')],
                    [{'time':t,'between_games':True} for t in range(0,1001,10)])
        self.assertEqual(['keep','remove','keep','keep'],[g['decision'] for g in p['games']])
        self.assertEqual([[70,230],[470,630],[670,830]],p['intervals'])

    def test_desktop_gap_cannot_delete_an_alt_tab(self):
        p=self.plan([game(0,100),game(500,1000)],
                    [{'time':200,'desktop':True},{'time':400,'desktop':True}])
        self.assertEqual([[0,1000]],p['intervals'])

    def test_gameplay_in_gap_overrides_lobby_evidence(self):
        p=self.plan([game(0,100),game(500,1000)],
                    [{'time':200,'between_games':True},{'time':300,'active':True,'clock':900}])
        self.assertEqual([[0,1000]],p['intervals'])

    def test_desktop_before_lobby_is_preserved(self):
        p=self.plan([game(0,100),game(500,1000)],
                    [{'time':200,'desktop':True},{'time':300,'between_games':True},
                     {'time':400,'between_games':True}])
        self.assertEqual([[0,270],[430,1000]],p['intervals'])

    def test_missing_audio_evidence_and_personal_keep_survive(self):
        g=game(100,200,'defeat');g['metrics']={}
        p=self.plan([g],[{'time':t,'between_games':True} for t in range(0,1001,10)],
                    [{'id':8,'start':850,'end':875,'decision':'keep','notes':'Personal'}])
        self.assertEqual('keep',p['games'][0]['decision'])
        self.assertEqual([[70,230],[850,875]],p['intervals'])
        with self.assertRaisesRegex(ValueError,'resolution'):
            self.plan([g],ranges=[{'start':1,'end':2,'decision':'maybe'}])

    def test_non_league_and_lobby_only_are_distinguished(self):
        with self.assertRaisesRegex(ValueError,'left untouched'):
            self.plan([],observations=[{'time':100,'desktop':True}])
        p=self.plan([],observations=[{'time':t,'between_games':True} for t in range(0,1001,10)])
        self.assertEqual([],p['intervals'])

    def test_inclusive_seven_removal_and_fifteen_estimate(self):
        games=[game(100,200,'defeat',7),game(300,400,'defeat',8),game(500,600,'defeat',15),game(700,800,'victory',0)]
        result={'games':games,'observations':[]}
        self.assertEqual(['remove','keep','keep','keep'],[g['decision'] for g in source_plan(self.video,result,[],8)['games']])
        self.assertEqual(['remove','remove','keep','keep'],[g['decision'] for g in source_plan(self.video,result,[],15)['games']])
        self.assertEqual(['remove','remove','remove','keep'],[g['decision'] for g in source_plan(self.video,result,[],16)['games']])

    def test_win_threshold_is_explicit_preserves_ten_unknowns_and_personal_keepers(self):
        games=[game(100,200,'victory',9),game(300,400,'victory',10),game(500,600,'defeat',15),game(700,800,'unknown',0)]
        result={'games':games,'observations':[]}
        p=source_plan(self.video,result,[{'id':1,'start':150,'end':160,'decision':'keep','notes':'Personal'}],16,10)
        self.assertEqual(['remove','keep','remove','keep'],[g['decision'] for g in p['games']])
        self.assertTrue(any(a<=150 and b>=160 for a,b in p['intervals']))
        games[0]['metrics']={}
        self.assertEqual('keep',source_plan(self.video,result,[],16,10)['games'][0]['decision'])

    def test_combined_outcome_thresholds_and_unmeasured_unknown_protection(self):
        games=[game(50,100,'victory',19),game(150,200,'victory',20),
               game(250,300,'defeat',29),game(350,400,'defeat',30),
               game(450,500,'unknown',24),game(550,600,'unknown',25),game(650,700,'unknown',0)]
        games[-1]['metrics']={}
        result={'games':games,'observations':[]}
        p=source_plan(self.video,result,[],30,20,25)
        self.assertEqual(['remove','keep','remove','keep','remove','keep','keep'],[g['decision'] for g in p['games']])
        self.assertEqual('keep',source_plan(self.video,result,[],30,20)['games'][4]['decision'])


class ExecutionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.folder=Path(self.temp.name)
        self.store=Store(self.folder/'data')
        self.source=self.folder/'disposable.mp4'
        run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=160x90:rate=10',
             '-f','lavfi','-i','sine=frequency=440:sample_rate=16000','-t','8',
             '-c:v','libx264','-preset','ultrafast','-g','10','-c:a','aac','-y',str(self.source)])
        duration,streams=probe(self.source);st=self.source.stat()
        self.ident=self.store.execute('INSERT INTO videos(path,name,size,mtime_ns,duration,streams) VALUES (?,?,?,?,?,?)',
            (str(self.source),self.source.name,st.st_size,st.st_mtime_ns,duration,json.dumps(streams)))
        self.repo=AnalysisStore(self.store)
        self.repo.save(self.store.video(self.ident),{}, {'games':[game(1,7)],'observations':[]})
        self.plan=source_plan(self.store.video(self.ident),self.repo.load(self.store.video(self.ident)),[])
        # Tiny integration fixture isolates a real partial export and unlink.
        self.plan['intervals']=[[1,4]]
        self.batch=CleanupBatch(self.store,{'sources':[self.plan],'skipped':[]})

    def tearDown(self):
        self.store.db.close();self.temp.cleanup()

    def test_verified_extraction_preserves_tracks_then_reclaims_source_without_backups(self):
        with patch.object(self.store,'backup',side_effect=AssertionError('No backups requested')):
            self.batch.process(self.plan,{})
        self.assertFalse(self.source.exists())
        self.assertEqual('deleted',self.store.video(self.ident)['availability'])
        kept=self.store.ranges(self.ident)[0]
        duration,streams=probe(kept['exported'])
        self.assertLess(abs(duration-3),2)
        self.assertEqual(['audio','video'],sorted(s['type'] for s in streams))
        self.assertTrue(Path(kept['exported']+'.source.json').exists())

    def test_export_failure_leaves_original(self):
        with patch('footage_manager.cleanup.export_clip',side_effect=ValueError('disk full')):
            with self.assertRaisesRegex(ValueError,'disk full'):
                self.batch.process(self.plan,{})
        self.assertTrue(self.source.exists())

    def test_changed_review_or_changed_analysis_prevents_deletion(self):
        self.store.save_range({'video_id':self.ident,'start':2,'end':3,'decision':'keep','notes':'New decision'})
        with self.assertRaisesRegex(ValueError,'review decisions changed'):
            self.batch.process(self.plan,{})
        self.assertTrue(self.source.exists())
        self.store.execute('DELETE FROM ranges')
        self.repo.save(self.store.video(self.ident),{}, {'games':[game(1,7,'defeat',10)],'observations':[]})
        with self.assertRaisesRegex(ValueError,'analysis changed'):
            self.batch.process(self.plan,{})
        self.assertTrue(self.source.exists())

    def test_failed_final_probe_and_changed_source_prevent_deletion(self):
        with patch('footage_manager.cleanup.verify_exports',side_effect=ValueError('bad export')):
            with self.assertRaisesRegex(ValueError,'bad export'):
                self.batch.process(self.plan,{})
        self.assertTrue(self.source.exists())
        self.source.write_bytes(self.source.read_bytes()+b'changed')
        with self.assertRaisesRegex(ValueError,'Source changed'):
            self.batch.process(self.plan,{})
        self.assertTrue(self.source.exists())

    def test_authorization_and_minimum_length_are_enforced(self):
        with self.assertRaisesRegex(ValueError,'authorization'):
            prepare(self.store,{'ids':[self.ident]})
        self.assertEqual([],preview(self.store)['sources'])

    def retained_task(self, intervals):
        self.plan['intervals']=[[0,8]]
        self.batch.process(self.plan,{})
        from footage_manager.cleanup_plan import digest,personal_signature
        return {'video_id':self.ident,'clip':self.store.ranges(self.ident)[0],
                'intervals':intervals,'analysis_digest':digest(self.repo.load(self.store.video(self.ident))),
                'personal_signature':personal_signature(self.store.ranges(self.ident))}

    def test_retained_split_verified_before_delete_and_original_coordinates_preserved(self):
        from footage_manager.retained_cleanup import process
        task=self.retained_task([[1,3],[5,7]])
        old=Path(task['clip']['exported'])
        with patch.object(self.store,'backup',side_effect=AssertionError('No backups')):
            process(self.store,task,self.batch.ledger,self.batch.persist)
        self.assertFalse(old.exists())
        rows=[r for r in self.store.ranges(self.ident) if r['decision']=='keep']
        self.assertEqual([(1,3),(5,7)],[(r['start'],r['end']) for r in rows])
        for row in rows:
            info=json.loads(row['export_info'])
            self.assertEqual(row['start'],info['start'])
            meta=json.loads(Path(info['source_metadata']).read_text(encoding='utf-8'))
            self.assertEqual(str(self.source),meta['source_path'])
            self.assertEqual(row['start'],meta['export_start_seconds'])
            self.assertEqual(['audio','video'],sorted(s['type'] for s in probe(row['exported'])[1]))

    def test_retained_export_failure_and_review_change_preserve_old_file(self):
        from footage_manager.retained_cleanup import process
        task=self.retained_task([[1,3]])
        old=Path(task['clip']['exported'])
        with patch('footage_manager.retained_cleanup.export_clip',side_effect=ValueError('disk full')):
            with self.assertRaisesRegex(ValueError,'disk full'):
                process(self.store,task,self.batch.ledger,self.batch.persist)
        self.assertTrue(old.exists())
        self.store.save_range({'video_id':self.ident,'start':0,'end':1,'decision':'keep','notes':'Personal'})
        with self.assertRaisesRegex(ValueError,'Personal review changed'):
            process(self.store,task,self.batch.ledger,self.batch.persist)
        self.assertTrue(old.exists())

    def test_whole_retained_clip_can_be_removed_without_reexport(self):
        from footage_manager.retained_cleanup import process
        task=self.retained_task([])
        process(self.store,task,self.batch.ledger,self.batch.persist)
        self.assertFalse(Path(task['clip']['exported']).exists())
        self.assertEqual([], [r for r in self.store.ranges(self.ident) if r['decision']=='keep'])

    def test_cleanup_observes_canonical_worker_cancellation(self):
        from footage_manager.media import JOB_CONTEXT,Cancelled
        JOB_CONTEXT.job={'cancel_requested':True}
        try:
            with self.assertRaises(Cancelled):
                self.batch({})
        finally:
            JOB_CONTEXT.job={}
        self.assertTrue(self.source.exists())


if __name__=='__main__':
    unittest.main()
