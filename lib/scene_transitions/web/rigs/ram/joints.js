import {sourcePoint} from './calibration.js';
export function solve(view,leg,root,paw){const r=sourcePoint(view,...leg.root),k=sourcePoint(view,...leg.joint),f=sourcePoint(view,...leg.sole);
 const upper=Math.hypot(k[0]-r[0],k[1]-r[1]),lower=Math.hypot(f[0]-k[0],f[1]-k[1]),dx=paw[0]-root[0],dy=paw[1]-root[1],d=Math.max(.001,Math.hypot(dx,dy));
 const stretch=Math.max(1,d/(upper+lower)*1.001),a=upper*stretch,b=lower*stretch,along=(a*a-b*b+d*d)/(2*d),bow=Math.sqrt(Math.max(0,a*a-along*along));
 const sign=((f[0]-r[0])*(k[1]-r[1])-(f[1]-r[1])*(k[0]-r[0]))>=0?1:-1;
 const knee=[root[0]+dx/d*along-dy/d*bow*sign,root[1]+dy/d*along+dx/d*bow*sign];
 const ankleY=paw[1]-(leg.sole[1]-leg.ankle)*view.h;knee[1]=Math.max(root[1]+.02,Math.min(ankleY-.02,knee[1]));return {root,knee,paw,stretch};}
