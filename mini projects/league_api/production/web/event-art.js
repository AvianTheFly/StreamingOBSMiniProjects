// Authored League border composition and scenic geometry; no detection or timers.
import {smooth,EdgeFinish} from './subtle.js';
import {eventRelics,soulRelics,artReady,playfulStories} from './event-relics.js';
export const EVENT_DESIGNS=Object.freeze({...playfulStories,dragon_hextech:'An open circuit closes before its paired crystals power haste gears and attack blades.'});

export function eventArt(c,e,options){
 // The director's keyless ambience exit must not fall back to the retired
 // stone walls and terrain plates in the compatibility renderer.
 if(e.kind==='release'&&e.theme!=='hextech'){
  c.save();c.globalAlpha*=1-smooth(e.elapsed/e.duration);
  eventRelics(c,{...e,key:'dragon_'+e.theme,elapsed:e.elapsed+2,duration:Infinity});
  c.restore();return true;
 }
 const k=e.key;if(!EVENT_DESIGNS[k]&&!k?.startsWith('custom_'))return false;
 const t=e.elapsed;
 c.save();c.lineCap='round';c.lineJoin='round';
 c.globalAlpha*=smooth(t/Math.min(.24,e.duration*.18))*smooth((e.duration-t)/Math.min(.32,e.duration*.2));
 c.globalAlpha*=Math.min(1,Math.max(.3,((options.intensity||1)*(e.intensity||1))**.5));
 if(k==='death')deathAtmosphere(c,{elapsed:t,worth:false});
 else{eventRelics(c,e);}
 c.restore();return true;
}
export function deathAtmosphere(c,death){
 const t=death.elapsed||0,worth=!!death.worth,color=worth?'#cbd7ba':'#a9c9df';
 soulRelics(c,death);
 c.save();c.globalAlpha*=.65*smooth(t/1.4);c.textAlign='center';c.font='500 17px "Segoe UI",sans-serif';c.fillStyle=color;
 const remaining=death.remaining;
 c.fillText(Number.isFinite(remaining)?`RETURNING IN ${Math.max(0,Math.ceil(remaining))}s`:'RETURNING',960,44);
 c.restore();
}
export {EdgeFinish,artReady};
