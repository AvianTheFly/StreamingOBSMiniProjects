// Page-owned pose cache from the user's existing ending-screen penguin artwork.
const poses=new Map();let frames;
export const penguinsReady=(async()=>{
 const image=new Image();image.src='/media/raid-penguin.png';
 const response=await fetch('/raid-penguin-frames.json');if(!response.ok)throw Error('Penguin frames unavailable');
 frames=await response.json();await image.decode();
 for(const action of [17,25])for(const n of action===25?frames.waveFrames:[1]){
  const cv=document.createElement('canvas');cv.width=160;cv.height=160;const c=cv.getContext('2d');c.translate(80,120);c.scale(1.4,1.4);
  for(const prefix of ['body','penguin']){const entry=frames.frames[`${prefix}/${action}_${n}`];if(!entry)continue;const f=entry.frame,d=entry.spriteSourceSize;
   c.save();c.drawImage(image,f.x,f.y,f.w,f.h,d.x-200,d.y-213,d.w,d.h);
   if(prefix==='body'){c.globalCompositeOperation='source-in';c.fillStyle='hsl(175 70% 54%)';c.fillRect(-200,-213,400,400);}c.restore();}
  poses.set(`${action}/${n}`,cv);
 }
})();
export function drawPenguin(c,t){if(!frames)return;const n=frames.waveFrames[Math.floor(t*10)%frames.waveFrames.length],pose=poses.get(`25/${n}`);c.save();c.rotate(Math.sin(t*5)*.09);c.drawImage(pose,-78,-82,156,156);c.restore();}
