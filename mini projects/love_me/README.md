# Mood cues / Love Me

Open the Hub's **Mood cues / Love Me** page. Existing `987` stages, OBS files,
transforms, groups, filters and audio levels are preserved. New music moments
use a transparent browser source inside `LoveMe`; no program-scene change.

| Sequence | Variation | Suggested sound / feeling |
| --- | --- | --- |
| `987` | Original Love Me | Existing four OBS stages |
| `986` | Signal found | Rihanna, Where Have You Been orchestral edit; longing and recognition |
| `985` | Heart on sleeve | The Cardigans, Lovefool; playful devotion |
| `984` | Golden | JVKE, golden hour; awe and warmth |
| `983` | Afterglow | Beach House, Space Song; nostalgic dreaminess |

Type within 300 ms. The same variation toggles off. Different variations replace
the current cue after cleanup. Original `987` advances, toggles off at its last
stage, and resets after idle. Buttons and project actions work in Hub workflows.

Choose one shot, fixed **total plays**, or continuous until stopped. **Make a
variation** clones a direction with independent text, hotkey, timing, audio,
level, placement and opacity. Empty hotkeys support button-only variants.
`variations.json` writes atomically, preserves unknown fields/malformed data,
and rejects stale revision edits.

## Audio

Drop MP3/WAV/OGG/M4A in the editor (20 MB), choose a local path, or drop an
ID-named file such as `signal_found.mp3` into `audio/`. Imports preserve older
files. Ambiguous folder drops require explicit selection. All files stay local.
New editor imports use `%LOCALAPPDATA%/StreamingHub/mood-cues/audio` on C:.
Existing local paths and module-folder drops remain supported.

- **Trim start** is original file seconds.
- **Excerpt length** is playback seconds. Short files fail clearly.
- **Lift / cue anchor** is seconds after trimmed start at the selected speed.
  It maps the visual reveal to your musical lift; replacing audio does not
  automatically stretch the cue sheet to the whole file.
- **BPM** controls gentle accents. Authored cues own image changes and text.
- Preview privately, scrub visuals, then save/play in OBS.

Audio position drives visuals. Pause freezes it; repeats restart the exact
excerpt. Silent cues have a pause-aware clock. Playback IDs reject old
completions. Connection loss clears audio/art. Idle sources do not animate.

The supplied 30.8129-second MP3 is connected to **Signal found**:
`C:/StreamingMedia/twitch downloads/Rihanna - Where Have You Been (Orchestra remix) #music #edm #sleepy.mp3`.
The first 30.65 seconds play; the initial reveal anchor is 9.65 seconds, around
the rise after the quiet 8–9-second passage. This waveform-based alignment is
editable in preview. The download is unmodified.

New cues default to **Monitor Only / track 1**. Desktop Audio supplies the live
mix once; clean track 2 recordings, replays, VODs and clips exclude the music.
**Retain this audio** selects Monitor and Output / track 2 for a cleared stinger.
Original Love Me routing remains intact. The latest project/profile master from
`hub_audio.json` combines with each variation's offset. OBS browser fader edits
belong only to the last-loaded variation, captured before swaps, on editor
reads and at shutdown. Hub master edits use the public feature interface.

Other sounds await your audio. Popularity and excluding track 2 do not grant
live streaming rights; use audio you have permission to stream.

## Art and research

Signal found uses 35 distinct full-frame film and TV stills: Interstellar, The Pursuit of
Happyness, Titanic, Rocky, Harry Potter, The Lord of the Rings, Breaking Bad,
Friends, Up, Avengers: Endgame, The Office, Stranger Things, Toy Story,
The Shawshank Redemption, Forrest Gump, Inside Out, La La Land, The Last of Us,
Good Will Hunting, The Lion King, The Green Mile, Soul, Monsters Inc., WALL-E,
Finding Dory, Elemental, Finding Nemo, Coco, Logan, Infinity War, Terminator 2,
The Notebook, Man on Fire, Call Me by Your Name and The Iron Giant.
The selection mixes grief, affection, reassurance, relief and victory.

