// Assemble body physics and independently authored jump/turn performances.
import {soften,window,track} from '../../performance.js';
import {jumps,jumpState,jumpPose} from './leaps.js';
import {turning,facingFront} from './turn.js';
import {viewIds} from './views.js';
export {jumps,jumpState};
export const beats={takeoffs:jumps.map(j=>j.start),landings:jumps.map(j=>j.end),rearStart:2.86,rearPeak:3.10,rearEnd:3.25,fall:3.29,impact:3.65};
export function acting(t){const j=jumpState(t),pose=jumpPose(t,j),turn=turning(t);
 const layers=t>=2.70?facingFront(t):turn||pose.layers;
 const weights=Object.fromEntries(viewIds.map(id=>[id,0])),mirrors={};
 for(const l of layers){weights[l.id]+=l.weight;mirrors[l.id]=l.mirror;}
 return {t,jump:j,lift:j.lift,land:pose.land,compression:turn?0:pose.compression,
  facing:j.index===2&&t>=1.92?-1:1,rear:window(t,2.86,3.10,3.18,3.42),fall:soften((t-3.28)/.37),
  breath:Math.sin(t*4.4)*.0025,weights,mirrors,turning:!!turn};
}
export const viewWeights=t=>acting(t).weights;
export function approach(t,variant=0){const a=acting(t),j=a.jump,rush=soften((t-3.29)/.36),sign=(variant?-1:1)*a.facing;
 const size=track([[0,320],[.68,440],[1.48,540],[2.62,650],[2.86,670],[3.24,670],[3.65,1520],[3.86,1520]],t);
 const pitch=j.airborne?Math.sin(j.q*Math.PI)*(j.q-.35)*.24:0;
 return {x:variant?1920-j.x:j.x,y:j.y+a.land*12+rush*525,size,
  angle:sign*pitch*(t<2.70?1:0),alpha:soften(t/.08)*(1-soften((t-3.70)/.15)),
  t,variant,hop:a.lift,stride:a.lift,crouch:a.compression,charge:rush};
}
