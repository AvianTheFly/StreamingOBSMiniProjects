# Architecture audit — 2026-10-15

## Result and scope

The Hub already has a substantial modular foundation: separate scene arbitration,
playback admission, pause claims, source workers, transport owners and settings
transactions. Preserve these owners. Centralizing all feature logic into another
orchestrator would make responsibilities less clear.

This audit checked all 474 supported Python modules with the static boundary
checker and inspected startup, interfaces, events, coordination, scene sessions,
source replacement, persistence, HTTP composition and their regression tests.
It also compared the navigation documentation against actual files and inspected
large functions as possible extraction targets. It did not manually review every
function or every browser renderer, and does not certify the absence of all races.

Before edits, source/tests/artwork and existing tracked settings were committed and
pushed to `main` as `57f8892` in `AvianTheFly/StreamingOBSMiniProjects`. External
settings history was snapshotted. Approximately 2 GB of untracked local diagnostic
output was left in place and excluded from the checkpoint. Ignored credentials
were not staged. Concurrent League work after that checkpoint is separate from
this audit's changes.

## Findings and disposition

### Corrected: contradictory architectural guidance

`lib/project_runtime.py` recommended bulk pause/resume, despite the owned-claim
contract and checker forbidding those runtime calls. Its conflict query also
claimed that an empty observation made playback safe. The examples now point to
ticket admission and manual coordinator actions, and clarify that observations
are not reservations. Legacy methods remain for compatibility.

`events.emit` advised creating a daemon thread inside blocking subscribers. That
encouraged unbounded work under repeated events. Its documentation now directs
subscribers to their existing bounded workers and stale-intent checks.

The older `docs/ARCHITECTURE.md` allowed private `_live` access in HTTP adapters,
assigned scene ownership to the playback coordinator, and attributed trim jobs to
a compatibility facade. The guide now follows the current owners, includes
dependency and playback diagrams, and links to the existing live Stream map.
The root responsibility reference now has a navigation entry point; its nonexistent
League `service.py` reference points to the actual `main.py: Service`.
The README's supported list now includes the four omitted runtime features.

### Corrected: static boundary checks missed common call forms

The previous checker inspected attribute calls, missing imported constructors such
as `from obsws_python import ReqClient as Client; Client()` and captured methods
such as `switch = client.set_current_program_scene`. It also missed adapter reads
through `feature._live` and raw scene requests passed by keyword.

The checker now shares one operation policy between attribute references and
imported symbols, checks private-state attribute reads, and inspects keyword raw
scene requests. Tests verify rejection and continued acceptance of legitimate
transport owners/public feature adapters. No exception was broadened.

This remains a syntactic guard. Reflection, computed dynamic imports, indirect
data flow and all possible lock interleavings need code review and behavioral
tests. Matching reserved operation names is intentionally conservative; any new
exception requires a concrete owner and justification.

### Remaining: workflow explanations have broad source-review debt

The workflow check already failed before audit edits. At the audit's final review,
74 of 92 behaviors across 31 mapped owners need review, with 121 discovered source
facts and no manifest shape issues. Many warnings are conservative owner-scope
fingerprint changes rather than evidence that an individual explanation is wrong.
Several cited symbols also changed, including League HTTP/control adapters,
League Stats collector/report behavior and Twitch celebration submission.

This matters because agents and the Stream map use these descriptions to explain
conditions, waits and release paths, and GitHub's boundary workflow also runs
`check_workflows.py`. Passing tests does not make the workflow check green.

Review each flagged behavior against its cited symbols and relevant owner changes;
correct its explanation, then stamp that specific flow. Prioritize coordination,
Hub startup, replay, League handoffs and active recording. No bulk stamps or
disabled checks were applied in this audit. Comment/docstring corrections here
do not change runtime behavior; docstrings still participate in source fingerprints.

Local evidence: `output/architecture-audit-workflows-20261015.log`.

### Remaining: useful future responsibility extractions

Size alone is not a defect. These are focused candidates based on mixed concerns,
not a recommendation to split every large file:

| Current owner | Potential extraction | Behavior to preserve and test |
| --- | --- | --- |
| `lib/shared_media/media_project.py: run_media_project` (386 lines at audit) | Input/command routing separate from assembly and resource lifetime | Profile reload, permission gates, random-mode cancellation, subscriptions and final source cleanup |
| `mini projects/soundboard/main.py: run` (339 lines) | Feature trigger/command adapter | Voice/keyboard equivalence, selected asset, saved profile and personal gain, cleanup |
| `mini projects/specific_song/main.py: run` (308 lines) | Command dispatch and random-mode policy | Track selection, cancellation before admission, music focus and actual completion identity |
| `mini projects/league_api/main.py: Service` | Service orchestration out of the entry point, then settings-edit policy if needed | Public facade compatibility, one poll loop, revision checks, recording ownership and partial startup cleanup |
| `mini projects/league_api/http_server.py: make_handler` (315 lines) | Route groups behind existing public service APIs | Existing URLs/status codes; transport never takes over feature policy |

Perform one extraction at a time with unchanged settings paths and public
contracts. Update evidence references and responsibility documentation with that
extraction. The active League work was not moved during this pass. No new runtime
controller, process, worker, listener, registry or event bus was introduced.

## Verification

- Baseline architecture check: 474 modules, zero violations.
- Baseline full offline suite: 1,415 tests passed.
- Strengthened boundary regression suite: six tests passed, including multiple
  alias/reference/private-state cases and positive owner cases.
- Final full offline suite: 1,418 tests passed in 102.950 seconds
  (`output/architecture-audit-offline-final-20261015.log`).
- Final architecture check: 474 modules, zero violations.
- Runtime executable AST comparison: unchanged in both edited runtime files
  (`events.py`, `lib/project_runtime.py`) after excluding docstrings.
- Local documentation links resolve; Git whitespace checks pass.
- Workflow check: fails for the review debt described above; not waived.

The relevant existing behavioral suites include `tools.test_coordination`,
`tools.test_cleanup`, `tools.test_shared_state`, `tools.test_hub_startup`,
`tools.test_module_lifecycle` and `tools.test_architecture_boundaries`. They cover
overlapping claims, stale completion, manual/external scene choices, replacement,
cancellation, startup failure and settings preservation using disposable fixtures.

Changes in this pass affect documentation and offline enforcement only. Personal
settings and media were not rewritten by the audit. Runtime algorithms are
unchanged, so a Hub restart and live synthetic playback were unnecessary. Browser
renderer suites were not rerun for these documentation/checker changes.
