import { terrain } from './terrain.js';
import { burst } from './bursts.js';
import { clipEdges } from './materials.js';
export class ProductionScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d');
  }
  clear() {
    this.c.clearRect(0, 0, 1920, 1080);
  }
  draw(state) {
    this.clear();
    if (!state?.enabled) return;
    const c = this.c;
    if (state.ambient) {
      c.save();
      clipEdges(c);
      c.globalAlpha = state.opacity * Math.min(1, state.ambient.elapsed / 1.4) * 0.65;
      // The entrance rises in from outside the screen; an established frame is quiet.
      terrain(c, state.ambient.theme, state.ambient.elapsed, state);
      c.restore();
    }
    if (state.effect) {
      c.save();
      clipEdges(c);
      c.globalAlpha = state.opacity;
      burst(c, state.effect, state);
      c.restore();
    }
  }
}
