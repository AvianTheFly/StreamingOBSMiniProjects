# Little appearances: reusable Easter eggs

Open `index.html` in a browser to audition all 24 five-second acts. Choose a
character, choose an act, then Play once. Frame stepping, scrubbing, speed,
size, horizontal flip, and four backdrop choices are available. Repeat is off
by default. The preview stops while hidden. Everything is local and silent.

`preview-reel.mp4` is a 40-second video index showing each character's three
actual exported performances side by side.

## The collection

| Character | Greeting | Dance or signature | Joke |
|---|---|---|---|
| Kirby | Poyo hello | Victory two-step | Snack in, star out |
| Boo | Too shy to say hi | Ghost mambo | Scared of its own boo |
| Crewmate | Crew reporting | Emergency disco | One more card swipe |
| Creeper | Friendly head tilt | Four-foot shuffle | Definitely not exploding |
| Knife goose | A very polite honk | Stolen cutlery parade | Your cup is my cup |
| Getting Over It climber | Summit salute | Cauldron groove | I had that |
| Hornet | Quiet challenger | Needle recital | Silk got tangled |
| Salvage robot | Boot-up wave | Do the actual robot | Very valuable. Very fragile. |

Each act has an entrance, performance, brief finish, exit, and fully transparent
first and last frames. There are 120 output frames per act at 24 fps on a
512 × 512 transparent canvas. The character artwork occupies part of that
canvas to leave room for motion. It is intended for small-to-medium cameos.

Seven characters have 24 newly generated illustrations each: eight key poses
per act. These use deliberately held and repeated poses, with smooth authored
entrances and exits. They are limited pose animations, not 120 independently
drawn images per clip. Boo's three original approved poses have new choreography;
two attempts to generate a new Boo sheet were rejected by the image tool.
The salvage robot is our original R.E.P.O.-inspired design.

## Reuse

- `clips/*.webm`: 24 silent VP9 videos with alpha, ready for compatible media
  players, editors and OBS Media Sources. Disable looping for one-shot use.
  In OBS, restart playback when the source becomes active; hide it when finished.
- `frames/<act>.zip`: each clip's numbered RGBA PNG frames and timing metadata.
  Import as a 24 fps image sequence when an editor does not support WebM alpha.
- `poses/<character>/*.png`: isolated illustrated poses on a common 384 × 384
  registration canvas. Anchor: x=192, y=320. These allow different choreography.
- `manifest.json`: clip IDs, filenames, frame counts, durations, anchors and sources.
- `choreography.js`: pure `Cameo.sample(clip, seconds)` and a Canvas renderer.
  A host supplies its own clock and can change position, scale and mirroring.
  Call `renderer.load(characterId)`, then `renderer.draw(context, clip, time,
  {scale: 1, flip: false, x: 0, y: 0})`. Draw clears its canvas, so use a dedicated
  overlay canvas or draw into a temporary surface before compositing. Call
  `renderer.dispose()` at the end. There is no internal timer in the renderer.
- `art/`: preserved generated sheets plus Boo's original poses.
- `prompts.json` and `generation-log.json`: exact built-in imagegen prompts,
  source paths, and the recorded Boo fallback. No CLI/API image generation used.

The full ZIP includes the gallery, clips, per-act frame ZIPs, poses, source
art, manifest, prompts, and verification reports. Extract it before opening
the gallery. The loose PNG sequences remain beside the source workspace pack.

## Character reference notes

The jokes are newly authored. Their starting points are the characters' familiar
actions: [Kirby's inhale and float](https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NAAPE.pdf),
[Boo's shyness](https://www.nintendo.com/en-ca/store/products/amiibo-boo-super-mario-104015/),
[Among Us crewmate roles](https://innersloth.zendesk.com/hc/en-us/articles/7913947403924-Roles-Explanation),
[Creeper's explosive identity](https://www.minecraft.net/fr-ca/article/meet-creeper),
[Untitled Goose Game's mischief](https://untitled.goose.game/),
[Getting Over It](https://www.foddy.net/blog/2017/09/getting-over-it/),
[Hornet's Silksong adventure](https://hollowknightsilksong.com/), and
[R.E.P.O.'s salvage premise](https://store.steampowered.com/app/3241660/REPO/).

## Build and verification

The parent directory owns finite preparation and exports: `prepare.cjs` extracts
complete connected silhouettes, `export_frames.cjs` renders every PNG through
the actual gallery renderer and tests seeking/replacement/clear endpoints, and
`encode.py` encodes WebM through the existing shared conversion budget. It
decodes every clip with libvpx to verify frame count and retained alpha.

Run the Node scripts with the bundled `sharp` and `playwright` packages on
NODE_PATH; run the Python encoder with `py -3.11`. No application settings,
OBS sources, hotkeys or live lobby rotation are changed by these artifacts.
