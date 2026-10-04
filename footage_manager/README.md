# Footage Desk

The desk has three stages: **Review recordings**, **Saved clips**, and **Clear space**.
The review screen keeps the entire recording timeline visible, with separate rows
for pink voice highlights, blue games and green saved clips. Click a highlight or
game to open **Highlight** mode. Drag either boundary to see that source frame;
click the local rail to seek, or scroll over it to zoom. **Recording** hides the
local trim editor while keeping all source timelines visible.
**Keep**, **Extract**, **Skip** and optional **Notes & tags** work on the selection.
Skip saves a rejected marker; it never deletes source footage. Saved-clip resizing
updates that marker, keeping its title and metadata. Extraction controls live in
Folders & settings; the review UI uses no padding by default. Existing server
export verification, all-audio retention and disposal confirmations remain active.
Saved clips shows retained moments across recordings, with playback, editing,
extraction status and extraction of remaining keepers. Changed cut boundaries
return a clip to the extraction list; **Extract again** is available for repairs.
Playback pauses when you leave the review desk.

When finished, choose **Keep full recording**, **Keep only clips**, or **Nothing
to keep**. Clear space lists reviewed originals by size and explains outstanding
steps. Current export metadata is an estimate of readiness; the existing server
checks actual retained files before moving an original. Trash is reversible and
still occupies disk space. Permanent deletion in **Trash & history** checks the
exports again and requires typing the original filename. No source is removed
automatically after extraction. Recording-length filters do not hide saved clips
or disposal candidates; source/search/collection filters still apply.

Game results display thirty at a time, with next/previous browsing and filters.
UI regressions: `node footage_manager/test_workflow.cjs` and
`node footage_manager/test_analysis_ui.cjs`, plus
`node footage_manager/test_clip_editor.cjs` for sizing and preview boundaries and
`node footage_manager/test_recording_timeline.cjs` for game/saved-range navigation.

The retained analysis panel supplies automated League archive analysis. **Analyze selected recording**
processes one source; **Analyze all eligible recordings** works through all saved
folders, including renamed videos. Recordings under ten minutes are excluded.
One-minute overview estimates are the default. The supplied tavern-table background marks likely
between-game periods and skips full-scene OCR. Click those rough timestamps in
**Likely between games** to jump nearby. A readable gameplay HUD takes precedence.
 Completed finer analysis is reused when switching
to a quick pass with the same audio selection; use Reanalyze to refresh it.
Jobs run one at a time, can be canceled, and completed recordings survive restart.
Exports and previews take priority over background analysis. Analysis closes its
decoder/command first, then resumes from checkpoints when the foreground work ends.
Visual checkpoints and five-minute speech checkpoints let interrupted recordings
resume without starting the whole source again. These caches live on C: with the
catalogue, separately from the originals.
Speech processing skips five-minute chunks outside detected games. Sparse coverage
is retained so a later game-boundary adjustment can analyze a previously skipped gap.
Copies at different locations can share completed analysis after SHA-256 matches
for every byte of both files. Names, sizes and durations alone never authorize
reuse. Each copy keeps its own source ID, path, review decisions and export metadata.
Install CPU analysis dependencies with
`py -3.11 -m pip install -r footage_manager/requirements-analysis.txt` if needed.

The analyzer reads frames locally, without a League API. It recognizes game-clock
and KDA fields, loading/loadout screens, Continue/Nexus screens, portraits without
the HUD, post-game victory/defeat and the Instant Replay banner. Full-screen
browser clips with visible player controls are excluded through their HUD run,
including pauses and hidden controls; they appear as Browser clip playback in
the replay review list. Desktop/Alt-Tab
alone does not end a game. No-HUD boundaries between three and fifteen game minutes
are ignored. A portrait over the Windows desktop is also neutral. A red Continue
button or post-game result supplies stronger end evidence.
Closing a known game through a later loading screen requires consecutive loading
readings at least two seconds apart. A single purple Nexus/death flash cannot
close that game; Continue and result evidence still take precedence.
A death overlay with an advancing game clock keeps the known game open even if
KDA and the health/mana bars are obscured. Subsecond probes may retain the same
one-second clock reading without implying a frozen end screen.
Game-clock resets require two readings and a later inferred game start. A clock
returning from an inflated OCR minute cannot create overlapping copies of a game.
Missing starts/ends are labeled incomplete. Browser images and match-history lists
do not supply a current game result. A native client over the desktop can confirm
its result through an aligned header and panel controls if its queue label is cropped.
Masked `ICTORY`/`1CTORY` and `EFEAT` titles require that same client-panel evidence; partial
words alone do not classify a result. The result crop includes the frame's top edge.
When the fixed top crop sees a client title left of the detail crop, its coordinates
are mapped to the panel controls before validation. Overlapping readings and animated
banner crops cannot provide duplicate or unrelated client headings.
Conflicting result evidence stays unknown,
even if one result repeats later. Each game's proposed IN/OUT includes sixty seconds
on both sides, clamped to the original recording.

