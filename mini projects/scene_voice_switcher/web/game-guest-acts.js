// Small three-pose performances: anticipation, contact, reaction and exit.
import {ellipse,smooth,TAU} from './shared/world-motion.js';
import {star,cup,bubble} from './reef-ink.js';
export const phase=(a,start,end)=>smooth(Math.max(0,Math.min(1,(a-start)/(end-start))));
export function shadow(c,x,y,w=24,alpha=.25){ellipse(c,x,y,w,3,`rgba(8,15,24,${alpha})`);}
export function box(c,x,y,w,h,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,3);c.fill();}
export function snack(c,x,y,kind='star',turn=0){
 c.save();c.translate(x,y);c.rotate(turn);
 if(kind==='tea')cup(c,0,-3,.42);
 else if(kind==='marshmallow'){box(c,-5,-8,10,11,'#fff0d1');c.fillStyle='#a66a3d';c.fillRect(-.8,2,1.6,10);}
 else star(c,0,0,8,'#ffdd79',0);
 c.restore();
}
export function kirby(c,a,e,art,s){
 const enter=phase(a,0,1.8),leave=phase(a,10,12),x=-42*(1-enter)-leave*60;
 const inhale=phase(a,2.4,5.2),spit=phase(a,6.8,8.1),pose=a<2.4?0:a<5.2?1:a<6.8?2:0;
 shadow(c,x,0);art.guests.draw(c,'kirby',pose,x,-Math.abs(Math.sin(a*5))*2,64,{squash:1+Math.sin(a*3)*.015});
 // Food starts on the ledge, follows a curved suction path, then returns as a star.
 if(a<5.2)snack(c,52*(1-inhale)+x*inhale,-10-22*inhale,s.prop,a*.3);
 if(a>2.4&&a<5.2){c.save();c.globalAlpha*=.3;c.strokeStyle='#f8e2b8';c.lineWidth=1;for(let i=0;i<3;i++){c.beginPath();c.moveTo(62,-12-i*12);c.quadraticCurveTo(35,-3-i*15,x+13,-31);c.stroke();}c.restore();}
 if(a>=6.8&&a<9.5){star(c,x+14+spit*70,-30-Math.sin(spit*Math.PI)*28,7,'#ffdc73',a*3);for(let i=0;i<3;i++)bubble(c,x+20+spit*60-i*9,-26-i*6,2,.5);}
}
export function boo(c,a,e,art){
 const rise=phase(a,0,2.1),hide=phase(a,9,12),y=54*(1-rise)+hide*70-7*Math.sin(a*.9);
 // Reveal from behind the actual ledge; hide again instead of fading in midair.
 c.save();c.beginPath();c.rect(-90,-140,180,140);c.clip();
 const lookedAt=a>4.2&&a<7;art.guests.draw(c,'boo',lookedAt?2:a>2.5?1:0,Math.sin(a*.8)*12,y,61,{turn:Math.sin(a*1.5)*.06});
 c.restore();
}
export function vent(c,open=0){
 box(c,-25,-7,50,9,'#26373c');c.save();c.translate(-23,-7);c.rotate(-open*.9);box(c,0,-5,46,7,'#72898c');
 c.strokeStyle='#26373c';c.lineWidth=2;for(let i=0;i<6;i++){c.beginPath();c.moveTo(5+i*6,-4);c.lineTo(5+i*6,1);c.stroke();}c.restore();
}
export function crewmate(c,a,e,art){
 const rise=phase(a,.7,2.3),sink=phase(a,9.4,11.6),pose=a<3?0:a<7?1:2;
 const open=phase(a,0,.7)*(1-phase(a,11.6,12));
 c.save();c.beginPath();c.rect(-100,-150,200,144);c.clip();
 art.guests.draw(c,'crewmate',pose,0,62*(1-rise)+70*sink-7,62,{turn:a>7&&a<9?Math.sin(a*5)*.07:0});c.restore();
 vent(c,open);
 box(c,32,-24,19,18,'#293544');ellipse(c,41,-15,4,4,a<6?'#eb8167':'#8be4b1');
 if(a>5.8&&a<6.7){c.strokeStyle='#a3ede7';c.lineWidth=1.4;for(let i=0;i<5;i++){const q=i*TAU/5;c.beginPath();c.moveTo(41+Math.cos(q)*8,-15+Math.sin(q)*8);c.lineTo(41+Math.cos(q)*14,-15+Math.sin(q)*14);c.stroke();}}
}
export function creeper(c,a,e,art){
 const emerge=phase(a,0,2),jump=phase(a,4.2,6.3),hide=phase(a,9,12),hop=Math.sin(jump*Math.PI)*46;
 c.save();c.beginPath();c.rect(-90,-140,180,140);c.clip();
 art.guests.draw(c,'creeper',a<3.6?0:a<4.2?1:a<6.3?2:0,Math.sin(jump*Math.PI)*20,50*(1-emerge)+70*hide-hop,68,{turn:Math.sin(jump*Math.PI)*.12});c.restore();
 box(c,-25,-8,50,10,'#4a6861');box(c,-21,1,42,15,'#34453c');
 if(a>6.3&&a<8){for(let i=0;i<6;i++){const q=(a-6.3)/1.7;c.fillStyle=i%2?'#b7cf8a':'#8aad78';c.fillRect(Math.sin(i*5)*q*32,-30+q*28+i%2*6,3,3);}}
}
export const quietActs={kirby,boo,crewmate,creeper};
