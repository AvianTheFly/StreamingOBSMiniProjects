"""Capture intent, selection and review boundaries on disposable media/settings."""
import json
import subprocess
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay import library, capture, inventory, commands, api, stage, presentation
from instant_replay.runtime_state import ReplayState
from instant_replay.selection import ReplaySelection
from lib.media_review import excluded_paths
from footage_manager import review_pool


class ReplayIntentTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.file=self.root/'labels.json'
        self.patch=patch.object(library,'STATE_FILE',self.file)
        self.patch.start();self.addCleanup(self.patch.stop)
        self.keeper=self.root/'keeper.mkv';self.keeper.write_bytes(b'keeper')
        self.small=self.root/'small.mkv';self.small.write_bytes(b'small')
        library.remember_capture(self.keeper,tag='win',saved_at=1)
        library.remember_capture(self.small,purpose='replay_only',saved_at=2)

    def test_purpose_changes_preserve_labels_and_unknown_personal_fields(self):
        data=library.read();key=library.clip_id(self.small)
        data['personal']={'keep':True};data['clips'][key].update(title='Funny miss',notes='note',favorite=True,custom=[1,2])
        library._write(data)
        result=library.mutate(dict(action='purpose',revision=data['revision'],paths=[str(self.small)],purpose='highlight'),self.root)
        self.assertEqual(result['personal'],{'keep':True})
        self.assertEqual(result['clips'][key]['custom'],[1,2])
        self.assertTrue(result['clips'][key]['favorite'])
        self.assertEqual(result['clips'][key]['title'],'Funny miss')
        self.assertEqual(library.highlight_paths([self.keeper,self.small]),[str(self.keeper),str(self.small)])
        self.assertEqual(excluded_paths(self.file),frozenset())

    def test_bulk_validation_is_atomic_and_rejects_stale_edits(self):
        before=self.file.read_bytes();revision=library.read()['revision']
        for body in [dict(action='purpose',revision=revision,paths=[str(self.keeper),str(self.root/'missing.mkv')],purpose='replay_only'),
                     dict(action='purpose',revision=revision-1,paths=[str(self.keeper)],purpose='replay_only')]:
            with self.assertRaises(ValueError):library.mutate(body,self.root)
            self.assertEqual(self.file.read_bytes(),before)

    def test_legacy_clips_remain_eligible_and_review_pool_follows_promotion(self):
        old=self.root/'legacy.mkv';old.write_bytes(b'old')
        self.assertEqual(library.highlight_paths([self.small,old]),[str(old)])
        with patch.object(review_pool,'CATALOG',self.file):
            rows=[dict(path=str(p),id=i) for i,p in enumerate([self.keeper,self.small,old])]
            self.assertEqual([r['id'] for r in review_pool.candidates(rows)],[0,2])
            library.mutate(dict(action='purpose',revision=library.read()['revision'],paths=[str(self.small)],purpose='highlight'),self.root)
            self.assertEqual(len(review_pool.candidates(rows)),3)

    def test_offline_and_live_inventory_hide_the_same_capture_copy(self):
        raw=self.root/'raw.mp4';raw.write_bytes(b'original buffer')
        cut=self.root/'replay-only'/'quick.mkv';cut.parent.mkdir();cut.write_bytes(b'quick cut')
        library.remember_capture(raw,purpose='replay_only')
        library.remember_capture(cut,purpose='replay_only',capture_source=raw)
        offline={r['path'] for r in library.disk_rows(self.root)}
        self.assertEqual(offline,{str(p.resolve()) for p in inventory.replay_files(self.root)})
        self.assertNotIn(str(raw),offline);self.assertIn(str(cut),offline)
        self.assertEqual(raw.read_bytes(),b'original buffer')
        cut.unlink()
        self.assertIn(str(raw),{r['path'] for r in library.disk_rows(self.root)},'A retained original must become visible if its cut is gone')
        self.assertEqual(library.highlight_paths([raw]),[],'Missing the cut must not reclassify a replay-only original')

    def test_game_highlights_exclude_replay_only(self):
        for p in [self.keeper,self.small]:
            library.archive_capture(p,p,game='Game 42 2026-10-03')
        self.assertEqual(library.game_paths(42,self.root),[str(self.keeper)])
        state=ReplayState();state._clip_registry.extend([dict(path=str(self.keeper)),dict(path=str(self.small))])
        player=Mock();selection=ReplaySelection(state,Mock(),player)
        selection._on_play('highlights')
        player._play_all_clips_sequential.assert_called_once_with([str(self.keeper)],presentation='highlights')

    def test_explicit_quick_mode_does_not_depend_on_game_client(self):
        views=Mock();views._get_most_recent_clip.return_value=[str(self.small)]
        player=Mock();selection=ReplaySelection(ReplayState(),views,player)
        selection._on_play('replay')
        player._play_all_clips_sequential.assert_called_once_with([str(self.small)],presentation='replay',mode='replay')
        self.assertEqual(presentation.transition_for('move'),('Move',320))
        self.assertEqual(presentation.transition_for('wipe'),('Luma Wipe',320))

    def test_small_capture_never_requests_twitch_and_preserves_mark(self):
        state=ReplayState();state._manual_mark_wall[0]=80
        recorder=capture.ReplayCapture(state,SimpleNamespace(first_kill_wall_time=None,last_death_wall_time=None))
        cut=self.root/'replay-only'/'small_ir_trimmed.mkv';cut.parent.mkdir();cut.write_bytes(b'cut')
        def saved(**kwargs):kwargs['on_save_requested'](100);return str(self.small)
        with patch.object(capture,'save_replay_buffer_and_wait',side_effect=saved),patch.object(capture,'request_clip') as twitch,patch.object(capture,'_trim_from_end',return_value=str(cut)) as trim:
            self.assertTrue(recorder._on_save(purpose='replay_only',clip_seconds=10,pressed_at=99))
            self.assertTrue(state._save_done_event[0].wait(2));twitch.assert_not_called()
        self.assertEqual(state._manual_mark_wall[0],80)
        self.assertEqual(state._save_result[0]['path'],str(cut))
        self.assertEqual(trim.call_args.kwargs['tail_seconds'],1)
        self.assertTrue(trim.call_args.kwargs['fast'])
        self.assertEqual(library.highlight_paths([self.small,cut]),[])
        self.assertEqual(len(excluded_paths(self.file)),2)
        with patch.object(inventory,'REPLAY_DIR',str(self.root)),patch.object(inventory,'CLIPS_DIR',str(self.root/'clips')),patch.object(inventory,'EDITED_DIR',str(self.root/'edited')):
            files=inventory._replay_files_on_disk()
            self.assertIn(cut,files);self.assertNotIn(self.small,files)
            self.assertNotIn(cut,inventory._replay_files_on_disk(highlights_only=True))

    def test_api_rejects_invalid_duration_and_busy_capture_before_work(self):
        for value in [0,2,121,float('nan'),float('inf'),'bad',None]:
            with patch.dict(api._live,{'quick_replay':Mock()},clear=True),self.assertRaises(ValueError):api.capture({'seconds':value})
            api._live.get('quick_replay',Mock()).assert_not_called()
        handler=Mock(return_value=False)
        with patch.dict(api._live,{'quick_replay':handler},clear=True),self.assertRaises(api.NotReady):api.capture({'seconds':15})

    def test_voice_quick_capture_is_distinct_from_replay_and_save(self):
        for spoken,seconds in [('quick replay',15),('replay that',15),('quick replay thirty seconds',30),('quick replay 5',5)]:
            self.assertEqual(commands.parse_command(spoken),('quick_replay','',seconds,False))
        self.assertEqual(commands.parse_command('replay')[:2],('play','replay'))
        self.assertEqual(commands.parse_command('save')[:2],('save',''))

    def test_fast_cut_keeps_audio_tracks_and_original_without_encoding(self):
        source=self.root/'test.mp4'
        subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','testsrc2=size=160x90:rate=30',
            '-f','lavfi','-i','sine=frequency=440','-t','6','-map','0:v','-map','1:a','-map','1:a',
            '-c:v','libx264','-g','30','-threads','2','-c:a','aac',str(source)],check=True,capture_output=True)
        before=source.read_bytes()
        from instant_replay.trimming import trim_from_end
        output=trim_from_end(str(source),3,tail_seconds=1,fast=True,output_dir=self.root/'replay-only')
        media=json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',output],capture_output=True,text=True,check=True).stdout)
        self.assertEqual(sum(s['codec_type']=='audio' for s in media['streams']),2)
        self.assertAlmostEqual(float(media['format']['duration']),3,delta=1.1)
        self.assertEqual(source.read_bytes(),before)


if __name__=='__main__':unittest.main()
