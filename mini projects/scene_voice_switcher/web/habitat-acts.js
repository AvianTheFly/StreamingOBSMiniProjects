// The preserved generated poses act on material props, then leave through the room.
import {ellipse,glow,TAU} from './shared/world-motion.js';
import {phase,shadow,box,boo,creeper} from './game-guest-acts.js';
import {climber} from './game-guest-stunts.js';
import {cup} from './reef-ink.js';
import {line} from './league-spirit-ink.js';
export function actState(age,role){
 const enter=phase(age,0,2),exit=phase(age,9.3,12);
 return {enter,exit,x:-48*(1-enter)+exit*110,contact:phase(age,2.2,3.4)*(1-phase(age,7.2,8.6)),react:phase(age,5,5.8)*(1-phase(age,8,9)),role};
}
function helmet(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);ellipse(c,0,-5,13,10,'#858681');line(c,[[-14,-3],[14,-3]],'#eac28a',3);line(c,[[-9,-10],[-15,-20],[-20,-16]],'#e5bc7e',3);line(c,[[9,-10],[15,-20],[20,-16]],'#e5bc7e',3);c.restore();}
function tea(c,a,e,art,p){
 const s=actState(a,p.role),sip=phase(a,3.2,5),set=phase(a,7.3,8.7),lift=sip*(1-set);
 const targetX=38*(1-lift)+(s.x+16)*lift,targetY=-5-lift*27;
 shadow(c,s.x,0,23,.18);art.guests.draw(c,'kirby',a<3.2?0:a<5?1:a<7.3?2:0,s.x,0,64);
 cup(c,targetX,targetY,.48);
 if(p.role==='brainfreeze'&&a>5&&a<8.7){
  for(let i=0;i<7;i++){const q=(a-5)/3.7,x=s.x+13+q*47+i*3,y=-30-Math.sin(q*Math.PI)*15+i%3*5;ellipse(c,x,y,1.5,3,'#c4f5ff');}
  c.globalAlpha*=s.react;line(c,[[s.x-12,-51],[s.x-7,-56],[s.x,-52],[s.x+7,-58],[s.x+14,-51]],'#a4e8ff',2);
 }else if(a>4&&a<8){c.strokeStyle='#bbeacb88';c.lineWidth=1;for(let i=0;i<3;i++){c.beginPath();c.moveTo(targetX-5+i*5,targetY-11);c.quadraticCurveTo(targetX-12+i*5,targetY-22,targetX+i*5,targetY-29);c.stroke();}}
}
function roast(c,a,e,art){
 const s=actState(a,'roast'),toast=phase(a,2.1,4.9),eat=phase(a,5,6.6),tip=[76*(1-eat)+14*eat,-39+8*eat];
 shadow(c,s.x,0,24,.18);art.guests.draw(c,'kirby',a>5&&a<6.6?1:a>6.6&&a<9?2:0,s.x,0,64);
 if(a<6.6){line(c,[[s.x+17,-24],tip],'#9d7247',2);box(c,tip[0]-5,tip[1]-6,11,11,toast>.65?'#d7a16a':'#fff2d7');}
 if(a>6.6&&a<8.5)for(let i=0;i<4;i++)ellipse(c,s.x+Math.sin(i*4)*(a-6.6)*12,-20+(a-6.6)*12+i,1.5,1,'#d8ad6b');
}
function thief(c,a,e,art){
 const reach=phase(a,0,3),take=phase(a,4,5.4),exit=phase(a,7.4,12),x=-50+reach*61+exit*106;
 shadow(c,x,0,25,.2);art.guests.draw(c,'goose',a>3&&a<5.4?1:a>5.4?2:0,x,-Math.abs(Math.sin(a*8))*1.5,62);
 // The cup handle meets the knife and remains attached throughout the escape.
 cup(c,49*(1-take)+(x+29)*take,-5-take*8,.43);
}
function repair(c,a,e,art){
 const s=actState(a,'repair');shadow(c,s.x,0,23,.18);
 art.guests.draw(c,'crewmate',a<2.5||a>9?0:a<6?1:2,s.x,-Math.abs(Math.sin(a*5))*.6,64);
 const pulse=phase(a,4.8,5.8)*(1-phase(a,9,11));
 ellipse(c,37,-5,17,5,'#755137');line(c,[[28,-9],[36,-19],[43,-10],[36,-5],[28,-9]],pulse?'#ffd085':'#946d48',2);
 if(a>2.5&&a<5.8){line(c,[[s.x+13,-28],[35,-12]],'#b6bbc1',3);ellipse(c,35,-12,4,3,'#ffcd8b');}
 glow(c,37,-12,31,'#ffbe70',pulse*.35);
}
function delivery(c,a,e,art){
 const s=actState(a,'delivery'),drop=phase(a,5,6.1),recover=phase(a,7.7,9),carrying=a>2.3&&a<5||a>9;
 shadow(c,s.x,0,22,.18);art.guests.draw(c,'salvager',a<2.3?0:a>5&&a<7.7?2:1,s.x,0,64);
 const x=carrying?s.x+17:30+drop*19-recover*20,y=carrying?-27:-6-Math.abs(Math.sin(drop*Math.PI*2))*20;
 helmet(c,x,y,.7);if(a>6.2&&a<7.2){ellipse(c,51,-4,16,3,'#c7b6a544');}
}
function silk(c,a,e,art,p){
 const jump=phase(a,2,6),leave=phase(a,8.6,12),x=-39+jump*80+leave*67,y=-Math.sin(jump*Math.PI)*57;
 shadow(c,x,0,17,.15);const anchor=p.silkAnchor;
 if(a>1.6&&a<7.6){c.strokeStyle='#e7e9de99';c.lineWidth=1;c.beginPath();c.moveTo(...anchor);c.quadraticCurveTo((anchor[0]+x)/2,y-47,x,y-31);c.stroke();}
 art.guests.draw(c,'hornet',a<2?0:a<6?1:2,x,y,64,{turn:Math.sin(jump*Math.PI)*.09});
 if(a>6&&a<7){c.strokeStyle='#c8e9d688';c.beginPath();c.ellipse(x,0,12+(a-6)*18,3,0,0,TAU);c.stroke();}
}
const acts={roast,tea,brainfreeze:tea,thief,repair,delivery,silk,climb:climber,boo,startle:creeper};
export function habitatAct(c,a,e,art,p){
 // These shelf/walkway bounds hide entrances behind an actual ledge; hanging
 // climbers enter through the canvas bottom and retain a fixed hammer contact.
 c.save();if(p.role!=='climb'){c.beginPath();c.rect(-75,-180,233,180);c.clip();}
 acts[p.role](c,a,e,art,p);c.restore();
}
export function habitatResponse(c,a,p){
 const reaction=phase(a,5,6)*(1-phase(a,9,11));if(!reaction)return;
 c.save();c.globalAlpha*=reaction;
 if(p.role==='repair'){
  glow(c,1720,340,135,'#ffad58',.15);glow(c,p.x,p.y-11,75,'#ffc173',.12);
  // Warm sparks emerge from the existing furnace mouth, then settle on the bench.
  for(let i=0;i<14;i++){const q=((a-5)*.32+i/14)%1;ellipse(c,1720+Math.sin(i*4)*q*55,505-q*155+q*q*80,1.4,2.1,'#ffcf8b');}
 }else if(p.role==='startle'){
  line(c,[[1170,880],[1138,909],[1152,940],[1128,971]],'#a9ecff',1.2);glow(c,p.x,p.y-46,49,'#83d9ff',.13);
 }else if(p.role==='brainfreeze'){
  line(c,[[p.x-19,p.y],[p.x+1,p.y-4],[p.x+17,p.y-1],[p.x+35,p.y-4],[p.x+54,p.y]],'#b3f4ff',2);for(let i=0;i<5;i++)line(c,[[p.x+i*10,p.y-2],[p.x+6+i*10,p.y-12]],'#a6e6ff',1);
 }else if(p.role==='roast')glow(c,1480,882,58,'#ffb477',.1);
 c.restore();
}
