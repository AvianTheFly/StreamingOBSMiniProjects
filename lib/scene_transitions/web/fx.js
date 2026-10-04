import {clamp,lerp,rng,TAU} from './math.js';

export function glow(c,x,y,r,color,alpha=1){
 if(r<=0||alpha<=0)return;c.save();c.globalAlpha=clamp(alpha);
 const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(.2,color+'aa');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore();
}
export function line(c,points,color,width=2,alpha=1){
 if(alpha<=0)return;c.save();c.globalAlpha=clamp(alpha);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();
}
export function ribbon(c,points,color,width,alpha=1){
 if(width<=0||alpha<=0)return;const edges=[[],[]];
 for(let i=0;i<points.length;i++){
  const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],dx=after[0]-before[0],dy=after[1]-before[1],len=Math.hypot(dx,dy)||1;
  const taper=Math.pow(Math.sin(Math.PI*i/(points.length-1)),.55),rough=1+Math.sin(i*11.7)*.13;
  for(let j=0;j<2;j++){const w=(j?1:-1)*(width*taper*rough/2+.3);edges[j].push([points[i][0]-dy/len*w,points[i][1]+dx/len*w]);}
 }
 c.save();c.globalAlpha=alpha;c.fillStyle=color;polygon(c,[...edges[0],...edges[1].reverse()]);c.fill();c.restore();
}
export function bolt(c,x,y,ex,ey,seed,alpha=1,width=2){
 const random=rng(seed),p=[[x,y]],dx=ex-x,dy=ey-y,len=Math.hypot(dx,dy);
 for(let i=1;i<13;i++){const v=(random()-.5)*len*.18, t=i/13;p.push([x+dx*t-dy/len*v,y+dy*t+dx/len*v]);}p.push([ex,ey]);
 line(c,p,'#268cfa',width*5,alpha*.18);line(c,p,'#86dfff',width*2,alpha*.65);line(c,p,'#efffff',width,alpha);
}
export class Field{
 constructor(seed,count=220){const r=rng(seed);this.items=Array.from({length:count},()=>({a:r()*TAU,d:r(),z:r(),v:r(),s:r()*3+.6,p:r()*TAU}));}
 ambient(c,t,color,alpha=1){c.save();c.globalCompositeOperation='screen';for(const p of this.items){const x=(p.d*2100+t*(p.v-.5)*75+2100)%2100-90,y=(p.z*1250-t*(20+p.v*45)+1250)%1250-85,a=(.35+.65*Math.sin(t*2+p.p)**2)*alpha;c.globalAlpha=a*.6;c.fillStyle=color;c.beginPath();c.arc(x,y,p.s,0,TAU);c.fill();if(p.s>2.8)line(c,[[x-5,y],[x+5,y]],color,.7,a);}c.restore();}
 burst(c,t,x,y,color,strength=1){if(t<0)return;c.save();c.globalCompositeOperation='screen';for(const p of this.items){const speed=170+p.v*900,d=t*speed*strength,px=x+Math.cos(p.a)*d,py=y+Math.sin(p.a)*d+t*t*110,alpha=clamp(1-t/(.65+p.z*.9));if(!alpha)continue;c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=p.s;c.beginPath();c.moveTo(px,py);c.lineTo(px-Math.cos(p.a)*(8+t*25),py-Math.sin(p.a)*(8+t*25));c.stroke();}c.restore();}
}
export function ring(c,x,y,r,color,alpha=1,width=3,sy=1){if(r<=0)return;c.save();c.translate(x,y);c.scale(1,sy);c.strokeStyle=color;c.globalAlpha=clamp(alpha);c.lineWidth=width;c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();c.restore();}
export function rune(c,x,y,r,t,color,alpha=1){
 c.save();c.translate(x,y);c.rotate(t*.18);c.globalAlpha=clamp(alpha);ring(c,0,0,r,color,alpha*.65,2);ring(c,0,0,r*.92,color,alpha*.25,1);
 for(let i=0;i<32;i++){const a=i*TAU/32;line(c,[[Math.cos(a)*r*.94,Math.sin(a)*r*.94],[Math.cos(a)*r*(i%4?1:1.07),Math.sin(a)*r*(i%4?1:1.07)]],color,i%4?1:3,alpha*.8);}
 c.restore();
}
// Seeded polygon meshes: irregular concentric fracture cells with shared vertices.
export function fractureMesh(seed){
 const random=rng(seed),n=24,radii=[0,150,360,680,1250,1700],rings=radii.map((r,j)=>Array.from({length:n},(_,i)=>{const a=i*TAU/n+(j%2)*.035;return [960+Math.cos(a)*r*(.9+random()*.2),540+Math.sin(a)*r*(.9+random()*.2)];})),cells=[];
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const k=(i+1)%n;const points=j? [rings[j][i],rings[j+1][i],rings[j+1][k],rings[j][k]]:[[960,540],rings[1][i],rings[1][k]];const x=points.reduce((a,p)=>a+p[0],0)/points.length,y=points.reduce((a,p)=>a+p[1],0)/points.length;cells.push({points,x,y,v:.5+random(),spin:(random()-.5)*2,shade:random(),delay:random()*.18});}return cells;
}
export function polygon(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
