// Calibrated quadruped paint with bounded premultiplied blending of complete views.
import {smooth,lerp} from '../../math.js';
import {acting,direction} from './motion.js';
import {bodyPoint} from './calibration.js';
import {drawLeg} from './skin.js';
import {drawTurn,turnLayers} from './turn.js';
import {drawFront} from './front-paint.js';
function runner(parts,c,t){const act=acting(t),turn=smooth(.82,1.06,t);
 const stop=smooth(.90,1.45,t),q=Math.min(1,Math.max(0,(t-.9)/.55));
 const cycle=t<=.9?((t-.08)*9%4+4)%4:((2*q**3-3*q*q+1)*7.38+(q**3-2*q*q+q)*.55*9+(-2*q**3+3*q*q)*10)%4;
 const index=Math.floor(cycle),p=cycle-index,settle=1-stop,blend=smooth(.82,1,p);
 for(const [frame,alpha] of [[index,1-blend],[(index+1)%4,blend]]){if(alpha<=0)continue;c.save();c.globalAlpha*=alpha;
  parts.run[frame].draw(c,(u,v)=>{const lower=smooth(.48,.98,v),fore=smooth(.56,.78,u),wave=Math.sin(act.gait.phase);
   const width=lerp(1.34,1.07,turn),height=lerp(.64,.72,turn),front=fore*lower;
   const head=smooth(.72,.9,u)*(1-smooth(.4,.65,v));
   return [(u-.5)*width+lower*(2*fore-1)*Math.sin(act.gait.phase-.4)*.014*settle-front*.27*turn+head*.035*turn,
    (v-1)*height-act.gait.lift*(1-lower)*settle+act.gait.compression*Math.sin(v*Math.PI)*settle+wave*.006*(1-lower)*settle+front*.06*turn+head*.04*turn];});c.restore();}
}
function braced(parts,c,t,act){
 c.save();c.translate(-act.views.front*.36,-act.views.front*.17);
 drawLeg(parts,c,1,act.legs[1]);drawLeg(parts,c,0,act.legs[0]);
 parts.cells[0].mesh.draw(c,(u,v)=>bodyPoint(u,v,t));
 drawLeg(parts,c,1,act.legs[1],{from:.53});drawLeg(parts,c,0,act.legs[0],{from:.23});
 c.restore();
}
function blendViews(parts,c,t,act){
 const front=act.views.front,total=(1-act.views.run)*(1-act.views.quarter)*(1-front),layers=[
  {weight:act.views.run*(1-front),paint:ctx=>runner(parts,ctx,t)},
  ...turnLayers(parts,act).map(view=>({weight:total*view.weight,paint:ctx=>drawTurn(parts,ctx,t,view)})),
  {weight:act.views.quarter*(1-front),paint:ctx=>braced(parts,ctx,t,act)},
  {weight:front,paint:ctx=>drawFront(parts,ctx,t,act.front)}];
 const mix=parts.mix.getContext('2d'),view=parts.view.getContext('2d');
 mix.clearRect(0,0,1536,1080);mix.save();mix.globalCompositeOperation='lighter';
 for(const layer of layers){if(layer.weight<=0)continue;view.clearRect(0,0,1536,1080);view.save();view.translate(768,900);view.scale(900,900);
  layer.paint(view);view.restore();mix.globalAlpha=layer.weight;mix.drawImage(parts.view,0,0);}
 mix.restore();c.drawImage(parts.mix,-768/900,-1,1536/900,1080/900);
}
export function draw(parts,c,{x,y,size,t,angle=0,alpha=1,variant=0}){
 const act=acting(t),v=act.views;c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);c.scale(size*direction(variant),size);
 if(v.run===1)runner(parts,c,t);else if(v.front===1)drawFront(parts,c,t,act.front);else if(v.quarter===1&&v.front===0)braced(parts,c,t,act);else blendViews(parts,c,t,act);
 c.restore();
}
export function contacts(pose){return acting(pose.t,pose.variant||0).paws;}
