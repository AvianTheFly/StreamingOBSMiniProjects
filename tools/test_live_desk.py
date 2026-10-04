"""Read-only desk snapshots and generic public asset HTTP delegation."""
import unittest
import threading
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from lib.paths import ensure_import_paths
ensure_import_paths()
from hub_ui.routes.projects import ProjectRoutes
from hub_ui.routes.controls import ControlRoutes
from hub_ui import project_status
from lib import display_capture
from lib.snapshots import SnapshotMap
from soundboard.desk import AssetControls


class Handler(ProjectRoutes, ControlRoutes):
    def _json(self, code, data):
        self.result = code, data
        return code, data

    def _err(self, code, message):
        return code, {'error': message}


class DeskTests(unittest.TestCase):
    def test_soundboard_selection_cancels_voice_and_random_before_existing_play(self):
        calls=Mock()
        inventory=SnapshotMap({'hooray':Path('Hooray.mp4')})
        stop=threading.Event()
        controls=AssetControls(inventory,stop,cancel_voice=calls.voice,
            close_window=calls.close,stop_random=calls.random,play=calls.play)
        self.assertEqual(controls.catalog(),[{'source':'hooray','name':'Hooray'}])
        self.assertFalse(controls.select('removed')['ok'])
        self.assertEqual(calls.mock_calls,[])
        self.assertTrue(controls.select(' Hooray ')['queued'])
        self.assertEqual([c[0] for c in calls.mock_calls],['voice','close','random','play'])
        calls.play.assert_called_once_with('hooray')
        inventory.replace({'new':Path('New.mp4')})
        self.assertEqual(controls.catalog(),[{'source':'new','name':'New'}])
        calls.reset_mock();stop.set()
        self.assertFalse(controls.select('new')['ok'])
        self.assertEqual(calls.mock_calls,[])

    def test_catalog_and_selection_call_public_interface_and_validate_input(self):
        handler = Handler()
        iface = Mock(asset_catalog=Mock(return_value=[{'source':'hooray'}]),
                     play_asset=Mock(return_value={'ok':True}))
        with patch('shared.project_registry.get', return_value=iface):
            self.assertEqual(handler._get_project('/api/projects/soundboard/assets'),
                             (200,[{'source':'hooray'}]))
            for value in (None, [], '', ' '):
                handler._body = lambda: {'source':value}
                self.assertEqual(handler._post_project('/api/projects/soundboard/play-asset')[0],400)
            iface.play_asset.assert_not_called()
            handler._body = lambda: {'source':'hooray'}
            self.assertEqual(handler._post_project('/api/projects/soundboard/play-asset')[0],200)
            iface.play_asset.assert_called_once_with('hooray')
            iface.play_asset.return_value = {'ok':False,'error':'Removed sound'}
            self.assertEqual(handler._post_project('/api/projects/soundboard/play-asset')[0],400)
        with patch('shared.project_registry.get', return_value=None):
            self.assertEqual(handler._get_project('/api/projects/missing/assets')[0],404)

    def test_snapshot_observes_program_and_capture_without_scene_writes(self):
        director = Mock(snapshot=Mock(return_value={'scene':None,'observing':True,'temporary_owner':'instant_replay'}))
        with patch('lib.coordination.scenes.scene_director', director), \
             patch('coordinator.coordinator.snapshot',return_value={'pauses':{}}), \
             patch('obs.scenes.get_current_scene',return_value='Test'), \
             patch('lib.display_capture.snapshot',return_value={'visible':False}), \
             patch('obs.outputs.get_stream_status',return_value={'active':True}):
            handler=Handler();handler._get_coordination()
            code,data=handler.result
            self.assertEqual(code,200)
            self.assertEqual(data['scenes']['scene'],'Test')
            self.assertEqual(data['scenes']['temporary_owner'],'instant_replay')
            self.assertFalse(data['display']['visible'])
            self.assertTrue(data['stream']['active'])
            director.request.assert_not_called()
            director.observe.assert_not_called()
        with patch('lib.coordination.scenes.scene_director',director), \
             patch('coordinator.coordinator.snapshot',return_value={}), \
             patch('obs.scenes.get_current_scene',side_effect=ConnectionError()), \
             patch('lib.display_capture.snapshot',side_effect=ConnectionError()), \
             patch('obs.outputs.get_stream_status',side_effect=ConnectionError()):
            handler=Handler();handler._get_coordination()
            data=handler.result[1]
            self.assertFalse(data['scenes']['observing'])
            self.assertIsNone(data['display']['visible'])
            self.assertIsNone(data['stream']['active'])

    def test_capture_snapshot_reads_actual_loaded_item_without_writing(self):
        client=Mock()
        client.get_scene_item_list.return_value=SimpleNamespace(scene_items=[
            {'sourceName':display_capture.CAPTURE_SOURCE,'sceneItemEnabled':False}])
        self.assertEqual(display_capture.snapshot(client=client),{'visible':False})
        client.set_scene_item_enabled.assert_not_called()

    def test_project_status_keeps_paused_state(self):
        status=SimpleNamespace(name='soundboard',is_active=True,is_paused=True,
            current_activity='playing: hooray',controlled_scenes=[],can_revert=True)
        iface=Mock(get_status=Mock(return_value=status))
        with patch('shared.project_registry.all',return_value=[iface]):
            self.assertTrue(project_status.all_statuses()[0]['is_paused'])


if __name__=='__main__':
    unittest.main()
