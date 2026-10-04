// Preserve native pose proportions; body registration carries the jump and turn.
// The late proud/lens attack retains the existing horn/ground registration.
import {sourcePoint} from './calibration.js';
import {soften} from '../../performance.js';
export function registration(parts,state){const anchors=parts.views.map(view=>{const sign=state.mirrors[view.id]||1;
 const a=sourcePoint(view,...view.cal.horns[0]),b=sourcePoint(view,...view.cal.horns[1]);return [sign*(a[0]+b[0])/2,(a[1]+b[1])/2];});
 const target=[0,0];anchors.forEach((a,i)=>{const w=state.weights[parts.views[i].id]||0;target[0]+=a[0]*w;target[1]+=a[1]*w;});
 const p=soften((state.t-2.78)/.08);
 return parts.views.map((view,i)=>{const mirror=state.mirrors[view.id]||1,body=sourcePoint(view,...(view.cal.body||[.46,.52]));
  return {mirror,x:(-body[0]*mirror)*(1-p)+(target[0]-anchors[i][0])*p,
   y:(-.46+state.compression*.075-body[1])*(1-p),sy:1+(target[1]/anchors[i][1]-1)*p};});
}
export const registeredPoint=(point,matrix)=>[point[0]*matrix.mirror+matrix.x,point[1]*matrix.sy+matrix.y];
export function headOffsets(parts,state,matrices){const result={};if(state.turning||state.t>=2.70)return result;
 const target=[0,0],heads=parts.views.map((view,i)=>{const a=sourcePoint(view,...view.cal.horns[0]),b=sourcePoint(view,...view.cal.horns[1]);return registeredPoint([(a[0]+b[0])/2,(a[1]+b[1])/2],matrices[i]);});
 heads.forEach((p,i)=>{const w=state.weights[parts.views[i].id]||0;target[0]+=p[0]*w;target[1]+=p[1]*w;});
 parts.views.forEach((view,i)=>{if(state.weights[view.id]>0)result[view.id]=[(target[0]-heads[i][0])/matrices[i].mirror,(target[1]-heads[i][1])/matrices[i].sy];});return result;
}
