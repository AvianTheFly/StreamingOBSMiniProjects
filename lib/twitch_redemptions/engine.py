"""Bounded redemption playback and completion acknowledgements."""
from __future__ import annotations

import os
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from .catalog import EFFECTS
from .storage import RewardStorage
from .transport import TwitchTransport
from .rewards import RewardManagement
from .obs_source import attach_obs
from .config import effect_config


class RewardBridge(RewardStorage, TwitchTransport, RewardManagement):
    def __init__(self, stop, root=None, clock=time.monotonic):
        self.stop = stop
        self.clock = clock
        self.root = Path(root or Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "StreamingHub" / "viewer-rewards")
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.api_lock = threading.RLock()
        self.csrf = secrets.token_urlsafe(32)
        self.overlay_key = self._read("overlay-key.json", {}).get("key") or secrets.token_urlsafe(32)
        self._write("overlay-key.json", {"key": self.overlay_key})
        self.config = self._read("settings.json", {"enabled": False, "rewards": {}})
        self.tokens = self._read("credentials.json", {})
        self.db = sqlite3.connect(self.root / "redemptions.sqlite", check_same_thread=False)
        self.db.execute("CREATE TABLE IF NOT EXISTS redemptions (id TEXT PRIMARY KEY, reward TEXT, status TEXT, created REAL)")
        self.db.execute("UPDATE redemptions SET status='interrupted: review in Twitch' WHERE status='queued'")
        self.db.commit()
        self.pending = None
        self.last_play = -1000.0
        self.last_obs = -1000.0
        self.last_browser = -1000.0
        self.connected = False
        self.message = "Connect Twitch to enable automatic stickers."
        self.auth = None
        self.auth_busy = False
        self.socket = None
        self.paused_remote = None
        self.reward_details = {}
        self.last_effect = None


    def status(self):
        with self.lock:
            rows = self.db.execute("SELECT id,reward,status FROM redemptions ORDER BY created DESC LIMIT 12").fetchall()
            return dict(connected=self.connected, enabled=self.config["enabled"],
                        overlay_ready=self.clock() - self.last_obs < 4,
                        message=self.message, auth=self.auth,
                        effects=[dict(key=k, **effect_config(self.config, k),
                                      installed=k in self.config.get('rewards', {}),
                                      twitch=self.reward_details.get(k)) for k in EFFECTS],
                        installed=len(self.config.get("rewards", {})),
                        last_effect=self.last_effect,
                        recent=[dict(id=r[0], reward=r[1], status=r[2]) for r in rows])


    def receive(self, event):
        if event.get("broadcaster_user_id") != os.environ.get("TWITCH_BROADCASTER_ID"):
            return False
        key = next((k for k, rid in self.config["rewards"].items() if rid == event.get("reward", {}).get("id")), None)
        if key not in EFFECTS or event.get("status") != "unfulfilled" or not event.get("id"):
            return False
        with self.lock:
            try:
                self.db.execute("INSERT INTO redemptions VALUES (?,?,?,?)", (event["id"], event["reward"]["id"], "received", time.time()))
                self.db.commit()
            except sqlite3.IntegrityError:
                return False
            try:
                self.enqueue(key, event["id"], live=True)
            except RuntimeError as exc:
                self._result(event["id"], str(exc) + ": refund in Twitch")
                return False
        return True


    def enqueue(self, key, redemption_id=None, live=False):
        if key not in EFFECTS:
            raise ValueError("Unknown sticker.")
        with self.lock:
            now = self.clock()
            self.expire_pending()
            if live and not self.config["enabled"]:
                raise RuntimeError("Effects paused")
            if live and not effect_config(self.config, key)['enabled']:
                raise RuntimeError('Reward paused')
            if now - self.last_obs > 4:
                raise RuntimeError("OBS overlay offline")
            if self.pending or now - self.last_play < 3:
                raise RuntimeError("Effects busy")
            self.last_play = now
            self.pending = dict(id=redemption_id or "test-" + secrets.token_hex(8), key=key,
                                expires=now + 8, live=live, delivered=False,
                                effect=effect_config(self.config, key))
            self.last_effect = dict(id=self.pending['id'], key=key, status='queued', test=not live)
            if live:
                self._result(redemption_id, "queued")
            return self.pending["id"]


    def next_effect(self, active=True):
        with self.lock:
            self.last_browser = self.clock()
            if not active:
                self.last_obs = -1000.0
                return None
            self.last_obs = self.clock()
            self.expire_pending()
            if not self.pending or self.pending["delivered"]:
                return None
            self.pending["delivered"] = True
            self.last_effect['status'] = 'displaying'
            return dict(id=self.pending["id"], key=self.pending["key"], **self.pending['effect'])

    def expire_pending(self):
        with self.lock:
            if self.pending and self.pending['expires'] < self.clock():
                if self.pending['live']:
                    self._result(self.pending['id'], 'overlay timed out: refund in Twitch')
                self.last_effect['status'] = 'timed out'
                self.pending = None


    def acknowledge(self, rid, status='played'):
        with self.lock:
            item = self.pending
            if not item or item["id"] != rid or not item["delivered"] or item["expires"] < self.clock():
                return
            self.pending = None
            self.last_effect['status'] = 'played' if status == 'played' else 'failed'
        if status != 'played':
            if item['live']:
                with self.lock:
                    self._result(rid, 'overlay failed: refund in Twitch')
            return
        if item["live"]:
            try:
                self.api("PATCH", "channel_points/custom_rewards/redemptions", params={
                    "broadcaster_id": os.environ["TWITCH_BROADCASTER_ID"],
                    "reward_id": self.config["rewards"][item["key"]], "id": rid}, json={"status": "FULFILLED"})
                result = "fulfilled"
            except RuntimeError:
                result = "played; mark fulfilled in Twitch"
            with self.lock:
                self._result(rid, result)


    def attach_obs(self):
        return attach_obs(self)
