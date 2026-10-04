"""Finite accent admission and relay policy, without live OBS access."""
import unittest
import uuid
from unittest.mock import patch
from spirit_lobby.actions import catalog, envelope
from hub_ui.routes.spirit_lobby import SpiritLobbyRoutes
from hub_ui.updates import subscription


class ActionsTests(unittest.TestCase):
    def test_catalog_and_validation(self):
        items = catalog()
        self.assertEqual(len({e['id'] for e in items}), 18)
        self.assertEqual(len({e['key'] for e in items}), 18)
        for e in items:
            self.assertIn(e['stage'], ('back', 'front'))
            self.assertGreater(e['weight'], 0)
            self.assertLessEqual(e['life'], 10)
            self.assertGreaterEqual(e['autoWeight'], 0)
            self.assertGreater(e['impact'], 0)
        for body in (None, [], {}, {'action': []}, {'action': 'delete'}, {'action': 'wave', 'id': '../bad'}):
            with self.subTest(body=body), self.assertRaises(ValueError):
                envelope(body)

    def test_echo_identity_and_server_time(self):
        cue_id = str(uuid.uuid4())
        with patch('spirit_lobby.actions.time.time', return_value=123):
            self.assertEqual(envelope({'action': 'bubbles', 'id': cue_id, 'issuedAt': 0}),
                             {'action': 'bubbles', 'id': cue_id, 'issuedAt': 123})

    def test_two_relay_calls_remain_separate_in_existing_transport(self):
        class Handler(SpiritLobbyRoutes):
            def _lobby_library(self):
                return None
            def _body(self):
                return self.body
            def _json(self, code, result):
                self.result = (code, result)
        handler = Handler()
        ids = [str(uuid.uuid4()), str(uuid.uuid4())]
        with subscription() as inbox:
            for cue_id in ids:
                handler.body = {'action': 'confetti', 'id': cue_id}
                handler._post_spirit_lobby('/api/spirit-lobby/action')
                self.assertEqual(handler.result[0], 200)
            import json
            received = [json.loads(inbox.get_nowait().decode()[6:]) for _ in ids]
            self.assertEqual([e['payload']['id'] for e in received], ids)
            self.assertTrue(all(e['type'] == 'spirit_lobby_action' for e in received))
            self.assertTrue(inbox.empty())
