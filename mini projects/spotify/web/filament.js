/* Signed-waveform perimeter, stabilized by the simulation's correlation alignment.
 * The perimeter and center share the same measured features and musical history.
 */
(function(root){
 'use strict';
 const TAU=Math.PI*2;
 function sample(values,t){const p=((t%1)+1)%1*values.length,i=Math.floor(p);return values[i]*(1-(p-i))+values[(i+1)%values.length]*(p-i);}
 function path(ctx,points,closed=false){
  ctx.beginPath();
  if(closed){
   const first=points[0],last=points.at(-1);ctx.moveTo((first[0]+last[0])/2,(first[1]+last[1])/2);
   points.forEach((p,i)=>{const next=points[(i+1)%points.length];ctx.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);});ctx.closePath();
  }else points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
 }
 function geometry(world){
  const f=world.f,bass=Math.sqrt(f.bass),treble=Math.sqrt(f.treble),energy=Math.sqrt(f.energy),points=[];
  for(let i=0;i<256;i++){
   const u=i/256,a=u*TAU;
   const wave=(sample(world.wave,u-.008)+2*sample(world.wave,u)+sample(world.wave,u+.008))*.25;
   const spectral=(sample(world.bands,u)-.18)*energy*12;
   const bend=Math.sin(a*3+world.phase[0])*bass*10+Math.cos(a*5-world.phase[2])*treble*6+wave*energy*15+spectral+f.beat*6;
   const radius=88+4*Math.tanh(bend/23);
   points.push([Math.cos(a)*radius,Math.sin(a)*radius]);
  }
  return points;
 }
 function clip(ctx,points){path(ctx,points,true);ctx.clip();}
 function paint(ctx,world,points){
  if(!world.active)return;
  const f=world.f,energy=Math.sqrt(f.energy),hue=world.hue;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineJoin='round';ctx.strokeStyle=`hsl(${hue+24},88%,70%)`;
  ctx.globalAlpha=.13+energy*.28;ctx.lineWidth=.8+f.beat*.3;path(ctx,points,true);ctx.stroke();
  // No missing wrap segment: the final highlight joins the first vertex.
  for(let segment=0;segment<32;segment++){
   const u=(segment+.5)/32,light=world.lightAt(segment%9,u);
   const lane=Math.sqrt(world.levels[segment%9]);
   ctx.strokeStyle=`hsla(${hue+light*40},92%,${64+light*23}%,${energy*light*lane*.65})`;
   ctx.globalAlpha=1;ctx.lineWidth=.65+light*.55;
   path(ctx,Array.from({length:9},(_,j)=>points[(segment*8+j)%points.length]));ctx.stroke();
  }
  ctx.restore();
 }
 root.ReactiveFilament={geometry,clip,paint};
 if(typeof module!=='undefined'&&module.exports)module.exports={geometry,clip,paint};
})(globalThis);
