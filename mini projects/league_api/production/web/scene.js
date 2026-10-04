import { burst } from './bursts.js';
import { hextechAtmosphere } from './elements.js';
import { clipEdges } from './materials.js';
import { deathAtmosphere,EdgeFinish,eventArt,artReady } from './event-art.js';
export class ProductionScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ready = artReady;
    this.c = canvas.getContext('2d');
    this.art = document.createElement('canvas');
    this.art.width = 1920; this.art.height = 1080;
    this.artContext = this.art.getContext('2d');
    this.finish = new EdgeFinish();
  }
  clear() {
    this.c.clearRect(0, 0, 1920, 1080);
    this.artContext.clearRect(0, 0, 1920, 1080);
  }
  draw(state) {
    this.clear();
    if (!state?.enabled) return;
    const c = this.artContext;
    if (state.ambient && !state.death) {
      c.save();
      clipEdges(c);
      c.globalAlpha = Math.min(1, state.ambient.elapsed / 1.4);
      // The entrance rises in from outside the screen; an established frame is quiet.
      c.globalAlpha *= .8;
      if(state.ambient.theme==='hextech'){
        c.globalAlpha*=.82/.8;
        hextechAtmosphere(c,state.ambient.elapsed);
      }else eventArt(c,{key:'dragon_'+state.ambient.theme,theme:state.ambient.theme,elapsed:state.ambient.elapsed,duration:Infinity,title:''},state);
      c.restore();
    }
    if (state.effect) {
      c.save();
      clipEdges(c);
      c.globalAlpha = 1;
      burst(c, state.effect, {...state,hextechBasePresent:state.ambient?.theme==='hextech'&&!state.death});
      c.restore();
    }
    if(state.death){
      c.save();clipEdges(c);c.globalAlpha=1;
      deathAtmosphere(c,state.death);c.restore();
    }
    this.finish.apply(c,10);
    // The user's strength control applies once to the composed show. Solid
    // engraving stays solid relative to glass even where several layers overlap.
    this.c.save(); this.c.globalAlpha = Math.max(0,Math.min(1,state.opacity ?? 1));
    this.c.drawImage(this.art,0,0); this.c.restore();
  }
}
