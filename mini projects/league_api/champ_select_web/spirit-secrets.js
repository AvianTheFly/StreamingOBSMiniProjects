import {clamp,smooth,pulse,path,light,scenes} from './scene-map.js';
import {bird} from './world-art.js';
import {secretProgram} from './secret-program.js';
import {paintVisitor} from './secret-visitors.js';
export {secretState} from './secret-program.js';
const shadow=(c,x,y)=>{c.save();c.fillStyle='#031014';c.globalAlpha=.35;c.beginPath();c.ellipse(x,y,18,4,0,0,Math.PI*2);c.fill();c.restore();};
function pearl(c,x,y,r=4){light(c,x,y,r*2,r*2,'#cbffe2',.35);c.fillStyle='#dcf3db';c.globalAlpha=1;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function prop(c,theme,x,y){c.save();c.globalAlpha=.95;
 if(theme==='bear'){path(c,[[x+28,y],[x+28,y-37],[x+34,y-45]],'#7b98a9',2,.8);path(c,[[x+19,y],[x+37,y]],'#7b98a9',3,.8);}
 if(theme==='turtle'){c.strokeStyle='#86784e';c.lineWidth=2;c.beginPath();c.ellipse(x+28,y-3,12,5,0,0,Math.PI*2);c.stroke();pearl(c,x+28,y-7);}
 if(theme==='ram'){c.fillStyle='#394044';c.fillRect(x+18,y-13,25,6);c.fillRect(x+24,y-7,14,7);path(c,[[x+16,y-14],[x+45,y-14],[x+49,y-18]],'#c6a265',2,.9);}
 if(theme==='phoenix'){path(c,[[x+25,y],[x+25,y-23]],'#c4b79b',2,.8);c.fillStyle='#222936';c.beginPath();c.moveTo(x+10,y-20);c.lineTo(x+25,y-30);c.lineTo(x+40,y-20);c.closePath();c.fill();}
 c.restore();}
function paintOriginal(c,t,theme,assets,s){const {x,y,h}=s,color=scenes[theme].colors[0];prop(c,theme,x,y);
 const a=s.age*10/16,v=s.variant,enter=smooth(a/1.2),exit=smooth((a-8.8)/1.2),alpha=enter*(1-exit),walk=-24*(1-enter)+exit*24;
 let pose=0,dx=walk,dy=0,turn=0,squash=1;shadow(c,x+dx,y);
 if(theme==='bear'){
  // Curious Kirby: test conductor / thunder sneeze / tiny grounded lightning kite.
  if(a>2&&a<4.3){pose=1;turn=.14;dx+=5;light(c,x+29,y-42,8,8,color,pulse(a,2,2.3));}
  if(a>=4.3&&a<6.9){pose=2;dy=-pulse(a,4.3,.7)*14;turn=Math.sin(a*22)*.04;
   for(let k=-1;k<=1;k++)path(c,[[x+k*7,y-h+2],[x+k*11,y-h-13],[x+k*8+4,y-h-19]],color,1.4,alpha*(1-clamp((a-5.5)/1.4)));
   if(v===1&&a>5)light(c,x+24+(a-5)*20,y-21,4,4,'#ffe4a6',pulse(a,5,1.5));
  }
  if(v===2){const rise=pulse(a,2,5)*35;path(c,[[x-7,y-20],[x-23,y-39-rise]],'#718795',.7,alpha);path(c,[[x-23,y-49-rise],[x-15,y-39-rise],[x-23,y-31-rise],[x-31,y-39-rise],[x-23,y-49-rise]],color,1,alpha);}
 }else if(theme==='turtle'){
  // The goose investigates a pearl: steal it / accidentally hatch a bubble / return two.
  if(a>2&&a<4){pose=1;turn=.12;dx+=8;}
  if(a>=4&&a<7.8){pose=2;dx+=Math.sin(a*3)*3;const q=clamp((a-4)/3.5);pearl(c,x+24-q*19,y-22-Math.sin(q*Math.PI)*20);
   if(v===1){c.strokeStyle=color;c.globalAlpha=alpha*(1-q);c.beginPath();c.arc(x+20,y-30-q*30,8+q*15,0,Math.PI*2);c.stroke();}
   if(v===2)pearl(c,x+36,y-7);
  }
 }else if(theme==='ram'){
  // A tiny forge apprentice: oversized hammer / runaway gold nut / one perfect star.
  if(a>2&&a<6.8){pose=1;const beat=pulse(a,2,1.4)+pulse(a,4.4,1.4);turn=-beat*.1;c.save();c.translate(x+25,y-14);c.rotate(-beat*1.5);c.fillStyle='#957546';c.fillRect(-2,-24,4,29);c.fillStyle='#798388';c.fillRect(-13,-29,24,10);c.restore();}
  if(a>5.7&&a<8){pose=2;squash=1-pulse(a,5.7,.6)*.2;const q=clamp((a-5.7)/2.3);light(c,x+28+q*40,y-14-q*25,3,3,'#ffde9b',(1-q)*.8);if(v===1)pearl(c,x+45+q*50,y-3+q*10,3);if(v===2)path(c,[[x+30,y-25],[x+33,y-18],[x+40,y-18],[x+34,y-14],[x+36,y-7],[x+30,y-12],[x+24,y-7],[x+26,y-14],[x+20,y-18],[x+27,y-18],[x+30,y-25]],'#ffdf92',1,alpha);}
 }else{
  // Boo visits the thermal boundary: toast a snowball / snow hat / feather sneeze.
  dy=Math.sin(a*2)*3;if(a>2&&a<5){pose=1;turn=-.1;pearl(c,x-18,y-19,5);}
  if(a>=5&&a<8){pose=2;dy+=pulse(a,5,2)*8;if(v===0){for(let k=0;k<3;k++)light(c,x-18+k*3,y-25-(a-5)*14,2,4,'#cceeff',alpha*.4);}if(v===1){c.fillStyle='#e6f8ff';c.globalAlpha=alpha;c.beginPath();c.ellipse(x,y-h+2,14,5,0,0,Math.PI*2);c.fill();}if(v===2)bird(c,x-22-(a-5)*10,y-26-(a-5)*7,5,a,color,alpha);}
 }
 assets.sprite(c,pose,x+dx,y+dy,h,{alpha,turn,squash});
}

// Keep every act inside its own scenery pocket, including props and shadows.
export function paintSecrets(c,t,theme,events,assets,clock=t){
 for(const spot of secretProgram(theme,clock)){
  if(!spot.active)continue;
  c.save();c.beginPath();c.rect(...spot.box);c.clip();
  if(spot.original)paintOriginal(c,t,theme,assets,spot);
  else paintVisitor(c,clock,theme,spot,assets);
  c.restore();
 }
}
