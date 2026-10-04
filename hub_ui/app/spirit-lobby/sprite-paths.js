// Decode classic sprite contours once into scalable paths. Original PNG stays
// untouched; rounding subpixel corners avoids magnifying blurry bitmap edges.
function category(r,g,b,a,body){
  if(a<96)return -1;if(body)return 0;
  const high=Math.max(r,g,b),low=Math.min(r,g,b);
  if(high<75)return 0;
  if(high-low<55)return high>195?1:2;
  if(r>g+18&&g>b+18)return r>180?3:4;
  return 2;
}
function simplify(points,tolerance){
  if(points.length<4)return points;
  const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  let far=0,index=0;
  for(let i=1;i<points.length-1;i++){
    const p=points[i],u=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
    const distance=(p[0]-a[0]-u*dx)**2+(p[1]-a[1]-u*dy)**2;
    if(distance>far){far=distance;index=i;}
  }
  return far>tolerance*tolerance?[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)]:[a,b];
}
function contour(mask,w,h,which,solid=false){
  const edges=new Map(),inside=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&mask[y*w+x]===which;
  const edge=(x,y,xx,yy)=>{const key=y*(w+1)+x,end=yy*(w+1)+xx;if(!edges.has(key))edges.set(key,[]);edges.get(key).push(end);};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(inside(x,y)){
    if(!inside(x,y-1))edge(x,y,x+1,y);if(!inside(x+1,y))edge(x+1,y,x+1,y+1);
    if(!inside(x,y+1))edge(x+1,y+1,x,y+1);if(!inside(x-1,y))edge(x,y+1,x,y);
  }
  const path=new Path2D();
  while(edges.size){
    const start=edges.keys().next().value,points=[];let key=start;
    for(let count=0;count<=w*h*4;count++){
      points.push([key%(w+1),Math.floor(key/(w+1))]);
      const list=edges.get(key);if(!list)break;const next=list.pop();if(!list.length)edges.delete(key);key=next;if(key===start)break;
    }
    // Retain silhouette corners but discard redundant points on straight edges.
    const extent=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
    const corners=simplify(points,extent<12?.3:.85);
    if(corners.length<3)continue;
    const area=corners.reduce((sum,p,i)=>{const q=corners[(i+1)%corners.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    if(solid&&area<0)continue;
    const end=corners.at(-1),first=corners[0];path.moveTo((end[0]+first[0])/2,(end[1]+first[1])/2);
    corners.forEach((p,i)=>{const next=corners[(i+1)%corners.length];path.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);});path.closePath();
  }return path;
}
export function spritePaths(image,frames){
  const canvas=document.createElement('canvas'),c=canvas.getContext('2d',{willReadFrequently:true});
  const result={};
  for(const [key,p] of Object.entries(frames)){
    const f=p.frame,body=key.startsWith('body/');canvas.width=f.w;canvas.height=f.h;c.clearRect(0,0,f.w,f.h);c.drawImage(image,f.x,f.y,f.w,f.h,0,0,f.w,f.h);
    const rgba=c.getImageData(0,0,f.w,f.h).data,mask=new Int8Array(f.w*f.h);
    for(let i=0;i<mask.length;i++)mask[i]=category(...rgba.subarray(i*4,i*4+4),body);
    result[key]={offset:p.spriteSourceSize,paths:Array.from({length:body?1:5},(_,n)=>contour(mask,f.w,f.h,n))};
    if(!body){
      // The upper white island is the pair of eyes. Keep its dark details,
      // without enlarging the archive's scattered flipper-shadow pixels.
      const first=mask.findIndex(v=>v===1),top=Math.floor(first/f.w),points=[];
      for(let y=top;y<Math.min(f.h,top+9);y++)for(let x=0;x<f.w;x++)if(mask[y*f.w+x]===1)points.push([x,y]);
      if(points.length){const xs=points.map(p=>p[0]);result[key].eyes={x:Math.min(...xs)-1,y:top-1,w:Math.max(...xs)-Math.min(...xs)+3,h:10};}
    }
  }
  // Make one complete exterior for each pose. Independent layered transparency
  // and anti-aliased mask seams must never punch holes through belly or flippers.
  for(const key of Object.keys(frames).filter(k=>k.startsWith('body/'))){
    const overlay='penguin/'+key.slice(5);if(!frames[overlay])continue;
    canvas.width=400;canvas.height=400;c.clearRect(0,0,400,400);
    for(const id of [key,overlay]){const {frame:f,spriteSourceSize:d}=frames[id];c.drawImage(image,f.x,f.y,f.w,f.h,d.x,d.y,d.w,d.h);}
    const pixels=c.getImageData(0,0,400,400).data,mask=new Int8Array(160000);
    for(let i=0;i<mask.length;i++)mask[i]=pixels[i*4+3]>96?0:-1;
    result[key].silhouette=contour(mask,400,400,0,true);
  }
  return result;
}
