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
