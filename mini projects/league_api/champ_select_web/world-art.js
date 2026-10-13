import {scenes,path,light,pulse} from './scene-map.js';
import {ribbon,ring,feather,lightning} from './vfx-ink.js';
const TAU=Math.PI*2,fract=x=>x-Math.floor(x),seed=x=>fract(Math.sin(x*127.1)*43758.5453);
// Independent articulated objects. The background bitmap never moves.
export function bird(c,x,y,size,t,color,alpha=1){c.save();c.translate(x,y);c.globalAlpha=alpha;c.fillStyle=color;c.shadowColor=color;c.shadowBlur=12;c.beginPath();c.ellipse(0,0,size*.12,size*.48,-.3,0,TAU);c.fill();for(const side of [-1,1])for(let i=0;i<6;i++){c.save();c.rotate(side*(.35+Math.sin(t*9)*.28));c.beginPath();c.moveTo(side*size*.08,-size*.2);c.quadraticCurveTo(side*size*(.45+i*.12),-size*(.85-i*.045),side*size*(.45+i*.12),size*(.12+i*.07));c.quadraticCurveTo(side*size*.2,size*.16,side*size*.08,size*.25);c.fill();c.restore();}c.beginPath();c.moveTo(0,-size*.35);c.lineTo(size*.26,-size*.42);c.lineTo(size*.03,-size*.55);c.fill();for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(i*size*.04,size*.25);c.lineTo(i*size*.3,size*1.1);c.lineTo(i*size*.13,size*.15);c.fill();}c.restore();}
export function shell(c,x,y,r,color,alpha=.6){c.save();c.translate(x,y);c.strokeStyle=color;c.globalAlpha=alpha;c.lineWidth=2;c.beginPath();c.ellipse(0,0,r,r*.65,0,0,TAU);c.stroke();for(let i=0;i<6;i++){const a=i*TAU/6;path(c,[[Math.cos(a)*r*.38,Math.sin(a)*r*.25],[Math.cos(a)*r,Math.sin(a)*r*.65]],color,2,alpha);}c.beginPath();for(let i=0;i<=6;i++){const a=i*TAU/6;c.lineTo(Math.cos(a)*r*.38,Math.sin(a)*r*.25);}c.stroke();c.restore();}
export function paintWorld(c,t,theme,events=[]){const s=scenes[theme];c.save();c.globalCompositeOperation='screen';for(let side=0;side<2;side++){const [x,y]=s.source[side],color=s.colors[side];const charge=events.reduce((v,e)=>e.kind==='lock'&&Number(!!e.enemy)===side?Math.max(v,pulse(t-e.at,0,2)):v,0);light(c,x,y,95+charge*100,28+charge*12,color,.14+charge*.55);light(c,...s.guardian[side],80,60,color,.055+charge*.2);
 // Local currents emerge from the painted source and leave a flattened reflection.
 const breathe=.65+Math.sin(t*1.4+side)*.2;
 light(c,x,y+24,140,13,color,.10*breathe);
 if(theme==='turtle'){
  for(let k=0;k<5;k++){const q=fract(t*.22+k/5);ring(c,x,y+5+q*30,20+q*125,4+q*15,color,(1-q)*.24,1.3);}
  for(let k=0;k<3;k++)ribbon(c,[x-30+k*30,y+4],[x+Math.sin(t+k)*14,y-100-k*16],1,color,{bend:28,width:8,tail:1,alpha:.12+charge*.16,phase:t*2+k});
 }else if(theme==='ram'){
  for(let k=0;k<5;k++){const q=fract(t*.5+k/5);ribbon(c,[x+(k-2)*14,y],[x+(k-2)*22+Math.sin(t*3+k)*17,y-80-q*65],1,color,{width:11*(1-q)+2,bend:12,tail:1,alpha:(1-q)*.21+charge*.07,phase:t*4+k});}
 }else if(theme==='phoenix'){
  for(let k=0;k<4;k++){const q=fract(t*.25+k/4);ribbon(c,[x,y],[x+Math.sin(t+k)*50,y-135],q,color,{width:10,tail:.3,bend:30,alpha:(1-q)*.32,phase:k+t});feather(c,x+Math.sin(k*3+q*4)*q*80,y-q*180,4+q*6,q*4+k,color,(1-q)*.45);}
 }else{
  const storm=fract(t/7+side*.4);if(storm<.075)lightning(c,[x-53,y-20],[x+48,y-51],color,Math.sin(storm/.075*Math.PI)*.48,t,1.4);
  for(let k=0;k<3;k++){const q=fract(t*.33+k/3);ring(c,x,y+8,20+q*90,4+q*16,color,(1-q)*.16,1.5);}
 }
 if(theme==='bear'){for(let k=0;k<3;k++){const f=t*4+k*2,dx=Math.sin(f)*30;path(c,[[x-45+k*38,y+9],[x+dx-10,y-16-k*5],[x+dx+8,y-34-k*7],[x+dx,y-55-k*4]],color,1.4,.2+charge*.6);}}
 else if(theme==='turtle'){for(let k=0;k<4;k++){const q=fract(t*.17+k/4);shell(c,x,y-q*65,18+q*42,color,(1-q)*.22);}}
 else if(theme==='ram'){for(let k=0;k<14;k++){const q=fract(t*.35+k/14);light(c,x+Math.sin(k*13+q)*q*65,y-q*140,1.3,3,color,(1-q)*.65);}}
 else{for(let k=0;k<7;k++){const q=fract(t*.22+k/7),px=x+Math.sin(k*6+q*4)*q*60,py=y-q*110;c.save();c.translate(px,py);c.rotate(q*4+k);c.fillStyle=color;c.globalAlpha=(1-q)*.55;c.beginPath();c.ellipse(0,0,2,7,0,0,TAU);c.fill();c.restore();}}}
 if(theme==='bear'||theme==='phoenix')for(let i=0;i<65;i++){const x=seed(i)*1920,y=fract(seed(i+100)+t*(theme==='bear'?.38:.065))*1080;if(theme==='bear')path(c,[[x,y],[x-8,y+25]],'#bfdfff',1,.16);else{c.globalAlpha=.2+seed(i+140)*.3;c.fillStyle=i%5?'#cfedff':'#ffa66b';c.fillRect(x+Math.sin(t+i)*12,y,2,2);}}
 if(theme==='turtle')for(let i=0;i<28;i++){const q=fract(t*.055+i/28),x=(i%2?80:1560)+seed(i)*280;c.strokeStyle='#aaffd7';c.lineWidth=1;c.globalAlpha=(1-q)*.35;c.beginPath();c.arc(x+Math.sin(t+i)*8,1000-q*650,2+seed(i+2)*4,0,TAU);c.stroke();}
 if(theme==='ram')for(let i=0;i<24;i++){const q=fract(t*.065+i/24);light(c,seed(i)*1920,1050-q*900,1.2,2.5,'#ffb969',(1-q)*.45);}
 if(theme==='phoenix'){const q=(t%29)/29;if(q>.7){const u=(q-.7)/.3;bird(c,160+u*1600,170-Math.sin(u*Math.PI)*100,11,t,'#e4f9ff',Math.sin(u*Math.PI)*.45);}}
 c.restore();}
