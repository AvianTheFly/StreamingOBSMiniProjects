// Feature-local painted presentation, with deformation policy supplied by a world.
import {PaintedPatch} from './shared/world-motion.js';
import {LobbyResidents} from './lobby-residents.js';
export const edge=(u,v)=>Math.sin(u*Math.PI)**2*Math.sin(v*Math.PI)**2;
export class PaintedWorld {
 constructor(scene,ambience){this.scene=scene;this.ambience=ambience;this.patches=[];this.residents=(scene.residents??!!scene.artUrl)?new LobbyResidents(scene.id):null;}
 async load(){
  const image=new Image();image.src=this.scene.artUrl?new URL(this.scene.artUrl,import.meta.url).href:'/api/projects/scene_voice_switcher/artwork?source='+encodeURIComponent(this.scene.source);await image.decode();
  this.base=document.createElement('canvas');this.base.width=1920;this.base.height=1080;this.base.getContext('2d').drawImage(image,0,0,1920,1080);
  this.patches=this.scene.patches.map(spec=>({spec,patch:new PaintedPatch(this.base,spec.rect)}));await this.residents?.load();return this;
 }
 draw(c,t,events,holes=[]){if(this.scene.artUrl)c.drawImage(this.base,0,0);for(const {spec,patch} of this.patches)patch.draw(c,(u,v)=>spec.move(u,v,t),holes);this.ambience(c,t,events);this.residents?.draw(c,t,events);}
 drawVisitor(c,slot,x,y,h,tilt=0,flip=false,alpha=1){this.residents?.sprite(c,slot,x,y,h,tilt,flip,alpha);}
 dispose(){for(const {patch} of this.patches)patch.dispose();this.patches=[];this.residents?.dispose();if(this.base)this.base.width=this.base.height=1;}
}
