// Two-bone articulation of the registered painting. Feet retain their ground
// targets; the shoulder/hip remains on the body's attachment point.
import {anatomy,sourcePoint} from './calibration.js';
export function solveLeg(index,root,paw){
 const leg=anatomy.legs[index],r=sourcePoint(...leg.root),k=sourcePoint(...leg.joint),f=sourcePoint(...leg.sole);
 const upper=Math.hypot(k[0]-r[0],k[1]-r[1]),lower=Math.hypot(f[0]-k[0],f[1]-k[1]);
 const dx=paw[0]-root[0],dy=paw[1]-root[1],distance=Math.max(.0001,Math.hypot(dx,dy));
 // The perspective-shortened far legs need a small, continuous reach extension.
 const stretch=Math.max(1,distance/(upper+lower)*1.002),a=upper*stretch,b=lower*stretch;
 const along=(a*a-b*b+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,a*a-along*along));
 const sign=((f[0]-r[0])*(k[1]-r[1])-(f[1]-r[1])*(k[0]-r[0]))>=0?1:-1;
 const knee=[root[0]+dx/distance*along-dy/distance*bend*sign,
  root[1]+dy/distance*along+dx/distance*bend*sign];
 // Keep the source's top-to-bottom tissue order while bending across the knee.
 const ankleY=paw[1]-(leg.sole[1]-leg.ankle)*anatomy.h;
 knee[1]=Math.max(root[1]+.012,Math.min(ankleY-.012,knee[1]));
 return {root,knee,paw,stretch};
}
