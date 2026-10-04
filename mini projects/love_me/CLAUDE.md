# Mood cues / Love Me

Read `README.md`, the root `AGENTS.md`, `ARCHITECTURE.md` and `CONTRIBUTING.md`
before changing this feature.

`987` retains the original four-stage OBS sequence. Authored variations use
the Hub-owned browser transport, with editable hotkeys and once, fixed-repeat
or continuous playback. Both paths share `MoodService`'s serial playback worker.

| Owner | Responsibility |
| --- | --- |
| `main.py` | Assembly, one keyboard subscription, bounded intent inbox, shutdown |
| `service.py` | Playback intent, actual coordinator tickets, repeats, replacement cleanup |
| `player.py` | Original OBS stages and their existing source settings |
| `settings.py` | Atomic variation persistence, validation and local audio imports |
| `catalog.py` | Authored directions and timing defaults |
| `presentation.py` | Browser playback policy, asset faders and recording tracks |
| `web/` | Original vector art, cue timing, transparent rendering and private preview |
| `interface.py`, `api.py` | Public workflow and editor contracts |

Keep original sources, groups, transforms, filters, files and levels intact.
Snapshot settings before edits. OBS fader edits belong to the loaded variation;
explicit Hub master edits use the public audio interface.

Use coordinator tickets and their permission gate. Finish the actual ticket
after source cleanup. Admission only schedules work; never bulk-pause projects
or hold a source lock while waiting for admission. The browser provider is
registered during startup and removed during shutdown. Imports start no work.

HTTP routes use public APIs. Feature-private live state stays in this package.
Update the responsibility map, workflow map and relevant regression checks when
changing ownership. See `README.md` for playback controls and verification.
