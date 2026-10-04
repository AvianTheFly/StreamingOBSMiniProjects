// Reusable atlas/rig mechanics. Animal proportions and acting belong in rigs/.
import {clamp} from './math.js';
import {atlases} from './rigs/atlases.js';
import {SpriteMesh} from './mesh.js';
export class Parts {
 async load(id,override=null){
  const atlas=override||atlases[id];this.image=new Image();this.image.src=override?.file?`./assets/${override.file}`:`./assets/${id}-rig-${id==='turtle'?'v8':'v5'}.png`;await this.image.decode();
  this.cells=atlas.regions.map((region,i)=>{
   const canvas=document.createElement('canvas');canvas.width=this.image.width;canvas.height=this.image.height;
   const c=canvas.getContext('2d',{willReadFrequently:true}),scale=canvas.width/atlas.width;
   c.save();c.beginPath();region.forEach(([x,y],n)=>n?c.lineTo(x*scale,y*scale):c.moveTo(x*scale,y*scale));c.closePath();c.clip();c.drawImage(this.image,0,0);c.restore();
   const data=c.getImageData(0,0,canvas.width,canvas.height).data,w=canvas.width,h=canvas.height;
   let x0=w,y0=h,x1=0,y1=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>20){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
   if(x1<=x0||y1<=y0)throw Error(`${id}: missing rig part ${i}`);
   const part=document.createElement('canvas');part.width=x1-x0+1;part.height=y1-y0+1;
   part.getContext('2d').drawImage(canvas,x0,y0,part.width,part.height,0,0,part.width,part.height);
   return {image:part,w:part.width,h:part.height,mesh:new SpriteMesh().fromImage(part,8,10)};
  });return this;
 }
 draw(c,i,x,y,w,h,angle=0,ax=.5,ay=.5,mirror=false){
  const p=this.cells[i];c.save();c.translate(x,y);c.rotate(angle);if(mirror)c.scale(-1,1);
  c.drawImage(p.image,-w*ax,-h*ay,w,h);c.restore();
 }
 flow(c,i,x,y,w,h,{angle=0,ax=.5,ay=.5,bend=0,ripple=0,phase=0}={}){
  c.save();c.translate(x,y);c.rotate(angle);
  this.cells[i].mesh.draw(c,(u,v)=>[(u-ax)*w+Math.sin(v*Math.PI)*bend+Math.sin(v*5-phase)*ripple*v,(v-ay)*h]);
  c.restore();
 }
 // Keep the painted limb continuous while bending its centreline. Reach is
 // bounded and the elbow's overlap can vary independently of the paw target.
 limb(c,i,root,target,upper,lower,bend=1,width=50,front=false){
  const dx=target[0]-root[0],dy=target[1]-root[1],raw=Math.hypot(dx,dy);
  const length=clamp(raw,Math.abs(upper-lower)+.01,upper+lower);
  const ux=dx/(raw||1),uy=dy/(raw||1),bow=bend*Math.sqrt(Math.max(0,(upper+lower)**2-length**2))*.32;
  // Bend the painted limb along a quadratic centreline. Root and paw stay
  // attached while the elbow trails the action; no rigid paddle rotation.
  this.cells[i].mesh.draw(c,(u,v)=>{
   const arc=4*v*(1-v)*bow,ax=ux*length-uy*4*(1-2*v)*bow,ay=uy*length+ux*4*(1-2*v)*bow;
   const n=Math.hypot(ax,ay)||1,lateral=(u-.5)*width;
   return [root[0]+ux*length*v-uy*arc-ay/n*lateral,root[1]+uy*length*v+ux*arc+ax/n*lateral];
  },{from:typeof front==='number'?front:(front ? .3 : 0)});
  return [root[0]+ux*length,root[1]+uy*length];
 }

}
export function shadow(c,x,ground,width,height,alpha=.24){
 c.save();c.globalAlpha=alpha;c.translate(x,ground);c.scale(1,height/width);const g=c.createRadialGradient(0,0,0,0,0,width);
 g.addColorStop(0,'#061017bb');g.addColorStop(1,'#06101700');c.fillStyle=g;c.fillRect(-width,-width,width*2,width*2);c.restore();
}

export function contact(c,t,x,y,color){
 if(t<0||t>.35)return;const fade=1-t/.35;c.save();c.globalAlpha=fade*.55;c.fillStyle=color;
 for(let i=0;i<12;i++){const a=i*2.399;c.beginPath();c.ellipse(x+Math.cos(a)*t*150,y-Math.abs(Math.sin(a))*t*65+t*t*100,3+fade*3,1+fade*2,a,0,Math.PI*2);c.fill();}c.restore();
}