Fastest estimates use one-minute visual samples; the quick option uses thirty
seconds. Both retain ten-second local passes at game boundaries and early-game
periods. They skip the extra subsecond desktop
checks. Voice analysis retains its per-second timestamps and game buffers stay
at sixty seconds. This is a review helper: short visual events may be missed.
Five- and ten-second visual sampling retain the detailed two-second local pass.
In those detailed modes, game-to-desktop transitions get local one-second probes,
then quarter-second probes across short gaps, to catch an end before a quick Alt-Tab.
End refinement checks the last chronological gameplay HUD even if a late estimate
falls minutes into the lobby, excluding replay/player HUDs. That gameplay window
and the estimated boundary receive separate bounded passes; long inactive gaps
do not get decoded densely.
These extra frames still require visual end evidence; desktop views remain neutral.
Five-second sampling catches shorter replay banners;
thirty-second or one-minute sampling gives rough estimates sooner. Brief banners or a game closed between
samples can still be missed; review low-confidence boundaries before cutting.
Early KDA snippets require kills **or** assists greater than one and a clock at or
before 05:00, confirmed by a second chronological HUD reading. Replay samples
cannot advance game chronology or add KDA/speech scores. Replay boundaries include
one sampling interval for banner entrance/exit animations.
Replay ranges are exposed as deletion candidates and can be marked rejected; no
automatic source deletion happens.

Speech activity uses local Silero VAD through faster-whisper (no transcript/model
download is needed). Auto selection prefers an audio track named Mic/Microphone;
you can select an individual track. Mixed Twitch audio is explicitly a speech
estimate and includes other speakers. Loudness is measured only on detected speech
and compared with that game's median, using a robust threshold of at least +6 dB.
Raw microphone gain is never used to rank different recordings.
Voice-spike ranking combines the frequency of bursts with their dB above the
game's baseline, excluding replay time. Ten 6 dB bursts per ten minutes give a
50% signal; more frequent or stronger bursts increase it smoothly. Retained
timestamp evidence lets ranking updates apply without decoding footage again.

Choose any combination of **Victory**, **Speaking activity**, **Voice spikes** and
**Early kills / assists**, and optionally adjust their weights. Scores update with
the selected metrics. Review game/snippet jumps into the existing source player and
sets its proposed IN/OUT. Keep buffered game creates a normal keeper you can edit.
Extract game is optional and uses that buffered range without adding another layer
of padding. Extraction preserves all audio tracks and writes an adjacent
`.source.json` containing source path/ID, original and exported timestamps, track
layout and cut mode. New exports require this metadata to remain intact before
source disposal is allowed. Fast copy can shift cuts to keyframes; choose precise
export for exact cuts. Originals and existing personal review decisions are kept.
Game results can also be exported as CSV.

Pink voice-spike markers appear on the full-recording and detail timelines.
The Voice spike clip candidates list shows their original timestamps, game number
and dB above that game's baseline; sort by strength or timestamp. Click a marker
or timestamp to play its context and propose IN/OUT with ten seconds before the
burst and fifteen seconds afterward, clamped to the game. Review and use Keep
range to save the clip candidate. These analysis cues preserve existing personal
markers and require no extraction.

Start **Run Footage Desk.bat** or the desktop **Footage Desk** shortcut. The local
interface opens at http://127.0.0.1:8791. No account, upload, or monthly service is
required. Python 3.11 and the installed FFmpeg do the work. Launching again opens
the existing server instead of creating another listener. This is separate from
the streaming Hub and does not alter OBS or Instant Replay settings.

1. **Folders & settings**: add recording folders, one absolute path per line.
   Scan finds supported video files recursively, without moving them. The default
   clips destination is `C:\StreamingMedia\SelectedClips`.
   Saved locations are scanned at startup and every ten minutes; the Scan button
   lets you pick up new recordings immediately.
