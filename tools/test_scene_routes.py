"""Scene HTTP feedback reports rejected requests instead of false success."""
import unittest
from unittest.mock import Mock, patch
from hub_ui.routes.scenes import SceneRoutes


class SceneRouteTests(unittest.TestCase):
    def test_rejected_scene_is_conflict_without_success_event(self):
        handler = SceneRoutes()
        handler._err, handler._json = Mock(), Mock()
        with patch('obs.switch_scene', return_value=False), patch('hub_ui.updates.broadcast') as broadcast:
            handler._svs_post('switch_scene', {'scene':'Test'})
        handler._err.assert_called_once_with(409, 'Scene choice was superseded; try again')
        handler._json.assert_not_called()
        broadcast.assert_not_called()

    def test_accepted_scene_reports_success(self):
        handler = SceneRoutes()
        handler._err, handler._json = Mock(), Mock()
        with patch('obs.switch_scene', return_value=True) as switch, patch('hub_ui.updates.broadcast') as broadcast:
            handler._svs_post('switch_scene', {'scene':'Test'})
        switch.assert_called_once_with('Test', owner='hub_ui', reason='Scene button')
        handler._json.assert_called_once_with(200, {'ok':True})
        handler._err.assert_not_called()
        broadcast.assert_called_once()
