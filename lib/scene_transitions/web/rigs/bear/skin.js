// Landmark-based painted skin. Shoulder, elbow and sole are explicit anchors.
import {lerp,smooth} from '../../math.js';
import {anatomy} from './calibration.js';
function segment(a,b,p){return [lerp(a[0],b[0],p),lerp(a[1],b[1],p)];}
function tangent(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);return [dx/d,dy/d];}
export function skinPoint(part,hand,leg,u,v){
 const source=anatomy.skins[hand],upperQ=(v-source.root[1])/(source.elbow[1]-source.root[1]),lowerQ=(v-source.elbow[1])/(source.paw[1]-source.elbow[1]);
 const upper=tangent(leg.root,leg.elbow),lower=tangent(leg.elbow,leg.paw),blend=smooth(source.elbow[1]-.13,source.elbow[1]+.13,v);
 let center=segment(segment(leg.root,leg.elbow,upperQ),segment(leg.elbow,leg.paw,lowerQ),blend);
 const sourceX=lerp(lerp(source.root[0],source.elbow[0],upperQ),lerp(source.elbow[0],source.paw[0],lowerQ),blend);
 let dx=lerp(upper[0],lower[0],blend),dy=lerp(upper[1],lower[1],blend);
 const scale=(leg.lengths[0]+leg.lengths[1])/((source.paw[1]-source.root[1])*part.h);
 // Forepaw orientation has its own wrist blend; claw tips never flip upward
 // just because the elbow bends. The same sole remains the contact anchor.
 const wrist=smooth(.72,.96,v),sole=[.10,.995],height=(v-source.paw[1])*part.h*scale;
 center=segment(center,[leg.paw[0]+sole[0]*height,leg.paw[1]+sole[1]*height],wrist);
 dx=lerp(dx,sole[0],wrist);dy=lerp(dy,sole[1],wrist);const n=Math.hypot(dx,dy);
 const lateral=(u-sourceX)*part.w*scale*source.depth;
 return [center[0]+dy/n*lateral,center[1]-dx/n*lateral];
}
export function drawLeg(parts,c,hand,leg,{from=0,to=1}={}){const part=parts.cells[2+hand];
 part.mesh.draw(c,(u,v)=>skinPoint(part,hand,leg,u,v),{from,to});}
