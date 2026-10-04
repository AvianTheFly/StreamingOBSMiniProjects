/* Presentation of the shared spectral mesh. Reads musical state without advancing it.
 * Patch normals, local traveling light and depth give the surface a glass/silk
 * material. Sorting is bounded to 128 patches; there are no retained canvas trails.
 */
(function(root){
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 function path(ctx,points){
  ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length-1;i++){
   const p=points[i],next=points[i+1];ctx.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);
  }
  const last=points[points.length-1];ctx.lineTo(last[0],last[1]);
 }
 function normal(a,b,c){
  const u=b.map((v,i)=>v-a[i]),v=c.map((value,i)=>value-a[i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)||1;
  return n.map(value=>value/length);
 }
 function paint(ctx,world){
  if(!world.active)return;
  const energy=Math.sqrt(world.f.energy),hue=world.hue,style=world.style;
  const particleWeight=clamp(.18+style[2]*.6+(1-world.f.tonality)*Math.sqrt(world.f.treble)*.5);
  const patches=[];
  for(let row=0;row<world.strands.length-1;row++){
   const level=Math.sqrt(world.levels[row]*world.levels[row+1])**.65*energy;
   if(level<.008)continue;
   const a=world.strands[row],b=world.strands[row+1];
   for(let segment=0;segment<16;segment++){
    const start=segment*8,end=start+8,u=(start+4)/128;
    const light=(world.lightAt(row,u)+world.lightAt(row+1,u))*.5;
    const n=normal(a[start],a[end],b[start]);
    // Light direction travels with the measured lane, rather than the viewport.
    const phase=world.lightPhase[row]*Math.PI*2;
    const facing=Math.abs(n[0]*Math.cos(phase)*.38+n[1]*Math.sin(phase)*.38+n[2]*.84);
    const fresnel=(1-Math.abs(n[2]))**2;
    const specular=facing**10*light;
    patches.push({row,a,b,start,end,level,light,facing,fresnel,specular,depth:(a[start][2]+a[end][2]+b[start][2]+b[end][2])/4});
   }
  }
  // Back faces render first, so crossing folds read as layered material.
  patches.sort((a,b)=>b.depth-a.depth);
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation='source-over';
  for(const p of patches){
   const {a,b,start,end,light,level,row}=p;
   const alpha=clamp(level*style[1]*(.10+light*.40+p.fresnel*.18)*(1+world.f.width*.25),0,.58);
   const g=ctx.createLinearGradient(a[start][0],a[start][1],b[end][0]+.001,b[end][1]+.001);
   const patchHue=hue-38+row*7;
   g.addColorStop(0,`hsla(${patchHue-15},83%,${33+p.facing*25+light*12}%,${alpha*.75})`);
   g.addColorStop(.5,`hsla(${patchHue+light*22},91%,${50+light*20+p.specular*20}%,${alpha})`);
   g.addColorStop(1,`hsla(${patchHue+30},86%,${36+p.facing*18}%,${alpha*.65})`);
   ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(a[start][0],a[start][1]);
   for(let i=start+1;i<=end;i++)ctx.lineTo(a[i][0],a[i][1]);
   for(let i=end;i>=start;i--)ctx.lineTo(b[i][0],b[i][1]);ctx.closePath();ctx.fill();
   if(p.specular>.08){
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=`hsla(${patchHue+28},65%,88%,${level*p.specular*.48})`;
    ctx.lineWidth=.6;path(ctx,a.slice(start,end+1));ctx.stroke();ctx.restore();
   }
  }
  ctx.globalCompositeOperation='lighter';
  for(let row=0;row<world.strands.length;row++){
   const level=world.levels[row]**.4,attack=world.attacks[row];if(level<.025)continue;
   const points=world.strands[row],laneHue=hue-54+row*7;
   for(let segment=0;segment<16;segment++){
    const start=segment*8,end=start+8,u=(start+4)/128,light=world.lightAt(row,u);
    const depth=clamp(.80-points[start][2]/110,.35,1),alpha=clamp(level*(.14+light*1.45)+attack*light*.25)*style[0]*depth;
    ctx.strokeStyle=`hsla(${laneHue+light*32},90%,${55+light*30}%,${alpha})`;
    const line=points.slice(start,end+1);
    ctx.globalAlpha=1;ctx.lineWidth=.65+light*.65+attack*.25;path(ctx,line);ctx.stroke();
   }
  }
  for(const p of world.particles){
   const level=Math.sqrt(world.levels[p.row]),light=world.lightAt(p.row,p.u);
   const strength=clamp(level*particleWeight*(.23+light*.9)+world.attacks[p.row]*particleWeight*.2);
   if(strength<.035)continue;
   const color=hue-50+p.row*7+light*35;
   ctx.strokeStyle=`hsla(${color},90%,73%,${strength*.45})`;ctx.lineWidth=.55;
   path(ctx,p.trail);ctx.stroke();ctx.fillStyle=`hsla(${color},94%,${65+light*24}%,${strength})`;
   ctx.beginPath();ctx.arc(p.x,p.y,.45+strength*1.2,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
 }
 root.ReactiveSurface={paint};
 if(typeof module!=='undefined'&&module.exports)module.exports={paint};
})(globalThis);
