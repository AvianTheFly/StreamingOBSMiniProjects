// Small drawn spirit manifestations and contact props, in character-local units.
import {ellipse,TAU} from './shared/world-motion.js';
export const spiritColors={claw:'#81d6ff',mantle:'#efab83',stampede:'#ffab62',storm:'#a2eaff'};
export function line(c,points,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
export function spirit(c,kind,x,y,size,t,alpha=1){
 c.save();c.translate(x,y);c.scale(size/32,size/32);c.globalAlpha*=alpha;c.strokeStyle=spiritColors[kind];c.fillStyle=spiritColors[kind];c.lineWidth=1.6;
 if(kind==='storm'){
  const lift=Math.sin(t*4)*4;
  for(const sign of [-1,1]){c.save();c.scale(sign,1);line(c,[[0,7],[8,-2],[29,-18-lift],[23,0],[12,7],[3,11]],c.strokeStyle);for(let i=0;i<3;i++)line(c,[[8+i*5,2],[21+i*4,-8-lift]],c.strokeStyle,1);c.restore();}
  line(c,[[0,12],[-3,-3],[0,-10],[5,-6],[1,-3],[0,12],[-6,20],[0,16],[5,20]],c.strokeStyle);
 }else{
  line(c,[[-14,-8],[-12,7],[0,18],[12,7],[14,-8],[7,-16],[-7,-16],[-14,-8]],c.strokeStyle);
  if(kind==='claw'){ellipse(c,-11,-15,5,5,c.fillStyle);ellipse(c,11,-15,5,5,c.fillStyle);line(c,[[-24,-9],[-30,-1],[-22,-1],[-28,10]],c.strokeStyle);line(c,[[24,-9],[30,-1],[22,-1],[28,10]],c.strokeStyle);}
  if(kind==='mantle'){line(c,[[-11,8],[-20,0],[-19,12],[-9,16]],c.strokeStyle,2.4);line(c,[[11,8],[20,0],[19,12],[9,16]],c.strokeStyle,2.4);}
  if(kind==='stampede'){for(const sign of [-1,1]){c.beginPath();c.arc(sign*15,-9,10,Math.PI*.2,Math.PI*1.9);c.stroke();}}
  ellipse(c,-6,-2,2,1.5,'#fff8df');ellipse(c,6,-2,2,1.5,'#fff8df');ellipse(c,0,7,4,3,c.fillStyle);
 }
 c.restore();
}
export function burst(c,x,y,t,color,count=9){
 for(let i=0;i<count;i++){const angle=i*TAU/count,reach=8+t*23;line(c,[[x+Math.cos(angle)*reach,y+Math.sin(angle)*reach],[x+Math.cos(angle)*(reach+4),y+Math.sin(angle)*(reach+4)]],color,1.3);}
}
export function biscuit(c,x,y,r=7){ellipse(c,x,y,r,r*.72,'#dbac69');for(const [dx,dy] of [[-2,-1],[2,2],[3,-2]])ellipse(c,x+dx,y+dy,1,1,'#93603e');}
export function mushroom(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='#eedab0';c.fillRect(-3,-8,6,9);ellipse(c,0,-10,10,7,'#c64b51');for(const [dx,dy] of [[-4,-11],[3,-13],[4,-7]])ellipse(c,dx,dy,2,1.8,'#ffedca');c.restore();}
