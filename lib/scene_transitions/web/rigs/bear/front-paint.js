// Complete original frontal artwork, preserving forearms, claws and occlusion.
// A bounded premultiplied blend avoids dark silhouettes during the fast swipe.
import {frontPoint} from './front-motion.js';
export function drawFront(parts,c,t,act){
 const layers=act.layers.filter(layer=>layer.weight>0);
 const paint=(ctx,layer)=>parts.front.poses[layer.key].mesh.draw(ctx,(u,v)=>frontPoint(u,v,t,act,layer.key));
 if(layers.length===1){paint(c,layers[0]);return;}
 const mix=parts.front.mix.getContext('2d'),view=parts.front.view.getContext('2d');
 mix.clearRect(0,0,1536,1080);mix.save();mix.globalCompositeOperation='lighter';
 for(const layer of layers){view.clearRect(0,0,1536,1080);view.save();view.translate(768,900);view.scale(900,900);paint(view,layer);view.restore();
  mix.globalAlpha=layer.weight;mix.drawImage(parts.front.view,0,0);}
 mix.restore();c.drawImage(parts.front.mix,-768/900,-1,1536/900,1080/900);
}
