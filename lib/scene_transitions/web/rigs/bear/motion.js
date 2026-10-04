// Pure quadruped acting; painted limbs use the same solved bone/contact paths.
import {soften} from '../../performance.js';
import {TAU} from '../../math.js';
import {anatomy,bodyPoint,solveLeg,twistTrack} from './calibration.js';
import {frontActing,frontClawContact} from './front-motion.js';
export {twistTrack};
// Existing audio/camera impacts land at each strike's maximum-speed midpoint.
export const swipes=[{at:2.11,hand:0,duration:.14},{at:2.61,hand:1,duration:.14},{at:3.11,hand:0,duration:.14}];
export function direction(variant=0){return variant?-1:1;}
export function gait(t){const phase=(t-.08)*TAU*2.25,flight=Math.max(0,Math.sin(phase))**2;
 return {phase,cycle:((t-.08)*2.25%1+1)%1,lift:flight*.065,compression:Math.max(0,-Math.sin(phase))*.018};}
export function views(t){const turn=soften((t-1.05)/.52),quarter=soften((t-1.57)/.08),run=1-soften((t-.98)/.08),front=soften((t-1.65)/.29);return {side:1-quarter,quarter,turn,run,front};}
export function shoulderPose(t){return anatomy.shoulders.map(([u,v])=>bodyPoint(u,v,t));}
function curve(a,b,c,p){const q=1-p;return [q*q*a[0]+2*q*p*b[0]+p*p*c[0],q*q*a[1]+2*q*p*b[1]+p*p*c[1]];}
export function quarterActing(t,variant=0){
 const roots=shoulderPose(t),paws=anatomy.plants.map(p=>[...p]),planted=[true,true];
 for(const sw of swipes){const d=t-sw.at;if(d<-.22||d>.26)continue;const hand=sw.hand,plant=paws[hand];
  const wind=hand===0?[.18,-.10]:[.45,-.12],end=hand===0?[.49,-.25]:[.18,-.13];
  if(d<0)paws[hand]=curve(plant,[plant[0]-.025,-.14],wind,soften((d+.22)/.22));
  else if(d<=sw.duration)paws[hand]=curve(wind,hand===0?[.35,-.34]:[.42,-.06],end,soften(d/sw.duration));
  else paws[hand]=curve(end,[plant[0]+.015,-.065],plant,soften((d-sw.duration)/(.26-sw.duration)));
  planted[hand]=d<=-.215||d>=.255;
 }
 const legs=roots.map((root,i)=>solveLeg(root,paws[i],anatomy.lengths[i]));
 const side=direction(variant),mirror=p=>[p[0]*side,p[1]];
 return {roots:roots.map(mirror),paws:paws.map(mirror),legs:legs.map(l=>({...l,root:mirror(l.root),elbow:mirror(l.elbow),paw:mirror(l.paw)})),planted,
  views:views(t),gait:gait(t),hindPaws:[[-.43*side,0],[-.03*side,-.025]]};
}
export function acting(t,variant=0){
 const quarter=quarterActing(t,variant),weight=quarter.views.front;if(weight===0)return quarter;
 const front=frontActing(t,swipes),side=direction(variant),mirror=p=>[p[0]*side,p[1]];
 const paws=quarter.paws.map((p,i)=>p.map((x,j)=>{const shifted=x-weight*(j===0?.36*side:.17);return shifted+(mirror(front.projectedPaws[i])[j]-shifted)*weight;}));
 // Quarter bones exist only for the view handover. The frontal paint supplies
 // complete raised-forepaw poses, so do not advertise old bones/planted paws.
 return {...quarter,front,mode:weight===1?'frontal':'handover',paws,
  legs:weight===1?[]:quarter.legs,roots:weight===1?[]:quarter.roots,
  planted:[false,false],hindPaws:front.hindPaws.map(mirror)};
}
export function clawContact(t,hand,offset=0,variant=0){const act=acting(t,variant),side=direction(variant);
 if(!act.front)return [act.paws[hand][0]+offset*side,act.paws[hand][1]];
 const projected=frontClawContact(t,act.front,hand,offset);
 const quarter=quarterActing(t,variant).paws[hand],weight=act.views.front;
 const start=[quarter[0]+offset*side-weight*.36*side,quarter[1]-weight*.17];
 return start.map((x,i)=>x+((i===0?projected[i]*side:projected[i])-x)*weight);
}
