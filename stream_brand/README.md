# UdyrIsABotLaner channel presentation

This package makes the channel page, breaks, signoff and a recurring replay segment
look like the same show. It uses original four-spirit artwork and retains your
Udyr bot premise, personal jokes and existing links.

## Current live About cards

The approved October 2 revision replaces the seven short panel headers with
complete **320 × 250** image-led cards and adds a build-guide card. Each has its
own original illustration generated with built-in imagegen, rather than repeated
crops of the same painting. Typography is rendered separately for sharp text.
Panel titles and descriptive prose now live inside the images. X, the Udyr bot
player roster, match history, and the existing Reddit build guide use clickable
images with short link labels rendered inside the artwork. There is no extra
title or description text beneath the cards, so the rows align. Payment handles remain in the support
image; no unverified payment destination was invented. The bio retains the user's
voice and main account, with its long build URL moved to the guide card.

- [Current cards and downloads](exports/panels-v2/index.html)
- [Editable copy and destinations](panels_v2/catalog.js)
- [Exact artwork prompts and provenance](panels_v2/prompts.json)
- Original full-resolution paintings: `panels_v2/art/`
- Export owner: `../tools/build_channel_panels.cjs`
- Publication backup, saved-field verification and public screenshots:
  `C:/StreamingMedia/ChannelPresentation/2026-10-02/publication/panels-v2/`

Rebuild this family with the same bundled Node setup below, running
`tools/build_channel_panels.cjs`. The exporter checks all artwork decoding, script
errors, text bounds and image upload sizes. It leaves the earlier panel files,
banner, trailer and installed OBS scene images intact. Twitch's crop selection
must be expanded to the entire taller image before Done; the site saves a
320 × 249 crop. Save accessible image descriptions after the image upload has
finished, then reload to verify them. Use image identity when editing; newly
created Twitch panels can move to the start of the list.

## Files and ownership

- `art/four-spirits.png`: original artwork generated with the built-in imagegen
  tool. The exact prompt and provenance are in `art/prompt.txt`.
- `catalog.js`: authored card and panel copy; no live settings or network access.
- `design.html`, `design.css`, `design.js`: editable graphic layout and typography.
- `exports/`: final PNGs and an asset manifest. Keep this folder in place because
  installed OBS image inputs reference it.
- `../output/channel-brand/index.html`: visual review and individual downloads.
- `../tools/build_channel_brand.cjs`: finite export and clipping/size verification.
- `../tools/install_channel_brand_obs.py`: additive native OBS setup.

These are static images. No browser source, perpetual rendering, audio cue,
keyboard hook, chat connection, polling worker or Hub restart is required.
The six new OBS scenes unload their image source while inactive.

A separate [36-second channel trailer](trailer/README.md) combines real saved
replays, your existing cinematic intro and these graphics. It has music-only and
original-audio review versions, rendered on C:. It adds no streaming runtime.

## Use the installed OBS scenes

Select **Spirit Welcome** when introducing the stream or greeting incoming viewers,
**Spirit Intermission** for a break, and **Spirit Signoff** after your final recap.
These cards do not start/stop the stream, control recordings, or initiate a raid.
Existing scenes retain their original sources, camera filters, transforms and audio.
New scenes share `Recording Audio - No Music` when that scene exists; existing
global microphone/desktop routing and source faders remain in their owners.

## Run Bot Lane Court

1. Between games, choose one saved clip showing a questionable **personal** decision.
2. Select **Bot Lane Court** and pose the question: genius or inting?
3. Use the existing Instant Replay controls to play the selected clip. The replay
   owner handles its temporary presentation and return. Do not switch scenes while
   its playback cleanup is still running.
4. Read viewers' ordinary chat replies. There is no `!vote` command or automatic
   count. With no replies, discuss the decision yourself and skip the chat verdict.
5. Once the replay is finished, select **Court - Genius** or **Court - Inting**
   to reflect what chat said. Keep the reveal brief, then choose your normal lobby
   through the existing Scene Voice Switcher controls.

The results are host-operated display cards. They do not measure sentiment,
resolve Twitch polls, record voter names, or affect gameplay. Use this occasionally
so it remains a recognizable moment rather than a routine interruption.

## First publication and original header family

Published with your approval on October 2, 2026: the profile banner, offline
player image, and the seven existing panel headers. The original panel titles,
descriptions, image links, accessible descriptions and order were checked after
reloading Twitch and preserved. The optional three new panels remain local.
Publication proof is in
`C:/StreamingMedia/ChannelPresentation/2026-10-02/publication/`.

For future graphic updates:
In the Twitch Creator Dashboard, Settings → Channel → Brand exposes the profile
banner and video player banner. Use `profile-banner.png` and `offline.png`.
The art-only profile banner tolerates responsive cropping without hiding key text.
Your present avatar and biography can stay as they are.

The first publication retained existing text fields. The approved image-led
revision above supersedes these seven headers and removes their duplicated prose.
The following table documents the first family for recovery.

| Existing panel | Image in exports/panels |
| --- | --- |
| add me on X! @udyrisabotlaner | `find-me.png` |
| here's a list of every udyr bot otp in the world | `udyr-bot-club.png` |
| donations | `support.png` |
| Match History Proof of Udyr bot | `match-history.png` |
| why udyr bot | `why-udyr-bot.png` |
| I like pineapples | `pineapples.png` |
| I"m just a lil pum pum | `pum-pum.png` |

There are also three optional new headers: `about.png`, `the-show.png`, `clips.png`.
They are not required to update the current page. Do not add unimplemented chat
commands, an invented schedule, rank claims, social accounts or subscriber perks.

Suggested optional About text:

> I play Udyr bot. Four spirits, questionable decisions, and an unreasonable amount
> of stream production. Come for the off-meta lane; stay for the replays and chaos.

Your current proof, build, social and donation details remain authoritative.
The optional copy is an authored suggestion, not a verified ranking claim.

Twitch's [channel page setup guide](https://help.twitch.tv/s/article/channel-page-setup)
recommends a 1200 × 480 profile banner. Its [channel page guide](https://help.twitch.tv/s/article/a-tour-of-your-channel-page)
describes 320-pixel panel images under 2.9 MB. The panel exports are 320 × 100;
the offline and OBS cards are 1920 × 1080. The artwork master is 1672 × 941,
with independently rendered typography in the exports.

## Rebuild and verify

The bundled Node runtime and Playwright package can run:

```powershell
$env:NODE_PATH='C:/Users/Michael/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
& 'C:/Users/Michael/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' tools/build_channel_brand.cjs
py -3.11 tools/check_architecture.py
py -3.11 -X utf8 tools/run_offline_tests.py tools.test_channel_brand
py -3.11 tools/install_channel_brand_obs.py
```

The exporter checks image decoding, script errors, text clipping and panel file
limits. Visually inspect the review after editing copy or layout. The installer
is safe to rerun: it creates missing sources/items and preserves existing settings,
visibility, locks and placement. It refuses to install during active streaming or
recording. It never selects the program scene or restores an older volume.

The sourced comparison, priorities and future ownership requirements are in
[the production review](../docs/STREAM-PRODUCTION-REVIEW.md).
