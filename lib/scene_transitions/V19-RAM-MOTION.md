# Mountain ram: turns and complete jump poses

Revision 19 keeps the accepted golden mountain spirit and adds eight painted
poses using built-in ImageGen: rear-quarter right, actual rear, rear-quarter
left, front-quarter left, deep crouch, push-off, airborne tuck and landing reach.
The project assets are `web/assets/ram-turn-views-v19.png` and
`web/assets/ram-jump-views-v19.png`. Exact prompts, generation mode and original
output paths are recorded in `RAM-MOTION-V19-PROMPTS.json`. Earlier art is retained.

`rigs/ram/views.js` defines named views; pack order never drives choreography.
`skin-pack.json` chooses filenames, normalized crops and height. `art.js` loads
all thirteen views as one bounded generation. `calibration.js` measures the
native body/horns and all four painted feet for each new pose. A replacement
painting with changed anatomy must receive new measured landmarks.

`leaps.js` owns parabolic bounds, prelaunch crouch, full tuck, landing reach and
compression. Landings occur at .68, 1.48 and 2.62 seconds. `turn.js` owns a planted
right-to-left turn through actual rear paintings at 1.67–1.92 seconds, before
the leftward takeoff at 2.08. Both variants face their direction of travel.
The final frontal turn, triumphant rear and 3.65-second horn strike are retained.
`motion.js` assembles these contracts and world scale/pitch without asset indices.

`registration.js` keeps early native body proportions, registers late horn
contacts and blends a local head/neck correction across jump-pose handoffs.
`skin.js` applies that correction equally to the body and attached surfaces;
the field leaves rigid hoof pads untouched. Complete crouch/tuck/reach paintings
carry the deep anatomical bends. The existing side/quarter joint rig still owns
its upper/lower segments and rigid hooves. `presentation.js` blends complete
views and projects contacts through exactly the same deformation as the paint.
Stage footholds persist through the planted turn, shadows follow the actual
ground height and motion trails follow the facing direction. `ram_sound.py`
follows the revised landings without changing personal volume settings.

Run the finite mountain and skin tests, scoped choreography
`node tools/verify_spirit_choreography.cjs ram ram-alt`, enlarged/dense review,
architecture and focused transition/native offline tests. Default choreography
still checks all eight authoring clips. The mountain test examines actual painted
triangles, all four attachments/hooves, buffer containment, real back-view turn,
jump phases, facing versus travel, painted contacts and every opaque cut frame.
Skin replacement also reverses pack order and tests failed-generation preservation.

Export to `C:/StreamingMedia/Transitions/udyr-spirits-v19-ram-motion` with
`tools/render_spirit_transitions.cjs ram ram-alt`. Preserve the other six clips
from the actually loaded directory and compare their hashes again at installation.
Verify optimized quality and decode every delivered clip. Keep existing personal
cut choices inside the 3.85–4.25-second full-cover plateau; native media-clock
ownership is unchanged. The finite installer verifies the loaded collection and
directory. Restart only the supported Hub hidden, with one keyboard worker,
preserving Footage Desk and OBS's running/off state.

The live preview exposed refused module connections on the loaded Hub while the
same asset graph passed through an isolated server. `hub_ui/server.py` owns a
64-slot HTTP accept queue so a burst survives a busy accept loop. The regression
queues 24 real asset requests before serving, then verifies each response and
bounded cleanup. This shared transport change requires the full offline suite.

Delivery evidence is in the versioned C: export. Both ram clips exceed .997 SSIM;
all eight encoded clips contain 396 frames and 25 fully opaque 1080p cut frames.
The loaded native directory, preserved six other clips and personal settings,
replay paths, one Hub/keyboard child and independent Footage Desk were audited.
The live Hub preview passes after the accept-queue fix. Architecture checked 401
modules with zero violations; 31 focused offline tests passed. The full suite
completed with 984/985 passing and one separate League border-duration expectation
failure (`league_api.test_border_catalog`, expected .8 seconds, received 2).
The transition workflow is reviewed; unrelated global review warnings remain.
