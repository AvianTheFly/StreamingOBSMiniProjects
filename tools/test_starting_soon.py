"""Waiting-room ownership regressions with disposable media and fake OBS."""
import json
import queue
import tempfile
import threading
import time
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import Mock, patch
from starting_soon import settings, clip_library, presentation
from starting_soon.player import ClipPlayer
from starting_soon.service import StartingSoon
from starting_soon.queue_state import ClipQueue
from starting_soon import layouts


class SettingsTests(unittest.TestCase):
    def test_legacy_playlist_becomes_named_without_losing_unknown_data(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(settings,'SettingsBackups'):
            path=Path(folder)/'settings.json'
            path.write_text(json.dumps({'playlist':['old.mkv'],'personal':{'keep':True}}))
            data=settings.read(path)
            self.assertEqual(data['playlists'][0]['paths'],['old.mkv'])
            data['playlists'][0]['notes']='personal notes'
            saved=settings.save({'playlists':data['playlists'],'revision':0},path)
            changed=settings.save({'playlists':[{'id':'main','name':'Warmup','paths':['old.mkv']}]},path)
            self.assertEqual(changed['playlists'][0]['notes'],'personal notes')
            self.assertEqual(changed['personal'],{'keep':True})
            with self.assertRaises(settings.Conflict):
                settings.save({'title':'stale','revision':saved['revision']},path)
            self.assertEqual(settings.read(path)['title'],settings.DEFAULTS['title'])

    def test_active_named_playlist_is_mirrored_for_legacy_actions(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(settings,'SettingsBackups'):
            path=Path(folder)/'settings.json'
            data=settings.save({'playlists':[{'id':'main','name':'One','paths':['a.mp4']},
                {'id':'two','name':'Two','paths':['b.mp4']}],'active_playlist_id':'two'},path)
            self.assertEqual(data['playlist'],['b.mp4'])
            data=settings.save({'playlist':['c.mp4']},path)
            self.assertEqual(data['playlists'][1]['paths'],['c.mp4'])
            self.assertEqual(data['playlists'][0]['paths'],['a.mp4'])

    def test_save_preserves_unknown_fields_and_malformed_data(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(settings, 'SettingsBackups'):
            path = Path(folder) / 'settings.json'
            path.write_text('{"personal": {"value": 17}, "title": "Existing"}')
            result = settings.save({'title': 'Changed'}, path)
            self.assertEqual(result['personal'], {'value': 17})
            self.assertEqual(result['title'], 'Changed')
            path.write_text('{bad')
            with self.assertRaises(ValueError):
                settings.save({'title': 'Cannot overwrite'}, path)
            self.assertEqual(path.read_text(), '{bad')

    def test_settings_validation_rejects_empty_artwork_and_bad_interval(self):
        with patch.object(settings, 'SettingsBackups'):
            for changes in ({'show_message':'yes'},{'show_footer':0},{'artwork': []}, {'rotation_seconds': 0}, {'rotation_seconds': True},
                            {'playlist': 'oops'}, {'loop': 'yes'}):
                with self.assertRaises(ValueError):
                    settings.save(changes)

    def test_clip_library_uses_registered_public_contract(self):
        provider = Mock()
        with patch.object(clip_library.project_registry, 'get', return_value=provider):
            clip_library.resolve(['clip.mp4'])
            provider.clip_selection.assert_called_once_with(['clip.mp4'])
            clip_library.catalog()
            provider.clip_catalog.assert_called_once_with()

    def test_named_looks_preserve_personal_fields_without_replacing_clips(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(settings,'SettingsBackups'):
            path=Path(folder)/'settings.json'
            original=settings.save({'playlist':['my.mp4'],'clip_layouts':{'my.mp4':{'layout':'left'}},
                'saved_looks':[{'id':'opening','name':'Opening','personal':'keep',
                    'settings':{'title':'Opening','future_option':{'keep':True}}}]},path)
            changed=settings.save({'saved_looks':[{'id':'opening','name':'Night opening',
                'settings':{'title':'Soon','motion':'drift'}}]},path)
            self.assertEqual(changed['playlist'],original['playlist'])
            self.assertEqual(changed['clip_layouts'],original['clip_layouts'])
            self.assertEqual(changed['saved_looks'][0]['personal'],'keep')
            self.assertEqual(changed['saved_looks'][0]['settings']['future_option'],{'keep':True})
            malformed={'saved_looks':[{'id':'bad','name':'Bad','settings':{'highlights_enabled':'yes'}}]}
            path.write_text(json.dumps(malformed))
            before=path.read_bytes()
            with self.assertRaises(ValueError):settings.save({'title':'Cannot reset'},path)
            self.assertEqual(path.read_bytes(),before)


class PresentationTests(unittest.TestCase):
    def test_stage_migration_carries_existing_asset_transform(self):
        client=Mock();original={'positionX':500,'positionY':300,'boundsWidth':960,
            'boundsHeight':540,'cropLeft':7,'rotation':2}
        client.get_input_list.return_value.inputs=[dict(inputName=presentation.OVERLAY,inputKind='browser_source'),dict(inputName=presentation.MEDIA,inputKind='ffmpeg_source')]
        client.get_video_settings.return_value=Mock(base_width=1920,base_height=1080)
        client.get_scene_item_transform.return_value.scene_item_transform=original
        with patch.object(presentation.obs,'get_obs',return_value=client), \
             patch.object(presentation.obs,'list_scenes',return_value=[presentation.SCENE]), \
             patch.object(presentation.obs,'list_sources',side_effect=[{presentation.OVERLAY:1,presentation.MEDIA:2},{}]), \
             patch.object(presentation.obs,'create_scene_item') as create, \
             patch.object(presentation.obs,'hide_source') as hide, \
             patch.object(presentation.obs,'set_source_transform') as transform, \
             patch.object(presentation,'SettingsBackups'):
            presentation.attach(7420)
            transform.assert_any_call(presentation.STAGE,presentation.MEDIA,original)
            create.assert_any_call(presentation.STAGE,presentation.MEDIA,False)
            hide.assert_called_once_with(presentation.SCENE,presentation.MEDIA)
            client.remove_scene_item.assert_not_called()

    def test_per_asset_placement_takes_precedence_and_custom_geometry_is_bounded(self):
        config={'layout':'right','clip_layouts':{'a.mp4':{'layout':'left'}}}
        self.assertEqual(layouts.box(config,'a.mp4'),layouts.PRESETS['left']['box'])
        self.assertEqual(layouts.box(config,'b.mp4'),layouts.PRESETS['right']['box'])
        self.assertIsNone(layouts.box({'layout':'preserve'}))
        self.assertEqual(layouts.custom_box({'x':500,'y':300,'width':960}),[500,300,960,540])
        for box in ({'x':0,'y':0,'width':1920},{'x':1000,'y':500,'width':1200},
                    {'x':float('nan'),'y':300,'width':960}):
            with self.assertRaises(ValueError):layouts.custom_box(box)

    def test_attachment_preserves_existing_transforms_settings_and_filters(self):
        client = Mock()
        client.get_input_list.return_value.inputs = [
            dict(inputName=presentation.OVERLAY, inputKind='browser_source'),
            dict(inputName=presentation.MEDIA, inputKind='ffmpeg_source')]
        client.get_video_settings.return_value = Mock(base_width=1920, base_height=1080)
        with patch.object(presentation.obs, 'get_obs', return_value=client), \
             patch.object(presentation.obs, 'list_scenes', return_value=[presentation.SCENE,presentation.STAGE]), \
             patch.object(presentation.obs, 'list_sources', side_effect=[{presentation.OVERLAY:1,presentation.STAGE:3},{presentation.MEDIA:2}]), \
             patch.object(presentation.obs, 'set_source_transform') as transform, \
             patch.object(presentation, 'SettingsBackups'):
            presentation.attach(7420)
            transform.assert_not_called()
            client.create_input.assert_not_called()
            client.set_input_settings.assert_not_called()
            client.set_source_filter_settings.assert_not_called()
            client.send.assert_called_once_with('PressInputPropertiesButton',
                {'inputName':presentation.OVERLAY,'propertyName':'refreshnocache'},raw=True)


class PlayerTests(unittest.TestCase):
    def player(self):
        gate = threading.Event(); gate.set()
        player = ClipPlayer(gate, Mock())
        player.fader = Mock()
        return player

    def test_pending_cancel_cannot_release_source_before_active_cleanup(self):
        player = self.player()
        entered, cleanup, release = threading.Event(), threading.Event(), threading.Event()
        def active(cancel):
            entered.set(); cancel.wait(2); cleanup.set(); release.wait(2)
        player.done = player.worker.submit(active)
        self.assertTrue(entered.wait(1))
        player.done = player.worker.submit(lambda cancel: None)
        closer = threading.Thread(target=player.close)
        closer.start()
        self.assertTrue(cleanup.wait(1))
        self.assertTrue(player.done.is_set(), 'cancelled pending request is complete')
        closer.join(.1)
        self.assertTrue(closer.is_alive(), 'active source still owns final cleanup')
        release.set(); closer.join(2)
        self.assertFalse(closer.is_alive())

    def test_cancel_before_source_activation_never_shows_source(self):
        player=self.player();session=Mock();session.owns_scene.return_value=True
        cancel=threading.Event()
        with patch('starting_soon.player.obs') as obs, \
             patch('starting_soon.player.media_startup',side_effect=lambda *a,**k:nullcontext()):
            player.fader.apply_row.side_effect=lambda *a:cancel.set()
            from lib.shared_media.media_startup import MediaStartupCancelled
            with self.assertRaises(MediaStartupCancelled):
                player._load(cancel,dict(path='one.mp4',title='One'),session)
            obs.show_source.assert_not_called()
            obs.configure_media_source_properties.assert_called_once_with(
                presentation.MEDIA,restart_on_activate=False,close_when_inactive=False,
                looping=False,clear_on_media_end=True)

    def test_cancel_before_gate_admission_does_not_load_file(self):
        player = self.player(); player.gate.clear()
        session = Mock(); session.owns_scene.return_value = True
        with patch('starting_soon.player.obs') as obs:
            player.play([dict(path='unused.mp4', title='Unused')], session, loop=False)
            player.close()
            obs.set_media_source_file.assert_not_called()

    def test_replaced_requests_cleanup_before_next_source_load(self):
        player = self.player()
        session = Mock(); session.owns_scene.return_value = True
        loaded, operations = threading.Event(), []
        def load(source, path):
            operations.append(('load',path)); loaded.set()
        with patch('starting_soon.player.obs') as obs, \
             patch('starting_soon.player.media_startup', side_effect=lambda *a, **k:nullcontext()):
            obs.set_media_source_file.side_effect = load
            obs.get_media_state.return_value = 'OBS_MEDIA_STATE_PLAYING'
            obs.park_media_source.side_effect = lambda *a:operations.append(('cleanup',None))
            player.play([dict(path='one.mp4',title='One')],session,loop=False)
            self.assertTrue(loaded.wait(1));loaded.clear()
            player.play([dict(path='two.mp4',title='Two')],session,loop=False)
            self.assertTrue(loaded.wait(1));player.close()
        self.assertEqual(operations[:3], [('load','one.mp4'),('cleanup',None),('load','two.mp4')])

    def test_fader_failure_still_parks_media(self):
        player = self.player();player.fader.capture.side_effect = ValueError('malformed')
        session = Mock();session.owns_scene.return_value = True
        with patch('starting_soon.player.obs') as obs, \
             patch('starting_soon.player.media_startup', side_effect=lambda *a, **k:nullcontext()):
            player.play([dict(path='one.mp4',title='One')],session,loop=False)
            player.done.wait(2)
            obs.park_media_source.assert_called_once()


class SessionTests(unittest.TestCase):
    def test_disabled_highlights_reject_play_before_resolving_or_loading(self):
        service=StartingSoon.__new__(StartingSoon);service.session=Mock();service.player=Mock()
        with patch('starting_soon.service.settings.read',return_value={'highlights_enabled':False}), \
             patch('starting_soon.service.clip_library.playable') as resolve:
            with self.assertRaisesRegex(ValueError,'Enable the highlight overlay'):
                service.execute('play',{'paths':['my.mp4']})
            resolve.assert_not_called();service.player.play.assert_not_called()

    def test_saving_disabled_highlights_requests_cleanup_without_scene_change(self):
        from starting_soon import api
        with patch.object(api.settings,'read',return_value={'playlists':[]}), \
             patch.object(api.settings,'save',return_value={'highlights_enabled':False}), \
             patch.object(api.runtime.interface,'run_action') as action:
            api.save({'highlights_enabled':False})
            action.assert_called_once_with('stop')

    def test_public_message_controls_preserve_copy_artwork_and_playlist(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(settings,'SettingsBackups'):
            path=Path(folder)/'settings.json'
            before=settings.save({'title':'My waiting room','playlist':['a.mp4'],
                'personal':{'keep':True}},path)
            self.assertTrue(before['show_message'])
            save=settings.save;service=StartingSoon.__new__(StartingSoon)
            with patch('starting_soon.service.settings.save',side_effect=lambda value:save(value,path)):
                service.execute('hide-message',{})
                hidden=settings.read(path);self.assertFalse(hidden['show_message'])
                for key in ('title','subtitle','artwork','playlists'):
                    self.assertEqual(hidden[key],before[key])
                service.execute('show-message',{})
                self.assertTrue(settings.read(path)['show_message'])

    def test_asset_override_does_not_become_next_assets_inherited_placement(self):
        service=StartingSoon.__new__(StartingSoon)
        service._preserved_box=None;service._placed_override=False;service.publish=Mock()
        config={'layout':'preserve','clip_layouts':{'a.mp4':{'layout':'left'}}}
        baseline=[600,310,1100,618.75]
        with patch('starting_soon.service.settings.read',return_value=config), \
             patch('starting_soon.service.presentation.placement',side_effect=[baseline,layouts.PRESETS['left']['box']]), \
             patch('starting_soon.service.presentation.place_box') as place:
            service.place_clip('a.mp4');service.place_clip('b.mp4')
            place.assert_called_once_with(baseline)
            self.assertFalse(service._placed_override)

    def test_lost_scene_stops_source_before_finishing_revoked_session(self):
        service = StartingSoon.__new__(StartingSoon)
        service.lock = threading.RLock();service.data = {};service.last_rotation = time.monotonic()
        operations=[]
        service.player = Mock();service.player.close.side_effect=lambda:operations.append('cleanup')
        service.session = Mock();service.session.owns_scene.return_value=False
        service.session.finish.side_effect=lambda:operations.append('finish')
        with patch('starting_soon.service.settings.read',return_value={'rotation_seconds':35}):
            service.tick()
        self.assertEqual(operations,['cleanup','finish'])
        self.assertFalse(service.data['active'])
        self.assertIsNone(service.session)

    def test_finish_does_not_release_session_when_source_cleanup_is_pending(self):
        service = StartingSoon.__new__(StartingSoon)
        service.player = Mock();service.player.close.side_effect=RuntimeError('cleanup pending')
        service.session = Mock()
        with self.assertRaises(RuntimeError):
            service.close()
        service.session.finish.assert_not_called()


class QueueTests(unittest.TestCase):
    def rows(self,*names):
        return [dict(path=n+'.mp4',title=n) for n in names]

    def test_live_edits_do_not_replace_loaded_clip_and_one_off_does_not_loop(self):
        plan=ClipQueue(self.rows('a','b'),loop=True)
        a=plan.take();plan.enqueue_next(self.rows('extra'))
        self.assertEqual(plan.snapshot()['current'],a)
        self.assertEqual(plan.take()['title'],'extra')
        self.assertEqual(plan.take()['title'],'b')
        self.assertEqual([r['title'] for r in plan.snapshot()['upcoming']],['a','b'])

    def test_remove_and_move_next_keep_current_and_saved_input_unchanged(self):
        original=self.rows('a','b','c');plan=ClipQueue(original,loop=True)
        current=plan.take();upcoming=plan.snapshot()['upcoming']
        plan.move_next(upcoming[1]['entry_id']);plan.remove(upcoming[0]['entry_id'])
        self.assertEqual(plan.snapshot()['current'],current)
        self.assertEqual(plan.take()['title'],'c')
        self.assertEqual([r['title'] for r in plan.snapshot()['upcoming']],['a','c'])
        self.assertEqual([r['title'] for r in original],['a','b','c'])

    def test_finite_queue_finishes_and_history_is_bounded(self):
        plan=ClipQueue(self.rows('a','b'),loop=False)
        self.assertEqual(plan.take()['title'],'a');plan.complete('skipped')
        self.assertEqual(plan.take()['title'],'b');plan.complete()
        self.assertIsNone(plan.take())
        self.assertEqual([r['outcome'] for r in plan.snapshot()['history']],['played','skipped'])

    def test_shuffle_cycle_does_not_immediately_repeat_same_file(self):
        import random
        plan=ClipQueue(self.rows('a','b','c'),loop=True,shuffle=True,rng=random.Random(1))
        seen=[plan.take()['title'] for _ in range(30)]
        self.assertTrue(all(a!=b for a,b in zip(seen,seen[1:])))

    def test_missing_clip_is_reported_without_erasing_original_selection(self):
        owner=Mock()
        owner.clip_selection.side_effect=lambda paths: (_ for _ in ()).throw(ValueError('missing')) if paths==['missing'] else self.rows('ok')
        original=['missing','ok']
        with patch.object(clip_library,'provider',return_value=owner):
            rows,missing=clip_library.playable(original)
        self.assertEqual(missing,['missing']);self.assertEqual(rows[0]['title'],'ok')
        self.assertEqual(original,['missing','ok'])


if __name__ == '__main__':
    unittest.main()
