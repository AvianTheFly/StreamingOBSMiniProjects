# Eight-second raid direction

`raid_sequence.js` owns the cue list and effect lifecycle. `raid_sequence.css`
owns lighting, bursts, entrances and words. `build_raid_chimes.py` reproduces the
five original audio accents. The base overlay still owns the music and mascots.

| Time | Stage |
| --- | --- |
| 0.00 | Incoming double chime, edge glow and incoming text |
| 0.65 | Channel-name entrance, chord, animated raider-count badge |
| 1.50 | Music rises to saved volume, dancers enter, light sweeps and rings |
| 3.20 | Character swap, sparkle chime, new words and dance motion |
| 5.00 | Second swap, meme cameos, corner burst and border confetti |
| 6.40 | Thank-you headline, welcome chime and closing message |
| 7.40 | Fade and exit; fully finished by eight seconds |

Chimes honor module mute/volume at 65% of saved music gain. Stop, pause,
disconnect and replacement stop every layer. Late joins skip stale sound cues.
Confetti is capped at 36 particles regardless of raid size. Reduced-motion mode
suppresses animation. Personal media overrides remain authoritative.

Design references reviewed:
- [StreamElements custom alert lifecycle](https://docs.streamelements.com/overlays/custom-code-in-alertbox)
- [Sound Alerts raid setup](https://support.soundalerts.com/article/raid-alerts)
- [OWN3D variations](https://www.own3d.pro/features/alerts/)

These document name/count, animation, sound and variation patterns. The specific
layered timeline is custom to this Hub, not a claim about all streamers.
