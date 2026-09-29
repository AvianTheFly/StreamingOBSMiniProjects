"""Manage only this application's explicitly mapped Twitch rewards."""
from __future__ import annotations

import os
import requests
from .catalog import ASSETS, EFFECTS
from .config import effect_config


class RewardManagement:
    def install_rewards(self):
        if not self.connected:
            raise RuntimeError("Connect Twitch before installing automatic rewards.")
        params = {"broadcaster_id": os.environ["TWITCH_BROADCASTER_ID"]}
        owned = self.api("GET", "channel_points/custom_rewards", params={**params, "only_manageable_rewards": "true"})["data"]
        for key, effect in EFFECTS.items():
            if not (ASSETS / effect["image"]).is_file():
                raise RuntimeError(f"Missing sticker asset for {effect['title']}.")
            existing = next((r for r in owned if r["id"] == self.config["rewards"].get(key)), None)
            if existing is None:
                existing = next((r for r in owned if r["title"] == effect["title"]), None)
            if existing is None:
                existing = self.api("POST", "channel_points/custom_rewards", params=params, json={
                    "title": effect["title"], "cost": effect["cost"], "background_color": effect["color"],
                    "prompt": f"Automatic small, silent sticker for {effect['duration']/1000:g}s. Requires the Hub + viewer overlay. Failed requests stay in the queue for refund.",
                    "is_enabled": True, "is_global_cooldown_enabled": True, "global_cooldown_seconds": 10,
                    "is_max_per_stream_enabled": True, "max_per_stream": 100,
                    "is_max_per_user_per_stream_enabled": True, "max_per_user_per_stream": 20,
                    "should_redemptions_skip_request_queue": False,
                })["data"][0]
            self.config["rewards"][key] = existing["id"]
            self.api("PATCH", "channel_points/custom_rewards", params={**params, "id": existing["id"]}, json={"is_paused": True})
            with self.lock:
                self._write("settings.json", self.config)
        self.message = 'Automatic rewards installed. They activate when effects are enabled and OBS is ready.'
        self.paused_remote = None

    def refresh_rewards(self):
        owned = self.api('GET', 'channel_points/custom_rewards', params={
            'broadcaster_id': os.environ['TWITCH_BROADCASTER_ID'], 'only_manageable_rewards': 'true'})['data']
        by_id = {r['id']: r for r in owned}
        self.reward_details = {key: {field: by_id[rid][field] for field in ('title', 'cost', 'is_paused', 'is_enabled')}
                               for key, rid in self.config.get('rewards', {}).items() if rid in by_id}


    def sync_availability(self):
        """Pause only our rewards if the bridge/overlay is unavailable."""
        while not self.stop.is_set():
            self.expire_pending()
            ready = self.connected and self.config['enabled'] and self.clock() - self.last_obs < 4
            desired = {key: not (ready and effect_config(self.config, key)['enabled'])
                       for key in self.config.get('rewards', {}) if key in EFFECTS}
            if self.tokens and desired and self.paused_remote != desired:
                try:
                    for key, paused in desired.items():
                        rid = self.config['rewards'][key]
                        self.api("PATCH", "channel_points/custom_rewards", params={
                            "broadcaster_id": os.environ["TWITCH_BROADCASTER_ID"], "id": rid}, json={"is_paused": paused})
                    self.paused_remote = desired
                    self.refresh_rewards()
                except (RuntimeError, requests.RequestException):
                    pass
            self.stop.wait(5)
