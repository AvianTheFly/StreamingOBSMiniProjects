"""Mood variation persistence, cancellation, audio scope and browser publication."""
import base64
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch
from lib.paths import ensure_import_paths
ensure_import_paths()
from love_me.settings import VariationStore, Conflict
from love_me.service import MoodService
from love_me.presentation import MoodPresentation, SOURCE
from love_me.catalog import presets
from lib.browser_effects.presentations import register, unregister, resolve
from lib.coordination.playback import PlayCoordinator
from lib.project_runtime import _ProjectRegistry, ProjectInterface, ProjectStatus


class VariationSettingsTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.store=VariationStore(self.folder.name)
        backup=patch('love_me.settings.SettingsBackups')
        backup.start();self.addCleanup(backup.stop)

    def save(self,identity='signal_found',**changes):
        return self.store.save(dict(id=identity,changes=changes,revision=self.store.snapshot()['revision']))

    def test_preserves_unknown_personal_fields_and_other_variations(self):
        raw={'personal':'keep','variations':{'signal_found':{'unknown_filter':{'gain':8}},'golden':{'volume_db':-5}}}
        self.store.path.write_text(json.dumps(raw))
        self.save(opacity=.4)
        saved=json.loads(self.store.path.read_text())
        self.assertEqual(saved['personal'],'keep')
        self.assertEqual(saved['variations']['signal_found']['unknown_filter'],{'gain':8})
        self.assertEqual(saved['variations']['golden'],raw['variations']['golden'])

    def test_revision_conflict_keeps_newer_edit(self):
        old=self.store.snapshot()['revision'];self.save(opacity=.4)
        with self.assertRaises(Conflict):self.store.save(dict(id='signal_found',changes={'opacity':.9},revision=old))
        self.assertEqual(self.store.get('signal_found')['opacity'],.4)

    def test_malformed_settings_never_replaced(self):
        for raw in ['broken','[]','{"variations":{"signal_found":42}}']:
            self.store.path.write_text(raw)
            with self.assertRaises(ValueError):self.save(opacity=.3)
            self.assertEqual(self.store.path.read_text(),raw)

    def test_hotkeys_are_unique_and_987_reserved(self):
        for key in ['987','984']:
            with self.assertRaises(ValueError):self.save(hotkey=key)
        self.save(hotkey='abc')
        self.assertEqual(self.store.get('signal_found')['hotkey'],'abc')

    def test_cloned_direction_keeps_cue_sheet_and_can_use_different_audio(self):
        result=self.store.save(dict(id='my_mood',clone_from='golden',revision=self.store.snapshot()['revision'],changes={'name':'My moment','hotkey':'abc'}))
        row=next(r for r in result['variations'] if r['id']=='my_mood')
        self.assertEqual(row['cuts'],self.store.get('golden')['cuts'])
        self.assertEqual(len(result['variations']),5)

    def test_invalid_timing_rejected_before_write(self):
        for changes in [{'audio_anchor':60},{'opacity':float('nan')},{'duration':2},{'repeats':2.5}]:
            with self.assertRaises(ValueError):self.save(**changes)
        self.assertFalse(self.store.path.exists())

    def test_image_hit_is_independent_of_words_preserved_in_clones_and_nullable(self):
        words=self.store.get('signal_found')['lyric_cues']
        self.save(image_onset=9.719)
        self.assertEqual(self.store.get('signal_found')['lyric_cues'],words)
        self.store.save(dict(id='hit_clone',clone_from='signal_found',revision=self.store.snapshot()['revision'],changes={'name':'Hit clone','hotkey':''}))
        self.save(image_onset=None)
        self.assertIsNone(self.store.get('signal_found')['image_onset'])
        self.assertEqual(self.store.get('hit_clone')['image_onset'],9.719)
        for value in [-1,True,'9.719',float('nan'),14401]:
            with self.assertRaises(ValueError):self.save(image_onset=value)

    def test_word_score_is_ordered_lossless_and_clone_scoped(self):
        cues=[dict(start=1,end=3,text='WHERE',personal_note='keep'),dict(start=3,end=3.4,text='HAVE')]
        self.save(lyric_cues=cues,lyric_offset=.1,font_interval=.09,hold_fade=.8)
        self.assertEqual(self.store.get('signal_found')['lyric_cues'],cues)
        self.store.save(dict(id='my_signal',clone_from='signal_found',revision=self.store.snapshot()['revision'],changes={'name':'My signal','hotkey':''}))
        self.save(lyric_cues=[])
        self.assertEqual(self.store.get('my_signal')['lyric_cues'],cues)
        for invalid in [[dict(start=3,end=2,text='WHERE')], [dict(start=1,end=3,text='WHERE'),dict(start=2,end=4,text='HAVE')], [dict(start=True,end=3,text='WHERE')]]:
            with self.assertRaises(ValueError):self.save(lyric_cues=invalid)

    def test_older_custom_variation_receives_new_controls_without_replacing_personal_data(self):
        row=dict(self.store.get('golden'),id='personal',hotkey='',name='Personal')
        for key in ('lyric_cues','lyric_offset','font_interval','hold_fade'):row.pop(key)
        self.store.path.write_text(json.dumps({'variations':{'personal':row}}))
        self.assertEqual(self.store.get('personal')['font_interval'],.12)
        self.assertEqual(json.loads(self.store.path.read_text())['variations']['personal'],row)

    def test_upload_is_identity_scoped_and_does_not_delete_previous_media(self):
        def upload(payload):return self.store.import_audio(dict(id='golden',filename='../outside.mp3',data=base64.b64encode(payload).decode(),revision=self.store.snapshot()['revision']))
        upload(b'first');first=self.store.audio_path(self.store.get('golden'))
        upload(b'second');second=self.store.audio_path(self.store.get('golden'))
        self.assertEqual(first.read_bytes(),b'first');self.assertEqual(second.read_bytes(),b'second')
        self.assertTrue(second.is_relative_to(self.store.root))
        self.assertEqual(self.store.get('afterglow')['audio_file'],'')

    def test_folder_drop_and_ambiguous_audio(self):
        (self.store.root/'audio').mkdir();(self.store.root/'audio/golden.mp3').write_bytes(b'a')
        self.assertEqual(self.store.audio_path(self.store.get('golden')).name,'golden.mp3')
        (self.store.root/'audio/golden.wav').write_bytes(b'a')
        with self.assertRaises(ValueError):self.store.audio_path(self.store.get('golden'))

    def test_import_can_use_external_media_drive_without_moving_old_audio(self):
        with tempfile.TemporaryDirectory() as media:
            store=VariationStore(self.folder.name,media_root=media)
            store.import_audio(dict(id='signal_found',filename='edit.mp3',data=base64.b64encode(b'new audio').decode(),revision=store.snapshot()['revision']))
            file=store.audio_path(store.get('signal_found'))
            self.assertTrue(file.is_relative_to(Path(media)))
            self.assertEqual(file.read_bytes(),b'new audio')
            self.assertFalse((store.root/'audio').exists())

    def test_signal_score_follows_user_listening_times(self):
        words=self.store.get('signal_found')['lyric_cues']
        self.assertEqual([cue['text'] for cue in words],['WHERE','HAVE','YOU','BEEN','ALL','MY','LIFE'])
        self.assertEqual(words[0]['start'],10)
        self.assertEqual(words[0]['end'],12)
        self.assertEqual(words[3]['end'],15)
        self.assertEqual(words[-1]['end'],18)

    def test_fader_capture_belongs_to_loaded_variation_and_master_is_current(self):
        (self.store.root/'hub_audio.json').write_text('{"project_volume_db":-6,"profile_volume_db":0}')
        with patch('love_me.presentation.obs') as obs:
            p=MoodPresentation(self.store);p.loaded=self.store.get('golden');p.expected_db=-6
            p.channel=Mock(matches=Mock(return_value=True))
            obs.get_input_volume.return_value={'db':-9}
            p.capture_fader()
            self.assertEqual(self.store.get('golden')['volume_db'],-3)
            self.assertEqual(self.store.get('afterglow')['volume_db'],0)
            p._audio(self.store.get('afterglow'))
            obs.set_input_volume_db.assert_called_with(SOURCE,-6)
            obs.set_input_audio_monitor_type.assert_called_with(SOURCE,'OBS_MONITORING_TYPE_MONITOR_ONLY')
            self.assertFalse(obs.set_input_audio_tracks.call_args.args[1]['2'])

    def test_first_prepare_refreshes_existing_browser_once_after_hub_restart(self):
        with patch('love_me.presentation.attach',return_value=SOURCE),patch('love_me.presentation.obs') as obs:
            presentation=MoodPresentation(self.store)
            presentation.channel=Mock(snapshot=Mock(return_value={'ready':True}))
            presentation.prepare();presentation.prepare()
            obs.get_obs.return_value.send.assert_called_once_with(
                'PressInputPropertiesButton',dict(inputName=SOURCE,propertyName='refreshnocache'),raw=True)

    def test_failed_first_refresh_can_retry(self):
        with patch('love_me.presentation.attach',return_value=SOURCE),patch('love_me.presentation.obs') as obs:
            presentation=MoodPresentation(self.store)
            obs.get_obs.return_value.send.side_effect=[RuntimeError('OBS unavailable'),None]
            with self.assertRaises(RuntimeError):presentation.prepare()
            self.assertFalse(presentation.prepared)
            presentation.prepare();self.assertTrue(presentation.prepared)


