// Authored League border composition and scenic geometry; no detection or timers.
import {smooth,EdgeFinish} from './subtle.js';
import {eventRelics,soulRelics,artReady,playfulStories} from './event-relics.js';
import {hextechAtmosphere,hextechSurge} from './elements.js';
import {colors as legacyColors} from './palette.js';
export const EVENT_DESIGNS=Object.freeze({...playfulStories,dragon_hextech:'Hexagonal circuits / travelling charge'});
function caption(c,e,color){
 if(!e.title)return;c.save();c.globalAlpha*=.54;c.font=(e.key==='victory'?'500 23px Georgia':'500 16px "Segoe UI",sans-serif');c.textAlign='center';c.fillStyle=color;
 const x=e.category==='economy'?1410:e.category==='survival'?530:960;c.fillText(e.title,x,e.key==='victory'?62:34,620);c.restore();
}

export function eventArt(c,e,options){
 // The director's keyless ambience exit must not fall back to the retired
 // stone walls and terrain plates in the compatibility renderer.
 if(e.kind==='release'&&e.theme!=='hextech'){
  c.save();c.globalAlpha*=1-smooth(e.elapsed/e.duration);
  eventRelics(c,{...e,key:'dragon_'+e.theme,elapsed:e.elapsed+2,duration:Infinity});
  c.restore();return true;
 }
 if(e.key==='dragon_hextech'){
  const t=e.elapsed,d=e.duration;if(t<0||t>=d)return true;
  const power=Math.max(.3,Math.min(2.56,(options.intensity??1.15)*(e.intensity??1)));
  c.save();c.globalAlpha*=smooth(t/.35)*smooth((d-t)/.5);
  c.globalAlpha*=Math.min(1,Math.sqrt(power));
  if(!options.hextechBasePresent)hextechAtmosphere(c,t,true);
  hextechSurge(c,t,d);
  caption(c,e,legacyColors.hextech);c.restore();return true;
 }
 const k=e.key;if(!EVENT_DESIGNS[k]&&!k?.startsWith('custom_'))return false;
 const t=e.elapsed;
 c.save();c.lineCap='round';c.lineJoin='round';
 c.globalAlpha*=smooth(t/Math.min(.85,e.duration*.3))*smooth((e.duration-t)/Math.min(.9,e.duration*.3));
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
 if(worth)c.fillText('THE TRADE STILL COUNTS',960,1060);c.restore();
}
export {EdgeFinish,artReady};
