import {erosionAtlas} from './vfx-texture.js';
// Feature-owned still, transparent VFX texture and three visitor poses. No shared cache.
const guests={bear:'kirby',turtle:'goose',ram:'crewmate',phoenix:'boo'};
export class WorldAssets{
 constructor(){this.token=0;this.theme=null;this.images=[];this.poses=[];this.effect=null;this.ready=false;}
 async load(theme){if(this.theme===theme)return;this.dispose();this.theme=theme;const token=this.token;
  const load=async url=>{const image=new Image();this.images.push(image);image.src=url;await image.decode();return image;};
  try{await load(`/champ-select/backgrounds/${theme}.jpg`);if(token!==this.token)return;this.ready=true;}catch{if(token===this.token)this.ready=false;return;}
  try{const effect=await load(`/champ-select/vfx/${theme}.png`);if(token!==this.token)return;effect.dissolveFrames=erosionAtlas(effect);this.effect=effect;}catch{ /* Procedural impacts still work if a texture is unavailable. */ }
  if(token!==this.token)return;
  try{const poses=await Promise.all([0,1,2].map(i=>load(`/champ-select/guests/game-${guests[theme]}-${i}.png`)));if(token===this.token)this.poses=poses;}catch{ /* A missed cameo never removes the scene. */ }
 }
 sprite(c,pose,x,y,h,{turn=0,squash=1,alpha=1,flip=false}={}){const image=this.poses[pose];if(!image)return;const scale=h/this.poses[0].height,w=image.width*scale;c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(turn);c.scale(flip?-1:1,1);c.scale(1/squash,squash);c.drawImage(image,-w/2,-image.height*scale,w,image.height*scale);c.restore();}
 dispose(){this.token++;for(const image of this.images){for(const frame of image.dissolveFrames||[])frame.width=frame.height=1;image.dissolveFrames=[];image.src='';}this.images=[];this.poses=[];this.effect=null;this.theme=null;this.ready=false;}
}