Images cover the whole frame without letterboxing, from the measured musical hit
to the ALL onset. For the supplied MP3 the hit is 9.719 seconds, about 281 ms
before the rounded first-word cue. The first still appears immediately on that
audio-clock boundary and starts rapid changes before WHERE (10s);
images finish at 15s. Twenty distinct shots span the musical hit through the end of WHERE with
approximately 114 ms cuts with 50 ms overlapping dissolves. HAVE YOU BEEN slows slightly to 200 ms
cuts with 85 ms dissolves while opacity drops rapidly to zero. A single pass never wraps or repeats a still; a shorter catalog holds its final
image instead of revisiting earlier images. New scenes are interleaved with old ones. There is no
imagery before the musical hit or from 15 seconds onward. The remaining sung words
continue through 18 seconds using the user's original word score.
The new First image / musical hit control is original-file seconds, independent
of word timings. Empty follows the first word. Both images and text share the
actual file clock, trim, speed and lyric delay. A replacement edit needs its own
hit calibration; there is no live loudness detector or additional audio path.
The local audio-hit-analysis.json records the supplied MP3 hash and measured
3 ms RMS attack near 9.719s. The original audio remains unmodified.
Signal's size control scales the lyrics; images always fill the frame.
Other variations retain their perimeter composition.

The default photo opacity matches the actual original montage input's 34.88%,
then inherits the existing LoveMe scene fade. The editor's opacity control scales
that level. Source-over compensation keeps overlapping images at the same total
opacity as a single still. Gentle motion uses 250/350 ms cuts and removes camera drift; lyrics keep a stable face per word.

Each sung word has original-file start/end seconds. The renderer reads the actual
audio clock, compensates for trim and speed, cycles twenty-three distinct typefaces every 120 ms, starts
fading held words after 750 ms, and clears text between phrases. Gentle motion
selects a stable face per word. The word editor also exposes lyric delay, typeface
cadence and held-word fade. Automatic timing was rejected as low confidence;
the final score follows the user's listening timings:
no words until 10s, WHERE 10–12s, HAVE YOU BEEN 12–15s, ALL MY LIFE 15–18s,
then clear text. Individual words within those phrases remain adjustable.
Replacing an audio edit requires checking its word sheet.

Run `py -3.11 tools/install_signal_assets.py` to install independent copies of the
approved artwork and the unmodified OFL-licensed UnifrakturCook font into
`%LOCALAPPDATA%/StreamingHub/mood-cues/signal-v2` on C:. The installer records
source paths and SHA-256 hashes; it preserves existing files. Keep that directory
with a setup migration. The artwork provider registers only named files during
feature startup. Run `py -3.11 tools/install_mood_montage.py` to install the original public stills
in `%LOCALAPPDATA%/StreamingHub/mood-cues/signal-montage`. Its `montage.json`
records source pages, original image URLs, dimensions and SHA-256 hashes. Existing
files are preserved; the installer downloads images only. Keep this directory
with the setup. Run `py -3.11 tools/install_mood_fonts.py` to install seven additional OFL fonts,
including Rubik Dirt, Wet Paint, Burned, Bungee Shade, Eater, Metal Mania and Courier Prime,
with individual licenses and provenance on C:. Text is about 50% larger and uses
a bounded twelve-glyph worn-ink cache in `web/type-ink.js`; texture stays inside
the lettering. All stills and fonts decode before music is allowed to start.
Missing assets fail clearly. No celebration runtime is imported.

The first play in each Hub lifetime refreshes the OBS browser after provider
registration, so startup cannot retain a generic fallback renderer.

F: repeatedly filled during editing. This entire module, including all saved
settings, now resides at `%LOCALAPPDATA%/StreamingHub/feature-packages/love_me`.
An NTFS junction at the original checkout path keeps the supported Hub and tools
loading it normally. All files were hash-verified during the direct move; original
OBS media remain at their saved paths. Keep the module, mood artwork and imported
audio directories together when migrating this setup. Backups remain outside the
checkout under StreamingHub/settings-history.

Sources: [Where Have You Been montage](https://www.capcut.com/template-detail/WHERE-HAVE-YOU-BEEN/7567318045627092277),
[Lovefool](https://www.capcut.com/template-detail/Song-lovefool/7481867930292997381),
[golden hour](https://www.capcut.com/template-detail/golden-hour/7161788228884778241),
[Space Song short-form use](https://www.musicradar.com/artists/this-song-sounds-like-a-group-of-friends-going-their-separate-ways-forever-the-story-behind-the-2015-dream-pop-gem-that-tiktok-cant-get-enough-of),
[Twitch guidance](https://help.twitch.tv/s/article/dmca-and-copyright-faqs).

Focused Python suites: `tools.test_mood_cues`, `tools.test_module_lifecycle`,
`tools.test_coordination`, `tools.test_audio_settings`. Run the architecture
checker and full offline suite for shared contracts. `node tools/test_mood_cues.cjs`
uses disposable Chromium fixtures and generated `output/mood-cues/catalog.json`
to check full-frame photo alpha, crossfade opacity, closing transparency, cue mapping, trim/pause, completion, short-file errors, disconnect
cleanup and idle animation. It never plays on real OBS or edits personal files.
