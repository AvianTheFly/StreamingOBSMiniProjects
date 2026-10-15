import {scenes,path,light} from './scene-map.js';
import {TAU,ring,feather,lightning} from './vfx-ink.js';

const fract=n=>n-Math.floor(n);
function rune(c,x,y,size,color,a,turn=0){
 c.save();c.translate(x,y);c.rotate(turn);
 path(c,[[-size,0],[0,-size],[size,0],[0,size],[-size,0]],color,1,a);
 path(c,[[0,-size*1.5],[0,size*1.5]],color,1,a);c.restore();
}
function koi(c,x,y,t,color,a){
 c.save();c.translate(x,y);c.rotate(Math.cos(t)*.35);c.globalAlpha=a;c.fillStyle=color;
 c.beginPath();c.ellipse(0,0,13,4,0,0,TAU);c.fill();
 path(c,[[-10,0],[-19,-5+Math.sin(t*6)*3],[-16,0],[-19,5+Math.sin(t*6)*3],[-10,0]],color,1.4,a);
 path(c,[[1,0],[-4,-8],[-6,0],[0,6]],color,1,a*.65);light(c,8,-1,2,2,'#fff8d9',a);c.restore();
}
// Small stories occupy authored scenery contacts, never UI plates or the camera.
// All motion is analytical on the world's clock: no particles accumulate or own timers.
export function paintDetails(c,t,theme){
 const s=scenes[theme];c.save();c.globalCompositeOperation='screen';
 // Distant activity occupies the two upper corners, outside the camera and headers.
 // Small paired visitors drift through at different phases; ground stories stay dominant.
 for(let side=0;side<2;side++){
  const q=fract(t/31+side*.47),a=Math.sin(q*Math.PI)**2,x=(side?1230:40)+q*620,y=40+Math.sin(q*Math.PI)*105,color=s.colors[side];
  c.save();c.beginPath();c.rect(side?1200:20,12,700,185);c.clip();
  if(theme==='turtle'){
   for(let i=0;i<2;i++){const px=x-i*24,py=y+Math.sin(t*1.3+i)*9;
    light(c,px,py,4,3,color,a*.55);
    for(const sign of [-1,1]){path(c,[[px,py],[px+sign*6,py-3-Math.sin(t*11+i)*3]],color,.8,a*.5);}
   }
  }else if(theme==='bear'){
   // A little storm spark chases its own trailing stars.
   for(let i=0;i<5;i++){const px=x-i*10,py=y+Math.sin(t*2-i*.6)*8;light(c,px,py,3-i*.3,3-i*.3,color,a*(.5-i*.075));}
  }else{
   // Tiny thermal gliders bank above the far peaks, with a short falling feather.
   for(let i=0;i<2;i++){const px=x-i*31,py=y+i*9,wing=3+Math.sin(t*4+i)*3;
    path(c,[[px-8,py-wing],[px,py],[px+8,py-wing]],color,1,a*.5);
   }
   feather(c,x-65,y+15+q*25,3,q*6,color,a*.3);
  }
  c.restore();
 }
 for(let side=0;side<2;side++){
  const color=s.colors[side],mirror=side?-1:1,edge=side?1920:0;
  c.save();c.beginPath();c.rect(side?1178:20,0,722,1080);c.clip();
  if(theme==='bear'){
   // A tiny constellation draws itself above each sentinel; charge hops between stars.
   const stars=[[95,128],[137,86],[174,105],[201,62],[240,88]],cycle=fract(t/14+side*.37);
   for(let i=0;i<stars.length;i++){
    const [dx,y]=stars[i],x=edge+mirror*dx,a=.18+.45*Math.max(0,1-Math.abs(cycle-i/5)*9);
    light(c,x,y,5,5,color,a);path(c,[[x-3,y],[x+3,y]],color,.8,a);
    if(i&&cycle>i/5){const [px,py]=stars[i-1];path(c,[[edge+mirror*px,py],[x,y]],color,.7,.12);}
   }
   const [x,y]=s.source[side];
   for(let i=0;i<5;i++){const q=fract(t*.18+i/5);rune(c,x+mirror*(90+i*24),y+72+Math.sin(q*TAU)*3,4+i%2,color,.13+.25*Math.sin(q*Math.PI),.15);}
   const q=fract(t/9+side*.41);if(q<.14)lightning(c,[x-60,y+45],[x+76,y+47],color,Math.sin(q/.14*Math.PI)*.32,t,1,false);
  }else if(theme==='turtle'){
   const [x,y]=s.source[side];
   // Two translucent koi orbit the well, with ripples following their tails.
   for(let i=0;i<2;i++){const a=t*.22+i*Math.PI+side,px=x+Math.cos(a)*105,py=y+59+Math.sin(a)*19;
    c.save();c.translate(px,py);c.scale(Math.sin(a)<0?-1:1,1);koi(c,0,0,t+i,color,.48);c.restore();
    ring(c,px-12,py+4,13+fract(t*.4+i*.5)*19,3+fract(t*.4+i*.5)*4,color,.12,1);
   }
   for(let i=0;i<3;i++){const px=edge+mirror*(105+i*210),py=970+i%2*36,b=.65+Math.sin(t*.7+i)*.2;
    for(let j=-2;j<=2;j++)feather(c,px+j*3,py,9*b,j*.38,color,.26);
    ring(c,px,py+9,23,5,color,.15,1);light(c,px,py,15,10,color,.16*b);
   }
  }else if(theme==='ram'){
   const [x,y]=s.source[side];
   // Molten runes awaken in sequence along the engraved stone beneath the forge.
   for(let i=0;i<7;i++){const q=fract(t/11-i*.08+side*.4),a=.10+Math.max(0,1-q*5)*.55;
    rune(c,x+(i-3)*37,y+109+Math.abs(i-3)*3,5,color,a);light(c,x+(i-3)*37,y+109,12,6,color,a*.28);
   }
   // Droplets fall from the brazier lip, split and cool into small embers.
   for(let i=0;i<8;i++){const q=fract(t*.28+i/8),px=x+Math.sin(i*7)*20,py=y+24+q*q*175;
    light(c,px,py,1.5,3+q*5,'#ffce70',(1-q)*.6);
    if(q>.8)path(c,[[px,py],[px+(i%2?1:-1)*(q-.8)*55,py-4]],color,1,(1-q)*2);
   }
   const q=fract(t/17+side*.4);if(q<.18){const x=edge+mirror*166,y=171;ring(c,x,y,3+q*90,3+q*90,color,(1-q/.18)*.18,1);}
  }else{
   const [x,y]=s.source[side];
   // Ice and ember feathers share a slow orbit over their respective hearths.
   for(let i=0;i<5;i++){const a=t*.24+i*TAU/5,px=x+Math.cos(a)*80,py=y+65+Math.sin(a)*15;
    feather(c,px,py,7,a+.5,color,.34);light(c,px,py+8,11,3,color,.13);
   }
   for(let i=0;i<3;i++){const px=edge+mirror*(70+i*170),py=984+Math.sin(i*8)*27,q=fract(t*.09+i*.3);
    if(side){feather(c,px+Math.sin(q*6)*13,py-q*55,5,Math.sin(t+i),color,(1-q)*.4);}
    else{for(let j=0;j<3;j++){const a=j*Math.PI/3;path(c,[[px-Math.cos(a)*8,py-Math.sin(a)*8],[px+Math.cos(a)*8,py+Math.sin(a)*8]],color,1,.12+.22*Math.sin(q*Math.PI));}}
   }
  }
  c.restore();
 }
 c.restore();
}
