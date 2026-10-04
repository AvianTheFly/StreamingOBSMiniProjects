// Paint mounts and effect contacts share this bounded projection.
import {smooth,lerp} from '../../math.js';
import {anatomy} from './anatomy.js';
import {heading,wingPose,legPose,tailPose} from './motion.js';
export function bodyPoint(u,v,t,key){const height=anatomy.height,width=anatomy.widths[key];
 const breath=Math.sin(wingPose(t).phase-.4)*.009*Math.sin(v*Math.PI);
 return [(u-.5)*width+(1-v)*Math.sin(t*3.4)*.004,(v-.56)*height+breath];}
export function mount(kind,t,side=0){const uv=kind==='rump'?anatomy.rump[0]:anatomy[kind][0][side<0?0:1];return bodyPoint(...uv,t,0);}
export function wingCurve(t,side=1){const w=wingPose(t,side),root=mount('shoulders',t,side),points=[[0,0]],n=40;
 for(let i=1;i<=n;i++){const span=(i-.5)/n,a=w.angle+w.elbow*smooth(.18,.62,span)+w.wrist*smooth(.52,1,span),length=anatomy.wingLength*w.fold/n;
  points.push([points.at(-1)[0]+Math.cos(a)*length,points.at(-1)[1]-Math.sin(a)*length]);}
 return {w,root,points,side};}
export function wingPoint(t,side,u,v,curve=wingCurve(t,side)){
 const span=1-u,index=span*40,lo=Math.min(39,Math.floor(index)),q=index-lo,a=curve.points[lo],b=curve.points[lo+1];
 const tangent=i=>{const before=curve.points[Math.max(0,i-1)],after=curve.points[Math.min(40,i+1)];return [after[0]-before[0],after[1]-before[1]];};
 const ta=tangent(lo),tb=tangent(lo+1),dx=lerp(ta[0],tb[0],q),dy=lerp(ta[1],tb[1],q),norm=Math.hypot(dx,dy)||1;
 const cross=(v-anatomy.wingRoot[1])*.42*(.25+.75*smooth(0,.28,span));
 const flutter=Math.sin(curve.w.phase-1.6-span*1.2)*.012*smooth(.60,.92,span)*(v-anatomy.wingRoot[1]);
 const yaw=heading(t),depth=side*Math.sin(yaw)*span*.095,perspective=.70/(.70+depth);
 // Art-directed minimum silhouette width during the edge-on bank.
 const foreshorten=.30+.70*Math.abs(Math.cos(yaw)),near=1+side*Math.sin(yaw)*.10;
 return [curve.root[0]+side*(lerp(a[0],b[0],q)-dy/norm*cross)*foreshorten*near*perspective,
  curve.root[1]+(lerp(a[1],b[1],q)+dx/norm*cross+flutter)*perspective];
}
export function wingTip(t,side,variant=0){const p=wingPoint(t,side,...anatomy.wingContact);return [p[0]*(variant?-1:1),p[1]];}
export function legChain(t,side){const root=mount('hips',t,side),m=legPose(t,side),angles=[m.upper,m.upper+m.lower,m.upper+m.lower+m.claw],points=[root];
 for(let i=0;i<3;i++)points.push([points.at(-1)[0]+Math.sin(angles[i])*anatomy.legLengths[i],points.at(-1)[1]+Math.cos(angles[i])*anatomy.legLengths[i]]);
 return {points,angles};}
export function legPoint(t,side,u,v,chain=legChain(t,side)){
 const knots=[0,.42,.70,1],centres=[.47,.70,.43,.44];let i=0;while(i<2&&v>knots[i+1])i++;
 const q=(v-knots[i])/(knots[i+1]-knots[i]),a=chain.points[i],b=chain.points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],norm=Math.hypot(dx,dy);
 const lateral=(u-lerp(centres[i],centres[i+1],q))*.15;
 return [lerp(a[0],b[0],q)+dy/norm*lateral,lerp(a[1],b[1],q)-dx/norm*lateral];}
export function tailPoint(t,u,v){const root=mount('rump',t),p=tailPose(t),yaw=heading(t),bend=p.sway*v*v;
 return [root[0]+(u-.5)*anatomy.tailWidth*(1-.25*Math.abs(Math.sin(yaw)))+bend+Math.sin(v*5.5-t*5.2)*.018*v*v,
  root[1]+v*anatomy.tailHeight+Math.sin(u*11+t*5-2)*p.flutter*v*v];}
