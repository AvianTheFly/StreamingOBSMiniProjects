// Coherent anatomical paint with far/body/near occlusion and complete claw pads.
import {acting} from './motion.js';
import {skinPoint} from './skin.js';
export function draw(parts,c,{x,y,size,t,alpha=1,variant=0}){
 const a=acting(t);c.save();c.globalAlpha*=alpha;c.translate(x,y);c.scale(size*(variant?-1:1),size);
 for(const index of [3,2,-1,1,0]){const part=parts.cells[index+1],d=part.domain;
  part.mesh.draw(c,(u,v)=>skinPoint(d.x+u*d.w,d.y+v*d.h,a,index));}
 c.restore();
}
