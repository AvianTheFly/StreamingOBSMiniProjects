import { ProductionScene } from './scene.js';
// One composed match presentation. Server deadlines survive Live Client shutdown;
// local deadlines remove it even if the service itself becomes unavailable.
const layer = document.createElement('div');
layer.id = 'match-screen';
layer.style.cssText = 'position:absolute;inset:0;z-index:100;pointer-events:none;display:none;background:#04090e';
document.querySelector('#stage').append(layer);
const images = new Map();
for (const key of ['game_start', 'victory', 'defeat']) {
  const image = new Image();
  image.alt = '';
  image.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover';
  image.src = '/match-art/' + key;
  images.set(key, image);
}
const border = document.createElement('canvas');
border.id = 'match-screen-border';
border.width = 1920; border.height = 1080;
border.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
const scene = new ProductionScene(border);
let artReady = false;
scene.ready.then(() => { artReady = true; paint(); }).catch(() => {});
let state = null, received = 0;
let production = null;
function clear() {
  state = null;
  scene.clear();
  layer.style.display = 'none';
  layer.style.opacity = '0';
}
function paint() {
  if (!state) return;
  const since = (performance.now() - received) / 1000;
  const elapsed = state.elapsed + since;
  const remaining = state.remaining - since;
  if (remaining <= 0) { clear(); return; }
  const image = images.get(state.key);
  if (elapsed < 0 || !image?.complete || !image.naturalWidth) {
    layer.style.display = 'none';
    return;
  }
  if (layer.firstChild !== image) layer.replaceChildren(image, border);
  if (artReady) {
    // The picture owns this clock and fade. Never reuse the director's shorter
    // event timer, ambient dragon, death presentation, or lifecycle caption.
    scene.draw({enabled:true, opacity:(production?.opacity ?? .8)*.7,
      intensity:production?.intensity ?? 1, edge_width:production?.edge_width ?? 56,
      effect:{key:state.key, title:'', theme:state.key==='victory'?'gold':state.key==='defeat'?'ash':'arcane',
        elapsed, duration:state.duration}});
  }
  layer.style.display = 'block';
  layer.style.opacity = String(Math.max(0, Math.min(1, elapsed / .3, remaining / .3)));
}
window.leagueMatchScreens = {
  update(next, settings) {
    if (!next) { clear(); return; }
    production = settings;
    state = next;
    received = performance.now();
    paint();
  },
  // Keep the last finite deadline on transport failure, rather than cutting
  // the result short. New successful state and explicit clears still win.
  disconnected() { paint(); },
  ownsPresentation() { return !!state && state.remaining-(performance.now()-received)/1000>0; },
};
setInterval(paint, 50);
window.addEventListener('pagehide', clear);
