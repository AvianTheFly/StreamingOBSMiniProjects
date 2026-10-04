// Phoenix depth layering and asset-owned premultiplied view blending.
import {smooth} from '../../math.js';
import {bodyViews,heading} from './motion.js';
import {bodyPoint,wingPoint,wingCurve,legPoint,legChain,tailPoint} from './projection.js';
import * as turned from './turned.js';
function blend(parts,c,layers,draw){layers=layers.filter(l=>l.weight>0);
 if(layers.length===1){draw(c,layers[0]);return;}
 const mix=parts.mix.getContext('2d'),view=parts.view.getContext('2d');mix.clearRect(0,0,1536,1536);mix.save();mix.globalCompositeOperation='lighter';
 for(const l of layers){view.clearRect(0,0,1536,1536);view.save();view.translate(768,600);view.scale(600,600);draw(view,l);view.restore();mix.globalAlpha=l.weight;mix.drawImage(parts.view,0,0);}
 mix.restore();c.drawImage(parts.mix,-768/600,-600/600,1536/600,1536/600);
}
function wing(parts,c,t,side){const curve=wingCurve(t,side),under=smooth(-.40,.30,curve.w.angle);
 blend(parts,c,[{key:0,weight:1-under},{key:1,weight:under}],(ctx,l)=>parts.wings[l.key].mesh.draw(ctx,(u,v)=>wingPoint(t,side,u,v,curve)));
}
function leg(parts,c,t,side){const chain=legChain(t,side);parts.leg.mesh.draw(c,(u,v)=>legPoint(t,side,u,v,chain));}
export function draw(parts,c,{x,y,size,t,angle=0,alpha=1,variant=0}){
 c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);c.scale(size*(variant?-1:1),size);
 // Blend complete angle generations, including their wings, talons and tail.
 // Only the frontal view uses the independently articulated frontal rig.
 const camera={view:parts.cameraView,mix:parts.cameraMix};
 blend(camera,c,bodyViews(t),(ctx,l)=>{if(l.key===0)frontal(parts,ctx,t);else turned.draw(parts,ctx,l.key,t,blend);});c.restore();
}
function frontal(parts,c,t){const near=Math.sin(heading(t))>=0?1:-1;
 parts.tail.mesh.draw(c,(u,v)=>tailPoint(t,u,v));wing(parts,c,t,-near);leg(parts,c,t,-near);
 // Frontal body paint alone; angle blending is owned by the complete bird above.
 parts.body[0].mesh.draw(c,(u,v)=>bodyPoint(u,v,t,0));wing(parts,c,t,near);leg(parts,c,t,near);
}
