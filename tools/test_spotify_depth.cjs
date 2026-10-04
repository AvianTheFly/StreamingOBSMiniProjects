// Musical memory, independent sustained voices and continuous spatial handoffs.
const assert=require('node:assert/strict');
const World=require('../mini projects/spotify/web/reactive.js');
const Journey=require('../mini projects/spotify/web/journey.js');
const Depth=require('../mini projects/spotify/web/stage_depth.js');
const w=new World({geometry:false}),j=new Journey();
const input={energy:.25,beat:0,bass:0,treble:.15,flux:0,width:0,tonality:.8,
 bands:Array(48).fill(0),waveform:Array(128).fill(0),voice_widths:Array(8).fill(0),voice_balances:Array(8).fill(0)};
input.bands[40]=.6;
function advance(frames){for(let i=0;i<frames;i++){w.step(input,1/60);j.step(w,1/60,input);}}
function capture(){const paths=[];Depth.render({stroke(points,colors,widths,alphas){
 assert(points.flat().every(Number.isFinite));assert(alphas.every(v=>v>=0&&v<=1));
 paths.push({points,colors,widths,alphas});}},w,j);return paths;}
advance(180);j.stage=9;j.transitioning=false;
const before=capture(),phase=j.motion.flowPhases.slice(),framing=j.space.depth;
// Hold scene evolution and palette fixed so they cannot conceal a missing
// frequency-specific response. Only the musical articulation/memory advances.
for(let i=0;i<180;i++){j.motion.step(input,1/60);j.space.step(j.motion,input,1/60);}
j.space.depth=framing; // Hold the phrase-wide room expansion for this isolation proof.
const after=capture();
assert.equal(j.motion.flowPhases[0],0);assert(j.motion.flowPhases[6]>phase[6]);
const changed=before.filter((path,i)=>path.points.some((p,k)=>p.some((v,n)=>Math.abs(v-after[i].points[k][n])>.01)));
assert.equal(changed.length,1,'one sustained upper voice moves its own spatial path, without phantom bass motion');
assert.equal(j.motion.counts[0],0,'this proof must not rely on a drum beat');
const old=j.space.at(6,1),oldFocus=j.space.focus;
input.bands.fill(0);input.bands[6]=.7;advance(12);
assert(j.space.at(6,1)>.1,'a note remains in musical memory after the arrangement changes');
assert(j.motion.voices[6]<old,'the live leading edge must release instead of waiting for the historical trail');
advance(600);assert(j.space.focus<oldFocus-.3,'register changes must shift the spatial focus');
assert.equal(j.space.count,j.space.capacity);assert.equal(j.space.levels.length,768);
const held=JSON.stringify(j.space.snapshot());j.space.step(j.motion,{energy:0},1/60);assert.equal(JSON.stringify(j.space.snapshot()),held);
// Endpoints must match the complete surrounding field, not fade to a separate show.
let worst=0;
for(let from=0;from<Journey.names.length;from++)for(let to=0;to<Journey.names.length;to++)if(from!==to){
 j.stage=from;j.next=to;j.transitioning=true;j.mix=0;const a=capture();
 j.transitioning=false;assert.deepEqual(capture(),a);
 j.transitioning=true;j.mix=1;const b=capture();j.stage=to;j.transitioning=false;assert.deepEqual(capture(),b);
 j.stage=from;j.transitioning=true;j.mix=.5;const middle=capture();j.mix=.5001;const next=capture();
 for(let p=0;p<middle.length;p++)for(let i=0;i<middle[p].points.length;i++)for(let k=0;k<3;k++)
  worst=Math.max(worst,Math.abs(middle[p].points[i][k]-next[p].points[i][k]));
}
assert(worst<.1,'the field must morph continuously with the sculpture');
const state=JSON.stringify(j.snapshot());capture();capture();assert.equal(JSON.stringify(j.snapshot()),state);
console.log(JSON.stringify({passed:true,sustainedUpperVoice:true,independentPaths:8,memorySeconds:4.8,
 samples:j.space.count,silenceHolds:true,spatialPairs:272,maximumMorphStep:worst,renderIsPure:true}));
