# Twitch redemptions

The supported v2 `hub.py` owns one redemption service at **127.0.0.1:7442**.
Open **Twitch Redemptions** in the Hub sidebar to manage it. This service receives
Channel Points redemptions through Twitch EventSub. Raid/sub/follow alerts remain
in `mini projects/twitch_celebrations`; soundboard audio lives in `lib/browser_effects`.

| File | Responsibility |
| --- | --- |
| `catalog.py` | Six default cheap rewards and asset allowlist |
| `config.py` | Validated per-reward appearance and enable settings |
| `storage.py` | External JSON persistence and redemption results |
| `transport.py` | Owner OAuth, refresh, hourly validation, EventSub reconnection |
| `rewards.py` | Install missing application-owned rewards and synchronize availability |
| `engine.py` | Deduplication, bounded playback, expiry and fulfillment |
| `obs_source.py` | Reuse/repair OBS browser input without changing scenes |
| `http_server.py` | Loopback controls and capability-protected overlay API |
| `service.py` | Hub-owned threads and shutdown |
| `hub_ui/viewer_rewards/` | Separate control, overlay, renderer and styles |

The existing credentials, overlay key, settings and SQLite database stay at
`LOCALAPPDATA/StreamingHub/viewer-rewards`. Existing reward IDs, Twitch prices,
titles and unrelated JSON fields are retained. Local overrides are stored under
`settings.json.effects`; credentials are never served by the UI or committed.
Settings history is captured under the existing external settings-history root.
`lib/viewer_rewards.py` is only a compatibility import, not a second service.

Six defaults last 1–2 seconds. The control page allows 0.4–2 second duration,
label, accent, animation and per-reward enable edits. Preview is local; **Test in
OBS** uses saved settings without spending points or fulfilling a Twitch redeem.
The effects are silent and clip out the central gameplay rectangle. Other rewards
retain their human-performed actions. This module never executes viewer text.

`Hub Viewer Stickers` stays loaded and transparent while idle, at 30 FPS. Existing
transforms, filters and faders are retained. A startup/recovery worker refreshes an
existing source if its heartbeat disappears; it never switches scenes. The explicit
add/repair action creates a missing source in the current scene. Add the same input
to any additional scenes needing viewer effects rather than creating duplicates.

The service pauses only its mapped rewards when disconnected, globally paused,
individually disabled or missing a visible/active OBS heartbeat. OBS visibility
callbacks cancel interrupted effects and report a failed display; a hidden input
does not consume new effects. It resumes rewards when ready.
One effect can be pending with a three-second admission interval; per-reward Twitch
cooldowns also apply. Bursts, timeouts, failures and interrupted requests stay in
Twitch's queue for refund. Successful live effects are fulfilled only after OBS
acknowledges completion. Redemption IDs persist for duplicate protection.

Run `py -3.11 -X utf8 -m unittest tools.test_viewer_rewards tools.test_browser_effects`
for offline contracts. `tools/test_redemption_rendering.cjs` tests actual Chromium
animations, transparency, duration, acknowledgements and configuration controls.
These fixtures make no live Twitch writes and do not control the desktop.
