// Furniture contact drives the larger jokes. Every stunt is finite and silent.
import {ellipse,TAU} from './shared/world-motion.js';
import {cup,star} from './reef-ink.js';
import {phase,shadow,box} from './game-guest-acts.js';
export function goose(c,a,e,art){
 const approach=phase(a,0,3),escape=phase(a,6.8,12),x=-68+approach*69+escape*108;
 const crouch=a>3&&a<6.5,hop=Math.abs(Math.sin(a*(escape?12:7)))*(escape?3:1.3);
 shadow(c,x,0,23,.18);art.guests.draw(c,'goose',crouch?1:escape?2:0,x,-hop,58,{turn:escape?-.04:0});
 // The low knife snags a cup handle; it skates along the painted shelf.
 const nudge=phase(a,4.2,6.3);cup(c,49+nudge*69,-7+Math.sin(nudge*Math.PI)*-8,.4);
 if(a>5.6&&a<7){c.save();c.strokeStyle='#e9ddaa88';c.lineWidth=1;for(let i=0;i<3;i++){c.beginPath();c.moveTo(91+i*6,-2);c.lineTo(97+i*6,-2);c.stroke();}c.restore();}
}
export function climberState(a,ledge=[74,-90]){
 const reach=phase(a,0,2.2),climb=phase(a,2.2,5.8),slip=phase(a,6.2,7.2),fall=phase(a,7.2,9.1),exit=phase(a,10,12);
 const length=Math.hypot(28-ledge[0],-37-ledge[1]),start=Math.atan2(-37-ledge[1],28-ledge[0]);
 const angle=start+1.25*(climb-slip*.75),contact=a>=2.2&&a<7.2;
 // Rotate the grip around a fixed head: the handle never telescopes as he lifts.
 const grip=[ledge[0]+Math.cos(angle)*length,ledge[1]+Math.sin(angle)*length];
 const x=(grip[0]-28)*(1-fall)-fall*30-exit*55,y=(grip[1]+37)*(1-fall)+exit*70;
 const pose=a<1?0:a>=7.2&&a<9.1?2:1,offset=pose===0?[0,-44]:pose===2?[27,-62]:[28,-37];
 const hand=[x+offset[0],y+offset[1]];
 const target=contact?ledge:a<2.2?[hand[0]+(ledge[0]-hand[0])*reach-16*(1-reach),hand[1]-length*(1-reach)+(ledge[1]-hand[1])*reach]:[hand[0]-Math.cos(angle+fall*2)*length,hand[1]-Math.sin(angle+fall*2)*length];
 return {x,y,hand,target,contact,pose,turn:0};
}
export function climber(c,a,e,art,s){
 const motion=climberState(a,s.ledge);if(s.shadow!==false)shadow(c,motion.x,0,25,.16);
 art.guests.draw(c,'climber',motion.pose,motion.x,motion.y,70,{turn:motion.turn});
 // The sledge head remains planted on the authored ledge through the push.
 const [hx,hy]=motion.hand,[tx,ty]=motion.target;
 c.strokeStyle='#503b25';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(hx,hy);c.lineTo(tx,ty);c.stroke();
 c.strokeStyle='#d5ac63';c.lineWidth=2.3;c.beginPath();c.moveTo(hx,hy);c.lineTo(tx,ty);c.stroke();
 c.save();c.translate(tx,ty);c.rotate(motion.contact?0:Math.atan2(ty-hy,tx-hx)+Math.PI/2);box(c,-10,-5,20,9,'#65767a');box(c,-10,-5,20,2,'#c8d5cc');c.restore();
 if(a>6.3&&a<7.3){for(let i=0;i<4;i++)ellipse(c,tx+(i-1.5)*4,ty+phase(a,6.3,7.3)*15,1,1,'#dfc78f');}
}
export function hornet(c,a,e,art){
 const leap=phase(a,2,7),leave=phase(a,9.5,12),x=-46+leap*94+leave*50,y=-Math.sin(leap*Math.PI)*60;
 shadow(c,x,0,15,.15);
 if(a>2&&a<7.5){c.strokeStyle='#eee7d988';c.lineWidth=.9;c.beginPath();c.moveTo(65,-95);c.quadraticCurveTo(x+18,y-48,x,y-32);c.stroke();}
 art.guests.draw(c,'hornet',a<2?0:a<7?1:2,x,y,67,{turn:Math.sin(leap*Math.PI)*.12});
 if(a>7&&a<8){c.save();c.globalAlpha*=1-phase(a,7,8);c.strokeStyle='#e9cabe';c.lineWidth=1.1;c.beginPath();c.ellipse(x,0,15+phase(a,7,8)*17,3,0,0,TAU);c.stroke();c.restore();}
}
export function salvager(c,a,e,art){
 const collect=phase(a,0,3),haul=phase(a,4.5,6.6),recover=phase(a,9,12),x=-53+collect*57-haul*20+recover*70;
 const dropped=a>6.4&&a<9,pose=a<3?0:dropped?2:1;
 shadow(c,x,0,20,.2);art.guests.draw(c,'salvager',pose,x,-Math.abs(Math.sin(a*8))*.8,63,{turn:dropped?-.06:Math.sin(a*3)*.018});
 if(a<3)cup(c,25,-5,.48);
 if(dropped){const q=(a-6.4)/2.6;cup(c,30+q*28,-5-Math.abs(Math.sin(q*Math.PI*2))*22*(1-q),.48);}
 if(a>8.2&&a<8.8)star(c,57,-7,4,'#ffe1a2',a);
}
export const stuntActs={goose,climber,hornet,salvager};
