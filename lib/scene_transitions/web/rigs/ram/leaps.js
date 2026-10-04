// Ballistic body travel, grounded preparation and the four painted jump phases.
import {soften,window} from '../../performance.js';
import {layer,blend} from './views.js';
export const jumps=[{start:.08,end:.68,from:[-400,990],to:[460,940],height:220},
 {start:.90,end:1.48,from:[460,940],to:[1340,860],height:355},
 {start:2.08,end:2.62,from:[1340,860],to:[960,998],height:290}];
export function jumpState(t){for(let i=0;i<jumps.length;i++){const j=jumps[i];if(t<=j.end){const q=Math.max(0,Math.min(1,(t-j.start)/(j.end-j.start)));
 return {index:i,q,lift:Math.sin(q*Math.PI),groundY:j.from[1]+(j.to[1]-j.from[1])*q,x:j.from[0]+(j.to[0]-j.from[0])*q,
  y:j.from[1]+(j.to[1]-j.from[1])*q-4*j.height*q*(1-q),airborne:t>j.start&&t<j.end};}}
 return {index:2,q:1,lift:0,x:960,y:998,groundY:998,airborne:false};}
export function jumpPose(t,j){const spec=jumps[j.index],mirror=j.index===2&&t>=1.92?-1:1;
 const prepare=soften((t-(spec.start-.15))/.15),land=jumps.reduce((v,s)=>v+window(t,s.end-.015,s.end+.045,s.end+.065,s.end+.19),0);
 if(!j.airborne){const recent=jumps.findLast(s=>t>=s.end&&t<s.end+.19),pre=t<spec.start?prepare:0;
  let layers=[layer('side',1,mirror)];
  if(recent){const age=t-recent.end,sign=recent.to[0]<recent.from[0]?-1:1;
   layers=age<.075?blend(layer('reach',1,sign),layer('crouch',1,sign),soften(age/.075)):
    blend(layer('crouch',1,sign),layer('side',1,sign),recent===jumps[2]?0:soften((age-.075)/.115));}
  layers=layers.map(l=>({...l,weight:l.weight*(1-pre)}));if(pre)layers.push(layer('crouch',pre,mirror));
  return {layers,compression:Math.max(pre,land),land};}
 const q=j.q;let layers;
 if(q<.12)layers=blend(layer('crouch',1,mirror),layer('push',1,mirror),soften(q/.12));
 else if(q<.31)layers=blend(layer('push',1,mirror),layer('tuck',1,mirror),soften((q-.12)/.19));
 else if(q<.63)layers=[layer('tuck',1,mirror)];
 else if(q<.84)layers=blend(layer('tuck',1,mirror),layer('reach',1,mirror),soften((q-.63)/.21));
 else layers=[layer('reach',1,mirror)];
 return {layers,compression:0,land};
}
