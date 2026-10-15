# Extending the Streaming Hub

The application is `hub.py` / `Run Hub.bat` in this checkout. Read `AGENTS.md`
for personal settings and restart requirements, and `ARCHITECTURE.md` for owners.

## Choose an owner before writing code

When changing runtime behavior, update that owner's `workflows.json` (or the
single-file owner's adjacent `*.workflows.json`). Keep the labels brief and the
conditions, waits and release paths accurate. Run `py -3.11 tools/check_workflows.py`
alongside the architecture check. Changed AST evidence is flagged in the page
and fails the workflow check. After reviewing the explanation against the new
code, use `py -3.11 tools/check_workflows.py --stamp owner.flow_id` to update that
specific proof. Never stamp an explanation without reviewing it. Source wiring,
current conditions, coordinator rules and saved sequences refresh automatically.

Start with the behavior and affected resource. A feature interprets its own
events, commands, and assets. Shared infrastructure owns competing access to a
resource. The UI translates HTTP requests and responses; it calls public APIs.

For a new feature, use `config.py` for configuration, `commands.py` for pure
interpretation, `interface.py` for public controls/status, and `main.py` for
assembly and lifecycle. Add separate components for capture, selection,
presentation, or persistence when needed. Existing generic media features should
reuse `lib/shared_media/` instead of copying its workers and profile logic.

Feature `main.py` modules that can run without OBS declare `REQUIRES_OBS = False`.
The Hub lifecycle partitions selected projects using that public metadata and
starts OBS-independent services immediately. Missing or invalid declarations
default to waiting for OBS. Do not add feature names to a central startup
allowlist. Each feature remains responsible for its own bounded runtime cleanup.

Dependencies flow from entry points and adapters to features and shared services.
Shared services do not reach into features. Feature peers exchange events,
interfaces, or explicit shared provider contracts. Provider callbacks are copied
under a lock and invoked after releasing it.

## Shared-action examples

An automatic scene policy requests a destination:

```python
from lib.coordination.scenes import scene_director

scene_director.request("Lobbies", owner="my_feature", reason="Game ended",
                       automatic=True, defer=True)
```

A delayed callback also passes the revision captured when it was scheduled as
`expected_revision`. Deliberate scene selection uses `automatic=False`. Temporary
presentations reserve a `SceneSession` before loading and always finish it in
`finally`. Finishing a revoked session cannot overwrite a newer scene choice.
An activated session can advance through owned stages with `session.present(scene)`.
It keeps its original return target and pause claim, and refuses every advance
after a manual scene choice, lost observation stream, or session completion.

Cross-project playback gets its own completion identity:

```python
def admitted(ticket):
    # Schedule promptly; source work and waits happen on its playback worker.
    worker.submit(lambda cancel: play_owned_source(cancel, ticket))

ticket = coordinator.request("my_feature", admitted)
```

The source worker waits for `ticket.wait_until_allowed`, honors cancellation and
the ongoing `ticket.allowed` gate, and calls `ticket.finish()` after cleanup in
`finally`. A failed admission returns `False`. Source reuse remains serialized
by `PlaybackWorker`. Intentional layered playback uses the coordinator's module
permission and makes no exclusive playback claim. Manual pause/resume uses
`coordinator.manual_action`, so it cannot undo another owner's pause.

For an independent settings update, snapshot personal settings first, then:

```python
update_json(path, lambda current: {**current, "changed_field": value}, default={})
```

This serializes read/modify/write within the Hub and publishes a complete file.
It does not coordinate arbitrary external programs writing the same file.

## Verification and debugging

```powershell
py -3.11 tools/check_architecture.py
py -3.11 -X utf8 tools/run_offline_tests.py
# A focused run accepts unittest module names:
py -3.11 -X utf8 tools/run_offline_tests.py tools.test_coordination tools.test_shared_state
# Standalone film/storyboard exports are optional for ordinary Hub changes:
py -3.11 -X utf8 tools/run_offline_tests.py --include-artifacts
# Inspect selection without importing tests:
py -3.11 -X utf8 tools/run_offline_tests.py --list
```

The architecture check scans supported runtime modules without importing them.
It rejects feature peer imports, private live-state imports in HTTP adapters,
scene-write bypasses, unmanaged OBS connections, and unsafe bulk/name-based
coordination calls. The GitHub workflow runs this check without OBS dependencies.
It is a guard against accidental boundary violations, not a proof that all
possible races are absent.

