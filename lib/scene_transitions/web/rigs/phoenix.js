// Thin public phoenix contract; anatomy, acting and paint have separate owners.
export {draw} from './phoenix/paint.js';
export {wingCurve,wingPoint} from './phoenix/projection.js';
export {wingPose} from './phoenix/motion.js';
import {wingTip,wingPoint} from './phoenix/projection.js';
import {anatomy} from './phoenix/anatomy.js';
export function contacts(pose,parts,kind='attack'){return [-1,1].map(side=>{
 if(kind!=='cast')return wingTip(pose.t,side,pose.variant||0);
 const p=wingPoint(pose.t,side,...anatomy.castContact);return [p[0]*(pose.variant?-1:1),p[1]];
});}
