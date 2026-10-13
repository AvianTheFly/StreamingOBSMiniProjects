// Distinct spatial stories anchored to the new paintings, with finite envelopes.
import {glow,ellipse,TAU} from './shared/world-motion.js';
import {phase} from './game-guest-acts.js';
import {line} from './league-spirit-ink.js';
export function environment(c,a,id,kind){
 const envelope=phase(a,0,2)*(1-phase(a,10,14)),pulse=.55+.3*Math.sin(a*1.7);c.save();c.globalAlpha*=envelope;
 if(id==='aurora-camp'){
  if(kind==='awakening'){
   c.globalAlpha*=pulse;for(const points of [[[1100,150],[1040,205],[1070,219],[973,300]],[[970,125],[870,173],[898,202],[740,250]]]){line(c,points,'#a5e6ff88',2);line(c,points,'#e3f8ff99',.8);}glow(c,740,250,35,'#8ad9ff',.15);
  }else if(kind==='weather'){
   for(let i=0;i<25;i++){const q=(a*.05+i/25)%1,x=420+q*880,y=580+Math.sin(q*8)*54;glow(c,x,y,7,'#b6eec8',.1);ellipse(c,x,y,1.4,1.4,'#beefc2');}
  }else{glow(c,1741,698,29,'#ffe6a1',pulse*.2);for(let i=0;i<7;i++){const q=(a*.09+i/7)%1;ellipse(c,1741+Math.sin(i*4)*q*24,707-q*59,1.2,1.2,'#ffe7a6');}}
 }else if(id==='sanctuary'){
  if(kind==='awakening')for(let i=0;i<4;i++){const r=(a*8+i*24)%96;c.strokeStyle='#a5f3de77';c.lineWidth=1;c.beginPath();c.ellipse(1331,632,34+r,8+r*.25,0,0,TAU);c.stroke();}
  else if(kind==='weather')for(let i=0;i<18;i++){const q=(a*.05+i/18)%1;c.save();c.translate(885+Math.sin(i*7)*q*210,395+q*250);c.rotate(a+i);ellipse(c,0,0,3.4,1.4,'#ffd0d9aa');c.restore();}
  else{const x=1657+a*3,y=269-a*.6;glow(c,x,y,17,'#fff0a1',.2);for(let i=0;i<5;i++)ellipse(c,x-i*7,y+Math.sin(a+i)*3,1.5,1.5,'#f6de9677');}
 }else if(id==='forge'){
  if(kind==='lanterns'){
   c.save();c.translate(1010,825);c.globalAlpha*=pulse*.5;
   line(c,[[-16,-31],[-35,-48],[-43,-28],[-29,-12]],'#ffc77c',2);line(c,[[16,-31],[35,-48],[43,-28],[29,-12]],'#ffc77c',2);
   line(c,[[-47,53],[-47+phase(a,2,8)*93,53]],'#a46032',1.5);c.restore();
  }else if(kind==='awakening'){glow(c,670,122,150,'#ffce9c',pulse*.12);glow(c,788,197,55,'#ffb681',pulse*.17);}
  else for(let i=0;i<26;i++){const q=(a*.075+i/26)%1,x=1720+Math.sin(i*5)*q*83,y=540-q*310;ellipse(c,x,y,1.2,2.1,'#ffc68f');}
 }else if(kind==='lanterns'){
  glow(c,1800,484,57,'#b1e2ff',pulse*.2);for(let i=0;i<8;i++){const q=(a*.07+i/8)%1;ellipse(c,1800+Math.sin(i*4)*19,510-q*70,1.3,2.1,'#ccf1ff');}
 }else if(kind==='weather'){
  // Tiny glints travel down the already-painted frozen tea spiral.
  for(let i=0;i<9;i++){const q=(a*.09+i/9)%1;glow(c,1473+Math.sin(q*13)*18,646+q*165,5,'#a7e8ff',.35);}
 }else{
  for(let i=0;i<6;i++){c.strokeStyle=i%2?'#c9edff55':'#a4c2ff44';c.lineWidth=1.3;c.beginPath();for(let j=0;j<=28;j++){const p=j/28,x=384+p*579,y=117+i*22+Math.sin(p*5+a*.42+i*.3)*28+p*p*196;j?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
 }
 c.restore();
}
