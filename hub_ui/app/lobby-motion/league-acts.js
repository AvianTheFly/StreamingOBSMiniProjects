// Finite encounters: anticipation -> physical contact -> reaction -> departure.
import {ellipse,TAU} from './shared/world-motion.js';
import {phase,shadow,box} from './game-guest-acts.js';
import {cup} from './reef-ink.js';
import {spirit,spiritColors,line,burst,biscuit,mushroom} from './league-spirit-ink.js';
export function udyrState(a,stance){
 const enter=phase(a,0,1.8),leave=phase(a,11.5,14),hit=phase(a,3,3.25)*(1-phase(a,4,4.6));
 return {x:-48*(1-enter)-leave*66+(stance==='stampede'?phase(a,2.8,3.3)*22*(1-phase(a,5,6)):hit*7),hit,awake:phase(a,2,3)*(1-phase(a,8.5,10)),pose:a<2||a>10?0:stance==='mantle'?2:(a>3&&a<4.6?1:0)};
}
export function udyr(c,a,e,art,p){
 const s=udyrState(a,p.stance),color=spiritColors[p.stance];shadow(c,s.x,0,25);
 c.save();c.globalAlpha*=s.awake*.32;c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(s.x,-2,37,9,0,0,TAU);c.stroke();c.restore();
 spirit(c,p.stance,s.x,-86-Math.sin(a*2)*3,30,a,s.awake*.75);
 if(p.stance==='claw'){
  // A mounted practice bell swings away from the fist and settles back.
  box(c,50,-61,4,62,'#705543');box(c,36,-63,20,4,'#947258');
  c.save();c.translate(45,-59);c.rotate(a>3?Math.sin((a-3)*12)*Math.exp(-(a-3)*.9)*.7:0);line(c,[[0,0],[0,13]],'#bda884',1);ellipse(c,0,20,9,10,'#d5ad65');box(c,-11,24,22,4,'#f6d38f');c.restore();
  if(a>3&&a<4)burst(c,40,-35,(a-3),color,6);
 }else if(p.stance==='stampede'){
  c.save();c.translate(57,0);c.rotate(a>3.3?Math.sin((a-3.3)*8)*Math.exp(-(a-3.3)*1.1)*.28:0);box(c,-5,-45,10,44,'#775443');box(c,-15,-40,30,9,'#b18463');line(c,[[-12,-28],[12,-28]],'#ce6952',3);c.restore();
  if(a>3.3&&a<4.2)burst(c,50,-30,a-3.3,color);
  if(a>2.8&&a<3.5)for(let i=0;i<3;i++)line(c,[[s.x-45,-12-i*14],[s.x-27,-12-i*14]],color,1.7);
 }else if(p.stance==='mantle'){
  art.league.draw(c,'poro',a>6?2:0,47,0,27);
  const fly=phase(a,3.4,5.1),ballX=112-87*fly;
  if(a>3.4&&a<5.1)ellipse(c,ballX,-34+Math.sin(fly*Math.PI)*-12,6,6,'#e3f7ff');
  if(a>2.7&&a<7.8){c.save();c.globalAlpha*=.5;c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.ellipse(s.x+4,-30,31,37,0,-Math.PI*.65,Math.PI*.65);c.stroke();c.restore();}
  if(a>=5.1&&a<6.5)burst(c,25,-34,(a-5.1)/1.4,'#ddf5ff');
 }else{
  cup(c,50,-3,.65);
  if(a>3&&a<9){const swirl=phase(a,3,5);c.save();c.globalAlpha*=.6*(1-phase(a,8,9));c.strokeStyle=color;c.lineWidth=1.2;for(let i=0;i<3;i++){c.beginPath();c.ellipse(50,-14,20+5*i,8+i*3,a*.4+i,0,TAU);c.stroke();}c.restore();
   for(let i=0;i<5;i++){const q=i*TAU/5+a;ellipse(c,50+Math.cos(q)*18*swirl,-20+Math.sin(q)*10,1.7,1.7,color);}}
  if(a>5&&a<11){box(c,41,-22,18,5,'#bceaf5aa');line(c,[[46,-22],[45,-11],[50,-18],[54,-12],[57,-22]],'#e1faff',1.4);}
 }
 art.league.draw(c,'udyr',s.pose,s.x,-Math.abs(Math.sin(a*5))*1.2,64,{turn:p.stance==='stampede'?s.hit*.1:0});
 if(s.awake){for(const sign of [-1,1]){c.save();c.globalAlpha*=s.awake*.75;line(c,[[s.x+sign*20,-24],[s.x+sign*24,-37],[s.x+sign*18,-42]],color,2);c.restore();}}
}
export function poro(c,a,e,art){
 const approach=phase(a,0,3),jump=phase(a,3,5),leave=phase(a,11,14),x=-55+approach*42+Math.sin(jump*Math.PI)*20-leave*85;
 const y=-Math.sin(jump*Math.PI)*31;shadow(c,x,0,20);
 if(a<4.8)biscuit(c,13,-6-Math.sin(jump*Math.PI)*8);
 art.league.draw(c,'poro',a<3?0:a<5?1:2,x,y,45,{turn:a>5&&a<8?Math.sin(a*4)*.06:0,squash:1+Math.sin(a*4)*.02});
 if(a>5&&a<6.4)for(let i=0;i<5;i++)ellipse(c,x+Math.sin(i*3)*(a-5)*15,-17+(a-5)*14+i,1.5,1,'#e1b572');
}
export function scuttle(c,a,e,art){
 const approach=phase(a,0,3),retreat=phase(a,9,14),x=-62+approach*57-retreat*75;
 shadow(c,x,0,24);art.league.draw(c,'scuttle',a<3?0:a<5?1:2,x,-Math.abs(Math.sin(a*8))*2,40,{flip:a>9});
 // The crab plants a little vision shrine and looks proud of its contribution.
 if(a>4){const strength=phase(a,4,5)*(1-phase(a,12,14));c.save();c.globalAlpha*=strength;
  ellipse(c,27,-3,29,9,'#71d9cb22');c.strokeStyle='#98e6c788';c.lineWidth=1;c.beginPath();c.ellipse(27,-3,23+Math.sin(a*2)*3,7,0,0,TAU);c.stroke();
  box(c,24,-24,5,20,'#718d70');ellipse(c,27,-28,8,5,'#d8ed91');ellipse(c,27,-28,3,3,'#527e70');c.restore();}
}
export function teemo(c,a,e,art){
 const approach=phase(a,0,2.4),leave=phase(a,10,14),x=-42+approach*42-leave*52;
 shadow(c,x,0,21);c.save();c.globalAlpha*=a>6.5&&a<10?.12:1;art.league.draw(c,'teemo',a<3?0:a<5?1:2,x,-Math.abs(Math.sin(a*4)),52);c.restore();
 if(a>4.8)mushroom(c,18,0,.72);
 // Camouflage leaves the mushroom and a few tiny drifting leaves behind.
 if(a>6.5&&a<8.2)for(let i=0;i<6;i++){const q=(a-6.5)/1.7;ellipse(c,x+Math.sin(i*5)*q*34,-15-q*24+i*3,3,1.5,'#9cbd79aa');}
}
export const leagueActs={udyr,poro,scuttle,teemo};
