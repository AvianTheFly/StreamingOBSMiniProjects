# League API alerts

## Cinematic match screens

The production page has a cinematic match-screen checkbox, three preview buttons,
and timing controls. The matching, text-free Udyr temple artwork is stored in
`media/match-screens/`: `game-start.png`, `victory.png`, and `defeat.png`.
These are silent still images covering the 1920×1080 game canvas through the
existing League API browser source. They do not change saved clip banks, audio
levels, OBS filters, source transforms, or lobby content.

The picture and its restrained matching border are one composed presentation.
`production/web/match-screens.js` owns their shared clock, delay, fade and expiry;
it uses `ProductionScene` for caption-free edge artwork above the picture.
Other production layers, clip slots and level sprites yield during the entire
match-screen sequence, including the result delay. Successful clears/replacements
win immediately; transport failure retains only the original finite deadline.

GameStart displays the original storm temple for five seconds. A fresh observed
GameEnd with Result Win or Lose selects victory or defeat, waits 1.5 seconds,
then displays the corresponding artwork for five seconds before automatic
post-game routing proceeds. Both client scene automation and the fallback
game-disconnected lobby return respect that deadline. Ordinary game API loss
does not clear the result; the browser also expires it if its HTTP service fails.

If the client end phase arrives first, routing reserves at most two seconds for
an in-flight result. Without a known result it resumes without inventing victory
or defeat. Joining/reconnecting to old game history does not replay artwork.
Duplicate results never extend the deadline. Instant Replay retains its existing
client-router protection. Previews do not change scenes or delay live routing;
Clear cancels the art and releases its hold. Timing is configurable in production
settings with `result_delay_seconds`, `result_hold_seconds`, and
`start_hold_seconds`; `match_screens` enables the feature. The production and
match-lifecycle toggles apply, as does the global pause control. The clip-alert
visibility switch is independent and can stay off while production art is on.

Implementation: `match_screens.py` owns deadlines and result state; the Service
feeds it fresh detector candidates; `production/web/match-screens.js` displays the
plates. `test_match_screens.py` exercises API-loss, result-before/after-client
ordering, deadline, deduplication, and fallback return cancellation.
`tools/test_match_screens.cjs` verifies the actual browser output and expiry.

Production borders are now the default Hub page. See [production/README.md](production/README.md)
for dragon atmosphere, short objective celebrations, controls, code ownership and
the API review. The sections below describe the optional clip editor, linked from
the production page. Its saved media banks and layout are preserved.

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
- **Variety · random media pool** adds alternatives to the main file. Drop several
  files or choose existing library media; each card has its own duration and start
  offset. Save the event to apply. Random selection avoids the previous pick for
  that event and prefers files outside the last three reactions when possible.
  Turn random selection off to play only the main file, retaining the alternatives.
  Pools are saved separately for My setup and Meme pack; volume remains event-owned.
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
Optional clip cards use the saved layout on the 1920×1080 canvas. Idle is fully
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
focus on the local player; objectives, structures and aces celebrate resolved friendly
ownership. First blood is local. Ambiguous identities remain unknown.

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

## Death reactions: maintenance map

The League module shows the existing DeathBorder once for 2.5 seconds
(`league/config.py`, `DEATH_DISPLAY_DURATION`). Its existing respawn handler
also hides the border. No source transforms or asset settings are changed.

`death_reactions.py` owns the pure death lifecycle, timing constants, and two
curated pools of existing meme videos. After the splash, a reserved corner card
rotates every six seconds without immediate repeats. The existing alert layout
and Death event clip volume apply; OBS master volume is untouched.

A local kill/assist or personally credited objective within eight seconds before
or after death latches Worth it until respawn. A teammate killing your actual
killer within eight seconds after death also counts. Unrelated teammate kills
and objectives do not count.
Enemy/unknown objectives do not count. This is temporal correlation, not proof
that the death caused the payoff; Riot provides no fight coordinates.
New evidence immediately replaces a bad-death clip. Respawn, game reset,
reconnect baseline, and clear remove the current reaction. Joining while dead
waits until the next life. Pausing or hiding alerts hides reactions too.

Integration: Engine feeds snapshots into the classifier; Service.snapshot maps
its media through the existing asset endpoint and reserves the first of three
browser cards. Ordinary event scheduling remains independent. Edit POOLS for
media selection and the timing constants for pacing; keep splash timing in sync
with league/config.py. Regression coverage lives in test_death_reactions.py.

## Automatic meme context

Built-in objective/structure celebrations require confirmed allied ownership;
first blood requires the local recipient and ace requires the allied acing team.
Explicit custom event rules keep their configured scope. Low-health kill reactions
require a living player and an event at most two seconds old. Inferred fight
reactions require local kill/death/assist involvement and a living local player.
Escape reactions require recent damage, recovery above 20% health and eight
seconds without further detected damage; shopping, death and polling gaps cancel
the pending inference. These remain approximate signals, not location evidence.
Saved media pools, presentation banks, volumes and layouts are unchanged.