class Ticket:
    def __init__(self):
        self.cancelled=threading.Event();self.allowed=threading.Event();self.allowed.set();self.finished=threading.Event()
    def wait_until_allowed(self,cancelled):return not cancelled() and self.allowed.is_set()
    def finish(self):self.cancelled.set();self.finished.set()


class Coordination:
    def __init__(self,delay=False):self.tickets=[];self.callbacks=[];self.delay=delay
    def request(self,name,callback,**kwargs):
        ticket=Ticket();self.tickets.append(ticket);self.callbacks.append(callback)
        if not self.delay:callback(ticket)
        return ticket


class MoodOwnershipTests(unittest.TestCase):
    def make(self,presentation=None,delay=False):
        store=Mock(get=Mock(return_value=presets()[0]))
        legacy=Mock(lock=threading.RLock(),current_index=0,items=[{}, {}, {}, {}])
        coordination=Coordination(delay)
        presentation=presentation or Mock()
        service=MoodService(legacy,store,threading.Event(),coordination=coordination,presentation=presentation)
        self.addCleanup(service.close)
        return service,coordination,store,presentation

    def test_fixed_repeat_count_and_ticket_completion(self):
        service,c,store,p=self.make();store.get.return_value={**presets()[0],'mode':'repeat','repeats':3}
        service.trigger('signal_found');self.assertTrue(service.done.wait(2))
        self.assertEqual(p.play.call_count,3);self.assertTrue(c.tickets[0].finished.is_set())
        self.assertFalse(service.snapshot()['busy'])

    def test_continuous_stops_on_same_hotkey(self):
        entered=threading.Event()
        def play(row,cancelled,allowed):
            entered.set()
            while not cancelled():time.sleep(.005)
        service,c,store,p=self.make(Mock(play=Mock(side_effect=play)))
        store.get.return_value={**presets()[0],'mode':'continuous'}
        service.trigger('signal_found');self.assertTrue(entered.wait(2));service.trigger('signal_found')
        self.assertTrue(service.done.wait(2));self.assertTrue(c.tickets[0].finished.is_set())

    def test_replacement_waits_for_cleanup_and_old_completion_cannot_clear_new(self):
        entered,cleanup,release,next_started=map(lambda _:threading.Event(),range(4))
        def play(row,cancelled,allowed):
            if row['id']=='signal_found':
                entered.set()
                while not cancelled():time.sleep(.005)
                cleanup.set();release.wait(2)
            else:next_started.set()
        service,c,store,p=self.make(Mock(play=Mock(side_effect=play)))
        service.trigger('signal_found');self.assertTrue(entered.wait(2))
        store.get.return_value=presets()[2];service.trigger('golden');latest=service.done
        try:
            self.assertTrue(cleanup.wait(2));self.assertFalse(next_started.is_set())
            self.assertFalse(c.tickets[0].finished.is_set());self.assertEqual(service.snapshot()['active'],'golden')
        finally:release.set()
        self.assertTrue(latest.wait(2));self.assertTrue(next_started.is_set());self.assertTrue(c.tickets[0].finished.is_set())

    def test_cancel_before_admission_rejects_stale_callback(self):
        service,c,_,p=self.make(delay=True);service.trigger('signal_found');service.cancel()
        self.assertFalse(c.callbacks[0](c.tickets[0]));p.play.assert_not_called()

    def test_discarded_pending_request_releases_ticket(self):
        entered,release=threading.Event(),threading.Event()
        def play(row,cancelled,allowed):entered.set();release.wait(2)
        service,c,store,p=self.make(Mock(play=Mock(side_effect=play)))
        service.trigger('signal_found');self.assertTrue(entered.wait(2))
        store.get.return_value=presets()[2];service.trigger('golden');service.cancel()
        try:self.assertTrue(c.tickets[1].finished.is_set())
        finally:release.set()

    def test_latest_pre_admission_intent_only(self):
        service,c,store,p=self.make(delay=True)
        service.trigger('signal_found');store.get.return_value=presets()[2];service.trigger('golden')
        self.assertFalse(c.callbacks[0](c.tickets[0]));c.callbacks[1](c.tickets[1])
        self.assertTrue(service.done.wait(2));self.assertEqual(p.play.call_count,1)


