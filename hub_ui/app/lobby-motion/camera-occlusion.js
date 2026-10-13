// The finished painting is the foreground prop. Custom placements stay fully clear.
import {habitatDesigns} from './habitat-designs.js';
export function cameraEdge(id,rect){
 const d=habitatDesigns[id];
 return d&&rect.every((v,i)=>v===d.camera[i])?d.cameraEdge:null;
}
export function cameraForeground(c,base,id,rect){
 const edge=cameraEdge(id,rect);if(!edge)return;
 const [x,y,w,h]=rect;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
 c.beginPath();edge.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));
 c.lineTo(x+w,y+h);c.lineTo(x,y+h);c.closePath();c.clip();c.drawImage(base,0,0);c.restore();
}
