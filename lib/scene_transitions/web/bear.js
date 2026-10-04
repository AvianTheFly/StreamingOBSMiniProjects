import {clamp,smooth,out} from './math.js';
import {glow,line,bolt} from './fx.js';
import {shadow} from './rig.js';
import {swipes,acting,clawContact} from './rigs/bear-motion.js';
import {world} from './performance.js';
import {impulse} from './motion.js';
import {dust} from './atmosphere.js';
export const beats={approach:.12,coil:1.75,plant:1.94,slashes:[2.18,2.68,3.18]};
export {swipes,acting};
import {arrival,ground} from './bear/approach.js';
import {trails,slashPoint} from './bear/tears.js';
export {arrival,slashPoint};
export function entrance(s,t){
 if(t>3.85)return;const {c}=s,pose=arrival(t,s.variant);
 for(const at of [.45,.94,1.42]){const foot=arrival(at,s.variant);dust(c,s.field,t-at,foot.x,985,'#78969c',.35);}
 dust(c,s.field,t-1.94,960,985,'#78969c',1.15);
 for(const sw of swipes){
  const impact=sw.at+sw.duration/2,age=t-sw.at;
  if(age>-.20&&age<0){const charge=smooth(-.20,0,age),paw=world(pose,clawContact(t,sw.hand,0,s.variant));
   glow(c,...paw,18+charge*25,'#8dccf2',charge*.55);
   for(let j=0;j<3;j++){const angle=j*2.094+t*5;bolt(c,paw[0]+Math.cos(angle)*45,paw[1]+Math.sin(angle)*35,...paw,j+Math.floor(t*18)*11,charge*.3,1);}
  }
  impulse(c,t,impact,...slashPoint(sw,.5,0,s.variant),'#9fdaff',.28+(sw===swipes.at(-1)?.18:0));
  dust(c,s.field,t-impact,...slashPoint(sw,.5,0,s.variant),'#b9e5f9',1.2);
 }
 trails(c,t,{variant:s.variant});
}
export function foreground(s,t){if(t>3.85)return;
 const {c,character}=s,pose=arrival(t,s.variant),alpha=pose.alpha*(1-smooth(3.30,3.78,t));
 if(alpha<=0)return;shadow(c,pose.x,ground,pose.size*.47,23,.32*alpha);
 character.draw(c,{...pose,t,brace:smooth(1.7,1.94,t),alpha});
}
export function coverage(s,t){
 if(t<=swipes[0].at)return false;
 // The actual claw gouges widen into a storm tear. There is no unrelated wipe.
 trails(s.b,t,{mask:true,variant:s.variant});
 return true;
}
export function surface(s,t){
 const c=s.b;c.drawImage(s.material,0,0);
 c.save();c.globalAlpha=.13;c.globalCompositeOperation='screen';
 c.drawImage(s.material,-22-Math.sin(t)*18,-16,1980,1120);c.restore();
 trails(c,t,{opacity:1-smooth(3.38,3.84,t),variant:s.variant});
 if(t>3.25)for(let j=0;j<7;j++){
  const p=slashPoint(swipes[j%3],.35+j*.07,0,s.variant);
  bolt(c,...p,p[0]+Math.sin(j*7)*800,p[1]+Math.cos(j*9)*700,j+Math.floor(t*10)*13,.36,1.2);
 }
}
export function reveal(s,t){
 const c=s.b,p=clamp((t-s.timing.coveredUntil)/1.65),width=out(p)*2300;
 // Split the torn surface along the same diagonal claw direction.
 c.save();c.globalCompositeOperation='destination-out';
 for(let j=0;j<3;j++){const center=320+j*640;c.fillStyle='#fff';c.beginPath();
  c.moveTo(center-width/2-850,-100);c.lineTo(center+width/2-850,-100);
  c.lineTo(center+width/2+850,1180);c.lineTo(center-width/2+850,1180);c.closePath();c.fill();}
 c.restore();
 for(let j=0;j<3;j++){const x=320+j*640;
  line(s.c,[[x-width/2-850,-100],[x-width/2+850,1180]],'#68bde8',2,(1-p)*.25);
  line(s.c,[[x+width/2-850,-100],[x+width/2+850,1180]],'#a0dffe',1,(1-p)*.35);
 }
}

