// Small deterministic physical accents shared by the four choreographies.
import {clamp,TAU} from './math.js';
import {line,ring,glow} from './fx.js';
export function dust(c,field,age,x,y,color,power=1){
 if(age<0||age>1.1)return;
 c.save();
 for(const p of field.items.slice(0,70)){
  const vx=Math.cos(p.a)*(80+p.v*380)*power,vy=-(35+p.z*200)*power;
  const px=x+vx*age,py=y+vy*age+age*age*240,fade=clamp(1-age/(.35+p.d*.75));
  c.globalAlpha=fade*.58;c.fillStyle=color;c.beginPath();c.ellipse(px,py,1+p.s,1+p.s*.5,p.a,0,TAU);c.fill();
 }
 c.restore();
}
export function lake(c,t,x,y,strength=1){
 c.save();c.translate(x,y);c.scale(1,.15);
 const g=c.createRadialGradient(0,0,0,0,0,540);g.addColorStop(0,'#173e33bb');g.addColorStop(.65,'#103a3677');g.addColorStop(1,'#163e3400');
 c.globalAlpha=strength;c.fillStyle=g;c.fillRect(-560,-560,1120,1120);c.restore();
 for(let i=0;i<5;i++){const r=90+((t*120+i*103)%460);ring(c,x,y,r,'#9cceb7',strength*(1-r/570)*.45,1.5,.15);}
}
export function splash(c,field,age,x,y,strength=1){
 if(age<0||age>1.25)return;
 for(const p of field.items.slice(0,90)){
  const dx=Math.cos(p.a)*(100+p.v*430)*age*strength,dy=-(90+p.z*570)*age+age*age*430;
  line(c,[[x+dx,y+dy],[x+dx*.98,y+dy+4+p.s*2]],'#bbebde',1+p.s*.4,clamp(1-age/1.25)*.7);
 }
 ring(c,x,y,40+age*750,'#d2f0da',clamp(1-age)*.55,3,.14);
}
export function fissures(c,mesh,origin,color,progress=1,alpha=.6){
 c.save();c.globalAlpha=alpha;
 for(const cell of mesh){
  const dx=cell.x-origin[0],dy=cell.y-origin[1],distance=Math.hypot(dx,dy);
  if(distance>progress*1700)continue;
  const a=cell.points[0],b=cell.points[1],m=[(a[0]+b[0])*.5+cell.spin*14,(a[1]+b[1])*.5+cell.shade*20];
  line(c,[a,m,b],color,.8+cell.shade,alpha*(.3+cell.shade*.5));
 }
 c.restore();
}

