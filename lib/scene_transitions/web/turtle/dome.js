// Turtle-only jade membrane optics. Pure bounded curves; no per-frame resources.
import {TAU,lerp} from '../math.js';
import {polygon,line,glow} from '../fx.js';
export function edge(sh,a){const r=sh.r*(.955+.024*Math.cos(a*6)+.011*Math.cos(a*17)+.009*Math.cos(a*31));
 return [sh.x+Math.cos(a)*r*sh.sx,sh.y+Math.sin(a)*r*sh.sy];}
export function outline(sh){return Array.from({length:192},(_,i)=>edge(sh,i*TAU/192));}
export function texture(c,material,sh){const p=sh.p||0;
 c.drawImage(material,lerp(sh.x-sh.r*sh.sx,0,p),lerp(sh.y-sh.r*sh.sy,0,p),lerp(sh.r*sh.sx*2,1920,p),lerp(sh.r*sh.sy*2,1080,p));}
function project(sh,x,y){const d=Math.hypot(x,y),k=d?Math.sin(Math.min(1,d)*Math.PI/2)/d:Math.PI/2;
 return [sh.x+x*k*sh.r*sh.sx,sh.y+y*k*sh.r*sh.sy];}
export function paint(c,sh,t,hit,age,opaque=false,material=null){
 const points=outline(sh);c.save();polygon(c,points);c.clip();
 const g=c.createRadialGradient(sh.x-sh.r*.2,sh.y-sh.r*.25,sh.r*.08,sh.x,sh.y,sh.r*sh.sx);
 g.addColorStop(0,opaque?'#207666':'#12584c05');g.addColorStop(.52,opaque?'#12554e':'#185f5220');g.addColorStop(.83,opaque?'#297e65':'#53c49a32');g.addColorStop(1,'#a3f5c5b0');
 c.fillStyle=g;c.fillRect(sh.x-sh.r*sh.sx,sh.y-sh.r*sh.sy,sh.r*sh.sx*2,sh.r*sh.sy*2);
 if(material){c.save();c.globalAlpha*=.34+Math.exp(-Math.max(0,age)*7)*(age>=0?.20:0);texture(c,material,sh);c.restore();}
 const unit=.145,dy=unit*Math.sqrt(3);
 // Project the hex lattice over a hemisphere: compressed rim, broad front facets.
 for(let col=-6;col<=6;col++)for(let row=-6;row<=6;row++){
  const x=col*unit*1.5,y=row*dy+(col%2)*dy/2;if(Math.hypot(x,y)>.91)continue;
  const verts=Array.from({length:6},(_,i)=>project(sh,x+Math.cos(i*TAU/6)*unit*.98,y+Math.sin(i*TAU/6)*unit*.98));
  const center=project(sh,x,y),d=Math.hypot(center[0]-hit[0],center[1]-hit[1]);
  const wave=age>=0?Math.exp(-Math.pow((d-age*1150)/65,2))*Math.exp(-age*2.8):0;
  polygon(c,verts);c.fillStyle=`rgba(96,237,170,${.018+wave*.22})`;c.fill();
  c.strokeStyle=`rgba(136,176,111,${.065+wave*.65})`;c.lineWidth=2+wave*3.8;c.stroke();
  line(c,[verts[3],verts[4],verts[5]],'#dfd697',.8,.08+wave*.4);
 }
 // Winding aurora currents and branched electrical veins over the same surface.
 c.globalCompositeOperation='screen';
 for(let n=0;n<25;n++){
  const curve=[],a0=n*2.399+t*(n%2?.20:-.16),radius=.18+(n%9)*.087;
  for(let k=0;k<45;k++){const a=a0+k*.045,v=radius+.018*Math.sin(k*.7+n*4+t*3)+.009*Math.sin(k*2.3+n);
   curve.push(project(sh,Math.cos(a)*v,Math.sin(a)*v));}
  line(c,curve,n%5?'#46d797':'#f0d892',n%5?2.5:1.3,.08+(n%4)*.025);
  line(c,curve,'#36c48c',12,.03);
 }
 for(let n=0;n<12;n++){
  const start=n*TAU/12+t*.08,curve=[];
  for(let k=0;k<24;k++){const r=.37+k*.026,a=start+.018*Math.sin(k*1.9+n*4)+.025*Math.sin(k*.63+t*2);
   curve.push(project(sh,Math.cos(a)*r,Math.sin(a)*r));}
  line(c,curve,n%3?'#a0efbf':'#f3d793',1.7,.12+Math.sin(t*8+n)**6*.32);
 }
 if(age>=0)glow(c,...hit,100+age*230,'#f3ffbd',Math.exp(-age*10)*.8);
 c.restore();
 const rim=[...points,points[0]];
 line(c,rim,'#247446',22,.16);line(c,rim,'#82ad6a',7,.30);line(c,rim,'#d4e7ac',1.6,.54);
}
