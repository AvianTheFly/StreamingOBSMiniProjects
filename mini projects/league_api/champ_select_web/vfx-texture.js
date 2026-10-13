// Small precomputed erosion atlas. Created once per active world, never per frame.
import {seed} from './vfx-ink.js';
import {clamp,smooth} from './scene-map.js';
function noise(x,y,scale){const u=x/scale,v=y/scale,ix=Math.floor(u),iy=Math.floor(v),a=smooth(u-ix),b=smooth(v-iy),n=(i,j)=>seed(i*19+j*137);return (n(ix,iy)*(1-a)+n(ix+1,iy)*a)*(1-b)+(n(ix,iy+1)*(1-a)+n(ix+1,iy+1)*a)*b;}
export function erosionAtlas(image){
 const size=96,values=new Float32Array(size*size),mask=document.createElement('canvas');mask.width=mask.height=size;const m=mask.getContext('2d'),pixels=m.createImageData(size,size),frames=[];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)values[y*size+x]=noise(x,y,13)*.56+noise(x,y,5)*.29+noise(x,y,2)*.15;
 for(let frame=0;frame<16;frame++){
  const progress=frame/15;
  for(let i=0;i<values.length;i++)pixels.data[i*4+3]=Math.round(clamp((values[i]-progress)/.16+.5)*255);
  m.putImageData(pixels,0,0);const canvas=document.createElement('canvas');canvas.width=canvas.height=384;const c=canvas.getContext('2d');c.drawImage(image,0,0,384,384);c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0,384,384);frames.push(canvas);
 }
 mask.width=mask.height=1;return frames;
}
