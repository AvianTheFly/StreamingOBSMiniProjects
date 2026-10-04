// One lazily acquired WebGL context per preview document; no timers or OBS I/O.
import {T,disposeTree} from './geometry.js';
let shared=null;
class Stage {
 constructor(){
  this.refs=0;this.canvas=document.createElement('canvas');
  this.renderer=new T.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:true});
  this.renderer.setSize(1400,1400,false);this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=T.SRGBColorSpace;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.22;
  this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-.8,.8,1.3,-.3,.1,10);this.camera.position.set(0,0,4);
  this.scene.add(new T.HemisphereLight('#dcecff','#213349',2.15));
  this.key=new T.DirectionalLight('#fff1d8',3.6);this.key.position.set(-2.2,3.5,4);this.scene.add(this.key);
  this.rim=new T.DirectionalLight('#8bdfff',4);this.rim.position.set(2,1,-2);this.scene.add(this.rim);
  this.fill=new T.DirectionalLight('#cfdefa',.8);this.fill.position.set(-3,0,1);this.scene.add(this.fill);
  this.actors=new Set();
 }
 add(actor){this.refs++;this.actors.add(actor);this.scene.add(actor.root);actor.root.visible=false;}
 draw(actor,pose){
  for(const a of this.actors)a.root.visible=a===actor;actor.update(pose);
  const [left,right,top,bottom]=actor.bounds;Object.assign(this.camera,{left,right,top,bottom});this.camera.updateProjectionMatrix();
  this.rim.color.set(actor.rim);this.renderer.render(this.scene,this.camera);return this.canvas;
 }
 release(actor){if(!this.actors.delete(actor))return;this.scene.remove(actor.root);disposeTree(actor.root);this.refs--;if(!this.refs){this.renderer.dispose();this.renderer.forceContextLoss();shared=null;}}
}
export function acquireStage(actor){if(!shared)shared=new Stage();shared.add(actor);return shared;}
export async function texture(name,repeat=1){const t=await new T.TextureLoader().loadAsync(new URL(`../assets/${name}-v7.png`,import.meta.url).href);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;return t;}
