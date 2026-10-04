// Registered yaw texture views; common silhouette scale and eye motion avoid ghost faces.
import {smooth,lerp} from '../../math.js';
import {soften} from '../../performance.js';
const eyes=[[.916,.404],[.892,.425],[.894,.413],[.859,.416]];
export function turnLayers(parts,act){
 const phase=act.views.turn*3,index=Math.min(2,Math.floor(phase)),blend=soften(phase-index);
 const a=parts.turn[index],b=parts.turn[index+1],width=lerp(.72*a.w/a.h,.72*b.w/b.h,blend);
 const eye=eyes[index].map((x,i)=>lerp(x,eyes[index+1][i],blend));
 return [{key:index,weight:1-blend,width,eye},{key:index+1,weight:blend,width,eye}];
}
export function drawTurn(parts,c,t,{key,width,eye}){
 const sourceEye=eyes[key],part=parts.turn[key];
 part.mesh.draw(c,(u,v)=>{const face=Math.exp(-((u-sourceEye[0])**2/.045+(v-sourceEye[1])**2/.09));
  return [(u-.5)*width+(eye[0]-sourceEye[0])*width*face-smooth(.58,.84,u)*smooth(.68,.94,v)*.025,
   (v-1)*.72+(eye[1]-sourceEye[1])*.72*face+Math.sin(t*3.2)*.004*(1-smooth(.7,.99,v))];
 });
}
