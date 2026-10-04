// Restored October 1 muffin performance, with original characters and title choreography.
import {createLegacyProductionDesign,artReady} from './rave.js';
// Original canvas characters. Audio time drives every beat, cue and particle.
// Idle does not animate. The middle of the gameplay canvas stays clear.
export class MuffinShow{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.design=createLegacyProductionDesign(this.c);this.ready=artReady;}
 clear(){this.c.clearRect(0,0,1920,1080);}
 draw(t,duration,effect={}){
  this.clear();const c=this.c,beat=t*(effect.bpm||126)/60,pulse=(Math.sin(beat*Math.PI*2)+1)/2;
  const fade=Math.min(1,t/.3,Math.max(0,(duration-t)/.45));c.globalAlpha=fade;
  const party=t>1.1,encore=t>duration-1.6;
  c.save();c.beginPath();c.rect(0,0,1920,1080);c.rect(240,170,1440,670);c.clip('evenodd');
  const progress=Math.max(0,Math.min(1,t/Math.max(.1,duration))),phase=progress<.18?0:progress<.42?1:progress<.78?2:3;
  const starts=[0,.18,.42,.78],ends=[.18,.42,.78,1];
  this.design.scenery(t,beat,'muffins',{phase,progress,local:(progress-starts[phase])/(ends[phase]-starts[phase]),energy:1});
  // Corner arcs and thin border lights; no rectangle over the game.
  c.strokeStyle=`rgba(255,198,90,${.3+pulse*.45})`;c.lineWidth=4;
  for(const [x,y,sx,sy] of [[18,18,1,1],[1902,18,-1,1],[18,1062,1,-1],[1902,1062,-1,-1]]){
   c.beginPath();c.moveTo(x+sx*140,y);c.lineTo(x,y);c.lineTo(x,y+sy*140);c.stroke();
  }
  // Beat burst stars constrained to the outer 100px.
  for(let i=0;i<32;i++){
   const side=i%4,travel=(t*(45+i%5*9)+i*83)%1000;
   const x=side<2?(side?1860:60):80+travel*1.76;
   const y=side<2?40+travel:(side===2?38:1042);
   c.save();c.translate(x,y);c.rotate(t*(i%2?1:-1));c.fillStyle=i%2?'#f5ccff':'#ffd16b';
   c.globalAlpha=fade*(.25+pulse*.5);this.star(6+(i%3)*3);c.restore();
  }
  c.globalAlpha=fade;
  const slots=[[95,230,1],[1825,230,-1],[95,520,1],[1825,520,-1],[95,820,1],[1825,820,-1],[450,998,1],[1470,998,-1]];
  slots.forEach(([x,y,dir],i)=>{
   const bounce=Math.abs(Math.sin((beat+i*.25)*Math.PI))*22*(party?1:.35);
   const enter=Math.max(0,1-t/.55)*170;
   c.save();c.translate(x-dir*enter,y-bounce);c.scale(dir,1);
   c.rotate(Math.sin(beat*Math.PI*2+i)*.13);this.muffin(beat,i,party,encore);c.restore();
  });
  // Narrow top title and bottom flourish, outside the action area.
  const label=encore?'ONE MORE BITE!':party?'MUFFIN MAYHEM':'IT’S MUFFIN TIME';
  this.design.title(t,duration,label,'muffins',{});c.restore();
  c.globalAlpha=1;
 }
 star(r){const c=this.c;c.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4,rr=j%2?r*.35:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();}
 muffin(beat,i,party,encore){
  const c=this.c,swing=Math.sin(beat*Math.PI*2+i),lift=party?swing*16:0;
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
  if(i%3===1&&party){c.fillStyle='#38263f';c.fillRect(-28,-31,22,13);c.fillRect(7,-31,22,13);c.fillRect(-6,-28,13,4);}
  else{for(const x of [-16,17]){c.fillStyle='#38263f';c.beginPath();c.ellipse(x,-24,4,8,0,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(x-1,-27,1.6,0,Math.PI*2);c.fill();}}
  c.fillStyle='#f39192';for(const x of [-30,31]){c.beginPath();c.ellipse(x,-12,8,4,0,0,Math.PI*2);c.fill();}
  c.fillStyle='#54233c';c.beginPath();c.ellipse(0,-8,8,party?9+Math.abs(swing)*3:4,0,0,Math.PI*2);c.fill();
  if(i%3===0){c.save();c.translate(-72,-43-lift);c.rotate(-.2);c.fillStyle='#64788c';c.fillRect(-4,0,8,21);c.fillStyle='#bce1ed';c.beginPath();c.arc(0,-3,10,0,Math.PI*2);c.fill();c.restore();}
  if(i%3===2||encore){c.fillStyle='#bc9aff';c.beginPath();c.moveTo(15,-73);c.lineTo(24,-117);c.lineTo(48,-68);c.closePath();c.fill();c.stroke();c.fillStyle='#ffd36c';c.beginPath();c.arc(24,-117,5,0,Math.PI*2);c.fill();}
 }
}
