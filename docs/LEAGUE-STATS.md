# League Stats research and operation

Researched October 2, 2026. The supported application is this checkout's Hub.

## Confirmed streamer-tool examples

[StreamElements' own counter documentation](https://support.streamelements.com/hc/en-us/articles/18750902018450-Chatbot-Counters)
explicitly uses deaths and missed cannon minions as examples, with `!cannon`
incrementing a persistent counter. [Meld's League stats widget](https://meldstudio.co/gallery/league-of-legends-live-gameplay-stats/)
shows K/D/A, CS, gold, and champion level; its commands are restricted to the
streamer and moderators. [OP.GG](https://streamer-overlay.op.gg/) offers a dedicated
streamer-overlay product. These are verified product examples, not evidence that
a particular top streamer uses a given counter. Searches for individual top
streamers did not establish reliable public inventories or current lifetime
counter values. Those values should not be invented.

The useful design is an automatic personal record plus a small, trusted manual
observation system, rather than asking moderators to maintain API-readable K/D/A.

## Data sources and certainty

[Riot's League documentation](https://developer.riotgames.com/docs/lol?from=20423&from_column=20423)
documents Live Client Data on local port 2999, including player scores, inventory,
roles and game events. Its [sample response](https://static.developer.riotgames.com/docs/lol/liveclientdata_sample.json)
and [sample events](https://static.developer.riotgames.com/docs/lol/liveclientdata_events.json)
were inspected. The local League launcher API supplies account identity, game ID,
queue and post-game history. Riot explicitly says this launcher API is unsupported
for third-party applications and may change without notice. The tracker retains
data and reports unavailable endpoints rather than resetting history.

Optional [Match-v5](https://developer.riotgames.com/apis#match-v5) enrichment uses
`RIOT_API_KEY` in the Hub environment and the platform selected in tracker
preferences. No key is required for local tracking. Keys are never sent to the
browser or included in archive exports. Expired keys and rate limits retain local
records; 429 responses respect Retry-After. The official record improves fields
and role coverage when available. Old games can only be imported while their
records remain available from the client, up to 100 per requested import.

| Group | Automatically recorded when exposed | Manual / unavailable distinction |
| --- | --- | --- |
| Combat | Kills, deaths, assists, total/average K/D/A, KDA, kill participation, first blood, multi-kills, killing sprees; optional solo kills and skillshots hit/dodged | No automatic missed-skillshot judgment |
| Farming | Total CS, lane/jungle CS when separated, weighted CS/min, mean per-game CS/min, CS at 5/10/15/20/30 minutes when witnessed | No per-minion missed-last-hit event; observers report melee/ranged/cannon misses |
| Game record | Wins/losses, win rate, game length, champion, role, queue, patch, account; filters for today/session/all | A disconnection is partial, never an invented loss |
| Objectives | Personal and team dragons, Elder, Baron, Herald, grubs, Atakhan when exposed; turret/inhibitor kills, first tower, steals and assists, team aces | Team objectives differ from your personal killing blows; incomplete/unresolved event ownership can undercount live team totals |
| Nexus | `nexusKills` and `nexusTakedowns` when explicitly returned by the final record | Winning does not prove the Nexus last hit. A +50-gold change alone is not proof. `!nexus` is a separately labelled manual observation and is never added to the automatic counter |
| Economy/items | Earned/spent gold, final inventory, item frequency and observed win rate, inventory appearance observations | Transformations, free upgrades, swaps and consumables mean an observed item appearance is not an exact purchase history |
| Vision/damage | Vision score, wards placed/killed, control wards, champion/objective/turret damage, damage taken/mitigated, healing/shielding, CC time and time dead | Fields not returned stay unknown, not zero |
| Matchups | Results against enemy ADC/support and alongside your support/ADC; champion breakdowns with sample sizes | Uses reported roles, never champion stereotypes. Unknown/ambiguous roles are excluded. Item/matchup rates describe these games, not causal advantages |

## Expanded statistics and streamer controls

The second research pass adds these statistics whenever the underlying fields
are returned. [Riot's Match-v5 field changelog](https://gist.github.com/RiotTuxedo/758ee4d88693b768a880ece93cd78663)
documents spell casts, teammate healing/shielding, time dead, surrender results,
and richer timeline frames and events. Its reported role is a best guess: lane
swaps and unusual compositions can make a role-based opponent comparison imperfect.

| Addition | What it tells you | Coverage / interpretation |
| --- | --- | --- |
| Damage, gold, vision, wards, healing and damage taken per minute | Output relative to game length | Mean of completed games with each field; rates are not added into lifetime totals |
| Damage and gold share | Your contribution to your team's returned totals | Requires all five teammates and their relevant values |
| Time dead %, gold spent % | Downtime and use of earned resources | Only calculated with valid denominators |
| Q/W/E/R and summoner spell casts | How often each slot was used | Casts are not hits or accuracy; returned post-game fields only |
| Physical / magic / true damage dealt and taken | Damage composition | Champion damage and all-target damage remain separate fields |
| Longest life, largest critical strike, experience, ward purchases, structure takedowns, surrenders | Additional combat and game context | Missing fields remain unknown; best-value fields are shown as maxima |
| Personal bests, deathless games, win/loss streaks | Records across the selected filters | Completed games; unknown outcomes break streaks |
| Recent ten vs previous ten | Changes in CS/min, kills, deaths, damage/min, vision/min and gold/min | Each comparison shows its actual sample counts; partial groups are allowed |
| CS, gold and XP at 5/10/15/20/30; differences against reported lane opponent | Lane progress at fixed checkpoints | Optional Match-v5 timeline; uses a frame at or before the checkpoint, no older than 65 seconds, with actual sample time shown |
| First kill/death time, level-six time, kills/deaths before ten | Early-game milestones | Timeline events; before-ten totals require a frame reaching ten minutes |
| Purchases, sales, item destruction and undo events | Reviewable item transaction journal | Optional timeline; repeated same-time purchases are retained, and undo events are displayed explicitly |

Use **Stream sessions** to name the next stream between games. The current session
and previous boundaries survive Hub restarts. A game belongs to the session in
which it started; historical sessions have an exclusive end boundary. Select a
saved session to review it, or use All recorded / Today with champion, queue and
account filters. Session boundaries are shared across accounts; the account filter
still determines whose games are shown. The metric search narrows the large table.

**Match review** adds a note, excludes/re-includes a match in calculations, and
undoes an individual helper entry. Exclusion never deletes the archive; filtered
exports retain excluded matches and their review status. Notes and corrections
survive re-import and timeline enrichment. Conflicting note edits are rejected
instead of silently overwriting another edit. Reload to see the newer review.
Review controls show the latest 50 filtered games; JSON export includes all of them.

In **Helper permissions & preferences**, define up to 20 custom counters, for
example `bad_recall = Bad recalls` or `missed_hook = Missed hooks`. Broadcasters,
moderators and named helpers can use `!count bad_recall`, or the streamer's Hub
button. These observations share the existing global cooldown and audit journal.
Removing a definition leaves its historical counts and labels intact. Blocked
logins cannot submit observations or viewer requests; the broadcaster retains
counter authority. Named helpers are never inferred from display names.

### Viewer interaction

Any unblocked viewer can request a short overlay card with `!stats cs`, `!stats kda`,
`!stats record`, `!stats dragons`, `!stats misses`, `!stats damage`, `!stats vision`,
or `!stats streak`. These commands read the **current saved session**, even if the
dashboard or base overlay is showing another period. They do not change counters
and receive a compact threaded Twitch reply when chat writing is authorized and
chat replies are enabled. A card lasts 12 seconds; the default global cooldown is
10 seconds, and each viewer has a 60-second cooldown. A later accepted request can
replace an active card. Disable requests or dismiss the current card in the Hub.
Requests are available between games; unknown values display a dash. The request
queue, recent message IDs, user cooldown cache, and activity history are bounded.

This combines established counter and permission patterns documented in
[StreamElements counters](https://support.streamelements.com/hc/en-us/articles/18750902018450-Chatbot-Counters)
and [command management](https://support.streamelements.com/hc/en-us/articles/12252662969106-Chatbot-Commands-Overview).
Receiving commands requires no new Twitch OAuth permission. Sending replies uses
the broadcaster's optional `user:write:chat` permission. Native polls and Channel Points
predictions are future possibilities, not implemented features. [Twitch polls](https://dev.twitch.tv/docs/api/polls/)
require an eligible affiliate/partner channel and authorized poll-management access.
Other useful future additions are opt-in challenge targets, personal rank/LP history,
and comparison by patch; they need separate persistence or interaction policies.

## Riot enrichment and the stream experience

The latest pass fixes a cross-source identity assumption: a local launcher PUUID
must not be assumed equal to the public API's encrypted PUUID. [Riot's identifier
security explanation](https://www.riotgames.com/en/DevRel/player-universally-unique-identifiers-and-a-new-security-layer)
describes IDs that differ by API-key holder. The tracker now saves your locally
confirmed Riot name/tag, resolves ACCOUNT-V1 using the configured key, and checks
that verified player in the returned match. The archive retains its original
local account/game identity, with the verified API identity recorded separately.
Timeline participants are checked against that API identity. Key changes invalidate
the identity cache and require re-verification; matching champion names never
substitutes for a verified account.

**Tracker readiness → Optional Riot enrichment** shows configuration, connection,
retry countdown, pending work, and how many matches have verified records/timelines.
The **Refresh enrichment** button replans work without bypassing rate limits.
Archived matches can enrich while League is closed, once League has provided your
name and tag. One existing worker handles local collection and a bounded queue of
at most 100 recent archived matches. The worker polls live data before enrichment.
Rate-limit waits preserve queued work and do not consume retry attempts. Connection
failures use delayed retries; unavailable records are reconsidered after ten minutes.
Local match history and optional enrichment have independent status.

To enable it, sign into the [Riot Developer Portal](https://developer.riotgames.com/)
and add `RIOT_API_KEY=your_key` to this checkout's root `.env`, preserving the other
entries (especially `REPLAY_DIR`). No key was present during this implementation.
The feature reads key changes without restarting the Hub; an explicitly supplied
process-environment key takes precedence. It never writes the `.env`, places a key
in a URL, follows credential-bearing redirects, or serves the key to the browser.
Set the platform in preferences and open League once to confirm your name and tag.

[Riot's portal documentation](https://developer.riotgames.com/docs/portal) says
development keys deactivate every 24 hours and describes personal keys for personal
statistics and streaming bots. Personal keys suit this personal tracker; a public
product needs production approval. The transport reads application/method rate-limit
headers, honors Retry-After, and adds a conservative budget of 90 calls per two
minutes with at least 1.5 seconds between requests. A refused key shows a renewal
instruction rather than damaging local history. Successful live requests still
need a valid user-provided key; fixtures cover the protocol but do not prove a
current key or every current Riot endpoint works.

**Current stream at a glance** adds:

- Solo/Duo and Flex rank observations from the local client, checked periodically
  and shortly after a game. Records persist across restarts; a displayed check time
  distinguishes a saved rank from a fresh read. The launcher endpoint is unsupported
  and may change, so unavailable data stays unknown.
- Observed ladder movement since the session's first rank check. Division promotions
  count through a continuous ladder score. Master/Grandmaster/Challenger share an LP
  scale. Unranked/placement data, missing LP, or a detected season reset produce no
  movement claim. This is not a match-specific LP award. Offline play before the first
  session check is not attributed to this stream.
- A configurable farming target (default 7 CS/min) and how many completed, covered
  session games reached it. This is a personal target, not a recommended universal
  benchmark for every role/champion. Excluded games do not count.
- A last-completed-game recap, using the current saved session and its exclusions.
  Unknown fields remain unknown. Later verified enrichment updates the same recap.

Dedicated 520 × 190 OBS browser views use the existing overlay URL plus
`?view=rank`, `?view=recap`, or `?view=goal`. Viewer requests temporarily replace
that fixed view; it returns on the next poll after expiry. Viewers can request the
same information with `!stats rank`, `!stats recap`, and `!stats goal` under the
existing global/per-user cooldowns. These displays always use the current saved
session, independent of dashboard history filters.

### Streamer research and the ideas adopted

[TF Blade's verified channel video, “Return to NA! Unranked to Rank 1”](https://www.youtube.com/watch?v=smqvQ4XqXyk)
is direct evidence of a climb framed around a clear target. His [own website](https://tfblade.net/)
also links rank-race content. These support a visible climb narrative, not a claim
about his current overlay software or lifetime counter values. The adaptation here
is current rank, observed session movement, and a visible personal farming goal.

[Doublelift's verified channel, “How I got to Challenger from D1”](https://www.youtube.com/watch?v=3RMb2U_pT-o)
provides another direct example of progress presented as a climb. In a [published
first-person interview](https://www.invenglobal.com/articles/17013/thebausffs-when-i-get-top-10-in-kr-solo-queue-ill-be-expecting-a-private-apology-from-my-haters),
Thebausffs describes community-created catchphrases around solo kills and deaths.
That suggests letting a streamer choose personal counter labels and review context,
rather than assuming every death has the same meaning. Existing custom counters
and match notes already support that idea. These are historical content patterns;
the sources do not reveal either streamer's current counter software or totals.

[Kudos' League Counter](https://kudos.tv/products/league-counter) documents an OBS/
StreamElements widget combining rank, LP and win/loss records with optional manual
chat controls. [Meld's League stats widget](https://meldstudio.co/gallery/league-of-legends-live-gameplay-stats/)
documents compact game statistics and moderator management. [StreamElements counters](https://support.streamelements.com/hc/en-us/articles/18750902018450-Chatbot-Counters)
documents missed-cannon/death counters. The adopted patterns are a compact stream
summary, automated readable statistics, and trusted correction commands.

Searches also found Tyler1's historical Backseat AI announcement and community
descriptions of Caedrel's rank-climb streams. The primary announcement/site were
unavailable during this pass, and no reliable current counter inventory was found.
Those are leads rather than evidence that either streamer currently uses a
particular tracker. No AI coaching, invented counter values, or paid integration
was added on the strength of those leads.

## Open the Hub page

Open **League Stats** in the Hub sidebar, or
`http://localhost:7420/#projects/league_stats`. Collection starts with the Hub,
independently of media playback and scene pause/resume. The League client must
identify a current game and the live player must match the signed-in account;
spectating and replay data are excluded. Recent history syncs automatically when
the client opens. **Import recent 100 games** queues a bounded, paced import.

The transparent OBS browser page is
`http://127.0.0.1:7420/league-stats/overlay.html`. Use a 520 × 190 browser source and
place it where desired. Optional `?period=today` or `?period=session` changes the
record shown. The tracker does not move or replace existing OBS sources.

## Trusted helper commands

- `!melee`: one reported missed melee minion.
- `!range`, `!ranged`, `!caster`: one reported missed ranged minion.
- `!cannon`, `!siege`: one reported missed cannon minion.
- `!nexus`: one manually observed Nexus last hit, separate from confirmed API data.
- `!statundo`: named helpers undo their own latest active entry, even if someone
  else has reported since. The broadcaster and allowed moderators undo the latest
  active entry across helpers. Individual archived corrections remain available
  through match review, and replies identify which counter was corrected.

The broadcaster, Twitch moderators and configured named helpers are authorized.
The default 15-second cooldown is global across these commands and all viewers.
It persists across Hub restarts and undo does not clear it. Commands increment
only one count; amounts and extra arguments are rejected. Miss reports are
accepted only while a fresh live game is being tracked. Nexus confirmations can
also arrive for two minutes after the tracked game ends, to allow stream delay.
The Hub has matching
buttons and preferences to disable helper counting or moderator permission.

The read-only server-side chat connection receives Twitch's actual login and
moderator tags over TLS. It does not trust display names, browser-submitted
badges or messages copied from another shared-chat channel. Its channel follows
the existing Chat Overlay channel preference. A separate bounded Helix worker
sends replies through the existing Twitch Celebrations authorization owner.
Connection readiness is displayed in League Stats.

### Chat replies and command preview

The **Twitch stat replies** card previews each answer using the current saved
session, regardless of dashboard filters. Previewing and copying commands never
send messages. Type `!stats` or `!stats help` in Twitch for the command guide.
Commands include `cs`, `kda`, `record`, `dragons`, `misses`, `damage`, `vision`,
`streak`, `rank`, `recap`, `goal`, `live`, `averages`, `lifetime`, `objectives`,
`items`, `matchup`, `nexus`, and `helpers`, each following `!stats`.

| Viewer request | What it answers |
| --- | --- |
| `!stats live` | Fresh current-game champion, K/D/A, CS and CS/min; stale data is never labelled live |
| `!stats averages` | Session per-game K/D/A, average length and weighted CS/min; completed games with evidence |
| `!stats lifetime` | Completed games, W/L and recorded kills, deaths and CS for the current account, respecting exclusions and the custom-game preference |
| `!stats objectives` | Personal dragons, Barons, towers and first bloods in the saved session |
| `!stats items` | Three most frequent final-inventory items across the current account's included completed games; duplicate slots count once |
| `!stats matchup` | Current confirmed enemy ADC / allied support with results from the same queue; unknown queues and roles are not inferred |
| `!stats nexus` | Automatic Nexus kills and helper-confirmed +50-gold reports shown separately; they may describe the same event and are never summed |
| `!stats helpers` | A short permission and correction guide, without replacing the active overlay card |

Convenient aliases include `farm`, `wr`, `winrate`, `build`, `lane`, `average`,
`firstblood`, and `firstbloods`. They resolve to the same canonical topics and
share the same cooldowns. Preview scope labels distinguish the live game, current
saved session, lifetime/current-account history, and command guidance.

Replies use one emoji, a scope label, and short sections separated by dots:

- `🌾 Session CS · 2,291 total · 7.42/min (completed)`
- `🏆 Session Record · 8W–4L · 66.7% WR`
- `✅ Cannon miss +1 · This game: 3 · Undo: !statundo`

Missing evidence says “unknown”; completed rates are labelled separately from
totals that can include live games. Accepted trusted helper reports and undo
commands get confirmations only after their archive transaction succeeds.
Unauthorized, duplicate, stale, blocked, and cooldown requests stay quiet.
The chat switch disables both stat and helper replies without stopping collection
or overlay cards. Helper permissions remain broadcaster, enabled moderators,
and named helpers; custom counters use the same policy and confirmation format.

If readiness asks for a reconnect, open **Connect Twitch** and authorize the
broadcaster in Twitch Celebrations once. Existing celebration tokens continue to
work without chat permission. The connected login must match the Chat Overlay
channel. Answers use Twitch's native reply parent ID and send as the broadcaster.
User-token replies follow Twitch's shared-chat forwarding behavior.
[Twitch Send Chat Message documentation](https://dev.twitch.tv/docs/api/reference/#send-chat-message).

Delivery has one worker, a 32-message queue, a 15-second expiry, and at least two
seconds between writes. It rechecks feature intent, channel and authorization
after token refresh. Twitch drops and rate limits are shown in readiness; uncertain
writes are not retried. No scheduled or unsolicited chat messages are generated.

### Stream controls and visual presentation

Daily scoreboard and live controls appear before setup. Section shortcuts jump
to the overview, helpers, recent form, matchups, history, or folded setup.
Account choices use observed Riot names/tags where available, preserving the
account IDs that key the archive and filters. Unnamed accounts receive a short
identifier label; no account name is invented.

Tracking, history and viewer commands start even with OBS closed. The feature
publishes `REQUIRES_OBS = False`; the Hub starts OBS-independent workers once and
defers voice/playback modules until OBS connects. Opening OBS later does not
create a second stats worker or duplicate chat subscriber. The supported entry
point remains this checkout's `hub.py` / `Run Hub.bat`.

**Your recent form** charts the last 12 included completed games in the selected
dashboard filters. Choose CS/min, kills, deaths, vision, or damage/min. Missing
statistics leave gaps instead of zero points. The CS chart marks the saved goal;
coverage and per-game values are visible beside the chart. Game tiles open the
existing match-review controls.

Review notes and exclusion drafts survive switching between games and filters
while the page stays open. The cache is bounded to 50 drafts. They are saved only
on explicit Save; edits made during a pending save remain unsaved and receive the
new optimistic revision. Duplicate saves are prevented. Closing the page does
not persist an unsaved draft. Recent live helper entries show actor, counter,
game time and correction status without changing the audit journal.

The live farming bar compares reported CS with `game_minutes × CS_goal` and shows
the whole number of additional minions needed to reach that pace. It requires
fresh live telemetry, a positive game time, and a reported CS field. Completed
goal results continue to use only games with coverage.

**Make it yours on stream**, inside setup, builds copyable OBS Browser Source
URLs and offers a preview that can be stopped. Presets include live scoreboard,
saved-session record, rank, last-game recap, farming goal, and rotating views.
Choose mint teal, soft violet, or warm gold and a scoreboard-record period.
These presentation choices stay in that browser; they do not alter OBS sources,
transforms, profiles, or match statistics. Use the original **520 × 190** source
size. Example: `/league-stats/overlay.html?view=rotate&theme=violet&period=session&cycle=12`.

Rotation uses the selected 8–30-second interval and only views with available
evidence. Viewer spotlights temporarily take priority and then return to the
selected view. Farming-goal cards show live pace during a game and completed-game
coverage between games. Unknown missed-minion values display a dash. Static
cards do not show an invented requester. The overlay owns one polling interval
and one expiry timer, cancels pending reads on page hide, and restarts safely
after browser-history restoration. Hidden Hub previews remove their iframe.

## Persistence and math

The SQLite archive lives under
`%LOCALAPPDATA%/StreamingHub/league-stats/<checkout identity>/history.sqlite3`.
It is independent of module profiles, settings history, replay storage and Git
branches. Do not delete it during cleanup. Preferences live in
`mini projects/league_stats/settings.json`; saves snapshot personal settings and
preserve unknown fields. Malformed existing files remain intact.

Matches use account PUUID plus game ID as their identity. Repeated live polls,
reconnects, imports and final-record enrichment update the same record. Final
records preserve manual audit entries, witnessed CS checkpoints and live-only
fields. Manual reports are checkpointed immediately; ordinary live data is
checkpointed every ten seconds. Raw final records are retained locally for future
field support; exported JSON contains normalized statistics and observation audit.

Totals include saved live/partial observations. Averages and rates use completed
records with the necessary fields. Weighted CS/min is total completed CS divided
by total completed minutes; the separate mean per-game rate gives each game equal
weight. Win rate excludes unknown results. Every field reports coverage, so absent
post-game fields and unwatched manual events do not dilute averages with invented
zeroes. Lifetime means the recorded/imported archive, not an unverified complete
history of the Riot account. Exports include all filtered games, while the page
shows only the latest 50.

## Verification

`py -3.11 tools/check_architecture.py` and
`py -3.11 -X utf8 tools/run_offline_tests.py` enforce the existing boundaries.
`tools/test_league_stats.py` checks simultaneous observers, permissions, shared
cooldown/undo/restart behavior, reconnection, final-record reconciliation, missing
fields, role certainty, filtered exports, and read-only Twitch lifecycle.
`tools/test_league_stats.cjs` verifies browser rendering with isolated fixtures.
`tools/test_league_stats_extensions.py` covers saved session boundaries, reversible
reviews, failed-write isolation, custom counters, viewer limits and expiry,
timeline identity and coverage, enrichment idempotence, rates and streaks.
`tools/test_league_stats_enrichment.py` exercises rotated/refused keys, request
budgets, 429 retention, cross-source encrypted identities, closed-launcher work,
rank baselines/promotions, goal coverage, and recap exclusions.
Actual live collection still requires a real League game; fixtures do not certify
that the current client build exposes every optional field.
