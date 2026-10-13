// Material-local analytic motion, bounded by construction, on the stage clock.
import {glow,ellipse,hash} from './shared/world-motion.js';
import {sparks} from './forge-atmosphere.js';
import {steam} from './sanctuary-atmosphere.js';
export function habitatAmbience(c,t,id){
 c.save();
 if(id==='aurora-camp'){
  glow(c,1480,865,110,'#ffc083',.06+.02*Math.sin(t*2));sparks(c,1480,865,t,14);steam(c,1480,791,t,48);
  for(let i=0;i<24;i++){const q=(t*.024+hash(i))%1,x=70+hash(i+33)*1160+Math.sin(t*.5+i)*13,y=700-q*360;glow(c,x,y,5,'#9edbc2',.08);ellipse(c,x,y,1,1,'#b9f2d477');}
  for(const [x,y] of [[395,300],[740,250],[1310,415]])glow(c,x,y,26,'#8dddff',.04+.02*Math.sin(t+x));
 }else if(id==='sanctuary'){
  steam(c,1140,870,t,45);steam(c,1690,680,t+2,34);
  for(let i=0;i<18;i++){const q=(t*.035+hash(i+44))%1,x=510+hash(i+14)*720+Math.sin(t*.4+i)*12,y=400+q*290;c.save();c.translate(x,y);c.rotate(t*.6+i);ellipse(c,0,0,2.7,1.1,'#eebbce66');c.restore();}
  for(const [x,y] of [[360,890],[1200,520],[1830,730]])glow(c,x,y,32,'#ffdd9c',.045+.02*Math.sin(t*1.5+x));
 }else if(id==='forge'){
  for(const [x,y,r] of [[1720,340,100],[1150,605,45],[360,692,30]]){glow(c,x,y,r,'#ffb275',.07+.02*Math.sin(t*3));sparks(c,x,y,t+x,10);}
  steam(c,815,650,t,35);
 }else{
  for(let i=0;i<40;i++){const q=(t*.022+hash(i+20))%1,x=350+hash(i+42)*1100+Math.sin(t*.3+i)*12,y=q*780;ellipse(c,x,y,1,1,'#d2f0ff66');}
  for(const [x,y] of [[165,834],[1360,845],[1820,605]])glow(c,x,y,26,'#ffd4a1',.05+.02*Math.sin(t*2+x));
  glow(c,1800,486,65,'#a9dcff',.04+.02*Math.sin(t*.5));
 }
 c.restore();
}
