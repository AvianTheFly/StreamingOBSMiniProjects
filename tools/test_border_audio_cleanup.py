"""Finite cleanup policy does not normalize or alter unrelated personal media."""
import unittest
from tools.prepare_border_audio import filter_chain


class BorderAudioTests(unittest.TestCase):
    def test_piuw_targets_microphone_rumble_and_preserves_gain_policy(self):
        chain = filter_chain('piuw.mp3', .417875)
        self.assertIn('highpass=f=160:p=2', chain)
        self.assertIn('afftdn=nr=14', chain)
        self.assertIn('st=0.411875', chain)
        self.assertNotIn('loudnorm', chain)
        self.assertNotIn('volume=', chain)

    def test_frog_preserves_low_croak_with_subtle_room_gate(self):
        chain = filter_chain('mom frog.mp4', .418005)
        self.assertIn('highpass=f=100', chain)
        self.assertIn('agate=threshold=0.015', chain)
        self.assertIn('range=0.25', chain)
        self.assertNotIn('loudnorm', chain)

    def test_unrelated_asset_is_rejected(self):
        with self.assertRaises(ValueError):
            filter_chain('gary_meow.mp3', 1)
