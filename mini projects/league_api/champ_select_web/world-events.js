import {scenes,path,light,clamp,smooth,traceSlot} from './scene-map.js';
import {layouts} from './layout.js';
import {paintLock} from './spirit-locks.js';
import {BAN,CHAT} from './vfx-timing.js';
import {TAU,seed,out,arc,ribbon,lightning,ring,feather,burst,mist,apparition} from './vfx-ink.js';

function ban(c,t,theme,e,assets){
 const age=t-e.at,p=layouts[theme][e.key]?.[e.index];if(!p||age<0||age>BAN.end)return;
 const x=p.x+p.w/2,y=p.y+p.h/2,color=scenes[theme].colors[Number(!!e.enemy)],q=clamp(age/BAN.impact),d=age-BAN.impact;
 // A collapsing seal converges on the actual forbidden champion socket.
 if(d<.15){for(let i=0;i<6;i++){const a=i*TAU/6+t*.6,r=35+(1-q)**2*95;
  const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
  if(theme==='phoenix')feather(c,px,py,14,a+Math.PI/2,color,.8);
  else if(theme==='bear')lightning(c,[px,py],[x+Math.cos(a)*27,y+Math.sin(a)*27],color,q*.8,t+i,1.3,false);
  else{c.save();c.translate(px,py);c.rotate(a);path(c,[[-7,-12],[7,-12],[12,0],[7,12],[-7,12],[-12,0],[-7,-12]],color,theme==='ram'?4:2,.75);c.restore();}
 }}
 if(d>=0){const hit=Math.exp(-d*10),fade=1-smooth((d-.5)/1.4);
  light(c,x,y,95,75,color,hit*.8);
  burst(c,x,y,d,color,{kind:theme==='ram'?'stone':theme==='turtle'?'water':theme==='phoenix'?'feather':'spark',count:24,speed:240,life:1.6});
  ring(c,x,y,38+out(d/.25)*18,38+out(d/.25)*18,color,fade*.6,2);
  // Cut across the portrait only after the six pieces meet; hold the sealed state.
  path(c,[[x-22,y-23],[x+22,y+23]],color,4,fade*.85);path(c,[[x+22,y-23],[x-22,y+23]],color,4,fade*.85);
  mist(c,x,y,d,theme==='ram'?'#9b7452':color,.065,75);
 }
}
function chat(c,t,theme,e,assets){
 const age=t-e.at;if(age<0||age>CHAT.end)return;
 const s=scenes[theme],origin=s.source[0],target=[774,605],q=out(age/CHAT.impact),d=age-CHAT.impact,color=s.colors[0];
 // Small courier stays below the portraits, then turns into the chat's receiving rail.
 const via=[690,920],a=age<.3?origin:via,b=age<.3?via:target,u=age<.3?out(age/.3):out((age-.3)/.35);
 if(d<.08){ribbon(c,a,b,u,color,{bend:age<.3?35:15,width:8,tail:.6,alpha:.65});const h=arc(a,b,u,age<.3?35:15);
  if(theme==='phoenix')feather(c,...h,13,-.5,color,.9);
  else if(theme==='turtle'){ring(c,...h,10,13,color,.8,2);light(c,...h,16,16,color,.5);}
  else if(theme==='bear')lightning(c,[h[0]-18,h[1]+16],[h[0]+8,h[1]-12],color,.95,t,1.7,false);
  else{c.save();c.translate(...h);c.rotate(t*4);c.fillStyle='#e8ae56';c.globalAlpha=.9;c.fillRect(-5,-5,10,10);c.restore();}
 }
 light(c,...origin,70,20,color,Math.sin(clamp(age/.65)*Math.PI)*.3);
 if(d>=0){const fade=1-smooth(d/1.5),travel=out(d/.6);
  path(c,[[766,920],[766,589],[766+travel*388,589]],color,2.5,fade*.8);
  light(c,766+travel*388,589,25,7,color,fade*.6);
  burst(c,...target,d,color,{kind:theme==='turtle'?'water':theme==='phoenix'?'feather':'spark',count:12,speed:100,life:1.1,gravity:40});
 }
}
function ready(c,t,theme,e,assets){
 const age=t-e.at,s=scenes[theme];
 for(const key of ['allies','enemies']){const side=Number(key==='enemies'),color=s.colors[side];
  layouts[theme][key].forEach((p,i)=>{const d=age-.35-i*.1;if(d<0||d>2.9)return;const fade=1-smooth((d-.25)/2.6);
   traceSlot(c,p,color,3,fade*.85);light(c,p.x+p.w/2,807,85,17,color,fade*.75);
   for(const dir of [-1,1]){const y=806-out(d/.8)*410;light(c,p.x+(dir<0?0:p.w),y,12,45,color,fade*.65);}
  });
  const q=out((age-.3)/.6),fade=1-smooth((age-1)/2),source=s.source[side];
  light(c,...source,180,45,color,fade*.45*q);
  if(age>.3&&age<2.7){const target=[side?1515:400,205];
   ribbon(c,source,target,q,color,{width:28,bend:side?100:-100,tail:.85,alpha:fade*.4});
   apparition(c,assets?.effect,...target,140,150,{alpha:fade*.45*q,dissolve:clamp((age-1.15)/1.3)});
  }
 }
}
export function paintEvents(c,t,theme,events,assets){
 c.save();c.globalCompositeOperation='screen';
 for(const e of events){if(e.kind==='lock')paintLock(c,t,theme,e,assets);else if(e.kind==='ban')ban(c,t,theme,e,assets);else if(e.kind==='chat')chat(c,t,theme,e,assets);else if(e.kind==='ready')ready(c,t,theme,e,assets);}
 c.restore();
}
