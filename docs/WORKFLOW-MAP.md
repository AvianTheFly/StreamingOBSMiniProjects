# Stream map

Open **Stream map** in the Hub navigation (`http://127.0.0.1:7420/#workflows`).
The **Map** starts with six connected areas: your controls, your game, your
viewers, sound and video, clips and replays, and screen resources. Open an area
to reveal a smaller map. For example, **Your game → After a match → Return to a
lobby** goes from a stream overview to independent reactions to the participants
in one behavior. The participant view summarizes each owner's part before showing
individual steps. **Exact steps** opens the full condition/wait/cleanup diagram.
Participants with a supported workspace link directly to their existing controls.

The smallest situation maps also show **what overlaps**: reactions on the left,
shared resources on the right. At the overview, shared destinations are emphasized;
use **Focus** to isolate a resource or reveal independent effects such as saved
clips and match records. **Area connections** returns to the surrounding areas.
Select a resource or intention line for each reaction's purpose, conditions,
protection and timing caveats, alongside the last sampled ownership and recent
recorded decisions. The scene view distinguishes the director's deferred scene
from the client router's separately pending target.

Scene situations include illustrative states: no blockers, a result still showing,
a temporary screen reservation, and a newer manual choice. These use current enable
switches and owner-authored explanations, assuming enabled providers are running,
fresh intent and other admission checks pass. They explain possible outcomes;
they are not an execution simulator or a live prediction. **Observed now** keeps
actual ownership/decisions separate from possible reactions. Result holds influence
cooperating automatic lobby routers, while manual choices can revoke temporary
scene ownership. Two fresh automatic writers have no general fixed priority;
later accepted writes can win, and only one latest director-deferred destination
is retained. This is a useful order-sensitive case to inspect, not a claim that
every shared destination is a race.

`workflow/behavior.js` owns resource grouping, focus and presentation of policy
examples. Optional owner-authored `effects` in the existing manifests name the
resource, intention, role, protection, timing caveats and illustrative outcomes.
They carry the same source-review status as their behavior. Unannotated flows
remain reachable and group from described output owners; their dotted links are
explicitly unclassified, since shared placement does not prove one physical
resource. Current pause rules generate their own scoped intentions. Runtime policy
and settings remain in their existing owners; these controls issue GET requests.

Breadcrumbs, Back and **Whole stream** preserve your place. Search offers a short
set of relevant behaviors only after you type. Hover or keyboard focus highlights
connected areas; select a line to see the evidence behind its connection. Connected
areas at the edge of a submap open their own overview. Drag to pan; scroll or use
+/− to zoom; Fit returns to the whole diagram. The canvas also supports arrow
keys and 0 to fit. Areas, participants and connections support Enter and Space.
The phone layout recomposes the map into two columns.

`hub_ui/app/js/workflow/atlas.js` owns presentation grouping, breadcrumbs and
aggregation of described cross-owner edges and discovered emit/listen pairs.
`workflow/map.js` owns SVG rendering, inspection hit targets, hover/focus and
its disposable camera. Neither owns or writes runtime policy or user settings.
Every described behavior remains reachable; tests verify catalog coverage.

Solid overview links group actual described handoffs and discovered subscriptions;
separate dotted links connect an area's activity to independently owned reactions
grouped under that activity (for example, Replay's own game-data observer).
they are connections, not a single execution sequence. Pale dotted exploration
lines inside a group show containment, not event delivery. In the participant
and exact-step views, arrowed links show handoffs; dotted trigger links represent
independent polling, a control or background work. Similar game evidence can
start different owners independently; their order is not implied by the drawing.
Behavior maps show possible paths, including gates and cleanup, not a promise
that every branch ran. Wiring is discovered from source; Live subscriptions and
recorded fan-out show which callbacks are actually present.

Live shows the current program scene, temporary owner, pending destination,
playback permissions, pause owners, microphone owner and conversion capacity.
Freeze view freezes only this display; the Hub continues recording. History
lets you search observations and inspect actual event fan-out, scene decisions,
source playback/cleanup, voice ownership, alert scheduling and captured replays.
Select a state-change observation to inspect that earlier ownership snapshot.
Callback receipt, request acceptance and completed playback are distinct records.

The Hub records while the page is closed. A single bounded writer retains up to
14 days / 50,000 observations in
`%LOCALAPPDATA%/StreamingHub/workflow-history/observations.sqlite3`. Queue overload
is counted visibly. A storage failure falls back to a bounded memory history.
Only allowlisted decision metadata is recorded; chat and transcript bodies,
audio and credentials are excluded. Browser animation frames and the separate
Footage Desk's internal activity are outside this observation scope.

Each owner maintains brief behavior descriptions next to its code. Source facts
and declared settings are re-read when files change. Function/class AST proofs
stay valid after formatting or line moves. Conservative fingerprints also cover
the involved owners' helpers and browser scripts; changed behavior flags **review
needed**, without silently changing the explanation. The workflow check in CI
requires that review. See CONTRIBUTING.md for the targeted proof update command.
The source endpoint only exposes mapped evidence inside this checkout.

The interaction design uses nested maps and visible group boundaries inspired
by [React Flow sub-flows](https://reactflow.dev/learn/layouting/sub-flows) and
[Blender node groups](https://docs.blender.org/manual/id/5.0/interface/controls/nodes/groups.html).
The implementation is local SVG and native browser controls with no CDN runtime.
