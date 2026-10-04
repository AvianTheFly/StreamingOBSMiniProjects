// Geometry transport, endpoint identity, live music and bounded correspondence.
const assert=require('node:assert/strict');
const World=require('../mini projects/spotify/web/reactive.js');
const Journey=require('../mini projects/spotify/web/journey.js');
const Stages=require('../mini projects/spotify/web/stage_geometry.js');
const Morph=require('../mini projects/spotify/web/stage_morph.js');
const Palette=require('../mini projects/spotify/web/stage_palette.js');
const w=new World({geometry:false}),j=new Journey();
const signal={energy:.4,bass:.2,treble:.12,beat:0,flux:.1,width:.55,tonality:.7,pitch:.3,
 bands:Array.from({length:48},(_,i)=>.04+.25*Math.sin(i*.23)**2),waveform:Array.from({length:128},(_,i)=>Math.sin(i*.18)*.35)};
for(let i=0;i<90;i++){w.step(signal,1/30);j.step(w,1/30,signal);}
function geometry(render){
 const points=[],alpha=[],colors=[],probes=[];let vertices=0,strokes=0;
 function trace(p){
  const lengths=[0];for(let i=1;i<p.length;i++)lengths.push(lengths[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));
  let index=1;for(let sample=0;sample<=8;sample++){
   const target=lengths.at(-1)*sample/8;while(index<p.length-1&&lengths[index]<target)index++;
   const q=(target-lengths[index-1])/Math.max(1e-9,lengths[index]-lengths[index-1]);
   for(let k=0;k<2;k++)probes.push(p[index-1][k]+(p[index][k]-p[index-1][k])*q);
  }
 }
 const sink={stroke(p,c,width,a){trace(p);p.forEach(v=>points.push(v[0],v[1]));colors.push(...c.flat());alpha.push(...a);vertices+=(p.length-1)*6;strokes++;},
  line(a,b,c,width,opacity){trace([a,b]);points.push(a[0],a[1],b[0],b[1]);colors.push(...c);alpha.push(opacity);vertices+=6;},
  face(p,c,opacity){p.forEach(v=>points.push(v[0],v[1]));colors.push(...c);alpha.push(opacity);vertices+=(p.length-2)*3;}};
 render(sink);assert(points.every(Number.isFinite));assert(alpha.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
 assert(colors.every(v=>v>=0&&v<=1));return {points,alpha,colors,probes,vertices,strokes};
}
let maxVertices=0,maxStep=0,minResponse=Infinity;
for(let from=0;from<Journey.names.length;from++)for(let to=0;to<Journey.names.length;to++)if(from!==to){
 j.stage=from;j.next=to;j.transitioning=true;j.mix=0;
 const entry=geometry(s=>Morph.render(s,w,j));j.transitioning=false;
 assert.deepEqual(entry,geometry(s=>Morph.render(s,w,j)),'entry is the exact resting source presentation');
 j.transitioning=true;j.mix=1;const exit=geometry(s=>Morph.render(s,w,j));j.stage=to;j.transitioning=false;
 assert.deepEqual(exit,geometry(s=>Morph.render(s,w,j)),'exit is the exact resting destination presentation');
 j.stage=from;j.transitioning=true;
 j.mix=.5;j.motion.spring=0;const state=JSON.stringify([w.snapshot(),j.snapshot()]);
 const a=geometry(s=>Morph.render(s,w,j));assert.deepEqual(geometry(s=>Morph.render(s,w,j)),a,'repainting is deterministic');
 assert.equal(JSON.stringify([w.snapshot(),j.snapshot()]),state,'painting cannot advance sound or palette');
 maxVertices=Math.max(maxVertices,a.vertices);assert(a.vertices<120000,'all scene pairs fit the fixed GPU buffer');
 j.mix=.5002;const b=geometry(s=>Morph.render(s,w,j));assert.equal(a.points.length,b.points.length);
 const step=Math.sqrt(a.points.reduce((s,v,i)=>s+(v-b.points[i])**2,0)/a.points.length);maxStep=Math.max(maxStep,step);
 assert(step<.2,'small progress changes must move geometry continuously');
 j.mix=.5;j.motion.spring=.3;const hit=geometry(s=>Morph.render(s,w,j));
 // Bass can move interior structures without changing the outermost point of
 // a second scene. Compare samples along each live contour, independent of its
 // changing arc-knot count, rather than relying on the union bounding box.
 assert.equal(a.probes.length,hit.probes.length,'bass must preserve contour identity');
 const response=Math.sqrt(a.probes.reduce((sum,v,i)=>sum+(v-hit.probes[i])**2,0)/a.probes.length);
 minResponse=Math.min(minResponse,response);assert(response>.3,`bass must remain visible during morph ${from} -> ${to}: ${response}`);
}
assert.equal(Morph.planCount(),Journey.names.length*(Journey.names.length-1),'at most one correspondence per directed scene pair');
const before=Palette.color(0,.4,j);for(let i=0;i<30*20;i++){w.step(signal,1/30);j.step(w,1/30,signal);}
const after=Palette.color(0,.4,j);assert(before.some((v,i)=>Math.abs(v-after[i])>.12),'sustained audio must evolve the palette');
const phase=j.palettePhase;w.step({energy:0},1/30);j.step(w,1/30);assert.equal(j.palettePhase,phase,'silence holds the color score');
console.log(JSON.stringify({passed:true,pairs:Journey.names.length*(Journey.names.length-1),maxVertices,maxStep,minResponse,paletteEvolution:true}));
