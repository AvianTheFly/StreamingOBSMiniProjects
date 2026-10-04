// Phoenix rebirth props and flight accents, assembled over the public rig.
import {lerp,smooth,TAU} from '../math.js';
import {glow} from '../fx.js';
import {impulse} from '../motion.js';
import {flight} from './flight.js';
import {fronts} from './veil.js';
import {wake,breath} from './storm.js';
import {palette as p} from './palette.js';
export function entrance(s,t){if(t>3.85)return;const {c,character,field}=s;
 const eggAlpha=smooth(.03,.24,t)*(1-smooth(2.05,2.62,t)),heat=smooth(.35,1.1,t);
 if(eggAlpha>0){character.egg(c,960,1025,340+heat*65,t,eggAlpha);glow(c,960,860,100+heat*140,p.ember,heat*eggAlpha*.3);glow(c,960,920,140,p.cold,heat*eggAlpha*.13);}
 if(t<1.18){const phase=smooth(.02,.94,t),alpha=smooth(.02,.15,t)*(1-smooth(.81,1.06,t));
  character.feather(c,960+(s.variant?-1:1)*Math.cos(phase*Math.PI*1.6)*170*(1-phase),lerp(245,765,phase),160-45*phase,t,alpha);
  for(let i=0;i<5;i++){const a=i*TAU/5+t*1.8;glow(c,960+Math.cos(a)*(175-heat*80),920-Math.sin(heat*Math.PI)*150+i*5,9,i%2?p.ember:p.cold,heat*.17);}
 }
 field.burst(c,t-1.12,960,825,p.ember,.48);field.burst(c,t-1.12,960,870,p.cold,.32);
 const pose=flight(t,s.variant);wake(c,t,pose,time=>flight(time,s.variant));character.draw(c,{...pose,t});
 impulse(c,t,1.12,960,920,p.hot,.25);impulse(c,t,3.16,960,400,p.cold,.45);
 if(t>2.94)breath(c,t,fronts(s,t));
}
