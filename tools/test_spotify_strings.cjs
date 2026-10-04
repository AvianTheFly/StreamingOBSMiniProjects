// Causal mechanics: a local frequency pull travels through space and excites
// adjacent strings. Fixed buffers and pinned ends keep work and motion bounded.
const assert=require('node:assert/strict');
const Strings=require('../mini projects/spotify/web/music_strings.js');
const m={voiceBalances:Array(8).fill(0),voiceTones:Array(8).fill(.5),flowPhases:Array(8).fill(0)};
function pluck(level){
 const s=new Strings(),bands=Array(48).fill(0),history=[];
 for(let k=18;k<24;k++)bands[k]=level;
 for(let i=0;i<240;i++){
  s.step(m,bands,1/120);
  history.push([26,35,44].map(n=>s.at(3,n/64)).concat([s.at(4,26/64),s.at(5,26/64)]));
 }return {s,history};
}
const {s,history}=pluck(.64),quiet=pluck(.16).history;
const first=column=>history.findIndex(row=>Math.abs(row[column])>.12)/120;
assert(first(0)===0,'the driven point must respond on the first physics frame');
assert(first(1)>.1&&first(2)>first(1)+.1,'crests must travel instead of the entire line pulsing simultaneously');
assert(first(3)>first(0),'neighbouring strings must respond after the driven string');
assert(history.some(row=>row[1]<-.4),'a crest must be followed by a signed trough');
assert(Math.max(...history.slice(200).flat().map(Math.abs))<.15,'unforced oscillation must settle');
assert(Math.abs(history[0][0]/quiet[0][0]-2)<.001,'bend magnitude must track frequency amplitude');
// The spatial derivative must remain continuous at interior grid boundaries.
const smooth=new Strings();for(let lane=0;lane<8;lane++)for(let i=0;i<65;i++)smooth.displacement[lane*65+i]=Math.sin(i*.45)*8;
for(let i=2;i<62;i++){
 const u=i/64,epsilon=1e-6,left=(smooth.at(3,u)-smooth.at(3,u-epsilon))/epsilon,right=(smooth.at(3,u+epsilon)-smooth.at(3,u))/epsilon;
 assert(Math.abs(left-right)<.05,'wave interpolation must not leave a corner at each simulation node');
}
const buffers=[s.displacement,s.velocity,s.acceleration,s.weights,s.targets,s.sources];
const began=performance.now();
for(let i=0;i<3600;i++){
 const bands=Array.from({length:48},(_,k)=>(.5+.5*Math.sin(i*.4+k)));
 m.flowPhases=m.flowPhases.map((v,k)=>v+(k+1)*.016);
 s.step(m,bands,i%50===0?.07:1/60);
 for(let lane=0;lane<8;lane++)for(const node of [0,64])assert.equal(s.displacement[lane*65+node],0);
 assert(s.displacement.every(v=>Number.isFinite(v)&&Math.abs(v)<=38));
 assert(s.velocity.every(v=>Number.isFinite(v)&&Math.abs(v)<=350));
}
[s.displacement,s.velocity,s.acceleration,s.weights,s.targets,s.sources].forEach((buffer,i)=>assert.equal(buffer,buffers[i]));
console.log(JSON.stringify({passed:true,arrivalSeconds:[0,1,2,3].map(first),amplitudeRatio:history[0][0]/quiet[0][0],physicsMs:(performance.now()-began)/3600,nodes:520}));
