import {smooth,TAU} from '../math.js';
export function wingPose(t){
 const phase=(t-1.12)*TAU*1.25,prepare=smooth(2.42,2.96,t),strike=smooth(3.10,3.36,t);
 return {angle:(-.08+Math.sin(phase)*.62)*(1-prepare)+(.92-strike*1.38)*prepare,
  elbow:Math.sin(phase-.55)*.28*(1-prepare)+(.18-strike*.31)*prepare,
  wrist:Math.sin(phase-1.0)*.18*(1-prepare)+(.16-strike*.25)*prepare,
  fold:.5+.5*smooth(1.12,1.65,t),phase,prepare,strike};
}
// The camera is orthographic; this public contact matches the skeletal wing tip.
export function wingTip(t,side){const w=wingPose(t),angles=[w.angle,w.angle+w.elbow,w.angle+w.elbow+w.wrist],lengths=[.3,.28,.37];let x=.115,y=.08;
 for(let i=0;i<3;i++){x+=Math.cos(angles[i])*lengths[i];y+=Math.sin(angles[i])*lengths[i];}return [side*x,-y];}
