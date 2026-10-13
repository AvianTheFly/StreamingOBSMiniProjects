// Approved muffin cast, with an authored final-lyric collapse on the original audio clock.
import {createLegacyProductionDesign,artReady,cultureCameos,soundEnergy} from './rave.js';
const clamp=q=>Math.max(0,Math.min(1,q));
const ease=q=>{q=clamp(q);return q*q*(3-2*q);};
// The local 6.687s clip's last "die" starts at about 6.24s (source frames + word timing).
// Keep this absolute cue: normalizing to a beat would move the punchline off the lyric.
export function muffinChoreography(t,duration,index=0){
 const hit=Math.min(6.24,Math.max(.1,duration-.44)),dead=t>=hit;
 const fall=ease((t-hit)/(.13+(index%3)*.012));
 const prepare=ease((t-hit+.18)/.14)*(1-fall);
 const solo=ease((t-1.7-index%4*.38)/.12)*(1-ease((t-2.07-index%4*.38)/.12));
 const wave=ease((t-3.85-index*.06)/.13)*(1-ease((t-4.45-index*.06)/.16));
 return{hit,dead,fall,prepare,solo,wave,age:Math.max(0,t-hit),clock:Math.min(t,hit)};
}
// Original canvas characters. Audio time drives every beat, cue and particle.
// Idle does not animate. The middle of the gameplay canvas stays clear.
export class MuffinShow{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.design=createLegacyProductionDesign(this.c);this.ready=artReady;}
 clear(){this.c.clearRect(0,0,1920,1080);}
 draw(t,duration,effect={}){
  this.clear();if(t<0||t>=duration)return;
  const c=this.c,story=muffinChoreography(t,duration),beat=story.clock*(effect.bpm||126)/60,pulse=(Math.sin(beat*Math.PI*2)+1)/2;
  const fade=Math.min(1,t/.3,Math.max(0,(duration-t)/.055));c.globalAlpha=fade;
  const party=t>1.1,encore=t>duration-1.6;
  c.save();c.beginPath();c.rect(0,0,1920,1080);c.rect(240,170,1440,670);c.clip('evenodd');
  soundEnergy(c,story.clock,duration,{style:'muffins',bpm:effect.bpm||126});
  const progress=Math.max(0,Math.min(1,t/Math.max(.1,duration))),phase=progress<.18?0:progress<.42?1:progress<.78?2:3;
  const starts=[0,.18,.42,.78],ends=[.18,.42,.78,1];
  c.save();c.globalAlpha*=1-story.fall*.55;
  this.design.scenery(story.clock,beat,'muffins',{phase,progress,local:(progress-starts[phase])/(ends[phase]-starts[phase]),energy:1});c.restore();
  // Corner arcs and thin border lights; no rectangle over the game.
  c.strokeStyle=`rgba(255,198,90,${.3+pulse*.45})`;c.lineWidth=4;
  for(const [x,y,sx,sy] of [[18,18,1,1],[1902,18,-1,1],[18,1062,1,-1],[1902,1062,-1,-1]]){
   c.beginPath();c.moveTo(x+sx*140,y);c.lineTo(x,y);c.lineTo(x,y+sy*140);c.stroke();
  }
  // Beat burst stars constrained to the outer 100px.
  for(let i=0;i<32;i++){
   const side=i%4,travel=(story.clock*(45+i%5*9)+i*83)%1000;
   const x=side<2?(side?1860:60):80+travel*1.76;
   const y=side<2?40+travel:(side===2?38:1042);
   c.save();c.translate(x,y+story.age*story.age*260);c.rotate(story.clock*(i%2?1:-1));c.fillStyle=i%2?'#f5ccff':'#ffd16b';
   c.globalAlpha=fade*(.25+pulse*.5)*(1-story.fall*.65);this.star(6+(i%3)*3);c.restore();
  }
  c.globalAlpha=fade;
  const slots=[[95,230,1],[1825,230,-1],[95,520,1],[1825,520,-1],[95,820,1],[1825,820,-1],[450,998,1],[1470,998,-1]];
  slots.forEach(([x,y,dir],i)=>{
   const act=muffinChoreography(t,duration,i);
   const bounce=(Math.abs(Math.sin((beat+i*.25)*Math.PI))*22*(party?1:.35)+act.solo*26+act.wave*12)*(1-act.prepare)*(1-act.fall);
   const enter=Math.max(0,1-t/.55)*170;
   c.save();c.translate(x-dir*enter,y-bounce+act.fall*11);c.scale(dir,1);
   c.rotate(Math.sin(beat*Math.PI*2+i)*.13*(1-act.fall)+act.fall*(i%2?1:-1)*(1.28+(i%3)*.13));
   this.muffin(beat,i,party,encore,act);c.restore();
   // Accessories leave the hands at the same instant, then stay on the floor.
   if(act.dead){const q=ease(act.age/.2);c.save();c.translate(x,y);c.scale(dir,1);
    if(i%3===0){c.save();c.translate(-72+q*24,-43+q*111-Math.sin(q*Math.PI)*23);c.rotate(-.2+q*2.1);c.fillStyle='#64788c';c.fillRect(-4,0,8,21);c.fillStyle='#bce1ed';c.beginPath();c.arc(0,-3,10,0,Math.PI*2);c.fill();c.restore();}
    if(i%3===2||encore){c.save();c.translate(24+q*51,-103+q*143-Math.sin(q*Math.PI)*53);c.rotate(q*2.5);c.fillStyle='#bc9aff';c.beginPath();c.moveTo(-13,20);c.lineTo(0,-22);c.lineTo(17,20);c.fill();c.restore();}
    // A few chocolate crumbs, not a screen-wide explosion.
    if(act.age<.24){c.fillStyle='#db9b54';for(let j=0;j<4;j++){c.globalAlpha=fade*(1-q);c.fillRect((j-1.5)*(16+q*32),20-q*(22+j*7)+q*q*55,5,5);}}
    c.restore();
   }
  });
  // Narrow top title and bottom flourish, outside the action area.
  const label=story.prepare>.2?'I WANNA…':encore?'IT’S MUFFIN TIME':party?'MUFFIN MAYHEM':'IT’S MUFFIN TIME';
  if(!story.dead){cultureCameos(c,t,duration,{style:'muffins',bpm:effect.bpm||126});this.design.title(t,duration+.4,label,'muffins',{});}
  else{c.save();c.textAlign='center';c.fillStyle='#ffdfb3';c.font='900 54px Georgia';c.fillText('…oh.',960,76);c.font='700 18px "Trebuchet MS"';c.fillText('BAKERY CLOSED',960,1037);c.restore();}
  soundEnergy(c,t,duration,{style:'muffins',bpm:effect.bpm||126},true);
  c.restore();
  c.globalAlpha=1;
 }
 star(r){const c=this.c;c.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4,rr=j%2?r*.35:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();}
 muffin(beat,i,party,encore,act){
  const c=this.c,swing=act.dead?0:Math.sin(beat*Math.PI*2+i),lift=act.dead?-35:act.prepare*26+act.solo*25+act.wave*35+(party?swing*16:0);
  c.lineCap='round';c.lineJoin='round';c.strokeStyle='#4e2843';c.lineWidth=6;
  // Rubber-hose shoes and arms; left hand carries a tiny microphone.
  for(const dir of [-1,1]){
   c.beginPath();c.moveTo(dir*23,42);c.lineTo(dir*(30+swing*9),63);c.lineTo(dir*(43+swing*10),65);c.stroke();
   c.beginPath();c.moveTo(dir*43,-8);c.quadraticCurveTo(dir*66,-5-lift,dir*72,-30-lift);c.stroke();
   c.fillStyle='#fff7e4';c.beginPath();c.ellipse(dir*72,-30-lift,10,8,0,0,Math.PI*2);c.fill();c.stroke();
  }
  c.fillStyle=i%2?'#d47aad':'#83bcd9';c.beginPath();c.moveTo(-48,-12);c.lineTo(-34,46);c.quadraticCurveTo(0,60,34,46);c.lineTo(48,-12);c.closePath();c.fill();c.stroke();
  c.strokeStyle='rgba(70,30,55,.25)';c.lineWidth=3;
  for(let k=-2;k<=2;k++){c.beginPath();c.moveTo(k*15,-3);c.lineTo(k*11,43);c.stroke();}
  c.strokeStyle='#4e2843';c.lineWidth=6;c.fillStyle='#db9b54';
  c.beginPath();c.moveTo(-53,-11);c.bezierCurveTo(-77,-33,-45,-73,-22,-71);c.bezierCurveTo(-9,-91,27,-87,39,-66);c.bezierCurveTo(68,-61,75,-21,52,-10);c.quadraticCurveTo(0,5,-53,-11);c.fill();c.stroke();
  c.fillStyle='#ffe0a2';c.beginPath();c.ellipse(-12,-61,26,9,-.3,0,Math.PI*2);c.fill();
  c.fillStyle='#6d3a34';for(const [x,y]of [[-39,-42],[25,-54],[40,-28],[-2,-70]]){c.beginPath();c.ellipse(x,y,5,4,.4,0,Math.PI*2);c.fill();}
  // Alternating sunglasses, open singing mouths, pink cheeks.
  if(act.dead){c.strokeStyle='#38263f';c.lineWidth=4;for(const x of [-16,17]){c.beginPath();c.moveTo(x-6,-31);c.lineTo(x+6,-19);c.moveTo(x+6,-31);c.lineTo(x-6,-19);c.stroke();}}
  else if(i%3===1&&party){c.fillStyle='#38263f';c.fillRect(-28,-31,22,13);c.fillRect(7,-31,22,13);c.fillRect(-6,-28,13,4);}
  else{for(const x of [-16,17]){c.fillStyle='#38263f';c.beginPath();c.ellipse(x,-24,4,8,0,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(x-1,-27,1.6,0,Math.PI*2);c.fill();}}
  c.fillStyle='#f39192';for(const x of [-30,31]){c.beginPath();c.ellipse(x,-12,8,4,0,0,Math.PI*2);c.fill();}
  c.fillStyle='#54233c';c.beginPath();c.ellipse(0,-8,8,act.dead?2:party?9+Math.abs(swing)*3:4,0,0,Math.PI*2);c.fill();
  if(!act.dead&&i%3===0){c.save();c.translate(-72,-43-lift);c.rotate(-.2);c.fillStyle='#64788c';c.fillRect(-4,0,8,21);c.fillStyle='#bce1ed';c.beginPath();c.arc(0,-3,10,0,Math.PI*2);c.fill();c.restore();}
  if(!act.dead&&(i%3===2||encore)){c.fillStyle='#bc9aff';c.beginPath();c.moveTo(15,-73);c.lineTo(24,-117);c.lineTo(48,-68);c.closePath();c.fill();c.stroke();c.fillStyle='#ffd36c';c.beginPath();c.arc(24,-117,5,0,Math.PI*2);c.fill();}
 }
}
