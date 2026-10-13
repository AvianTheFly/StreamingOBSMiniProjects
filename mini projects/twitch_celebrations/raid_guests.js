// Feature-local copies of existing lobby art. One bounded cache per browser page.
// No peer implementation imports, timers, workers, videos, or runtime downloads.
export const GUEST_NAMES=['kirby','goose','crewmate','climber','hornet','boo','creeper','salvager'];
const frames=new Map();
export const guestsReady=Promise.all(GUEST_NAMES.map(async name=>{
 const images=await Promise.all([0,1,2].map(async pose=>{
  const image=new Image();image.src=`/media/raid-game-${name}-${pose}.png`;await image.decode();return image;
 }));frames.set(name,images);
}));
export function drawSprite(c,name,pose,x,y,height,{flip=false,turn=0,squash=1}={}){
 const images=frames.get(name);if(!images)return false;
 const image=images[Math.max(0,Math.min(2,Math.round(pose)))],scale=height/images[0].naturalHeight;
 c.save();c.translate(x,y);c.rotate(turn);c.scale((flip?-1:1)/squash,squash);
 c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 c.drawImage(image,-image.naturalWidth*scale/2,-image.naturalHeight*scale,image.naturalWidth*scale,image.naturalHeight*scale);
 c.restore();return true;
}
