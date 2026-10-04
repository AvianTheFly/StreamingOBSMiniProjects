// Spatial rails must stay in their authored depth while they contract, and
// physical grain coordinates must stay fixed when only the camera turns.
const assert=require('node:assert/strict');
const World=require('../mini projects/spotify/web/reactive.js');
const Journey=require('../mini projects/spotify/web/journey.js');
const Morph=require('../mini projects/spotify/web/stage_morph.js');
const Depth=require('../mini projects/spotify/web/stage_depth.js');
const w=new World({geometry:false}),j=new Journey();
const signal={energy:.4,bass:.2,treble:.12,width:.5,bands:Array(48).fill(.2),waveform:Array(128).fill(0)};
for(let i=0;i<90;i++){w.step(signal,1/30);j.step(w,1/30,signal);}
let rails=0,maximumDepthError=0;
for(const [from,to] of [[0,1],[1,0]])for(const progress of [.0001,.35,.8,.9999]){
 j.stage=from;j.next=to;j.transitioning=true;j.mix=progress;
 const a=Morph.capture(from,w,j),b=Morph.capture(to,w,j);
 assert.equal(Math.min(a.line.length,b.line.length),0);
 const source=a.line.length?a.line:b.line,q=a.line.length?1-j.blend:j.blend;
 const actual=[];
 Morph.render({face(){},line(){throw Error('Expected continuous stroke sink');},
  stroke(points){if(points.length===2)actual.push(points);}},w,j);
 assert.equal(actual.length,source.length);
 source.forEach((rail,i)=>{
  const center=[0,1,2].map(k=>rail.points.reduce((sum,p)=>sum+(p[k]||0)/rail.points.length,0));
  rail.points.forEach((p,n)=>{
   for(let k=0;k<3;k++){
    const expected=center[k]+((p[k]||0)-center[k])*q,error=Math.abs(actual[i][n][k]-expected);
    if(k===2)maximumDepthError=Math.max(maximumDepthError,error);
    assert(error<1e-8,'unmatched rails must contract in XYZ, including both morph directions');
   }
  });rails++;
 });
}
let maximumModelError=0,maximumGrainPhaseError=0,maximumInteriorError=0;
for(const yaw of [-.72,0,.72])for(const tilt of [-.46,0,.46])for(const roll of [-.18,0,.18]){
 const view=Depth.camera({space:{yaw,tilt,roll}}),lens=view.lens;
 for(const p of [[100,30,0],[-70,40,60],[20,-55,-30]]){
  const posed=view(p),scale=(lens.focal+posed[2])/lens.focal/lens.framing;
  const cameraPoint=[posed[0]*scale,posed[1]*scale,posed[2]-lens.pivot];
  const model=[0,1,2].map(k=>cameraPoint.reduce((sum,v,n)=>sum+v*lens.basis[n*3+k],0)+(k===2?lens.pivot:0));
  const expected=[p[0]*(280+p[2])/280,p[1]*(280+p[2])/280,p[2]];
  maximumModelError=Math.max(maximumModelError,...model.map((v,k)=>Math.abs(v-expected[k])));
  maximumGrainPhaseError=Math.max(maximumGrainPhaseError,Math.abs(model[0]*.7+model[1]*.18-(expected[0]*.7+expected[1]*.18)));
 }
 // The visible canvas uses pre-projected vertices with clip W=1. Texture
 // coordinates therefore need their own rational perspective interpolation;
 // matching only the three corners would still allow grain to swim inside.
 const triangle=[[100,30,0],[-70,40,60],[20,-55,-30]],weights=[.2,.3,.5];
 const perspective=triangle.map(p=>(lens.focal+view(p)[2])/lens.focal);
 const denominator=weights.reduce((sum,b,i)=>sum+b*perspective[i],0);
 const screenWeights=weights.map((b,i)=>b*perspective[i]/denominator);
 const models=triangle.map(p=>[p[0]*(280+p[2])/280,p[1]*(280+p[2])/280]);
 const h=screenWeights.reduce((sum,a,i)=>sum+a/perspective[i],0);
 for(let k=0;k<2;k++){
  const interpolated=screenWeights.reduce((sum,a,i)=>sum+a*models[i][k]/perspective[i],0)/h;
  const expected=weights.reduce((sum,b,i)=>sum+b*models[i][k],0);
  maximumInteriorError=Math.max(maximumInteriorError,Math.abs(interpolated-expected));
 }
}
assert(maximumModelError<1e-8&&maximumGrainPhaseError<1e-8&&maximumInteriorError<1e-8,'view rotation must not slide physical grain');
console.log(JSON.stringify({passed:true,rails,maximumDepthError,maximumModelError,maximumGrainPhaseError,maximumInteriorError}));
