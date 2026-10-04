// One authored coordinate system for painted anatomy and physical contacts.
import {smooth} from '../../math.js';
import {track} from '../../performance.js';
export const anatomy={width:.72*653/540,height:.72,
 shoulders:[[.645,.46],[.825,.51]],plants:[[.20,0],[.35,-.025]],
 lengths:[[.195,.215],[.175,.19]],
 skins:[{root:[.43,.12],elbow:[.55,.53],paw:[.79,.985],depth:1},
        {root:[.64,.12],elbow:[.44,.53],paw:[.23,.985],depth:.84}]};
export const twistTrack=[[0,0],[1.82,0],[2.08,-.15],[2.32,.22],[2.52,.08],[2.82,-.18],[3.02,-.05],[3.32,.25],[3.85,0]];
export function bodyPoint(u,v,t){const upper=1-smooth(.70,.99,v),lean=track(twistTrack,t);
 return [(u-.5)*anatomy.width+lean*.042*upper,
  (v-1)*anatomy.height+Math.sin(t*3.2)*.004*upper+lean*.018*(u-.5)*upper];}
export function solveLeg(root,paw,lengths,bend=1){
 const [upper,lower]=lengths,dx=paw[0]-root[0],dy=paw[1]-root[1],distance=Math.hypot(dx,dy);
 if(distance>upper+lower+.00001||distance<Math.abs(upper-lower)+.00001)throw Error('Bear paw path exceeds anatomical reach');
 const ux=dx/distance,uy=dy/distance,a=(upper*upper-lower*lower+distance*distance)/(2*distance),h=Math.sqrt(Math.max(0,upper*upper-a*a));
 return {root,elbow:[root[0]+ux*a-uy*h*bend,root[1]+uy*a+ux*h*bend],paw,lengths};
}