## Quiet autoplay tuning (2026-09-16)

The saved meme setup now uses one card, a global 18-second start-to-start gap,
and 25-second individual kill/death cooldowns. Ordinary events cannot interrupt
an active card. Higher-priority events in the same family (kill to multikill)
and victory/defeat may interrupt; skipped events are discarded, never queued.
Manual previews bypass the global gap. History explains spacing suppressions.

Only local kills/deaths/multikills, local first blood, allied ace, first turret,
inhibitor, Baron, elemental dragons, objective steals and match results are
selected. Routine health, shopping, assists, respawns and inferred fights are
disabled. Level-up retains its sprites, with only its meme autoplay disabled.
Each selected event has one fixed primary clip and an on-video event caption.
Alternate pools are retained but disabled; personal presentation data, faders,
asset offsets and layout have not been replaced.

`autoplay_gap_seconds` controls global spacing; `death_reactions_enabled=false`
disables the separate rotating death cards. Each rule's optional `autoplay=false`
suppresses automatic cards while retaining its non-card behavior and previews.
The older death classifier remains available but is off in the saved setup:
one ordinary death clip replaces the sequence of guessed payoff reactions.
## League client scene automation

`client_scenes.json` enables a separate, read-only client watcher. It discovers the
League installation's lockfile, subscribes to the local gameflow and champion
selection event stream, and refreshes the active draft once per second as well as
on relevant events. Credentials remain in memory and refresh from the lockfile
on reconnect. No Riot API key or game actions are required.

Matchmaking, ready checks, planning and incomplete bans select one available
location in `Lobbies` from the shared published catalog, hiding the central
desktop capture and Tavern's separate `league client` view. The location stays
fixed through ready checks and bans; each new entry avoids the previous location.
When all bans complete (or a queue has no bans and picks begin), it selects
`League Champion Select World`, a separate scene with the custom browser source
and the existing `FaceCamWithProps` scene source behind a camera-shaped opening
in the artwork. The original `LOL champ select`
group and all its transforms remain available. **Between games** selects either
a fresh chatting lobby (this checkout's configured mode) or the preserved
`idle_scene`, such as `just screen`. Leaving queue, dodging, or ending a game
uses that mode; post-game routing waits for the cinematic result hold.
Game loading, play and reconnect are left to the
existing game scene automation. The watcher keeps the private scene if the
League client connection temporarily fails. A confirmed idle transition never
exposes the desktop in chatting-lobby mode. Show screen reveals the shared
desktop in the current lobby; it remains visible through unchanged idle updates.

The production page's **Hide screen now** button enters a private location before
clicking Find Match, eliminating any lead-time exposure. It holds that view until
queue starts or **Show screen** is clicked. Routing applies once per target
transition; periodic updates never reclaim an unchanged queue, draft or idle
view. A newer deliberate scene choice invalidates a pending return, including
choices made during slow client reads, cinematic holds, or temporary playback.
An owned replay/temporary return does not invalidate the workflow; the route
waits until playback ends. Failed OBS updates retry while the intent is current.
Source transforms, filters, audio levels and other lobby content are preserved.
The page includes a separate client automation checkbox and live status. Pausing
it leaves the current OBS scene in place. Scene/source names can be customized
in `client_scenes.json`; `idle_presentation` chooses `lobby` or `scene` while
retaining `idle_scene`. Settings backups include that file. Existing configs
without the new field keep their configured scene mode.

### Custom champion select world

The live browser scene is `http://127.0.0.1:7431/champ-select`. URLs with
`?demo=1` show fixed sample champions and chat for preview only. The League production
controls at `/production` show previews of five worlds and a theme selector;
`random` chooses a new world per draft. The local team is always left, the enemy
team right. Each has five portrait picks and five small bans. Champion portraits,
ban icons, and names are cached from Riot Data Dragon in `media/champion-portraits`,
`media/champions`, and `champion_catalog.json`. Refresh the cache after a League
patch with `py -3.11 tools/cache_league_champions.py` from the repository root.

The watcher uses the already connected `/lol-champ-select/v1/session` stream to
render tentative and completed picks, completed bans, and the client's countdown
using its millisecond timer and turn timestamp. It
reads only the active champion-select chat conversation; direct messages are not
shown. The browser page receives no lockfile credentials or chat room password.
During planning and bans the overlay state omits picks, bans, and chat. The OBS
scene still switches only when the existing ban-completion route permits it.
`tools/preview_champ_select.cjs` renders all five demo themes without a League
client and checks the 5+5 picks, 5+5 bans, portraits, and reveal transitions.
If the OBS scene is removed, run `py -3.11 tools/install_champ_select_scene.py`
from the repository root while OBS is open to recreate the browser and facecam
scene items. It snapshots settings first and leaves the older champ-select group
untouched.