class PublicationTests(unittest.TestCase):
    def test_montage_publishes_catalog_files_without_exposing_neighbor_files(self):
        from love_me.assets import browser_files
        from love_me.montage_catalog import SHOTS, shot_file
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)/'signal-v2';root.mkdir()
            montage=root.parent/'signal-montage';montage.mkdir()
            (root/'UnifrakturCook-Bold.ttf').write_bytes(b'font')
            (montage/'montage.json').write_text('{}')
            named=shot_file(SHOTS[0]);(montage/named).write_bytes(b'photo')
            (montage/'private.json').write_text('personal')
            with patch('love_me.assets.asset_root',return_value=root):
                published=browser_files()
            self.assertEqual(set(published),{'UnifrakturCook-Bold.ttf','montage.json',named})
            self.assertEqual(published[named],montage/named)

    def test_old_unregister_cannot_remove_new_presentation(self):
        old=register('fixture',{'overlay.html':Path('a')})
        new=register('fixture',{'overlay.html':Path('b')})
        try:
            unregister('fixture',old);self.assertEqual(resolve('fixture'),Path('b').resolve())
            self.assertIsNone(resolve('fixture','../secret'))
        finally:unregister('fixture',new)

    def test_explicit_files_only(self):
        with self.assertRaises(ValueError):register('fixture',{'../secret':Path('b')},entry='../secret')

    def test_request_pause_policy_is_ticket_scoped(self):
        class Feature(ProjectInterface):
            name='music';paused=False
            def get_status(self):return ProjectStatus(self.name,True,None,[],True,self.paused)
            def pause(self):self.paused=True
            def resume(self):self.paused=False
        registry=_ProjectRegistry();feature=Feature();registry.register(feature)
        c=PlayCoordinator(registry);admitted=threading.Event()
        try:
            ticket=c.request('mood',lambda t:admitted.set(),pause=['music'])
            self.assertTrue(admitted.wait(2));self.assertTrue(feature.paused)
            ticket.finish();self.assertTrue(ticket.done.wait(2));self.assertFalse(feature.paused)
        finally:c.shutdown()


if __name__=='__main__':unittest.main()
