// Feature-owned material details around the existing 16:9 media rectangle.
import {habitatDesigns} from './habitat-designs.js';
export function habitatMediaFrame(c,[x,y,w,h],id){
 if(!habitatDesigns[id])return false;c.save();c.lineJoin='round';
 const ice=id==='phoenix-observatory',forest=id==='aurora-camp',garden=id==='sanctuary';
 c.shadowBlur=14;c.shadowColor='#000b';c.strokeStyle=ice?'#375c88':forest?'#342b1c':garden?'#4a4b2a':'#211d1c';c.lineWidth=22;c.strokeRect(x-9,y-9,w+18,h+18);c.shadowBlur=0;
 c.strokeStyle=ice?'#bcecff':forest?'#788755':garden?'#c0ae68':'#ad7844';c.lineWidth=4;c.strokeRect(x-12,y-12,w+24,h+24);
 if(garden){c.strokeStyle='#706e38';c.lineWidth=3;for(let a=20;a<w;a+=64){for(const yy of [y-16,y+h+16]){c.beginPath();c.moveTo(x+a,yy-5);c.lineTo(x+a,yy+5);c.stroke();}}}
 if(forest){c.strokeStyle='#92ac63';c.lineWidth=3;for(const side of [-1,1]){const xx=side<0?x-18:x+w+18;c.beginPath();c.moveTo(xx,y-24);c.bezierCurveTo(xx+side*22,y+h*.3,xx-side*12,y+h*.7,xx,y+h+20);c.stroke();for(let i=0;i<5;i++){c.fillStyle=i%2?'#718951':'#a0af72';c.beginPath();c.ellipse(xx+side*6,y+35+i*h/5,12,4,side,0,Math.PI*2);c.fill();}}}
 for(const [xx,yy] of [[x-12,y-12],[x+w+12,y-12],[x-12,y+h+12],[x+w+12,y+h+12]]){
  c.fillStyle=ice?'#b9e7ff':garden?'#526e50':forest?'#a68a53':'#d1a266';
  if(ice){c.beginPath();c.moveTo(xx-9,yy+12);c.lineTo(xx-4,yy-29);c.lineTo(xx+11,yy-6);c.lineTo(xx+7,yy+13);c.closePath();c.fill();}
  else{c.beginPath();c.arc(xx,yy,garden?8:5,0,Math.PI*2);c.fill();}
 }
 if(!ice&&!forest&&!garden){c.strokeStyle='#6a5c4b';c.lineWidth=4;for(const xx of [x+35,x+w-35])for(let yy=y-52;yy<y-14;yy+=12){c.beginPath();c.ellipse(xx,yy,5,9,0,0,Math.PI*2);c.stroke();}}
 c.restore();return true;
}
