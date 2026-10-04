// Phoenix-owned paint generation: source regions, continuous anatomy and buffers.
import {Parts} from '../../rig.js';
import {SpriteMesh} from '../../mesh.js';
const rect=(x,y,r,b)=>[[x,y],[r,y],[r,b],[x,b]];
const views={file:'phoenix-views-v16.png',width:1254,regions:[rect(0,0,634,638),rect(634,0,1254,638),rect(0,620,634,1254),rect(634,620,1254,1254)]};
const limbs={file:'phoenix-limbs-v16.png',width:1254,regions:[rect(0,0,640,590),rect(640,0,1254,590),rect(0,578,640,1254),rect(640,578,1254,1254)]};
const props={file:'phoenix-props-v16.png',width:1774,regions:[rect(0,0,980,887),rect(980,0,1774,887)]};
const flights={file:'phoenix-flight-v17.png',width:1254,regions:[rect(0,0,655,710),rect(550,160,1254,720),rect(0,625,712,1254),rect(575,750,1254,1254)]};
const rear={file:'phoenix-rear-v17.png',width:1774,regions:[rect(0,0,830,887),rect(735,0,1774,887)]};
// Generated gutters occasionally contain tiny neighbour fragments. Extract the
// largest continuous anatomy and its antialiased fringe once, at generation load.
function isolate(part,cols=14,rows=18){
 const source=part.image,c=source.getContext('2d',{willReadFrequently:true}),w=source.width,h=source.height;
 const d=c.getImageData(0,0,w,h),seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let largest=[];
 for(let p=0;p<w*h;p++){if(seen[p]||d.data[p*4+3]<=20)continue;let head=0,tail=1;queue[0]=p;seen[p]=1;
  while(head<tail){const q=queue[head++],x=q%w,y=Math.floor(q/w);
   for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){
    const n=yy*w+xx;if(!seen[n]&&d.data[n*4+3]>20){seen[n]=1;queue[tail++]=n;}
   }
  }if(tail>largest.length)largest=Array.from(queue.subarray(0,tail));
 }
 if(largest.length<100)throw Error('Missing continuous phoenix anatomy');
 const mask=new Uint8Array(w*h);let l=w,r=0,top=h,b=0;
 for(const p of largest){const x=p%w,y=Math.floor(p/w);l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);b=Math.max(b,y);
  for(let yy=Math.max(0,y-2);yy<=Math.min(h-1,y+2);yy++)for(let xx=Math.max(0,x-2);xx<=Math.min(w-1,x+2);xx++)mask[yy*w+xx]=1;
 }
 for(let p=0;p<mask.length;p++)if(!mask[p])d.data[p*4+3]=0;c.putImageData(d,0,0);
 const image=document.createElement('canvas');image.width=r-l+1;image.height=b-top+1;image.getContext('2d').drawImage(source,l,top,image.width,image.height,0,0,image.width,image.height);
 return {image,w:image.width,h:image.height,islandPixels:largest.length,mesh:new SpriteMesh().fromImage(image,cols,rows)};
}
export async function load(){
 const body=(await new Parts().load('phoenix',views)).cells.map(p=>isolate(p));
 const pieces=(await new Parts().load('phoenix',limbs)).cells.map(p=>isolate(p,18,22));
 const prop=(await new Parts().load('phoenix',props)).cells;
 const flight=(await new Parts().load('phoenix',flights)).cells.map(p=>isolate(p,16,18));
 const back=(await new Parts().load('phoenix',rear)).cells.map(p=>isolate(p,16,18));
 const parts={body,wings:pieces.slice(0,2),leg:pieces[2],tail:pieces[3],egg:prop[0],feather:prop[1],flight:[null,flight.slice(0,2),flight.slice(2,4),back]};
 parts.cells=[body[0],pieces[0],pieces[3],prop[1]];
 for(const key of ['view','mix','cameraView','cameraMix']){parts[key]=document.createElement('canvas');parts[key].width=1536;parts[key].height=1536;}
 return parts;
}
