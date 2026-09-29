"""Offline tests: no OBS operations, no Twitch writes, no personal settings."""
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.viewer_rewards import RewardBridge, EFFECTS


class ViewerRewardsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"TWITCH_BROADCASTER_ID": "owner"})
        self.env.start()
        self.now = 100.0
        self.b = RewardBridge(threading.Event(), self.tmp.name, lambda: self.now)
        self.b.config = {"enabled": True, "rewards": {"bear": "reward1"}}
        self.b.next_effect()

    def tearDown(self):
        self.b.db.close()
        self.env.stop()
        self.tmp.cleanup()

    def event(self, rid="redeem1", **kwargs):
        return dict(id=rid, broadcaster_user_id="owner", status="unfulfilled", reward={"id": "reward1"}, **kwargs)

    def test_only_explicit_ids_can_control_overlay(self):
        event = self.event(user_input='../../anything; set volume 100')
        event["reward"]["id"] = "unmapped"
        self.assertFalse(self.b.receive(event))
        event["reward"]["id"] = "reward1"
        event["broadcaster_user_id"] = "someone-else"
        self.assertFalse(self.b.receive(event))
        self.assertIsNone(self.b.pending)

    def test_duplicate_persists_across_restart(self):
        self.assertTrue(self.b.receive(self.event()))
        self.assertFalse(self.b.receive(self.event()))
        self.b.db.close()
        self.b = RewardBridge(threading.Event(), self.tmp.name, lambda: self.now)
        self.b.config = {"enabled": True, "rewards": {"bear": "reward1"}}
        self.assertFalse(self.b.receive(self.event()))
        self.assertIn("interrupted", self.b.status()["recent"][0]["status"])

    def test_requires_overlay_and_operator_enable(self):
        self.b.config["enabled"] = False
        self.assertFalse(self.b.receive(self.event()))
        self.b.config["enabled"] = True
        self.now += 10
        self.assertFalse(self.b.receive(self.event("redeem2")))
        self.assertIsNone(self.b.pending)

    def test_ack_required_before_fulfilling(self):
        calls = []
        self.b.api = lambda *a, **kw: calls.append((a, kw))
        self.b.receive(self.event())
        self.b.acknowledge("redeem1")
        self.assertEqual(calls, [])
        effect = self.b.next_effect()
        self.assertEqual(effect["duration"], 1000)
        self.assertIsNone(self.b.next_effect())
        self.b.acknowledge("other-id")
        self.assertEqual(calls, [])
        self.b.acknowledge("redeem1")
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][1]["json"], {"status": "FULFILLED"})

    def test_busy_and_timeout_remain_refundable(self):
        self.b.receive(self.event())
        self.assertFalse(self.b.receive(self.event("redeem2")))
        self.now += 10
        self.b.next_effect()
        self.assertIsNone(self.b.pending)
        self.assertTrue(all("refund" in x["status"] for x in self.b.status()["recent"]))

    def test_test_button_never_fulfills_a_twitch_redemption(self):
        self.b.api = lambda *a, **kw: self.fail("Unexpected Twitch call")
        self.b.enqueue("bear")
        e = self.b.next_effect()
        self.b.acknowledge(e["id"])
        self.assertEqual(self.b.status()["recent"], [])

    def test_effect_bounds_and_assets(self):
        from lib.viewer_rewards import ASSETS
        for effect in EFFECTS.values():
            self.assertLessEqual(effect["duration"], 2000)
            self.assertLessEqual(effect["cost"], 50)
            self.assertTrue((ASSETS / effect["image"]).is_file())


if __name__ == "__main__":
    unittest.main()
