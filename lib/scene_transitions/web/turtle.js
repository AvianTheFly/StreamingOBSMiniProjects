// Turtle choreography assembles the rig, projectile owner and hexagonal defense.
import {smooth} from './math.js';
import {shadow,contact as footDust} from './rig.js';
import {polygon,glow} from './fx.js';
import {impulse} from './motion.js';
import {arrival,hits,walk} from './rigs/turtle/motion.js';
import {soften} from './performance.js';
import * as ward from './turtle/shield.js';
import * as projectiles from './turtle/projectiles.js';
export {arrival};
export {shield} from './turtle/shield.js';
export const beats={walk:0,brace:walk.braceEnd,first:hits[0],second:hits[1],third:hits[2],lock:3.85};
export function entrance(s,t){
 const a=arrival(t,s.variant),c=s.c;
 if(t<3.86){
  shadow(c,a.x,987,390,25,.30*a.alpha);
  s.character.draw(c,{...a,alpha:a.alpha*(1-smooth(3.69,3.84,t))});
  const charge=soften((t-3.07)/.36)*(1-smooth(3.62,3.80,t)),side=s.variant?-1:1;
  glow(c,a.x-side*50,640,145,'#89e8b6',charge*.23);
  for(let i=0;i<7;i++){const angle=i*Math.PI/3.5,px=a.x+Math.cos(angle)*210,py=650+Math.sin(angle)*125;
   polygon(c,ward.hexPoints(px,py,7+charge*5));c.strokeStyle='#95edc3';c.lineWidth=1.4;c.globalAlpha=charge*.6;c.stroke();c.globalAlpha=1;
  }
  // Dust follows the four physical support points at the end of each step.
  if(t<walk.braceEnd)s.character.contacts(a).forEach((point,i)=>{
   const step=t-walk.start-walk.offsets[i]-walk.swing;
   if(step>=0)footDust(c,step%walk.cycle,point[0],point[1],'#a6a78b');
  });
  for(let i=0;i<3;i++)ward.local(c,t,s.variant,i,s.material);
 }
 projectiles.draw(c,t,s.variant);
 for(let i=0;i<3;i++){const point=ward.contact(i,s.variant);
  impulse(c,t,hits[i],point[0],point[1],'#a3efc5',i===2?.75:.32);
 }
}
export function coverage(s,t){return ward.mask(s,t);}
export function surface(s,t){ward.surface(s,t);}
export function reveal(s,t){
 const elapsed=t-s.timing.coveredUntil,c=s.b,sc=s.scratch.getContext('2d');
 sc.clearRect(0,0,1920,1080);sc.drawImage(s.cover,0,0);c.clearRect(0,0,1920,1080);
 for(const cell of s.hexes){
  const delay=Math.hypot(cell.x-960,cell.y-540)/1400*.30+cell.shade*.13;
  const d=Math.max(0,elapsed-delay),alpha=1-smooth(.26,.94,d);if(!alpha)continue;
  const scale=1-smooth(.05,.96,d)*.94;
  c.save();c.globalAlpha=alpha;c.translate(cell.x+cell.vx*d*.12,cell.y-d*d*150);
  c.rotate(cell.spin*d*.13);c.scale(scale,scale);c.translate(-cell.x,-cell.y);
  polygon(c,cell.points);c.clip();c.drawImage(s.scratch,0,0);c.strokeStyle='#b2efd5';c.lineWidth=2;c.stroke();c.restore();
  if(d>.1)glow(s.c,cell.x+cell.vx*d*.12,cell.y-d*d*150,6,'#91dbb2',alpha*.16);
 }
}
