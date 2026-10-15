import {scenes,light,path,clamp,smooth,traceSlot} from './scene-map.js';
import {layouts} from './layout.js';
import {LOCK} from './vfx-timing.js';
import {TAU,seed,ring,lightning,feather} from './vfx-ink.js';

// Spatial propagation from the locked portrait controls every secondary reply.
export function waveArrival(origin,point){return Math.max(0,Math.hypot(point[0]-origin[0],(point[1]-origin[1])/.55)-35)/920;}
export function resonance(theme,cue,time){
 const p=layouts[theme][cue.key]?.[cue.index];if(!p)return null;
 return {p,origin:[p.x+p.w/2,p.y+205],side:Number(!!cue.enemy),age:time-cue.at-LOCK.impact};
}
function crest(c,x,y,r,theme,color,alpha,t){
 if(theme==='bear'){
  for(let i=0;i<9;i++){const a=i*TAU/9,dr=25+seed(i)*40;
   lightning(c,[x+Math.cos(a)*(r-dr),y+Math.sin(a)*(r-dr)*.55],[x+Math.cos(a)*r,y+Math.sin(a)*r*.55],color,alpha,t+i,1.5,false);}
 }else if(theme==='turtle'){
  ring(c,x,y,r,r*.55,color,alpha*.65,2.5);ring(c,x,y,Math.max(1,r-12),Math.max(1,(r-12)*.55),color,alpha*.22,7);
  for(let i=0;i<12;i++){const a=i*TAU/12;feather(c,x+Math.cos(a)*r,y+Math.sin(a)*r*.55,7,a+Math.PI/2,color,alpha*.75);}
 }else if(theme==='ram'){
  const pts=[];for(let i=0;i<=18;i++){const a=i*TAU/18,rr=r+(i%2?14:-7);pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr*.55]);}
  path(c,pts,color,2.5,alpha*.8);path(c,pts,'#fff2bf',.7,alpha*.8);
 }else{
  for(let i=0;i<14;i++){const a=i*TAU/14;feather(c,x+Math.cos(a)*r,y+Math.sin(a)*r*.55,13,a+Math.PI/2,i%2?'#ffb270':'#a9edff',alpha*.85);}
  ring(c,x,y,r,r*.55,color,alpha*.3,1.5);
 }
}
export function paintResonance(c,t,theme,cue){
 const w=resonance(theme,cue,t);if(!w||w.age<0||w.age>3.2)return;
 const {origin:[x,y],side,age:d}=w,s=scenes[theme],color=s.colors[side],left=side?1178:20,right=side?1900:742;
 c.save();c.beginPath();c.rect(left,0,right-left,1080);c.clip();
 const radius=35+d*920,fade=1-smooth((d-.12)/1.1);
 if(fade>0){crest(c,x,y,radius,theme,color,fade,t);light(c,x,y,130+d*400,190+d*150,color,fade*.10);}
 for(const p of layouts[theme][side?'enemies':'allies']){
  const px=p.x+p.w/2,a=d-waveArrival([x,y],[px,y]);if(a<0||a>1.3)continue;
  const strength=Math.exp(-a*4)*(p===w.p?.35:.65);
  traceSlot(c,p,color,2.2,strength);light(c,px,813,75,12,color,strength*.8);
  path(c,[[p.x+8,824],[p.x+28,832],[p.x+p.w-28,832],[p.x+p.w-8,824]],color,1.4,strength);
 }
 // The outgoing pulse also travels along this team's physical platform seam.
 const baseY=820,baseDelay=waveArrival([x,y],[x,baseY]),q=clamp((d-baseDelay)/.7);
 if(d>=baseDelay&&d<2){
  const a=(1-smooth((d-.7)/1.3))*.75;
  for(const sign of [-1,1]){
   const end=x+sign*q*720;
   const pts=theme==='ram'?[[x,baseY],[x+sign*q*180,baseY+9],[x+sign*q*330,baseY-2],[end,baseY+6]]:[[x,baseY],[end,baseY]];
   path(c,pts,color,2.2,a);light(c,end,baseY,28,10,color,a);
  }
 }
 const source=s.source[side],sourceAge=d-waveArrival([x,y],source),g=s.guardian[side];
 if(sourceAge>=0&&sourceAge<2.2){
  const power=Math.exp(-sourceAge*2.4);light(c,...source,180,40,color,power*.65);
  for(let i=0;i<3;i++){const q=clamp((sourceAge-i*.1)/.9);if(sourceAge>=i*.1)ring(c,...source,30+q*150,8+q*26,color,(1-q)*.5,2);}
 }
 const guardianAge=d-waveArrival([x,y],g);
 if(guardianAge>=0&&guardianAge<1.8){const a=Math.exp(-guardianAge*2.5);light(c,...g,105,65,color,a*.35);light(c,...g,16,8,color,a*.8);}
 for(let i=0;i<16;i++){
  const a=i*2.399+cue.index*.3,v=180+seed(i+7)*210,life=1.2+seed(i)*1.2;
  if(d>life)continue;const px=x+Math.cos(a)*v*d,py=y+Math.sin(a)*v*d*.65+45*d*d,alpha=(1-d/life)*.65;
  if(theme==='phoenix')feather(c,px,py,5+seed(i)*5,a+d,color,alpha);
  else if(theme==='turtle')ring(c,px,py,2+seed(i)*3,3+seed(i)*4,color,alpha,1);
  else{c.globalAlpha=alpha;c.fillStyle=color;c.fillRect(px,py,theme==='ram'?3:1.5,theme==='ram'?3:9);}
 }
 c.restore();
}
