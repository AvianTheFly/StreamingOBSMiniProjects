// Complete coherent paintings; all masks and blend buffers belong to one skin.
import {SpriteMesh} from '../../mesh.js';
import {anatomy} from './calibration.js';
import {viewIds} from './views.js';
const path=(c,points,w,h,x=0,y=0)=>{c.beginPath();points.forEach(([u,v],i)=>i?c.lineTo(u*w-x,v*h-y):c.moveTo(u*w-x,v*h-y));c.closePath();};
function trim(image,crop=[0,0,1,1]){
 const canvas=document.createElement('canvas'),[x,y,w,h]=crop;canvas.width=Math.round(image.width*w);canvas.height=Math.round(image.height*h);
 const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,x*image.width,y*image.height,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
 const pixels=c.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;let l=canvas.width,t=canvas.height,r=0,b=0;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const index=(y*canvas.width+x)*4+3;if(data[index]>20){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}else data[index]=0;}
 // Ignore sub-threshold generation residue outside the calibrated silhouette.
 c.putImageData(pixels,0,0);
 if(r<=l||b<=t)throw Error('Ram skin view has no painted anatomy');
 const result=document.createElement('canvas');result.width=r-l+1;result.height=b-t+1;result.getContext('2d').drawImage(canvas,l,t,result.width,result.height,0,0,result.width,result.height);return result;
}
function registered(image,spec){const w=image.width,h=image.height,cal=anatomy[spec.id],view={...spec,image,h:spec.height,w:spec.height*w/h,cal};
 const regions=cal.legs?[null,...cal.legs.map(l=>l.region)]:[null];
 view.cells=regions.map(region=>{const box=region?{x:Math.min(...region.map(p=>p[0])),y:Math.min(...region.map(p=>p[1])),r:Math.max(...region.map(p=>p[0])),b:Math.max(...region.map(p=>p[1]))}:{x:0,y:0,r:1,b:1};
 const x=Math.floor(box.x*w),y=Math.floor(box.y*h),sw=Math.ceil(box.r*w)-x,sh=Math.ceil(box.b*h)-y;
 const paint=document.createElement('canvas');paint.width=sw;paint.height=sh;const c=paint.getContext('2d');
 if(region){path(c,region,w,h,x,y);c.clip();}c.drawImage(image,-x,-y);
 if(!region&&regions.length>1){c.globalCompositeOperation='destination-out';for(let i=0;i<cal.legs.length;i++){const l=cal.legs[i],collar=i===1||i===3?l.joint[1]-.025:l.root[1]+.045;c.save();c.beginPath();c.rect(0,collar*h,w,h);c.clip();path(c,l.region,w,h);c.fill();c.restore();}c.globalCompositeOperation='source-over';}
 const domain={x:x/w,y:y/h,w:sw/w,h:sh/h};return {image:paint,w:sw,h:sh,domain,mesh:new SpriteMesh().fromImage(paint,Math.max(8,Math.ceil(domain.w*40)),Math.max(8,Math.ceil(domain.h*38)))};
 });return view;
}
export async function load(){const response=await fetch(new URL('./skin-pack.json',import.meta.url));if(!response.ok)throw Error('Ram skin pack unavailable');const skin=await response.json(),decoded=new Map(),views=[];
 const ids=skin.views.map(v=>v.id);if(ids.length!==viewIds.length||new Set(ids).size!==ids.length||!viewIds.every(id=>ids.includes(id)))throw Error('Ram skin pack needs every registered turn and jump view');
 for(const spec of skin.views){if(!decoded.has(spec.file)){const im=new Image();im.src='./assets/'+spec.file;await im.decode();decoded.set(spec.file,im);}views.push(registered(trim(decoded.get(spec.file),spec.crop),spec));}
 const mix=document.createElement('canvas');mix.width=1536;mix.height=1320;const view=mix.cloneNode();return {skin,views,cells:views[0].cells,mix,view,origin:[768,1210],units:640,intactSource:true};
}
