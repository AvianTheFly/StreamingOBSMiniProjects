import {ellipse,glow,TAU,hash} from './shared/world-motion.js';
import {cup,turtle,star} from './reef-ink.js';
export function crab(c,a,e){
 const dir=Math.floor(e.seed)%2?1:-1,x=(dir===1?310:1610)+dir*a*105,y=999+Math.sin(a*12)*2;
 c.save();c.translate(x,y);c.scale(dir,1);c.strokeStyle='#b38754';c.lineWidth=2;
 for(const side of [-1,1])for(let i=0;i<3;i++){const px=side*(12+i*4),lift=Math.sin(a*11+i+side)*5;c.beginPath();c.moveTo(px,-4);c.lineTo(px+side*13,-10-lift);c.lineTo(px+side*19,7);c.stroke();}
 ellipse(c,0,-8,22,13,'#b5895d');ellipse(c,-3,-11,14,10,'#876c55');c.strokeStyle='#d4b28b';c.lineWidth=2;c.beginPath();c.arc(-4,-11,7,a,TAU+a);c.stroke();
 for(const px of [-10,10]){c.beginPath();c.moveTo(px,-17);c.lineTo(px,-25);c.stroke();ellipse(c,px,-26,3,3,'#243b3c');ellipse(c,px-1,-27,1,1,'#f3eccc');}
 c.strokeStyle='#c49c74';c.lineWidth=4;c.beginPath();c.moveTo(18,-8);c.lineTo(33,-26);c.lineTo(43,-30);c.moveTo(-18,-8);c.lineTo(-28,-23+Math.sin(a*5)*3);c.stroke();cup(c,43,-39,.65);c.restore();
}
export function treasure(c,a,e){
 const rise=Math.sin(Math.min(1,a/9)*Math.PI);glow(c,1325,694,92,'#ffd986',.18*rise);
 for(let i=0;i<12;i++){const age=a-.8-i*.16;if(age<0||age>5.5)continue;const x=1315+Math.sin(age*1.6+i)*18+Math.cos(i)*age*12,y=697-age*30;const alpha=Math.min(1,age*3,(5.5-age)*2);c.save();c.globalAlpha*=alpha;glow(c,x,y,11,'#afe8d4',.4);ellipse(c,x,y,3.3,3.3,'#f8edce');c.restore();}
 if(a>2&&a<7){c.save();c.globalAlpha*=Math.sin((a-2)/5*Math.PI)*.7;turtle(c,1325,620,24,'#e9dca4',a);c.restore();}
}
export function chart(c,a,e){
 const points=[[239,1002],[322,970],[438,1010],[529,945],[635,962]],progress=Math.min(1,a/5);c.strokeStyle='#ead09e';c.lineWidth=1.5;c.setLineDash([3,5]);c.beginPath();
 for(let i=0;i<=40;i++){const q=i/40*progress,v=q*4,j=Math.min(3,Math.floor(v)),f=v-j;c.lineTo(points[j][0]*(1-f)+points[j+1][0]*f,points[j][1]*(1-f)+points[j+1][1]*f);}c.stroke();c.setLineDash([]);
 const v=progress*4,j=Math.min(3,Math.floor(v)),f=v-j,x=points[j][0]*(1-f)+points[j+1][0]*f,y=points[j][1]*(1-f)+points[j+1][1]*f;glow(c,x,y,20,'#e9c784',.3);star(c,x,y,5,'#f4dfa4',a*.8);if(a>5)turtle(c,635,960,14,'#e8d3a4',a);
}
export const roomArtists={crab,treasure,chart};
