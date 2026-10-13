// Finite miniature payoffs, painted inside one theatre window on the stage clock.
import {ellipse,glow,smooth,TAU} from './shared/world-motion.js';
import {line,spirit} from './league-spirit-ink.js';
function star(c,x,y,r,color,t=0){c.save();c.translate(x,y);c.rotate(t);c.fillStyle=color;c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,s=i%2?r*.42:r;c.lineTo(Math.cos(a)*s,Math.sin(a)*s);}c.closePath();c.fill();c.restore();}
function turtle(c,x,y,t,color){
 ellipse(c,x,y+8,32,7,'#03191f99');for(const s of [-1,1])ellipse(c,x+s*21,y+4+Math.sin(t*3+s)*2,8,4,color);
 ellipse(c,x,y,28,19,color);ellipse(c,x,y-3,22,13,'#164e4b');
 line(c,[[x-19,y],[x-10,y-12],[x+7,y-15],[x+20,y],[x+9,y+11],[x-12,y+10],[x-19,y]],color,1.2);
 line(c,[[x,y-14],[x+5,y],[x-12,y+10]],color,1.2);ellipse(c,x+32,y+1,11,8,color);ellipse(c,x+36,y-1,2,2,'#10282f');
}
function goose(c,x,y,t){
 c.save();c.translate(x,y);c.rotate(Math.sin(t*4)*.07);ellipse(c,0,0,21,12,'#f9f1db');line(c,[[8,-3],[13,-24],[19,-30]],'#f9f1db',11);ellipse(c,21,-29,9,8,'#f9f1db');
 line(c,[[26,-28],[39,-26]],'#ffbd6a',5);ellipse(c,23,-31,1.7,1.7,'#1a2434');for(const s of [-1,1])line(c,[[s*9,10],[s*9+Math.sin(t*7+s)*4,18]],'#ffc26d',3);c.restore();
}
export function drawPayoff(c,act,theme,t,palette){
 const color=palette.color,second=palette.second;c.save();c.beginPath();c.roundRect(0,0,112,100,12);c.clip();
 const x=56,y=52,beat=t%8;
 glow(c,x,y,48,color,.13);line(c,[[7,83],[106,83]],color+'66',1);
 if(act==='turtle'){turtle(c,45+Math.sin(t*.7)*9,59,t,color);for(let i=0;i<3;i++)ellipse(c,20+i*29,21+Math.sin(t+i)*5,2,2,second);}
 else if(act==='goose'){const travel=Math.sin(t*.65)*18;goose(c,43+travel,61,t);star(c,81+travel,31,9,'#ffd782',t*.7);}
 else if(act==='bonfire'){
  line(c,[[30,79],[79,71],[37,72],[74,82]],'#c9996b',6);
  for(let i=0;i<5;i++){const h=20+12*Math.sin(t*3+i);ellipse(c,42+i*7,65-h*.35,6,h/2,i%2?'#ffc680':'#ff865f');}
  line(c,[[57,76],[52,22]],'#d5eeff',4);line(c,[[40,40],[65,38]],'#ffe0a5',4);
 }else if(act==='phoenix'){
  const hatch=smooth((beat-2)/2)*(1-smooth((beat-6)/2));ellipse(c,56,70,16,20*(1-hatch*.65),'#d9bfff');
  spirit(c,'storm',56,56-hatch*30,32*hatch,t,hatch);for(let i=0;i<5;i++){const q=i*TAU/5+t;star(c,56+Math.cos(q)*35,47+Math.sin(q)*24,2,second);}
 }else if(act==='mimic'){
  c.fillStyle='#96633c';c.fillRect(27,52,60,29);c.strokeStyle='#f5ca85';c.lineWidth=3;c.strokeRect(27,52,60,29);
  const jaw=(.5+.5*Math.sin(t*1.8))*17;c.fillStyle='#16202c';c.fillRect(30,49-jaw,54,jaw+9);line(c,[[28,48-jaw],[86,48-jaw]],'#ffd997',6);
  for(let i=0;i<6;i++){c.fillStyle='#fff1d1';c.beginPath();c.moveTo(31+i*9,49-jaw);c.lineTo(35+i*9,57-jaw);c.lineTo(39+i*9,49-jaw);c.fill();}
  ellipse(c,58,65,9,4+Math.sin(t*3)*2,'#f891a8');
 }else if(act==='portal'||act==='loop'){
  for(let i=0;i<2;i++){c.strokeStyle=i?second:color;c.lineWidth=4;c.beginPath();c.ellipse(25+i*62,49,13,29,0,0,TAU);c.stroke();}
  const q=(t*.22)%1;star(c,25+62*q,49-Math.sin(q*Math.PI)*18,11,'#ffe7aa',t);
 }else if(act==='loot'){
  const rise=Math.sin(Math.min(1,beat/3)*Math.PI/2);star(c,56,60-rise*23,22,color,t*.25);
  for(let i=0;i<6;i++){const a=i*TAU/6+t*.3;ellipse(c,56+Math.cos(a)*40,48+Math.sin(a)*32,2,2,second);}
 }else{
  const charge=smooth((beat-1)/2),recoil=smooth((beat-3)/2),dx=(charge-recoil)*29;
  spirit(c,act==='bear'||theme==='bear'?'claw':'stampede',37+dx,47,27,t);
  if(act==='parry'){line(c,[[87,23],[103,29],[100,62],[88,74],[78,61],[75,30],[87,23]],second,3);if(beat>3&&beat<4.3)for(let i=0;i<5;i++)star(c,83+Math.cos(i)*20*(beat-3),45+Math.sin(i)*23*(beat-3),3,color);}
  if(act==='dash')for(let i=0;i<3;i++)line(c,[[8,38+i*11],[21+Math.sin(t*4+i)*8,38+i*11]],second,2);
 }
 c.restore();
}
