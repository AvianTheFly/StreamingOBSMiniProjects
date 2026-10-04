import {acting} from './motion.js';
import {skinPoint,bones} from './skin.js';
import {sourcePoint} from './calibration.js';
import {registration,registeredPoint,headOffsets} from './registration.js';
function paint(view,c,state){const order=view.cells.length>1?[4,3,0,2,1]:[0];
 for(const i of order){const p=view.cells[i],d=p.domain;p.mesh.draw(c,(u,v)=>skinPoint(view,d.x+u*d.w,d.y+v*d.h,state,i-1));}}
export function draw(parts,c,{x,y,size,angle=0,alpha=1,t=0,variant=0}){const state=acting(t),matrices=registration(parts,state),mix=parts.mix,mc=mix.getContext('2d'),vc=parts.view.getContext('2d');mc.resetTransform();mc.clearRect(0,0,mix.width,mix.height);
 state.headOffsets=headOffsets(parts,state,matrices);
 mc.save();mc.globalCompositeOperation='lighter';
 for(let i=0;i<parts.views.length;i++)if(state.weights[parts.views[i].id]>.00001){vc.resetTransform();vc.clearRect(0,0,mix.width,mix.height);vc.save();vc.translate(...parts.origin);vc.scale(parts.units,parts.units);vc.translate(matrices[i].x,matrices[i].y);vc.scale(matrices[i].mirror,matrices[i].sy);paint(parts.views[i],vc,state);vc.restore();mc.globalAlpha=state.weights[parts.views[i].id];mc.drawImage(parts.view,0,0);}mc.restore();
 c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);c.scale((variant?-1:1)*size/parts.units,size/parts.units);c.drawImage(mix,-parts.origin[0],-parts.origin[1]);c.restore();
}
export function contacts(pose,parts,kind='attack'){const state=acting(pose.t||0),matrices=registration(parts,state),sign=pose.variant?-1:1;
 state.headOffsets=headOffsets(parts,state,matrices);
 if(kind==='feet'){const index=parts.views.reduce((best,v,i)=>(state.weights[v.id]||0)>(state.weights[parts.views[best].id]||0)?i:best,0),view=parts.views[index],points=view.cal.legs?bones(view,state).map(b=>b.paw):view.cal.feet.map(f=>skinPoint(view,...f,state));return points.map(p=>{const q=registeredPoint(p,matrices[index]);return [sign*q[0],q[1]];});}
 return [0,1].map(n=>{const p=[0,0];parts.views.forEach((view,i)=>{const q=registeredPoint(skinPoint(view,...view.cal.horns[n],state),matrices[i]),w=state.weights[view.id]||0;p[0]+=q[0]*w;p[1]+=q[1]*w;});return [p[0]*sign,p[1]];});
}
