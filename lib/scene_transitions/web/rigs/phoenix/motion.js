// Pure acting: continuous yaw, asynchronous feathers and talon articulation.
import {TAU,smooth,lerp} from '../../math.js';
import {track} from '../../performance.js';
export function heading(t){return track([[0,0],[1.12,0],[1.48,.68],[1.72,1.38],[1.91,2.58],[2.12,2.58],[2.22,1.38],[2.42,.68],[2.68,0],[3.16,0],[3.85,0]],t);}
export function bodyViews(t){const yaw=heading(t),angles=[0,.68,1.38,2.58];let key=0;while(key<2&&yaw>angles[key+1])key++;
 // Camera registrations are authored poses. A short continuous handoff avoids
 // long transparent double-wing silhouettes between very different views.
 const p=smooth(.40,.60,(yaw-angles[key])/(angles[key+1]-angles[key]));return [{key,weight:1-p},{key:key+1,weight:p}];}
export function wingPose(t,side=1){
 const phase=(t-1.12)*TAU*1.25,bank=Math.sin(heading(t)),offset=side*bank*.13;
 const prepare=smooth(2.58,2.98,t),strike=smooth(3.08,3.30,t);
 return {angle:(-.08+Math.sin(phase+offset)*.60)*(1-prepare)+(.88-strike*1.23)*prepare,
  elbow:Math.sin(phase+offset-.58)*.25*(1-prepare)+(.19-strike*.32)*prepare,
  wrist:Math.sin(phase+offset-1.10)*.20*(1-prepare)+(.15-strike*.26)*prepare,
  fold:.48+.52*smooth(1.12,1.62,t),phase:phase+offset,prepare,strike,bank};
}
export function legPose(t,side){const tuck=smooth(1.36,1.96,t)*(1-smooth(2.92,3.20,t));
 return {upper:lerp(.12,-.93,tuck)+side*(.25+smooth(2.94,3.20,t)*.20)+Math.sin(t*5.1-side*.4)*.035,
  lower:lerp(-.30,1.56,tuck)+Math.sin(t*5.1-side*.4-.5)*.045,
  claw:lerp(.22,-.44,tuck)+smooth(2.98,3.20,t)*.36};}
export function tailPose(t){return {sway:Math.sin(t*5.2-.8)*.055+Math.sin(heading(t))*.06,flutter:Math.sin(t*8.8-1.6)*.012};}
