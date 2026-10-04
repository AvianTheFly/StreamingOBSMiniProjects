const assert=require('node:assert/strict'),fs=require('node:fs');
const Pacing=require('../mini projects/spotify/web/music_pacing.js');
const Motion=require('../mini projects/spotify/web/music_motion.js');
const Stages=require('../mini projects/spotify/web/stage_geometry.js');
const World=require('../mini projects/spotify/web/reactive.js'),Journey=require('../mini projects/spotify/web/journey.js');
// Both passages have an identical 120-BPM pulse. Arrangement activity changes.
function signal(t,hype,equalEnergy=false){
 const beat=Math.exp(-((t% .5)/.03));
 return {energy:equalEnergy?.65:hype?.85:.22,beat,bass:hype?.4:.15,treble:hype?.3:.025,width:hype?.7:.2,tonality:.6,flux:0,
 bands:Array.from({length:48},(_,k)=>hype?.28+.42*(.5+.5*Math.sin(t*13+k*.5)):.04+.12*Math.exp(-(((k-12)/7)**2))*(1+beat*.25)),waveform:Array(128).fill(0)};
}
function passage(hype,equalEnergy=false){const p=new Pacing();for(let i=0;i<600;i++)p.step(signal(i/60,hype,equalEnergy),1/60);return p;}
const calm=passage(false),hype=passage(true),sparse=passage(false,true),busy=passage(true,true);
assert(hype.speed>calm.speed*2.3,'same-BPM chorus must travel substantially faster than the relaxed verse');
assert(busy.speed>sparse.speed*1.35,'activity and arrangement must matter even at equal loudness and BPM');
const rates=[30,60].map(fps=>{const p=new Pacing();for(let i=0;i<fps*10;i++)p.step(signal(i/fps,true),1/fps);return p.speed;});
assert(Math.abs(rates[0]-rates[1])<.03,'OBS and browser frame rates must preserve musical pacing');
const timeline=new Pacing(),samples=[];let maxJump=0,previous=timeline.speed;
for(let i=0;i<2400;i++){
 const t=i/60;timeline.step(signal(t,t>=10&&t<25),1/60);
 maxJump=Math.max(maxJump,Math.abs(timeline.speed-previous));previous=timeline.speed;
 if(i%60===0)samples.push({seconds:t,...timeline.snapshot()});
}
assert(maxJump<.025,'phrase pacing must ease without speed jumps on individual beats');
assert(samples[20].speed>samples[8].speed*2);assert(samples[38].speed<samples[20].speed*.6,'breakdowns must return to slower motion');
const before=JSON.stringify(timeline.snapshot());timeline.step({energy:0},1/60);assert.equal(JSON.stringify(timeline.snapshot()),before);
const w=new World({geometry:false}),j=new Journey();let maxDeformation=0,minJacobian=Infinity;
// Dense loud input, changing pitches, stereo extremes and repeated impulses.
for(let i=0;i<1800;i++){
 const input=signal(i/30,true);input.bands=input.bands.map((v,k)=>v*(.55+.45*Math.sin(i*.4+k)**2));
 input.balance=Math.sin(i*.1);w.step(input,1/30);j.step(w,1/30,input);
 if(i%30!==0)continue;
 for(let stage=0;stage<17;stage++)for(let y=-80;y<=80;y+=20)for(let x=-150;x<=150;x+=30){
  const p=[x,y,0],q=Stages.deform(p,j.motion,stage),limit=Stages.bendLimits[stage];
  assert(Math.abs(q[1]-y)<=limit+1e-6&&Math.abs(q[0]-x)<=limit*.18+1e-6,'each scene must obey its silhouette budget');
  maxDeformation=Math.max(maxDeformation,Math.hypot(q[0]-x,q[1]-y));
  const epsilon=.02,a=Stages.deform([x+epsilon,y,0],j.motion,stage),b=Stages.deform([x,y+epsilon,0],j.motion,stage);
  const determinant=((a[0]-q[0])*(b[1]-q[1])-(a[1]-q[1])*(b[0]-q[0]))/(epsilon*epsilon);
  minJacobian=Math.min(minJacobian,determinant);
 }
}
assert(minJacobian>.15,'the local music warp must not fold the drawing inside out under dense input');
const motionBefore=JSON.stringify(j.snapshot());Stages.deform([0,0],j.motion,13);assert.equal(JSON.stringify(j.snapshot()),motionBefore);
const report={passed:true,bpm:120,calmSpeed:calm.speed,hypeSpeed:hype.speed,equalLoudnessSpeeds:[sparse.speed,busy.speed],maxSpeedJump:maxJump,frameRateSpeeds:rates,minJacobian,maxDeformation,samples};
if(process.env.SPOTIFY_PACING_REPORT)fs.writeFileSync(process.env.SPOTIFY_PACING_REPORT,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,samples:undefined}));
