// Stateless, pixel-aligned display furniture. Callers own geometry and materials.
function paintDisplayFrame(c,rect,{dark='#302014',metal='#bd8a42',light='#f7d991',accent='#5fd9df'}={}){
 const [x,y,w,h]=rect,p=18;
 c.save();
 c.shadowColor='#000b';c.shadowBlur=16;c.shadowOffsetY=8;
 c.fillStyle=dark;c.fillRect(x-p,y-p,w+2*p,h+2*p);
 c.shadowBlur=0;c.shadowOffsetY=0;
 const gold=c.createLinearGradient(0,y-p,0,y+h+p);
 gold.addColorStop(0,light);gold.addColorStop(.07,metal);gold.addColorStop(.45,dark);gold.addColorStop(.94,metal);gold.addColorStop(1,light);
 c.strokeStyle=gold;c.lineWidth=8;c.strokeRect(x-11,y-11,w+22,h+22);
 c.strokeStyle=light;c.lineWidth=1;c.strokeRect(x-16.5,y-16.5,w+33,h+33);
 c.strokeStyle=metal;c.lineWidth=2;c.strokeRect(x-2,y-2,w+4,h+4);
 // Small inlaid corner diamonds stay outside the usable picture.
 for(const [xx,yy] of [[x-10,y-10],[x+w+10,y-10],[x-10,y+h+10],[x+w+10,y+h+10]]){
  c.fillStyle=dark;c.strokeStyle=light;c.lineWidth=1.5;c.beginPath();c.moveTo(xx,yy-7);c.lineTo(xx+7,yy);c.lineTo(xx,yy+7);c.lineTo(xx-7,yy);c.closePath();c.fill();c.stroke();
  c.fillStyle=accent;c.fillRect(xx-1.5,yy-1.5,3,3);
 }
 c.fillStyle='#070b12';c.fillRect(x,y,w,h);c.restore();
}

// One prepared furniture surface per exact geometry/material recipe. Keep the
// direct painter for transformed/translucent contexts where grouping changes
// compositing. The owning page releases all retained surfaces on teardown.
const frames=new Map();
const budget=128*1024*1024;
let bytes=0;
export function clearDisplayFrameCache(){
 for(const {surface} of frames.values())surface.width=surface.height=1;
 frames.clear();bytes=0;
}
export function displayFrameCacheStatus(){return {entries:frames.size,bytes,budget};}
export function drawDisplayFrame(c,rect,materials){
 const transform=c.getTransform();
 if(c.globalAlpha!==1||c.globalCompositeOperation!=='source-over'||c.filter!=='none'||
    c.shadowBlur||c.shadowOffsetX||c.shadowOffsetY||transform.a!==1||transform.b||
    transform.c||transform.d!==1||transform.e||transform.f||rect.some(v=>!Number.isFinite(v))){
  return paintDisplayFrame(c,rect,materials);
 }
 const {dark='#302014',metal='#bd8a42',light='#f7d991',accent='#5fd9df'}=materials||{};
 const recipe={dark,metal,light,accent},
   readback=!!c.getContextAttributes?.().willReadFrequently,
   key=JSON.stringify([rect,dark,metal,light,accent,readback]);
 let item=frames.get(key);
 if(item){frames.delete(key);frames.set(key,item);}
 else{
  // Whole-pixel origin and matching backend preserve subpixel intersections.
  const [x,y,w,h]=rect,left=Math.floor(x-66),top=Math.floor(y-66),
    width=Math.ceil(x+w+66)-left,height=Math.ceil(y+h+82)-top;
  const size=width*height*4;
  if(width<1||height<1||size>budget)return paintDisplayFrame(c,rect,materials);
  while(bytes+size>budget||frames.size>=32){
   const first=frames.keys().next().value,old=frames.get(first);
   old.surface.width=old.surface.height=1;bytes-=old.bytes;frames.delete(first);
  }
  const surface=document.createElement('canvas');surface.width=width;surface.height=height;
  const prepared=surface.getContext('2d',{willReadFrequently:readback});prepared.translate(-left,-top);
  paintDisplayFrame(prepared,rect,recipe);
  item={surface,left,top,bytes:size};frames.set(key,item);bytes+=size;
 }
 c.drawImage(item.surface,item.left,item.top);
}
window.addEventListener('pagehide',clearDisplayFrameCache);
