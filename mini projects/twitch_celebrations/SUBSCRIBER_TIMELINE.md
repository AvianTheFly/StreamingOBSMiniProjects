# Subscriber thank-you machine

Subscriptions and resubscriptions use one 4.8-second, 120 BPM musical story.
One upper panel says “THANK YOU FOR SUBBING,” the actual name, and the observed
month count. Missing months are not invented; messages and tier labels are not
added to this show. Characters and props contain no text. The transparent
rectangle x=240..1680, y=170..840 stays clear in every frame.

| Music time | Physical payoff |
| --- | --- |
| 0.25 | Corner stages and three performers arrive |
| 0.75 | Goose (or the salvage robot in the cat flavor) sends a heart-stamped coin rolling |
| 1.75 | The actual coin enters the crewmate’s machine; the courier gets a tiny blank receipt |
| 2.25 | The machine pops its lid and returns a heart across the bottom; a crown lands on the crewmate |
| 3.25 | Kirby inhales the returned heart and puffs up |
| 3.75 | Kirby burps a heart balloon, still tied to his foot |
| 4.25 | Final applause and landing, followed by a clean fade |

The original music is prepared offline by `tools/prepare_subscriber_music.py`.
It plays once, through the existing saved fader, without adding an audio worker.
Visuals follow that audio element’s currentTime; blocked audio falls back to the
bounded event clock. Existing custom audio is honored, although arbitrary tracks
have no measured beat map. Saved custom visual choices are preserved but do not
cover the game during subscriptions. Follow and gift behavior stays unchanged.

| Observed months | Additions |
| --- | --- |
| Unknown or 1–2 | Complete three-character story; 8 particles per applause burst |
| 3–5 | Boo appears and gets a crown; 14 particles |
| 6–11 | Cauldron climber discovers a coin fountain and catches a heart; small edge balloons; 22 particles |
| 12+ | Hornet ties a bow on a large heart; 30 particles |

Intensity caps at six characters, with unchanged size of the gameplay opening,
unchanged duration and no brightness flashes. Long subscriptions do not create
unbounded particles or extra workers. Four palettes vary the props; the cat
palette uses the existing salvage robot as courier. This is a finite authored
story, not a different new joke for every individual event.

`subscriber_story.js` owns facts and pure contact trajectories; `subscriber_acts.js`
owns drawing; `subscriber_party.js` owns its DOM/canvas and bounded resize observer.
`SupporterShow` is the routing facade. The queue/transport/overlay retain lifecycle
and audio ownership. The existing feature-local 24-pose cache is reused without
copying or changing lobby source artwork.

`tools/test_subscriber_party.cjs` exercises production routes, all themes and
milestones, clear gameplay on every sampled frame, fixed contact endpoints,
intensity caps, literal long/international names, reduced motion, media seeking,
custom audio, removal on end/stop, private controls and approved follower pixel
fingerprints. `tools/test_supporter_rendering.cjs` is its compatibility entry.
`tools/export_subscriber_preview.cjs` renders exact music-time frames for review.