The offline runner blocks OBS connections and fails on uncaught worker errors.
It queues simultaneous suites for the same checkout before importing tests,
uses below-normal Windows priority, and defaults numerical-library pools to two
threads. Explicit thread environment values remain respected. Cancel a queued
run with Ctrl+C; normal exits and crashes release the suite's OS-owned slot.
Concurrency regressions use events/barriers and disposable settings/media, not
personal assets or a live OBS connection. Tests for ownership changes should
cover replacement during cleanup, cancellation before admission, overlapping
claims, newer intent, and shutdown where relevant.

Tests are evidence about behavior, not an independent source of product
requirements. Before preserving or adding an assertion, identify the streamer
or viewer problem it detects. Protect saved data, control feedback, playback,
scene intent, media integrity and resource cleanup. Use disposable profiles;
do not require the streamer's real keys, sound lists or sticker choices to match
a historical setup. Catalog checks should validate supported entries and unique
identities without freezing the number of effects. Performance comparisons that
promise unchanged output should compare both current paths on the same input;
an old pixel or DSP snapshot is not a permanent artistic requirement.
For a deliberate unchanged-art comparison, `test_supporter_rendering.cjs`
supports `--capture-followers` and `--compare-followers`. Normal runs do not
silently enforce a fingerprint left by an earlier review.
These flags also work on its current owner, `test_subscriber_party.cjs`.
Capture and compare are separate runs; the default reference is
`output/subscriber-party/follower-fingerprints.json`. Set `FOLLOWER_REFERENCE_FILE`
to use a different reference explicitly. A historical file's presence alone
must never enable a comparison.

When changing a feature, distinguish a defect from an intentionally changed
contract. Keep tests for the behavior that still matters; revise the scenario
when the requested behavior changes. Do not restore obsolete UI, artwork, catalog
sizes or private implementation just to satisfy an old assertion. Catalog tests
should check identities, coverage and valid behavior, so an additional valid
entry passes while a missing, duplicate or unreachable entry fails. Exact counts
remain useful for controlled fixtures and bounded resources.

The default Python suite covers Hub runtime, installers and Footage Desk.
The ten standalone `stream_brand` export suites are listed in `ARTIFACT_MODULES`
in `tools/run_offline_tests.py`; run them explicitly when working on those exports,
or use `--include-artifacts` for the complete Python suite. Their story-specific
checks describe those versions and must be reconsidered when the creative brief
changes. `probe_3d_block_filter.py` and `probe_spotify_isolation.py` are manual
live-device diagnostics, not offline regression tests. The former edits live OBS
filters; the latter plays audible tones. Neither is run by the offline runner.

JavaScript `.cjs` tests are separate from the Python runner. Prefer disposable
browser fixtures for normal changes. Some artwork reviews depend on the live
Hub or generated local media; inspect their entry points before running them.
Passing automated checks cannot judge whether an animation is entertaining or
whether the controls feel convenient during a stream; those need visual and
workflow review.

With the Hub running, `GET /api/coordination` reports current scene ownership,
revision, deferred intent, recent decisions, active playback gates, and pause
owners. `GET /api/status` reports feature status; `/api/projects` lists available projects. Keep resource measurements
in their existing diagnostics rather than adding competing polling workers.

After runtime changes, snapshot settings and restart this checkout's Hub hidden.
Verify the Hub UI, module startup readiness, and exactly one keyboard child.
Footage Desk (`footage_manager/app.py`) is the separate recording review app;
leave it running during unrelated Hub restarts. When a requested change needs
Footage Desk to restart, back up its catalogue, checkpoint active work and resume
unfinished analysis with the same settings. This is not a blanket ban on restarts
or a requirement to ask again when the user has authorized the maintenance.
Do not commit or discard unrelated working-tree changes as part of a refactor.

Browser workspace changes can be checked with `node tools/test_hub_ui.cjs` when
Node, Playwright and Chrome are available. The disposable HTTP fixtures cover
navigation, controls, pending/errors, focus, fader scope, late responses,
subscription cleanup and desktop/mobile layouts without live commands or personal
settings writes. `--live` captures the running Hub's views and rejects non-GET
requests. Keep feature control and persistence in their existing public owners;
the shell catalog contains presentation labels and links only.

## Live diagnostic captures

A finite live OBS check owns every recording, replay-buffer save and derived cut
it creates. Move these files out of `REPLAY_DIR` into that check's diagnostic
output folder as soon as the writer closes, including failure cleanup. Never
leave test footage in the personal replay inventory or invoke a Hub save action
for a synthetic test without collecting its original and derived files afterward.
Directory discovery cannot distinguish a diagnostic OBS filename from a real
user capture. Offline tests must continue to use disposable media.
