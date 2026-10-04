const assert=require('node:assert/strict'),fs=require('node:fs');
const Motion=require('../mini projects/spotify/web/music_motion.js');
const Stages=require('../mini projects/spotify/web/stage_geometry.js');
const base={energy:.7,loudness:.5,beat:0,roughness:.65,noisiness:.35,texture_rate:90,
 tonality:.65,bands:Array(48).fill(.3)};
const held=new Motion();
for(let i=0;i<1200;i++)held.step({...base,bands:base.bands.map((v,k)=>v+.007*Math.sin(i*.7+k))},1/60);
assert.deepEqual(held.counts,[0,0,0],'small spectral jitter must not invent hits');
assert(held.roughness>.64&&held.texturePhase>100,'held grit must keep its texture after the onset ends');
assert(held.presenceVoices.every(v=>v>.5),'sustained frequency voices must remain present');
const texture=held.texturePhase;
for(let i=0;i<480;i++)held.step({...base,loudness:.12,energy:.3,roughness:0,noisiness:.03,bands:base.bands.map(v=>v*.3)},1/60);
assert(held.body<.36&&held.body>.3,'quiet passages retain visibly smaller presence');
assert(held.roughness<1e-8,'clean release must shed grit');
assert(held.texturePhase-texture<20,'texture stops advancing after the release tail');
assert(held.voices.some(v=>v>.2),'light music remains articulated');
const hiss=new Motion(),clean=new Motion();
for(let i=0;i<600;i++){
 hiss.step({...base,roughness:0,noisiness:.8},1/100);
 clean.step({...base,roughness:0,noisiness:0},1/100);
}
assert.deepEqual(hiss.counts,[0,0,0],'held broadband noise cannot manufacture rhythmic accents');
assert(hiss.texturePhase>50,'noise without beating partials retains moving grain');
assert.equal(clean.texturePhase,0,'a clean held tone cannot invent gritty vibration');
const hissPhase=hiss.texturePhase;hiss.step({energy:0},1/100);
assert.equal(hiss.texturePhase,hissPhase,'silent texture cannot run an unrelated clock');
const fast=new Motion();fast.step({...base,bands:Array(48).fill(.01)},1/100);
fast.step({...base,bands:Array(48).fill(.9)},1/100);
assert(fast.voices[4]>.7&&fast.presenceVoices[4]<fast.voices[4]*.5,'direct attacks and structural presence have independent time scales');
const grit=new Motion();for(let i=0;i<240;i++)grit.step({...base,loudness:1,roughness:1,noisiness:1},1/60);
for(let stage=0;stage<17;stage++){
 let displacement=0;
 for(let x=-150;x<=150;x+=15)for(let y=-80;y<=80;y+=20){
  grit.texturePhase=0;const a=Stages.deform([x,y,0],grit,stage);
  grit.texturePhase=Math.PI;const b=Stages.deform([x,y,0],grit,stage);
  displacement+=Math.abs(a[1]-b[1]);
  assert(Math.abs(a[1]-y)<=Stages.bendLimits[stage],'maximum grit stays inside the existing silhouette budget');
 }
 assert(displacement>20,'held texture must articulate every scene without drum impulses');
}
let passages;
if(process.argv[2]){
 const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),m=new Motion(),measure=[];
 for(let i=0;i<data.length;i++){m.step(data[i],1/30);measure.push({...m.snapshot(),time:i/30});}
 passages=[[46,55],[76,85]].map(([a,b])=>{
  const s=measure.filter(v=>v.time>=a&&v.time<b),keys=['roughness','grain','body'];
  return {seconds:[a,b],...Object.fromEntries(keys.map(k=>[k,s.reduce((v,f)=>v+f[k]/s.length,0)])),
   speed:s.reduce((v,f)=>v+f.pacing.speed/s.length,0),
   textureTravel:s.at(-1).texturePhase-s[0].texturePhase};
 });
 assert(passages[0].roughness>passages[1].roughness*1.4,'actual sustained passage retains stronger grit');
 assert(passages[0].body>passages[1].body*1.12,'actual break keeps smaller body presence');
 assert(passages[0].speed>passages[1].speed*1.15,'actual break slows while music remains visible');
}
console.log(JSON.stringify({passed:true,heldTexture:true,jitterHits:0,passages}));
