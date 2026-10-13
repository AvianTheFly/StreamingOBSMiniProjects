// One world's decoded cameo poses. No timers, listeners or shared mutable cache.
import {guestAssets} from './game-guest-assets.js';
export class GameGuestSprites {
 constructor(names,assets=guestAssets){this.names=[...new Set(names)];this.assets=assets;this.frames=new Map();this.images=new Set();this.disposed=false;}
 async load(){
  try{
   await Promise.all(this.names.map(async name=>{
    const frames=await Promise.all(this.assets[name].map(async spec=>{const image=new Image();this.images.add(image);image.src=new URL(spec.url,import.meta.url).href;await image.decode();return image;}));
    if(this.disposed){for(const image of frames)image.src='';return;}
    this.frames.set(name,frames);
   }));
  }catch(error){this.dispose();throw error;}
  return this;
 }
 draw(c,name,pose,x,y,height,{flip=false,turn=0,squash=1}={}){
  const frames=this.frames.get(name);if(!frames||this.disposed)return;
  const image=frames[Math.max(0,Math.min(2,Math.round(pose)))],scale=height/frames[0].height,width=scale*image.width;
  c.save();c.translate(x,y);c.rotate(turn);c.scale(flip?-1:1,1);c.scale(1/squash,squash);
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  c.drawImage(image,-width/2,-image.height*scale,width,image.height*scale);c.restore();
 }
 dispose(){this.disposed=true;for(const image of this.images)image.src='';this.images.clear();this.frames.clear();}
}
