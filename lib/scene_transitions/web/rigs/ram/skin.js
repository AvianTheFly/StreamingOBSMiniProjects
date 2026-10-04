// Whole source-registered leg tissue follows root/knee/rigid-hoof targets.
import {clamp,smooth} from '../../math.js';
import {sourcePoint} from './calibration.js';
import {solve} from './joints.js';
const cache=new WeakMap();
export function bodyPoint(view,u,v,state){const p=sourcePoint(view,u,v),torso=1-smooth(.47,.86,v);
 return [p[0]+Math.sin(state.t*4.7)*.002*torso,p[1]+(state.breath+state.land*.012)*torso];}
export function bones(view,state){let all=cache.get(state);if(!all){all=new Map();cache.set(state,all);}if(all.has(view))return all.get(view);
 const result=view.cal.legs.map((leg,i)=>{const root=bodyPoint(view,...leg.root,state),foot=sourcePoint(view,...leg.sole),fore=i===0||i===2,tuck=state.lift*(fore?1:.8),sign=fore?-1:1;
 const paw=[foot[0]+sign*tuck*.065,foot[1]-tuck*.07];return solve(view,leg,root,paw);});all.set(view,result);return result;
}
export function limbPoint(view,u,v,state,index){const p=sourcePoint(view,u,v),leg=view.cal.legs[index],pose=bones(view,state)[index];
 if(v<=leg.root[1])return bodyPoint(view,u,v,state);
 const nodes=[leg.root,leg.joint,[leg.sole[0],leg.ankle]],sole=sourcePoint(view,...leg.sole),ankle=sourcePoint(view,leg.sole[0],leg.ankle);
 const targets=[pose.root,pose.knee,ankle.map((n,j)=>n+pose.paw[j]-sole[j])],segment=v<leg.joint[1]?0:1,q=clamp((v-nodes[segment][1])/(nodes[segment+1][1]-nodes[segment][1]));
 const a=sourcePoint(view,...nodes[segment]),b=sourcePoint(view,...nodes[segment+1]);return p.map((n,j)=>n+(targets[segment][j]-a[j])*(1-q)+(targets[segment+1][j]-b[j])*q);
}
function surfacePoint(view,u,v,state,index=-1){if(index>=0)return limbPoint(view,u,v,state,index);
 const base=bodyPoint(view,u,v,state);
 if(!view.cal.legs){let dx=0,dy=0;for(let i=0;i<view.cal.joints.length;i++){const joint=view.cal.joints[i],d=Math.hypot((u-joint[0])*view.w,(v-joint[1])*view.h),w=Math.exp(-d*d/.0035);
 const flex=Math.sin(state.t*5.2+i*.8)*.004;dx+=flex*w;dy+=flex*.5*w;}return [base[0]+dx,base[1]+dy];}
 return base;
}
export function skinPoint(view,u,v,state,index=-1){const p=surfacePoint(view,u,v,state,index),offset=state.headOffsets?.[view.id];if(!offset)return p;
 const weight=smooth(.18,.61,u)*(1-smooth(.25,.75,v));return [p[0]+offset[0]*weight,p[1]+offset[1]*weight];}
