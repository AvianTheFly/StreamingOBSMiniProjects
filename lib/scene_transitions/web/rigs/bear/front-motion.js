// Registered complete frontal poses and continuous lens-pressure choreography.
// The source paint already includes natural forearm anatomy and crossing swipes.
import {smooth,clamp} from '../../math.js';
import {soften} from '../../performance.js';
export const frontAnatomy={width:.73*435/433,widths:[.73*435/433,.73*401/387,.73*430/396],height:.73,focal:.56,focusY:-.42,
 faces:[[.52,.20],[.50,.20],[.55,.23]],
 claws:[[[.17,.295],[.83,.48]],[[.19,.305],[.73,.77]],[[.30,.77],[.80,.43]]],
 hindPaws:[[.35,.89],[.57,.98]]};
export function frontActing(t,swipes){
 let layers=[{key:0,weight:1}],previous=0,pressure=0,hand=0;
 for(const sw of swipes){const age=t-sw.at;if(age<-.06)break;
  const key=sw.hand+1,weight=soften((age+.06)/.12);hand=sw.hand;
  layers=[{key:previous,weight:1-weight},{key,weight}];
  pressure=Math.sin(Math.PI*clamp(age/sw.duration))**2*.15;
  if(weight<1)break;previous=key;
 }
 const act={layers,pressure,hand};
 act.projectedPaws=[0,1].map(h=>layers.reduce((p,layer)=>{const uv=frontAnatomy.claws[layer.key][h],q=frontPoint(...uv,t,act,layer.key);return p.map((x,i)=>x+q[i]*layer.weight);},[0,0]));
 act.hindPaws=frontAnatomy.hindPaws.map(uv=>frontBodyPoint(...uv,t));
 return act;
}
export function frontBodyPoint(u,v,t,key=0){return [(u-.5)*frontAnatomy.widths[key],
 (v-1)*frontAnatomy.height+Math.sin(t*3.2)*.004*(1-smooth(.7,.87,v))];}
export function frontPoint(u,v,t,act,key){
 const p=frontBodyPoint(u,v,t,key),face=frontAnatomy.faces[key],registration=Math.exp(-((u-face[0])**2/.03+(v-face[1])**2/.05));
 const turn=1-soften((t-1.65)/.29);
 p[0]+=(.52-face[0])*frontAnatomy.widths[key]*registration+turn*.36;
 p[1]+=(.20-face[1])*frontAnatomy.height*registration+turn*.17;
 const claw=frontAnatomy.claws[key][act.hand],local=Math.exp(-((u-claw[0])**2/.06+(v-claw[1])**2/.10))*(1-smooth(.62,.87,v));
 const depth=-act.pressure*local,scale=frontAnatomy.focal/(frontAnatomy.focal+depth);
 return [p[0]*scale,frontAnatomy.focusY+(p[1]-frontAnatomy.focusY)*scale];
}
export function frontClawContact(t,act,hand,offset=0){return act.layers.reduce((p,layer)=>{
 const uv=frontAnatomy.claws[layer.key][hand],space=offset/frontAnatomy.widths[layer.key];
 const point=frontPoint(uv[0]+space,uv[1]+space*(hand?1:-1),t,act,layer.key);
 return p.map((x,i)=>x+point[i]*layer.weight);
},[0,0]);}
