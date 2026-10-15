# League API alerts

## Purchase detection research — checked October 13, 2026

The selected live flow is the existing shared Live Client snapshot → local-player
inventory and gold → recipe accounting → bounded celebration queue → existing OBS
browser. Purchases remain **inferred**. Riot documents inventory and gold endpoints,
but no live shop-transaction endpoint. One combined snapshot also avoids creating
independent inventory/gold requests. The Hub already needs the other game fields.
[Riot Live Client documentation](https://developer.riotgames.com/docs/lol#live-client-data-api).

The cached catalog and North America's item realm both report **16.20.1**. A
read-only comparison against this installed client's
`/lol-game-data/assets/v1/items.json` found 870 matching item IDs, with no differences
in total prices or direct recipes. The installed-client catalog is a useful
cross-check, not a live transaction source. Riot provides fewer guarantees for
LCU endpoints. Data Dragon can lag patches, so the preparation tool now selects
the regional item version instead of the newest global release. An explicit
`--version` is available for controlled patch maintenance.
[Riot versioning guidance](https://developer.riotgames.com/docs/lol#data-dragon),
[North American realm](https://ddragon.leagueoflegends.com/realms/na.json).

Sources considered:

| Source | Value for this feature | Decision |
| --- | --- | --- |
| Live Client API | Current local inventory, stacks, gold and runes | Primary live input, through the existing shared cache |
| Data Dragon and installed-client item data | IDs, prices, components and transformation relationships | Use cached recipes and local icons; verify against the installed patch |
| Overwolf GEP | Documents live-client data plus current/total gold; no dedicated purchase event found in its current League event list | Potential experiment for better gold accounting, not a demonstrated transaction feed or an installed dependency |
| Match-v5 timeline | Post-match purchase, destruction, sale and undo history | Useful future validation against completed matches; not suitable for live popup timing |
| Screen/OCR observation | Could corroborate the player's visible shop actions | Secondary experiment only; UI scale, hidden shop and fast actions create ambiguity |
| Game-memory readers | Older integrations may derive extra events this way | Do not build a new dependency on this route |

[Overwolf's current League event reference](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/league-of-legends/)
documents `gold` and `total_gold`; their live availability and accounting semantics
were not tested here. Riot began blocking unknown third-party memory access on
October 6, with a transition period for approved existing tools through April
2027. This makes older memory-based guides a poor foundation for new work.
[Riot's September 29 notice](https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps).

Current corrections:

- Reconcile up to eight snapshots across 1.25 seconds, covering gold-first,
  inventory-first, and component-removal-before-result updates. Consumed evidence
  cannot trigger another purchase. Invalid or discontinuous observations discard
  pending evidence; reconnects and permission gates retain their existing resets.
- Subtract consumed components recursively. Zero-cost boot/support upgrades are
  ignored even when another purchase spends gold in the same interval. A purchase
  immediately transforming into its final item can display that observed final ID.
  Riot explicitly documents free mid-lane boot upgrades, including on purchase.
  [26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/).
- Account for known sales, stack quantities and one-unit returns. Count changes
  ignore slot order. Magical Footwear can fund ordinary boot upgrade recipes.
- Account for Cash Back when rune 8321 is present. The verified current rate is
  **7.5%**, not the 6% still shown by some older references. Legendary eligibility
  is inferred from the terminal paid recipe graph with boots/consumables/support
  categories excluded; it is not an authoritative rarity field. The rebate can
  exceed an item's remaining combine cost, producing a net gold increase.
  [26.3 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-3-notes/),
  [16.20.1 rune data](https://ddragon.leagueoflegends.com/cdn/16.20.1/data/en_US/runesReforged.json).
- Allow 40-gold control wards when a completed support quest item is observed.
  This only helps if the ward is actually represented in the live inventory;
  visibility of the role quest slot has not been verified in a running match.
  [26.1 support changes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/).

Limits: buy-and-undo entirely between polls, immediately consumed purchases,
unexposed quest slots, concurrent large gold rewards, mode-specific discounts,
and mismatched patch data can still cause misses or ambiguity. Same-poll events
do not reveal true click order. Sale credits and rarity are heuristic. The five
gold accounting allowance covers only small passive-income/rounding differences.
Patch-specific refund and discount rules need review when the catalog is updated.

The right next validation is a controlled Practice Tool session covering direct
buys, component combines, multi-buys, sale/undo/rebuy, Cash Back and quest upgrades,
comparing visible shop actions with the detector. No live match was available
during this review, so no measured accuracy percentage is claimed. After-match
timeline comparison would add evidence, but should reconcile undos carefully:
an open July 2026 report describes missing item IDs on tier-three boot undos.
This is a reported API defect, not independently reproduced here.
[Riot developer-relations issue 1174](https://github.com/RiotGames/developer-relations/issues/1174).

### Sales and undo follow-up — October 13, 2026

The initial cancellation rule required a disappearance and a gold increase. That
missed selling while buying something more expensive, and undoing a Cash Back
combine that originally increased gold. The detector now keeps up to 64 inferred
unit receipts for 120 seconds. This is a bounded inference horizon, not a claim
about how long the game's Undo button remains available.

| Observed action | Popup behavior |
| --- | --- |
| Sell an item | Cancel that many matching queued/current purchase cues when the gold balance supports a sale |
| Undo an observed purchase | Cancel its original cue identity, including a completed recipe or immediate boot transformation |
| Components return after undo | Do not celebrate those restored components as purchases |
| Undo an observed sale | Restore inventory silently; do not replay the old purchase chime |
| Buy the item again at its purchase price | Create a fresh purchase cue |
| Sell/undo one item and buy another in one poll | Account for the combined balance; only the new purchase gets a cue |
| Consume an item or complete a recipe | A disappearance alone does not establish a sale or refund |

Each purchase receipt records its observed result, consumed component counts,
ordinary and rune-adjusted cost possibilities, and popup identity. Sale receipts
use item-specific catalog proceeds. Matching an inverse inventory change also
requires the corresponding gold balance, with five gold of rounding/passive
income allowance. Reversed receipts and snapshot evidence are consumed once.
Normal component consumption takes priority over a financially equivalent
undo-and-repurchase interpretation. Gold-first and inventory-first updates retain
the existing 1.25-second correlation window. Duplicate snapshots preserve history;
invalid data, discontinuities, reconnects and existing pause gates discard it.

The current 16.20.1 data gives Boots a 300 purchase/210 sale price, Health Potion
50/20, and Slightly Magical Footwear a 90 sale value. A universal 70% resale rule
would therefore be wrong. The detector uses the per-item `gold.sell` data.
[Riot item catalog](https://ddragon.leagueoflegends.com/cdn/16.20.1/data/en_US/item.json),
[Riot's Magical Footwear sale change](https://www.leagueoflegends.com/en-ph/news/game-updates/patch-13-4-notes/).

Riot's 26.15 notes explicitly fixed the inability to undo mid-lane tier-three
boots. A later open developer report says the post-match undo event can contain
zero item IDs. The live implementation consequently matches its own observations
and does not depend on post-match IDs or assume a positive refund.
[26.15 bug fix](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-15-notes/),
[reported timeline defect](https://github.com/RiotGames/developer-relations/issues/1174).

Cash Back sale accounting considers both nominal proceeds and proceeds minus the
modeled rebate; a matching balance is required. These are inference alternatives,
not verified live transaction fields. Multiple simultaneous actions, coincident
gold rewards, partially observed rebate timing, and old/missing history can remain
ambiguous. Actions completed entirely between observations remain invisible.
An already heard chime cannot be taken back; detection stops the remaining cue
and audio on the next overlay update. No sale/undo sound or new overlay is added.
Offline tests cover these reversals; the browser test verifies active sale/undo
cancellation, silence on undo-sale and a fresh chime on a real repurchase. Live
Practice Tool validation remains outstanding.

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
An explicit lobby-screen choice takes precedence over the legacy desktop gate;
the installed default is the existing Udyr animation. The Hub's **Lobby / queue**
view offers Udyr animation, League client, Desktop and Google Chrome. Choices
change references inside the shared screen scene, preserving original inputs,
filters, audio levels and each lobby's saved screen placement.
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

### Queue timer and roles

The existing **League Queue Badge** browser source serves
`http://127.0.0.1:7431/stage/queue` at 1920 × 1080. It reads the client's
`timeInQueue` and local primary/secondary position preferences through the existing
LCU transport. Initial matchmaking stays aligned with the client clock. The
timer continues through ready check, planning and bans; completed bans freeze and
hide it as the draft scene opens. Modes without bans wait for confirmed picking.
An automatic dodge/requeue retains the original journey even if the client clock
resets. Confirmed cancellation clears the timer immediately; an uncertain Lobby
transition gets a two-second bridge before reset. Unavailable client data hides
the overlay, and unavailable preferences are labeled rather than invented.

The Hub's **Queue timer** chooser offers Bear thunder claws, Turtle protection,
Ram resolve and Phoenix storm, plus timed rotation. Each theme uses
an orbiting, faceted spirit relic with opening crests, engraved claws, growing
laurels, shell petals or feather coronas and a distinct elemental track: thunder pulses,
flowing water, seismic ridges or braided wind. The larger phase heading, softly
revealed clock digits and role chips sit in a clear central column; redundant
spirit subtitles and match-finding filler are removed. The right side is a
persistent miniature world: a rotating ice cathedral with travelling currents,
a jade lotus garden with curved petals and swimming koi, an orbiting forge with
bevelled tools and moving stonework, or a phoenix aviary with articulated wings,
banking flight and trailing feathers. Depth, camera drift, material shading and
continuous paths keep the scenery moving as its choreography changes.
Original lore-inspired tableaux now inhabit these worlds: a spectral storm-bear
with flowing fur and thunder claws; a swimming jade turtle with articulated
flippers, prayer beads and protective veils; immense ram horns above a volcanic
forge; and a cryophoenix surrounded by branching frost currents and rebirth
crystals. A small spirit-walker channels currents into each apparition, with
swaying talismans in the bear and turtle scenes. These are artistic interpretations
informed by [Riot's Udyr design notes](https://www.leagueoflegends.com/en-gb/news/dev/udyr-vgu-rebuilding-the-spirit-walker/).
The retained turtle draws from [Spirit Guard's Ionian protective spirit](https://www.leagueoflegends.com/en-us/news/game-updates/updating-spirit-guard-udyr/);
the four-theme selection deliberately mixes that inspiration with Freljord imagery.
Each spirit has twelve acts: four choreography variations and eight supporting
effects. Each 45-second appearance
chooses two different performances and one supporting effect in random order.
Crystal formations open into bridges and crowns; lotus petals rise into canopies;
the forge changes its orbit and vertical rhythm; phoenix flight opens into a
flock, dive or silk wake. Nineteen-second gestures overlap for four seconds,
blending the same geometry instead of disappearing between short performances.
Supporting effects include constellations, auroras, shell waves and feather storms.
Text masks keep the clock column clear.
**Shuffle spirits · 45s** visits all four spirits in shuffled batches with a
four-second moving crossfade and no immediate repeat between batches. A browser-session
seed and the journey identity choose the schedule. A monotonic artwork clock is
seeded once from queue time; later API clock corrections affect the timer digits
without resetting or seeking the animation. Picking a named spirit keeps it fixed while its
three-effect selection changes every 45 seconds.
Reduced-motion preferences keep the symbol and backdrop static. Hidden
OBS sources stop polling and drawing. **Preview timer · off stream** is a private
sample with its own spirit picker, Play/Pause, **New mix** and **Explore loop**
scrubber. **Explore act** blends into any of the 48 acts and keeps it moving
continuously; starred acts are the four choreography variations for each world.
Choosing another act or mix preserves the motion clock. Scrubbing deliberately
seeks to the chosen moment and pauses the preview.
**New mix** restores the normal three-act appearance, listed beneath the controls.
Explore these moments without saving a theme or changing OBS. Those controls
appear only in the preview. Theme and display choices do not require a
restart or switch the program scene.

### Custom champion select world

The live browser is `http://127.0.0.1:7431/champ-select`; `?demo=1&theme=bear`
opens local rehearsal controls. The four new Udyr-inspired worlds are Thunderclaw
(bear), Jade Aegis (turtle), Golden Summit (ram), and Ash & Aurora (phoenix).
The production and Live Desk selectors offer these four; random chooses once per
draft. Retired saved choices resolve to their matching successor without rewriting
the settings file. Original earlier artwork remains available on disk.

Each side has exactly five portrait shrines and five ban sockets. Role plaques
sit above portraits and nameplates below; aliases cannot hide roles. TOP, JUNGLE,
MID, BOT and SUPPORT come from the client, with ROLE TBD for missing assignments.
The local player has a small inset diamond rather than a floating YOU label.
Team labels, live camera aperture, draft timer and team chat remain readable.
Player labels prefer the draft's exposed ranked alias, such as Gromp or Murk Wolf.
Where names are exposed, game/Riot ID names or Summoner names appear instead.
Blank or unavailable identities keep Teammate/Opponent numbers; no hidden-player
lookup is performed. Rehearsal cards show sample aliases. The LIVE badge is removed
from every draft theme.
All lettering is native browser text over text-free paintings. Role labels and
champion names use the bundled condensed font with clean strokes; larger player
aliases use Segoe UI. Two-line champion names retain a separate player line,
and the effects canvas clears the entire caption plate. Typography and long-name
fit are reviewed offline with `tools/test_champ_select_typography.cjs`.
`layout.js` owns 1920x1080 furniture coordinates, and source contacts are measured
against each new painting in `scene-map.js`.

The paintings stay still. `world-art.js` gives their basins currents, flame tongues,
ripples and reflected light. `spirit-locks.js` stages storm-claw tears, a jade
barrier, a charging molten ram and a rising ice/fire phoenix. The selected card acknowledges immediately, and its spirit hits at .18 seconds.
The portrait and frame use that same clock. `team-resonance.js` sends a material
wave outward through that team: nearby cards respond first, followed by platform
seams, basins and guardians according to distance. Two waves per team may coexist;
every new lock retains its own local impact. Heavy fragments, droplets, branching lightning and
feathers have different trajectories and lifetimes; aftermath lights the selected
shrine and its dais. Four alpha paintings retain body color instead of turning
into uniform white outlines. A bounded precomputed atlas erodes their edges into
vapor; no background image is distorted. Ban seals converge on the new ban, chat
couriers arrive at the receiving rail and ready lighting sweeps across the team.
`vfx-timing.js` owns synchronization; `vfx-ink.js` owns analytic drawing mechanics.
`world-assets.js` releases the active effect and sixteen small erosion frames with
its existing background/guest lifetime. Artwork prompts and provenance live in
`media/champ-select/vfx/provenance.json`. The read-only review is
`tools/test_champ_select_vfx.cjs`; research and phase captures are in
`output/champ-select-epic-v2/review/`.
`spirit-secrets.js` rotates three tiny discoveries per world: curious Kirby,
a pearl-stealing goose, a forge apprentice and Boo at the thermal boundary.
One ten-second act follows eight seconds of initial quiet, then quiet gaps;
draft events take priority. Hidden detail in the demo advances these variations.
No preview control sends game actions, changes scenes or saves preferences.

`world-motion.js` owns one deadline-paced 60 FPS loop and at most twenty 4.2-second cues.
`world-details.js` adds storm constellations, paired koi, lotus reflections,
sequential forge runes, molten droplets and ice/ember feathers. These analytical
details share the existing clock. `vfx-lights.js` reuses up to 32 small glow tiles
instead of allocating radial gradients for every particle every frame. DOM
response targets are cached without forced layout. The installed OBS browser
uses its authored 60 FPS. `tools/benchmark_champ_select.cjs` measures actual-stage
frame pacing; `tools/test_champ_select_resonance.cjs` checks spatial isolation
and cache lifetime.
The existing visibility poller stops requests and drawing while hidden; assets
and poses release on hiding/teardown. No mesh warping is used. Role/name plates
are cleared from the effect canvas and the camera uses its preserved aperture.
Reduced motion is static. New draft, theme or hidden return establishes a fresh
baseline, preventing replay of old locks/bans/chat. Normal routing still waits
until bans finish; the completed ban rack appears without historical impacts.

Champion art remains cached from Riot Data Dragon in `media/champion-portraits`,
`media/champions` and `champion_catalog.json`. Team chat only uses the active draft
conversation; no direct messages or client credentials reach the page.
Generated originals and the exact built-in imagegen prompts live in
`media/champ-select/udyr-originals`. Display JPEGs preserve those compositions.
Fonts and their OFL licenses ship locally under `champ_select_web/fonts`.
Run `tools/test_champ_select_alignment.cjs` and `test_champ_select_reactions.cjs`
for responsive geometry, privacy/event semantics, lifecycle and visual rehearsal.
Outputs are under `output/champ-select-spirits`.
