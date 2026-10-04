// Permanent claw-carved holes. Each strike opens its own painted-screen tear.
import {clamp,smooth} from '../math.js';
import {line,ribbon,glow} from '../fx.js';
import {world} from '../performance.js';
import {swipes,clawContact} from '../rigs/bear-motion.js';
import {arrival} from './approach.js';
export function slashPoint(swipe,p,offset=0,variant=0){
 const t=swipe.at+p*swipe.duration,pose=arrival(t,variant);
 return world(pose,clawContact(t,swipe.hand,offset,variant));
}
export function tearWidth(swipe,t){const index=swipes.indexOf(swipe);
 if(index<0)throw Error('Unknown bear strike');
 const strike=smooth(swipe.at,swipe.at+swipe.duration,t),settle=smooth(swipe.at+swipe.duration,swipe.at+.45,t);
 return strike*[600,850,1100][index]+settle*[200,300,400][index];
}
export function trails(c,t,{mask=false,opacity=1,variant=0}={}){
 const takeover=smooth(3.28,3.85,t);
 for(const [index,sw] of swipes.entries()){
  if(t<=sw.at)continue;const progress=clamp((t-sw.at)/sw.duration),width=tearWidth(sw,t);
  for(const offset of [-.035,0,.035]){
   const points=Array.from({length:64},(_,i)=>slashPoint(sw,progress*i/63,offset,variant));
   if(mask){
    // Tapered, rough feathered edges read as gouges during each strike.
    ribbon(c,points,'#fff',6+width,1);
    // The last blow releases pressure through those existing cuts, reaching the
    // opaque plateau without replacing them with an unrelated full-screen wipe.
    if(takeover>0)line(c,points,'#fff',takeover*[2200,3200,4300][index],1);
    continue;
   }
   ribbon(c,points,'#06101a',24+width*.04,.92*opacity);
   ribbon(c,points,'#327295',12,.8*opacity);ribbon(c,points,'#c9edff',3,.8*opacity);
   const tip=points.at(-1);glow(c,...tip,35,'#afeeff',clamp(1-(t-sw.at)/.33)*.7);
  }
 }
}
