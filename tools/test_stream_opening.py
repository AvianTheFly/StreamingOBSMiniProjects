"""Opening source cleanup and guarded handoff, with fake OBS and disposable media."""
import threading
import unittest
from unittest.mock import Mock, patch
from starting_soon.opening import Opening
from starting_soon.config import SCENE, STAGE


class OpeningTests(unittest.TestCase):
    def make(self):
        service = Mock()
        service.session.owns_scene.return_value = True
        service.session.present.return_value = True
        service.snapshot.return_value = {'error': ''}
        service.player.done = threading.Event()
        service.player.snapshot.return_value = {'busy': False}
        opening = Opening(service)
        return opening, service

    def test_selected_file_uses_existing_player_once_without_loop(self):
        opening, service = self.make()
        original = {'cropLeft': 8, 'rotation': 2, 'personal': 17}
        with patch('starting_soon.opening.catalog', return_value={'available': True}), \
             patch('starting_soon.opening.presentation') as presentation, \
             patch('starting_soon.opening.scene_director') as director:
            director.snapshot.return_value = {'manual_revision': 7}
            presentation.clip_transform.return_value = original
            opening.start(); opening.start()
            service.player.play.assert_called_once()
            row = service.player.play.call_args.args[0][0]
            self.assertTrue(row['path'].endswith('spirit-slideshow-v3-calm\\sanctuary-slideshow-40s.mp4')
                            or row['path'].endswith('spirit-slideshow-v3-calm/sanctuary-slideshow-40s.mp4'))
            self.assertEqual(service.player.play.call_args.kwargs, {'loop': False})
            service.session.present.assert_called_once_with(STAGE)
            self.assertEqual(opening.transform, original)

    def test_handoff_waits_for_cleanup_restores_exact_transform_then_uses_public_owner(self):
        opening, service = self.make();opening.active = True;opening.revision = 9
        opening.transform = {'rotation': 2, 'cropLeft': 5, 'boundsWidth': 911}
        calls=[]
        service.player.close.side_effect=lambda:calls.append('cleanup')
        owner=Mock();owner.present_lobby.side_effect=lambda **kwargs:calls.append(('lobby',kwargs))
        with patch('starting_soon.opening.presentation') as presentation, \
             patch('starting_soon.opening.project_registry.get', return_value=owner):
            presentation.restore_clip_transform.side_effect=lambda t:calls.append(('restore',t))
            opening.finish()
        self.assertEqual(calls, ['cleanup', ('restore', {'rotation':2,'cropLeft':5,'boundsWidth':911}),
                                 ('lobby', {'expected_manual_revision':9})])
        service.close.assert_called_once()

    def test_new_scene_choice_cancels_return_but_cleans_source_and_placement(self):
        opening, service = self.make();opening.active=True;opening.transform={'cropRight':4}
        service.session.owns_scene.return_value=False
        with patch('starting_soon.opening.presentation') as presentation, \
             patch('starting_soon.opening.project_registry.get') as owner:
            opening.finish()
            owner.assert_not_called();presentation.restore_clip_transform.assert_called_once_with({'cropRight':4})
        service.session.present.assert_not_called();service.close.assert_not_called()

    def test_pending_cleanup_cannot_restore_or_handoff(self):
        opening, service = self.make();opening.active=True;opening.transform={'x':4}
        service.player.close.side_effect=RuntimeError('cleanup pending')
        with patch('starting_soon.opening.presentation') as presentation, \
             patch('starting_soon.opening.project_registry.get') as owner:
            with self.assertRaisesRegex(RuntimeError,'cleanup pending'):opening.finish()
            presentation.restore_clip_transform.assert_not_called();owner.assert_not_called()
        self.assertTrue(opening.active)

    def test_failed_play_returns_to_starting_screen_without_entering_lobby(self):
        opening, service = self.make();opening.active=True;service.snapshot.return_value={'error':'Decode failed'}
        with patch('starting_soon.opening.project_registry.get') as owner:
            opening.finish();owner.assert_not_called()
        service.session.present.assert_called_once_with(SCENE)

    def test_done_notification_alone_cannot_reuse_busy_source(self):
        opening, service = self.make();opening.active=True;service.player.done.set()
        service.player.snapshot.return_value={'busy':True}
        opening.finish=Mock();opening.tick();opening.finish.assert_not_called()
        service.player.snapshot.return_value={'busy':False};opening.tick();opening.finish.assert_called_once()

    def test_failed_player_outcome_is_published_before_finishing(self):
        opening, service=self.make();opening.active=True;service.player.done.set()
        service.player.snapshot.return_value={'busy':False,'history':[{'outcome':'failed'}]}
        calls=[]
        service.publish.side_effect=lambda **kwargs:calls.append(('error',kwargs['error']))
        opening.finish=lambda:calls.append(('finish',None))
        opening.tick()
        self.assertEqual([item[0] for item in calls],['error','finish'])


if __name__=='__main__':unittest.main()
