import unittest
from .engine import Engine
from .test_engine import snapshot


class SpriteTests(unittest.TestCase):
    def test_level_count_duplicate_and_priority(self):
        e = Engine(clock=lambda: 10)
        e.ingest(snapshot())
        self.assertIsNone(e.sprite)
        e.submit([{'key': k} for k in ('pentakill', 'ace', 'objective_steal')])
        data = snapshot(101)
        data['allPlayers'][0]['level'] = 6
        e.ingest(data)
        self.assertEqual(e.sprite['level'], 6)
        self.assertEqual(e.sprite['expires'], 12)
        identity = e.sprite['id']
        e.ingest(data)
        self.assertEqual(e.sprite['id'], identity)
        e.clear()
        self.assertIsNone(e.sprite)

    def test_reconnect_pause_off_and_disabled(self):
        for option in ('baseline', 'paused', 'overlay_enabled', 'disabled'):
            e = Engine()
            e.ingest(snapshot())
            if option == 'paused': e.config['paused'] = True
            if option == 'overlay_enabled': e.config['overlay_enabled'] = False
            if option == 'disabled': e.config['events']['level_up']['enabled'] = False
            data = snapshot(101)
            data['allPlayers'][0]['level'] = 8
            e.ingest(data, baseline=option == 'baseline')
            self.assertIsNone(e.sprite, option)

    def test_preview_validation(self):
        e = Engine()
        for value in (0, -1, 101, True, '6', 6.5):
            with self.assertRaises(ValueError): e.trigger_sprites(value)

