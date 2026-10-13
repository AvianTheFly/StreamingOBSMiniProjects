import { ProductionScene } from './scene.js';
const canvas = document.createElement('canvas');
canvas.width = 1920;
canvas.height = 1080;
canvas.id = 'production-effects';
canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none';
document.querySelector('#stage').prepend(canvas);
const scene = new ProductionScene(canvas);
let state = null,
  received = 0,
  frame = 0,
  painted = false,
  lastFrame = 0,
  sourceVisible = true,
  visible = !document.hidden;
function clear() {
  cancelAnimationFrame(frame);
  frame = 0;
  if (painted) scene.clear();
  painted = false;
}
function tick(now) {
  if (!visible || !state?.enabled) {
    clear();
    return;
  }
  const elapsed = (now - received) / 1000;
  if (elapsed > 2.5) {
    clear();
    return;
  }
  if (now - lastFrame >= (state.effect || state.death ? 1000 / 30 : 1000 / 15)) {
    lastFrame = now;
    const current = { ...state };
    if (current.ambient)
      current.ambient = { ...current.ambient, elapsed: current.ambient.elapsed + elapsed };
    if (current.effect) {
      current.effect = { ...current.effect, elapsed: current.effect.elapsed + elapsed };
      if (current.effect.elapsed >= current.effect.duration) current.effect = null;
    }
    if(current.death)current.death={...current.death,elapsed:current.death.elapsed+elapsed,remaining:Number.isFinite(current.death.remaining)?Math.max(0,current.death.remaining-elapsed):null};
    if(current.stance){current.stance={...current.stance,elapsed:current.stance.elapsed+elapsed};if(current.stance.elapsed>=current.stance.duration)current.stance=null;}
    painted = true;
    scene.draw(current);
    if (!current.ambient && !current.effect && !current.death && !current.stance) {
      clear();
      return;
    }
  }
  frame = requestAnimationFrame(tick);
}
window.leagueProduction = {
  update(next) {
    // Match artwork owns the entire sequence, including its result delay.
    state = window.leagueMatchScreens?.ownsPresentation() ? null : next;
    received = performance.now();
    if (!state?.enabled || (!state.ambient && !state.effect && !state.death && !state.stance)) {
      clear();
      return;
    }
    if (!frame && visible) frame = requestAnimationFrame(tick);
  },
};
function updateVisibility() {
  visible = sourceVisible && !document.hidden;
  if (!visible) clear();
  else if (!frame && state && (state.ambient || state.effect || state.death || state.stance)) frame = requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', updateVisibility);
window.addEventListener('obsSourceVisibleChanged', event => {
  sourceVisible = event.detail?.visible !== false;
  updateVisibility();
});
window.addEventListener('pagehide', () => {clear();scene.stanceAccent.dispose();});
window.addEventListener('pageshow', () => scene.stanceAccent.prepare());
