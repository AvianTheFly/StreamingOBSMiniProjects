// Feature-local painted presentation, with deformation policy supplied by a world.
import {PaintedPatch} from './shared/world-motion.js';
export const edge=(u,v)=>Math.sin(u*Math.PI)**2*Math.sin(v*Math.PI)**2;
export class PaintedWorld {
 constructor(scene,ambience){this.scene=scene;this.ambience=ambience;this.patches=[];}
 async load(){
  const image=new Image();image.src='/api/projects/scene_voice_switcher/artwork?source='+encodeURIComponent(this.scene.source);await image.decode();
  this.base=document.createElement('canvas');this.base.width=1920;this.base.height=1080;this.base.getContext('2d').drawImage(image,0,0,1920,1080);
  this.patches=this.scene.patches.map(spec=>({spec,patch:new PaintedPatch(this.base,spec.rect)}));return this;
 }
 draw(c,t,events){for(const {spec,patch} of this.patches)patch.draw(c,(u,v)=>spec.move(u,v,t));this.ambience(c,t,events);}
 dispose(){for(const {patch} of this.patches)patch.dispose();this.patches=[];if(this.base)this.base.width=this.base.height=1;}
}
