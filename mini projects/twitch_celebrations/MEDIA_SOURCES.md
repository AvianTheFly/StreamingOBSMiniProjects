# Party music pack

Prepared at the user's request for their streaming setup. Source files in the
existing library were read only; generated cuts are isolated in this module.

| Prepared file | Source |
| --- | --- |
| `media/crab-rave-party.mp3` | Existing `Assets/VisualAndAudio/soundboard/crab rave.mp4` |
| `media/pedro-party.mp3` | Existing `Assets/VisualAndAudio/soundboard/Pedro.mp4` |
| `media/nyan-cat-party.mp3` | [Nyan Cat download page](https://www.myinstants.com/en/instant/nyan-cat/), download `/media/sounds/nyan-cat_1.mp3` |
| `media/toothless-party.mp3` | [Driftveil City / Toothless download page](https://www.myinstants.com/en/instant/toothless-dancing-to-driftveil-city-35196/) |

The local file named `songs/toothless.mp4` was inspected and turned out to be an
unrelated anime music video; it is not used in this pack.

Audio preparation: FFmpeg loops short source hooks to 16 seconds, converts to
stereo 44.1 kHz / 192 kbps MP3, applies `loudnorm=I=-17:TP=-2:LRA=8`, then a 50 ms
entrance and one-second exit fade. The overlay additionally fades shorter alerts.
Existing Hub/OBS/module volume controls were not changed. Original `.wav` tracks
remain available as manual choices.

Crab and Pedro dance cameos are silent 320-pixel-wide H.264 copies from those
same local videos, up to eight seconds, 24 fps. They loop in the border only.

Default assignments and dance cadence live in `characters.js` (`partyTracks`).
Saved per-theme `settings.custom` choices take precedence over these defaults.
No internet connection is needed for playback after download.

## Raid festival dancers / October 12, 2026

`media/raid-dancers.json` records the original source pages and exact GIF
downloads for Toothless, Mob's default dance, dancing cat and OIIA Ethel.
These are silent local PNG atlases prepared by `tools/prepare_raid_party.py`;
white/green backgrounds are keyed during preparation and OIIA plays at half speed.
Crab Rave uses the existing local dance cut. Classic Club Penguin uses untouched
copies of `hub_ui/app/spirit-lobby/art/penguin.png` and its frame map. No original
asset is overwritten and no external media is fetched during an alert. The finale
also uses the existing silent Minions, Tobey, Squidward and Pedro dance cuts.

## Current border puppets / October 12 follow-up

The current raid no longer loads the above meme atlases or dance videos.
`raid_cast.js` supplies authored vector puppets, including a Pedro raccoon based
on the existing border effect's mask, headphones, ringed tail and record gag.
Only the classic penguin PNG and frame metadata are used for bitmap animation.
The previously prepared media and personal custom choices remain on disk.
Raids retain saved audio choices but do not display custom visual panels.


## Familiar-character crossovers / October 13, 2026

Twenty-four existing generated lobby poses (Kirby, knife goose, Among Us
crewmate, Getting Over It climber, Hornet, Boo, Creeper and the original salvage
robot) are copied without pixel edits to `media/raid-game-*.png`. The source PNGs
and lobby configurations are untouched. `media/raid-game-provenance.json` records
every original path and SHA-256 digest; `tools/prepare_raid_guests.py` verifies the
copies. There is no feature-peer runtime import or alert-time external download.


Current raid-only music uses `raid-{crab,dragon,cat,frog}-single.wav`, prepared
locally by `tools/prepare_raid_music.py` from the existing party MP3s. These
6.4–6.6-second cuts stop before repeated material and fade out once. Original
16-second files and other event playback remain unchanged. `raid_score.json`
records exact source hashes, measured musical timing and cut durations.


`subscriber-thanks.wav` is an original 4.8-second 120 BPM synthesized musical
sting, prepared by `tools/prepare_subscriber_music.py` with deterministic notes,
bass and soft percussion. It plays once for subscriptions only; existing
supporter audio remains for gifts and followers. No external music was added.
