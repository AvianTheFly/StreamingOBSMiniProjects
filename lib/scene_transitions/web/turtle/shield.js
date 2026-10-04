// Reactive curved hex membranes and an independently validated solid cut mask.
import {lerp,TAU} from '../math.js';
import {soften,window} from '../performance.js';
import {polygon,glow} from '../fx.js';
import {arrival,hits} from '../rigs/turtle/motion.js';
import {outline,paint,edge,texture} from './dome.js';
export function defense(t,variant=0,index=0){const a=arrival(t,variant),side=variant?-1:1;
 return {x:a.x+side*70,y:650,r:445,sx:1.23,sy:.89,side,
 alpha:index===2?soften((t-3.07)/.15):window(t,hits[index]-.20,hits[index]-.045,hits[index]+.10,hits[index]+.48)};}
export function hexPoints(x,y,r,sx=1,sy=1){return Array.from({length:6},(_,i)=>[x+Math.cos(i*TAU/6)*r*sx,y+Math.sin(i*TAU/6)*r*sy]);}
export function shield(t,variant=0){const a=defense(t,variant,2),p=.15*soften((t-3.12)/.50)+.85*soften((t-hits[2])/.23);
 return {x:lerp(a.x,960,p),y:lerp(a.y,540,p),r:lerp(a.r,1850,p),sx:lerp(a.sx,1,p),sy:lerp(a.sy,1,p),side:a.side,p,alpha:a.alpha};}
export function contact(index,variant=0){const sh=index===2?shield(hits[index],variant):defense(hits[index],variant,index);
 return edge(sh,variant?Math.PI+.58:-.58);}
export function local(c,t,variant=0,index=0,material=null){const sh=index===2?shield(t,variant):defense(t,variant,index);if(!sh.alpha)return;
 c.save();c.globalAlpha=sh.alpha;paint(c,sh,t,contact(index,variant),t-hits[index],false,material);c.restore();}
export function mask(s,t){if(t<hits[2])return false;const sh=shield(t,s.variant);
 s.b.fillStyle='#08392f';polygon(s.b,outline(sh));s.b.fill();return true;}
export function surface(s,t){const c=s.b,sh=shield(t,s.variant);texture(c,s.material,sh);
 // Keep the gritty mineral plate under translucent living energy, never a flat fill.
 c.save();c.globalAlpha=.25;paint(c,sh,t,contact(2,s.variant),t-hits[2],true);c.restore();
 glow(c,960,540,700,'#6cd2aa',.14);
}
