// Classic Club Penguin sprites, composited once for uniform translucency.
// Original frame offsets keep the feet planted across sit / stand / wave.
import {shadow,TAU} from './paint.js';
import {spritePaths} from './sprite-paths.js';
export function penguinPose(t) {
  const phase=((t%3.8)+3.8)%3.8;
  const sequence=[['sit',17,.3],['stand',1,.3],['sit',17,.3],['stand',1,.3],['wave',25,.7],
    ['sit',17,.3],['stand',1,.3],['sit',17,.3],['stand',1,.3],['wave',25,.7]];
  let at=0;
  for(let step=0;step<sequence.length;step++){
    const [name,action,duration]=sequence[step];
    if(phase<at+duration||step===sequence.length-1)return {action,name,step,progress:(phase-at)/duration,duration,phase};
    at+=duration;
  }
}
export function penguinBlend(t){
  const pose=penguinPose(t),tail=pose.name==='wave'?.12:.065;
  const u=Math.max(0,Math.min(1,(pose.progress*pose.duration-pose.duration+tail)/tail));
  return {pose,next:penguinPose(t+(1-pose.progress)*pose.duration+.000001),mix:u*u*(3-2*u)};
}
export class Penguin {
  async load(){
    this.image=new Image();this.image.src=new URL('art/penguin.png',import.meta.url).href;
    const response=await fetch(new URL('art/penguin-frames.json',import.meta.url));
    if(!response.ok)throw new Error('Penguin frames could not load');
    this.data=await response.json();await this.image.decode();
    this.paths=spritePaths(this.image,this.data.frames);
    this.composite=document.createElement('canvas');this.composite.width=1200;this.composite.height=1200;
    this.c=this.composite.getContext('2d');this.poseCanvas=document.createElement('canvas');this.poseCanvas.width=1200;this.poseCanvas.height=1200;
    this.poseContext=this.poseCanvas.getContext('2d');return this;
  }
  part(c,key,bodyColor){
    const p=this.paths[key];if(!p)throw new Error(`Missing classic penguin frame: ${key}`);
    const colors=bodyColor?[bodyColor]:['#182337','#f5f7fb','#727880','#eea024','#b77819'];
    c.save();c.translate(p.offset.x-200,p.offset.y-218);
    p.paths.forEach((path,i)=>{
      c.save();
      // Preserve the eyes; omit scattered dark flipper pixels that look like
      // tears at this size. The complete solid body carries those surfaces.
      if(!bodyColor&&i===0){
        if(!p.eyes){c.restore();return;}
        const e=p.eyes;c.beginPath();c.rect(e.x,e.y,e.w,e.h);c.clip();c.globalAlpha=.5;
      }
      c.fillStyle=colors[i];c.strokeStyle=colors[i];c.lineWidth=.25;c.fill(path);c.stroke(path);c.restore();
    });c.restore();
  }
  paintPose(pose,color){
    const n=pose.action===25?this.data.waveFrames[Math.min(this.data.waveFrames.length-1,Math.floor(pose.progress*this.data.waveFrames.length))]:1;
    const body=`body/${pose.action}_${n}`,overlay=`penguin/${pose.action}_${n}`,buffer=this.poseContext;
    buffer.setTransform(1,0,0,1,0,0);buffer.clearRect(0,0,1200,1200);
    // The two wave slots use opposite flippers. All flips keep the feet anchored.
    buffer.setTransform(pose.step===9?-3:3,0,0,3,600,654);buffer.fillStyle=color;
    buffer.save();buffer.translate(-200,-218);buffer.fill(this.paths[body].silhouette);buffer.restore();
    this.part(buffer,body,color);this.part(buffer,overlay);
  }
  draw(c,t,{x=302,y=958,mirror=false,hue=175,opacity=.68,colorTime=t}={}){
    const {pose,next,mix}=penguinBlend(t),phase=((colorTime%3.8)+3.8)%3.8/3.8;
    const color=`hsl(${hue+105*Math.sin(phase*TAU)} 82% 59%)`,buffer=this.c;
    buffer.setTransform(1,0,0,1,0,0);buffer.clearRect(0,0,1200,1200);
    this.paintPose(pose,color);buffer.globalAlpha=1-mix;buffer.drawImage(this.poseCanvas,0,0);
    if(mix){this.paintPose(next,color);buffer.globalCompositeOperation='lighter';buffer.globalAlpha=mix;buffer.drawImage(this.poseCanvas,0,0);}
    buffer.globalAlpha=1;buffer.globalCompositeOperation='source-over';
    shadow(c,x,y-1,138,23);
    // Front-view correction lifts the torso out of the game's overhead camera
    // perspective. Translucency applies once to the complete, blended character.
    c.save();c.globalAlpha=opacity;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.translate(x,y);c.scale(mirror?-3.6:3.6,4.05);
    c.drawImage(this.composite,-200,-218,400,400);c.restore();return pose.name;
  }
}