2. Choose a recording. Playback position saves every five seconds and when
   switching recordings. Space plays/pauses; arrows jump 10 seconds; Shift+arrows
   jump one second; comma/period step by the source frame rate. Keyboard shortcuts do not register global listeners.
3. **I** sets IN; **O** sets OUT. **K** keeps the range, **M** saves it for later,
   **R** marks it for re-review, **X** rejects it. Give each moment a title, tags,
   intended format, collection/video idea, notes, and usage status.
4. Use **All moments** to search across every recording. **Re-review & later**
   includes both uncertain ranges and recordings. Tags can be comma-separated;
   search also covers titles, games, notes, and collections. Usage distinguishes
   unused clips, those in projects, and published clips.
5. **Load 12 previews** shows a storyboard across a full recording or the ten
   minutes around your playhead. Click frames to seek. The full timeline always
   represents the original, even when playing a short compatibility preview.
6. **Extract all keepers** extracts multiple ranges in a queued background job.
   Default padding is 15 seconds on each side. Fast mode copies original streams
   without losing quality, but cut boundaries can shift to keyframes. Precise
   mode re-encodes video to H.264 and copies other tracks. Every original audio
   track is preserved, including separate OBS mic and game tracks. Ordinary
   H.264/AAC recordings produce MP4; other stream types use MKV to retain tracks.
7. Choose a recording decision. “Reviewed — keep marked clips” permits disposal
   only after all keep ranges have current verified exports. “Reviewed — delete”
   is for reviewed recordings with no remaining value. Maybe and re-review
   ranges block disposal. The status is your overall judgment; playback coverage
   records only watched intervals or sections explicitly marked reviewed.
8. **Move original to trash** requires the exact filename. The hidden trash
   folder is on the source drive, so moving there is quick and reversible but
   does not reclaim space. **Trash & history → Delete forever** checks keepers
   again and requires `DELETE filename`. That step reclaims disk space and is
   irreversible. Export extra context if the setup or aftermath may matter later.
9. Import selected MP4 clips into your existing CapCut installation for reels
   or compilations. Open the clips folder to find them. Footage Desk is a review
   and archive manager, not a final video editor.

Use the recording-length filter to focus on sessions over an hour. Sort by
duration, size, date, or name; narrow by source folder or collection. These filters
are remembered in your browser. **Quick guide** explains the daily workflow.
**Extract matching keepers across library** batches keep ranges from multiple
recordings using your current search, collection, format, and usage filters.
Generated previews, scans and exports have a **Cancel job** button. Completed
exports survive cancellation. Job history survives app restarts; interrupted jobs
are shown explicitly instead of silently disappearing.

Retained moments stay in **All moments** after their original is trashed or
deleted. Selecting one plays its exported file while retaining original timestamps,
tags, notes, collection and usage metadata. Re-exporting requires an online source.

If the browser cannot play the original codec/container, choose **Make preview
here**. It creates only a two-minute low-resolution preview on C:, with the chosen
audio track. Jump to another point to request another preview. The original is
always used for exports, and markers remain in original time. The full-session
preview is never transcoded automatically. Multi-track browser playback generally
plays the first track; selecting another track makes a compatibility preview.

Your SQLite catalogue, backups, thumbnail cache and preview cache live in
`%LOCALAPPDATA%\FootageDesk`, outside the repo. Startup and destructive catalogue
actions create SQLite backups. **Back up catalogue** creates one on demand.
Backups preserve decisions, not footage. **Export catalogue CSV** makes the
timestamp/tag list portable. **Clear generated previews** removes only the cache.
Rescanning changed originals preserves notes and markers but requires re-review;
old exports no longer satisfy deletion checks. Missing drives do not lose records.

Keep the catalogue directory in your normal computer backup. Do not rename or move
source files outside the app while reviewing them; the catalogue uses their full
paths. File identity uses size and nanosecond modification time. Export checks
compare duration and track layout and decode the beginning and end; watch each
keeper before permanently deleting valuable originals.


For long recordings, the thin overview represents the full session and the larger
**detail timeline** shows a zoomed time window. Choose 15 minutes to browse,
then 1 minute or 10 seconds to place boundaries. Pan Earlier/Later, center on the
playhead, or fit the window to your IN/OUT points. One-second and source-frame-rate
steps pause playback for fine positioning. IN/OUT fields support milliseconds;
Go to IN/OUT lets you check both boundaries before saving. Browser frame steps
seek by nominal frame duration, so variable-frame-rate footage may require precise
trimming in your final editor. Fast lossless export still follows keyframes.
