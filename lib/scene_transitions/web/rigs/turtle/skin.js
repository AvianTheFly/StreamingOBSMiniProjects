// Source-registered whole limb deformation. Never blend opposing feet across tissue.
import {clamp,smooth} from '../../math.js';
import {anatomy,sourcePoint} from './calibration.js';
import {solveLeg} from './joints.js';
const poses=new WeakMap();
export function bodyPoint(u,v,state){const p=sourcePoint(u,v);
 const torso=1-smooth(.65,.91,v),head=smooth(.73,.93,u)*(1-smooth(.77,.90,v));
 return [p[0]-.009*state.effort*torso-.006*head*state.effort,p[1]+(state.bob+.014*state.effort)*torso];}
export function jointPoses(state){if(!poses.has(state))poses.set(state,anatomy.legs.map((leg,i)=>solveLeg(i,bodyPoint(...leg.root,state),state.paws[i])));return poses.get(state);}
export function skinPoint(u,v,state,index=-1){if(index<0){
 const p=bodyPoint(u,v,state),weight=smooth(.43,.515,u)*(1-smooth(.735,.825,u))*(1-smooth(.83,.91,v));
 // The belly's shoulder socket follows the same upper-leg tissue at its cut
 // boundary. This closes the overlap without a frozen second upper leg.
 if(!weight||v<=anatomy.legs[0].root[1])return p;
 const attached=skinPoint(u,v,state,0);
 return p.map((value,j)=>value+(attached[j]-value)*weight);
 }
 const p=sourcePoint(u,v),leg=anatomy.legs[index],pose=jointPoses(state)[index];
 const sole=sourcePoint(...leg.sole),ankle=sourcePoint(leg.sole[0],leg.ankle);
 const ankleTarget=ankle.map((value,j)=>value+pose.paw[j]-sole[j]);
 const nodes=[leg.root,leg.joint,[leg.sole[0],leg.ankle]],targets=[pose.root,pose.knee,ankleTarget];
 // Upper and lower segments follow their own joint. Below the ankle the entire
 // claw pad translates rigidly, rather than stretching individual toes.
 if(v<=leg.root[1])return bodyPoint(u,v,state);
 const segment=v<leg.joint[1]?0:1,q=clamp((v-nodes[segment][1])/(nodes[segment+1][1]-nodes[segment][1]));
 const a=sourcePoint(...nodes[segment]),b=sourcePoint(...nodes[segment+1]);
 return p.map((value,j)=>value+(targets[segment][j]-a[j])*(1-q)+(targets[segment+1][j]-b[j])*q);
}
