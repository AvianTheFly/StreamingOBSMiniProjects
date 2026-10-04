// Rock-first staging and a deterministic weighty crawl of the intact creature.
import {soften,window} from '../../performance.js';
import {anatomy,sourcePoint} from './calibration.js';
export const hits=[.92,1.94,3.62];
export const walk={stop:3.03,braceStart:2.84,braceEnd:3.07,cycle:.42,swing:.27,start:1.02,offsets:[0,.21,.21,0]};
const ramp=q=>{q=Math.max(0,Math.min(1,q));const e=.16;
 return (q<e?q*q/(2*e):q>1-e?1-e-(1-q)**2/(2*e):q-e/2)/(1-e);};
export function travel(t){return -690+260*soften((t-.62)/.30)+1150*ramp((t-1.02)/2.01);}
export function arrival(t,variant=0){return {x:variant?1920-travel(t):travel(t),y:982,size:820,
 angle:0,alpha:soften(t/.13),variant,t};}
export function support(t,index){
 const p=sourcePoint(...anatomy.legs[index].sole),offset=walk.offsets[index],shift=.032;
 if(t<=walk.start)return {paw:p,planted:false};
 if(t<=walk.start+offset)return {paw:[p[0]+(travel(walk.start)-travel(t))/820,p[1]],planted:true};
 let contactAt=walk.start,advance=0;
 for(let n=0;n<8;n++){
  const start=walk.start+offset+n*walk.cycle,end=start+walk.swing;
  if(start>walk.stop)break;if(t<start)break;
  if(t<=end){const q=soften((t-start)/walk.swing),a=p[0]+advance+(travel(contactAt)-travel(t))/820,
   b=p[0]+shift+(travel(end)-travel(t))/820;
   // Lift the entire ankle/claw pad into a deliberate recovery arc. The joint
   // solver folds both leg segments around this target, instead of toe shuffling.
   const clearance=index<2?.052:.035;
   return {paw:[a+(b-a)*q,p[1]-clearance*Math.sin(q*Math.PI)],planted:false};}
  contactAt=end;advance=shift;
 }
 return {paw:[p[0]+advance+(travel(contactAt)-travel(t))/820,p[1]],planted:true};
}
export function effort(t){return hits.reduce((a,at,i)=>a+window(t,at-.13,at-.02,at+.065,at+.26)*(i===2?1:.28),0);}
export function acting(t){const brace=soften((t-walk.braceStart)/(walk.braceEnd-walk.braceStart)),e=effort(t);
 const states=anatomy.legs.map((leg,i)=>{const s=support(t,i),p=sourcePoint(...leg.sole);
  return {paw:[s.paw[0]*(1-brace)+p[0]*brace,s.paw[1]*(1-brace)+p[1]*brace],planted:brace===1||s.planted};});
 return {paws:states.map(s=>s.paw),planted:states.map(s=>s.planted),brace,effort:e,bob:(1-brace)*Math.sin(t*7)*.003};}
export function contacts(pose){return acting(pose.t).paws.map(([x,y])=>[(pose.variant?-1:1)*x,y]);}
