# League API alerts

## Use the Hub editor

Start the normal **Run Hub.bat**, then choose **League API Alerts** in the sidebar,
or open http://localhost:7420/#projects/league_api. The old League page also links here.
The editor starts/reuses the alert service as needed. All routine changes are saved
from this page; editing JSON is no longer necessary.

- Select any event to read its actual detection conditions and uncertainty.
- Upload a media file with the file picker, or select an existing library asset.
  Uploads are local copies (up to 256 MB); the original file is untouched.
- Change display name, enabled state, clip volume, start offset, looping, duration,
  priority or cooldown, then **Save event**. **Save & play in OBS** also previews it.
- Choose **Hello World placeholder** to unassign media. Files stay in the library.
- **New rule** builds either a Riot event filter or a local snapshot threshold rule.
  For example, health crossing below 15%, or DragonKill with DragonType equal to Elder.
  Built-in detection formulas are explained; create a custom rule and disable the
  built-in event when you need a different threshold. Custom rules can be removed.
- The silent monitor shows the live three-slot composition. Local asset previews have
  separate playback controls. Detection activity explains displayed/dropped/cooldown events.
- **Pause automatic alerts** is persistent; previews still work while paused.
- The OBS master fader and mute directly control the single browser source, using the
  shared OBS boundary. The editor reads OBS every 1.2 seconds and never resets its fader
  at startup or on event playback. The latest OBS or frontend write therefore wins.
  Clip volume is an additional saved per-event multiplier before that master fader.

Settings are saved atomically with a revision check to prevent one editor window from
silently overwriting another. Invalid values are rejected. Config changes survive restart.
Custom snapshot rules skip missing fields and reconnect baselines. Their health changes
can include death/respawn; this is shown in the rule builder.

One browser source, `League API Alerts`, in your existing `League API` scene.
Three reusable cards appear on the right of the 1920×1080 canvas. Idle is fully
transparent. No game or scene switching, recording, or replay saving is performed.

## Run

League API Alerts is a normal Hub module. Double-click **Run Hub.bat**; it starts
alongside the other streaming modules and stops when the Hub stops. There is no
separate League launcher. Open the editor from the Hub sidebar.

- Control/preview page: http://127.0.0.1:7431 (preview buttons also play in OBS).
- If the source needs recreating: `node obs/league_api_setup.mjs` (Node 22+ and OBS WebSocket enabled).
- OBS source URL: `http://127.0.0.1:7431/overlay`, 1920×1080, browser audio routed through OBS.
  Nest the League API scene in your gameplay scene wherever you want these alerts visible.

## Replace placeholders with real media

The exact checklist is **MEDIA_CHECKLIST.md**. Every event already works without media:
it displays a Hello World card with its event name and context. No assets are required to test.

1. Put files in `mini projects/league_api/media/`, or use existing absolute file paths.
2. In `alerts.json`, set the corresponding event's `media` field, for example
   `"media": "media/pentakill.webm"`. The same file can be reused for many events.
3. Prefer the frontend controls above. Manual configuration remains available for maintenance.
4. **Reload saved settings** reloads the editor state. Restart after an external JSON edit.

Supported: PNG/JPEG/WebP/GIF; WebM/MP4/MOV subject to OBS browser codec support;
MP3/WAV/OGG/M4A audio. Transparent WebM is a good fit for animated overlays.
An asset fits inside a roughly 557×248 card on a 1080p canvas; use matching proportions
or allow transparent padding. Audio-only assets retain the named placeholder card.
Missing or unsupported media falls back to the placeholder. Browser decode/play errors
also appear in the control page's `media_errors` list. Alerts are cut off at their
configured duration; shorter clips loop only when enabled in the editor. Multiple visible assets may play audio
together. Set volume to 0 for silent visual variants.

## Event coverage and defaults

All supplied direct event names have handlers, including inhibitor respawn events,
per-grub events, dragon variants, first blood, first turret and win/lose. Atakhan is
available but disabled as a legacy trigger. Champion kills, assists and multikills
focus on the local player; objectives, structures, first blood and aces are global
and include team/participant context when known. Ambiguous identities remain unknown.

Snapshot comparisons detect local level/rank increases, death/respawn, inventory
additions/removals, health/resource changes, CS milestones and vision score increases.
Inventory comparison ignores item slot order. A changed inventory is **not** proof
of an item purchase, completion, sale or consumption.

Correlation triggers are explicitly named `possible_*`: purchase/upgrade, base visit,
combat, survival after low health, clustered deaths, objective fights, power spike,
roam, consumable use and jungle activity. They use simple tunable-code heuristics,
not statistical confidence percentages. Low-HP kills refer to health at the poll,
not exact health at the instant of the kill. Teamfight means three champion deaths
within 20 seconds; objective fight means a death within 12 seconds of an objective.
These can be unrelated fights because the API has no player coordinates.

No exact spell/Flash/ultimate cast, specific camp, ward placement/location, exact
enemy gold, confirmed recall or buff ownership is fabricated. Buff timers, item
recipe completion, lane/economic lead scores and rolling farming rates are not
implemented. The control page provides objective counts and whole-game CS/minute;
these are metrics rather than repeating on-stream alerts.

Noisy/weak signals are disabled by default: ability rank-up, inventory removal,
resource spending, consumable-use guess, roam guess, jungle guess and vision activity.
Enable them individually if desired. The preview page can audition disabled events.

## Priority and lifecycle

Penta/win/loss, steals and clutch events outrank objectives and routine notifications.
Only the top three active alerts survive. Higher-priority arrivals interrupt lower
ones; dropped alerts are not queued. Related alerts share a semantic family: a
multikill replaces a kill, a steal replaces its objective, and first turret replaces
the generic turret alert. Cooldowns reduce repeated health/correlation notifications.

Polling is 0.5 seconds. The service reads Riot's local `/allgamedata`, deduplicates event
history, baselines when joining mid-match or after a polling gap, resets when the game
clock rolls back, and never replays a match history on reconnect. Unavailable API is
normal outside a game. Overlay cards expire even if the service fails. The service
listens only on loopback and serves only explicitly mapped media files.

Reference: https://developer.riotgames.com/docs/lol?from=20423&from_column=20423
plus the two supplied API notes. Current game data and actual media playback still
need verification in a live match; synthetic tests cannot prove patch-specific fields.

## Checks

From `mini projects`: `python -m unittest league_api.test_engine -v`.
The control page's five-alert preview should display only Pentakill, Objective Steal,
and Ace. Clear returns the source to transparent immediately.
