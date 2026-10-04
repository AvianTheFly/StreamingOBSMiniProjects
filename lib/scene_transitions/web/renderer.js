import {spirits,timing,animationTiming,clips} from './catalog.js';
import {Character} from './characters.js';
import {Field,fractureMesh,glow} from './fx.js';
import {smooth} from './math.js';
import * as bear from './bear.js';
import * as turtle from './turtle.js';
import * as ram from './ram.js';
import * as phoenix from './phoenix.js';
import {FlameVolume} from './flame.js';
import {panel,hexMesh} from './coverage.js';
import {transform} from './motion.js';
const effects={bear,turtle,ram,phoenix};
export class SpiritTransition{
 constructor(canvas){this.canvas=canvas;canvas.width=1920;canvas.height=1080;this.c=canvas.getContext('2d');this.cover=document.createElement('canvas');this.cover.width=1920;this.cover.height=1080;this.b=this.cover.getContext('2d');this.scratch=this.cover.cloneNode();}
 async load(clip){
  if(!clips[clip])throw Error('Unknown animation');const {spirit:id,variant}=clips[clip];
  const epoch=this.loadEpoch=(this.loadEpoch||0)+1;
  const spec=spirits[id],character=await new Character().load(id);
  try{
  const material=panel(spec,spec.seed);
  if(id!=='phoenix'){const image=new Image();image.src=`./assets/${character.materialAsset||spec.material||`${id}-material-v5.png`}`;await image.decode();
   const materialContext=material.getContext('2d');materialContext.globalAlpha=1;materialContext.drawImage(image,0,0,1920,1080);}
  const flame=id==='phoenix'?await new FlameVolume().load():null;
  // Publish only a complete generation: quick selections or an old scrub event
  // can never combine one animal's choreography with another animal's assets.
  if(epoch!==this.loadEpoch){character.dispose();flame?.dispose();return this;}
  this.character?.dispose();
  this.flame?.dispose();
  Object.assign(this,{lightning:null,hornHits:null,frontTime:null,id,clip,variant,timing:animationTiming(id),spec,effect:effects[id],character,
   field:new Field(spec.seed),mesh:fractureMesh(spec.seed),hexes:hexMesh(spec.seed),material,flame});return this;
  }catch(error){character.dispose();throw error;}
 }
 draw(t){
  const {c,b,spec,effect}=this;c.resetTransform();c.globalAlpha=1;c.globalCompositeOperation='source-over';c.clearRect(0,0,1920,1080);b.resetTransform();b.globalAlpha=1;b.globalCompositeOperation='source-over';b.clearRect(0,0,1920,1080);
  if(t<=0||t>=timing.duration)return;
  c.save();transform(c,this.id,t);
  effect.entrance(this,t);
  // Choreography owns coverage: permanent claws, shield, impact glass, firefront.
  const hasCover=effect.coverage(this,t);
  // Isolate material effects before masking: screen/additive blends may otherwise
  // escape source-atop and paint particles or fire outside the coverage shape.
  if(hasCover){const mask=this.scratch.getContext('2d');mask.clearRect(0,0,1920,1080);mask.drawImage(this.cover,0,0);
  b.clearRect(0,0,1920,1080);effect.surface(this,t);
  b.save();b.globalCompositeOperation='destination-in';b.drawImage(this.scratch,0,0);b.restore();
  if(t>this.timing.coveredUntil)effect.reveal(this,t);
  c.drawImage(this.cover,0,0);}
  // An effect may keep its performer above its growing cover. The feature owns
  // the policy and fade; other effects retain their existing composition order.
  effect.foreground?.(this,t);
  // Impact bloom has a brief plateau rather than a flashing white frame.
  const impact=smooth(3.65,3.85,t)*(1-smooth(4.1,4.4,t));glow(c,960,540,880,spec.color,impact*.18);
  c.restore();
  // Finish completely clear: never leave particles or color over the new scene.
  if(t>6.2){c.save();c.globalCompositeOperation='destination-in';c.globalAlpha=1-smooth(6.2,6.5,t);c.fillStyle='#fff';c.fillRect(0,0,1920,1080);c.restore();}
 }
 dispose(){this.loadEpoch=(this.loadEpoch||0)+1;this.character?.dispose();this.flame?.dispose();this.flame=null;}
}
