"""Mana confirmation regressions: no network, real keys or personal settings."""
import unittest
from lib.paths import ensure_import_paths
ensure_import_paths()
from league.udyr_casts import ManaCasts


class ManaTests(unittest.TestCase):
    def setUp(self):
        self.now = 10.
        self.detector = ManaCasts(lambda: self.now)

    def observe(self, mana, *, regen=4, maximum=1000, dt=.25, resource='MANA'):
        self.now += dt
        return self.detector.observe({'gameData': {'gameTime': self.now},
            'activePlayer': {'championStats': {'resourceType': resource,
                'resourceValue': mana, 'resourceMax': maximum, 'resourceRegenRate': regen}}})

    def test_key_alone_and_mana_drop_alone_do_not_switch(self):
        self.observe(500)
        self.detector.press('w')
        self.assertIsNone(self.observe(500))
        self.assertIsNone(self.observe(500, dt=1))
        self.assertIsNone(self.observe(480))

    def test_one_mana_drop_confirms_once_and_delayed_cast_is_accepted(self):
        self.observe(500)
        self.detector.press('w')
        self.assertIsNone(self.observe(500))
        self.assertEqual(self.observe(499), 'w')
        self.assertIsNone(self.observe(475))

    def test_regeneration_masked_cost_uses_stable_rolling_history(self):
        for mana in (500, 505, 510, 515):
            self.observe(mana, regen=20)
        self.detector.press('r')
        self.assertEqual(self.observe(517, regen=20), 'r')

    def test_regeneration_without_spending_and_changed_buff_do_not_confirm(self):
        for mana in (500, 505, 510, 515):
            self.observe(mana, regen=20)
        self.detector.press('e')
        self.assertIsNone(self.observe(520, regen=20))
        self.assertIsNone(self.observe(520, regen=1))

    def test_mana_cap_cannot_look_like_spending(self):
        for mana in (980, 985, 990, 995):
            self.observe(mana, regen=20)
        self.detector.press('w')
        self.assertIsNone(self.observe(1000, regen=20))
        self.assertIsNone(self.observe(1000, regen=20))

    def test_mana_spend_uses_latest_key_and_repeat_is_one_intent(self):
        self.observe(500)
        self.detector.press('q')
        self.detector.press('w')
        self.assertEqual(self.observe(470), 'w')
        self.detector.press('r')
        self.detector.press('r')
        self.assertEqual(self.observe(469), 'r')

    def test_enter_guard_expires_and_repeated_enter_extends_it(self):
        self.assertTrue(self.detector.allows_fallback())
        self.detector.enter()
        self.now += 4.99
        self.assertFalse(self.detector.allows_fallback())
        self.detector.enter()
        self.now += 4.99
        self.assertFalse(self.detector.allows_fallback())
        self.now += .02
        self.assertTrue(self.detector.allows_fallback())

    def test_enter_discards_older_intent_but_accepts_new_mana_evidence(self):
        self.observe(500)
        self.detector.press('w')
        self.detector.enter()
        self.assertIsNone(self.observe(475))
        self.detector.press('r')
        self.assertEqual(self.observe(474), 'r')
        self.assertFalse(self.detector.allows_fallback())

    def test_invalid_mana_or_death_reset_does_not_cancel_chat_guard(self):
        self.detector.enter()
        self.observe(500, resource='ENERGY')
        self.detector.reset()
        self.assertFalse(self.detector.allows_fallback())

    def test_invalid_stale_and_new_game_evidence_are_rejected(self):
        for kwargs in ({'dt': 2}, {'resource': 'ENERGY'}, {'maximum': 1100},
                       {'dt': -10}):
            self.detector.reset()
            self.observe(500)
            self.detector.press('e')
            self.assertIsNone(self.observe(450, **kwargs))
        self.observe(500)
        self.now += 2
        self.assertFalse(self.detector.press('w'))

    def test_cached_sample_does_not_consume_key_or_regen_history(self):
        self.observe(500)
        self.detector.press('w')
        self.assertIsNone(self.observe(500, dt=0))
        self.assertEqual(self.observe(475), 'w')


if __name__ == '__main__':
    unittest.main()
