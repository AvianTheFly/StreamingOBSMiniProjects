// Registered body/limb paint from ONE coherent complete creature. No new art views.
import {SpriteMesh} from '../../mesh.js';
import {anatomy} from './calibration.js';
export const asset='turtle-intact-v14';
const path=(c,points,w,h,x=0,y=0)=>{c.beginPath();points.forEach(([u,v],i)=>i?c.lineTo(u*w-x,v*h-y):c.moveTo(u*w-x,v*h-y));c.closePath();};
export async function load(){const source=await new SpriteMesh().load(asset),image=source.image,w=image.width,h=image.height;
 const regions=[null,...anatomy.regions],cells=regions.map(region=>{
  const box=region?{x:Math.min(...region.map(p=>p[0])),y:Math.min(...region.map(p=>p[1])),right:Math.max(...region.map(p=>p[0])),bottom:Math.max(...region.map(p=>p[1]))}:{x:0,y:0,right:1,bottom:1};
  const x=Math.floor(box.x*w),y=Math.floor(box.y*h),sw=Math.ceil(box.right*w)-x,sh=Math.ceil(box.bottom*h)-y;
  const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;const c=canvas.getContext('2d');
  if(region){path(c,region,w,h,x,y);c.clip();}c.drawImage(image,-x,-y);
  if(!region){c.globalCompositeOperation='destination-out';for(let i=0;i<anatomy.regions.length;i++){c.save();c.beginPath();c.rect(0,(anatomy.legs[i].root[1]+.055)*h,w,h);c.clip();path(c,anatomy.regions[i],w,h);c.fill();c.restore();}c.globalCompositeOperation='source-over';}
  const domain={x:x/w,y:y/h,w:sw/w,h:sh/h};
  return {image:canvas,w:sw,h:sh,domain,mesh:new SpriteMesh().fromImage(canvas,Math.max(8,Math.ceil(domain.w*40)),Math.max(8,Math.ceil(domain.h*30)))};
 });return {cells,image,intactSource:true};}
