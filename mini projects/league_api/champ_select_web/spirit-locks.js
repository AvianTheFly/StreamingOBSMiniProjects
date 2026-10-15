import {scenes,path,light,clamp,smooth,traceSlot} from './scene-map.js';
import {layouts} from './layout.js';
import {LOCK} from './vfx-timing.js';
import {TAU,seed,out,envelope,arc,ribbon,lightning,ring,feather,burst,mist,apparition} from './vfx-ink.js';

function cardSeal(c,p,age,color){
 if(age>=LOCK.impact)return;
 const x=p.x+p.w/2,y=p.y+205,q=clamp(age/LOCK.impact);
 traceSlot(c,p,color,3.5,.6+q*.4);
 for(const sign of [-1,1]){const yy=p.y+45+q*270;
  path(c,[[x+sign*48,p.y+45],[x+sign*48,yy]],color,2.5,.85);
  light(c,x+sign*48,yy,14,24,color,.65);
 }
 ring(c,x,y,80-q*43,130-q*58,color,.3+q*.6,2.5);
}
function frameWake(c,p,age,color,theme){
 const d=age-LOCK.impact;if(d<0)return;const hit=Math.exp(-d*8),tail=envelope(d,.035,.45,2.8);
 light(c,p.x+p.w/2,p.y+p.h+10,130+out(d/.4)*80,24,color,hit*.95+tail*.15);
 traceSlot(c,p,color,13,hit*.3);traceSlot(c,p,color,2.5,tail*.78);
 // A climbing enchantment finishes in the selected shrine, with two points of contact.
 const q=out(d/.8);
 for(const side of [0,1]){const x=p.x+(side?p.w:0),y=p.y+p.h-q*p.h;
  path(c,[[x,p.y+p.h],[x,y]],color,2,tail*.6);light(c,x,y,14,32,color,tail*.6);}
 for(const dir of [-1,1]){const x=p.x+p.w/2+dir*out(d/.8)*250;
  light(c,x,813,42,9,color,Math.max(0,1-d/.9)*.55);}
 if(theme==='ram')for(let i=0;i<6;i++){const a=i*Math.PI/3,dx=Math.cos(a)*(80+i*5),dy=Math.sin(a)*14;path(c,[[p.x+p.w/2,814],[p.x+p.w/2+dx*.4,819+dy*.3],[p.x+p.w/2+dx,822+dy]],color,2,tail*.6);}
 else for(let i=0;i<2;i++){const q=clamp((d-i*.12)/.85);ring(c,p.x+p.w/2,811,15+q*220,3+q*25,color,(1-q)*.55,2);}
}
function bear(c,t,age,origin,target,p,color,image){
 const q=clamp((age-LOCK.launch)/(LOCK.impact-LOCK.launch)),d=age-LOCK.impact;
 if(age>LOCK.launch&&d<.08){const h=arc(origin,target,q*q,35);
  ribbon(c,origin,target,q*q,color,{width:28,bend:35,tail:.65,phase:t*9});lightning(c,origin,h,color,.8,t,2.2);
  apparition(c,image,...h,75+q*130,90+q*175,{alpha:smooth(q*4),turn:-.15});}
 if(d>=0){const slash=out(d/.065),life=1-smooth((d-.16)/.65);
  apparition(c,image,target[0]-40+slash*40,target[1]+45-slash*45,190+slash*45,270+slash*30,{alpha:life,turn:-.18,dissolve:clamp((d-.2)/.62)});
  if(d<.55){for(let k=0;k<3;k++)lightning(c,[p.x+12+k*32,p.y+80],[p.x+30+k*34,p.y+305],color,Math.max(0,1-d/.55),t+k,1.4);}
  burst(c,...target,d,color,{count:28,speed:540,life:1.55});mist(c,...target,d,'#4387b8',.12,110);
  // Thunder branches strike the frame corners, then burn out individually.
  for(const side of [0,1])if(d<1.5&&seed(Math.floor(t*9)+side)>.42)lightning(c,[p.x+side*p.w,p.y+65],[p.x+side*p.w,p.y+315],color,(1-d/1.5)*.65,t+side,1,false);
 }
}
function turtle(c,t,age,origin,target,p,color,image){
 const q=clamp((age-LOCK.launch)/(LOCK.impact-LOCK.launch)),d=age-LOCK.impact;
 if(age>LOCK.launch&&d<.1)for(let i=-1;i<=1;i++)ribbon(c,origin,[target[0]+i*24,target[1]],out(q),color,{width:16,bend:35+i*12,tail:.6,phase:i+t*5,alpha:.7});
 if(d>=0){const size=out(d/.24),fade=1-smooth((d-.65)/1.2);
  apparition(c,image,...target,112+size*60,200+size*90,{alpha:fade*.62,dissolve:clamp((d-.9)/1.05)});
  for(let j=0;j<3;j++){const z=d-j*.14;if(z<0)continue;ring(c,...target,55+out(z/.7)*44,100+out(z/.7)*69,color,Math.max(0,1-z/1.1)*.6,2,j*.08);}
  burst(c,target[0],target[1]+60,d,color,{kind:'water',count:22,speed:280,life:2.3,gravity:-55});
  for(let i=0;i<16;i++){const a=i*2.4+d*1.4,r=65+Math.sin(a)*7,y=p.y+320-((d*95+i*18)%260);feather(c,target[0]+Math.cos(a)*r,y,4+seed(i)*4,a,color,fade*.65);}
  mist(c,...target,d,'#59bfac',.095,110);
 }
}
function ram(c,t,age,origin,target,p,color,image){
 const q=clamp((age-LOCK.launch)/(LOCK.impact-LOCK.launch)),d=age-LOCK.impact;
 if(age>LOCK.launch&&d<.06){const h=arc(origin,target,q*q*q,35);ribbon(c,origin,target,q*q*q,color,{width:35,bend:35,tail:.55,alpha:.75});
  apparition(c,image,...h,65+q*q*175,75+q*q*190,{alpha:smooth(q*4)});}
 if(d>=0){const recoil=Math.sin(d*25)*Math.exp(-d*14),fade=1-smooth((d-.11)/.7);
  apparition(c,image,target[0],target[1]+recoil*10,235-recoil*25,265+recoil*10,{alpha:fade*.94,dissolve:clamp((d-.22)/.55)});
  burst(c,...target,d,color,{kind:'stone',count:26,speed:450,gravity:240,life:2.1});
  burst(c,...target,d,'#ffd57f',{count:20,speed:600,gravity:90,life:1.1,seedOffset:9});
  mist(c,target[0],target[1]+80,d,'#7b5541',.2,140);
  for(let i=0;i<3;i++){const a=d-i*.07;if(a<0)continue;ring(c,target[0],target[1]+30,25+out(a/.4)*150,10+out(a/.4)*50,color,Math.max(0,1-a/.5)*.6,4-i);}
 }
}
function phoenix(c,t,age,origin,target,p,color,image){
 const q=clamp((age-LOCK.launch)/(LOCK.impact-LOCK.launch)),d=age-LOCK.impact;
 if(age>LOCK.launch&&d<.1){const h=arc(origin,target,out(q),50);
  for(const sign of [-1,1])ribbon(c,[origin[0]+sign*18,origin[1]],[target[0]+sign*24,target[1]],out(q),sign<0?'#8edfff':'#ffad69',{bend:50,width:17,tail:.55,phase:t*7});
  apparition(c,image,...h,60+q*175,85+q*180,{alpha:smooth(q*4),turn:(1-q)*.28,wing:Math.sin(q*Math.PI)*.17});}
 if(d>=0){const rise=out(d/.6),fade=1-smooth((d-.18)/.95);
  apparition(c,image,target[0],target[1]-rise*35,230+rise*40,255+rise*50,{alpha:fade*.95,dissolve:clamp((d-.35)/.8),wing:Math.sin(d*7)*.025});
  for(const sign of [-1,1])burst(c,target[0]+sign*30,target[1],d,sign<0?'#8edfff':'#ffb270',{kind:'feather',count:16,speed:350,life:2.6,gravity:-30,seedOffset:sign+3});
  mist(c,target[0]-40,target[1]+40,d,'#559dcc',.1);mist(c,target[0]+40,target[1]+40,d,'#d58047',.1);
 }
}
const artists={bear,turtle,ram,phoenix};
export function paintLock(c,t,theme,e,assets){
 const age=t-e.at;if(age<0||age>=LOCK.end)return;
 const p=layouts[theme][e.key]?.[e.index];if(!p)return;
 const s=scenes[theme],side=Number(!!e.enemy),color=s.colors[side],target=[p.x+p.w/2,p.y+205];
 // The spirit emerges inside the newly locked portrait, then radiates outward.
 cardSeal(c,p,age,color);artists[theme](c,t,age,[target[0],p.y+295],target,p,color,assets?.effect);
 const d=age-LOCK.impact;
 if(d>=0&&d<.22){const flash=Math.exp(-d*22);light(c,...target,155,165,color,flash*.65);light(c,...target,45,60,'#fffbdc',flash*.8);}
 frameWake(c,p,age,color,theme);
}
