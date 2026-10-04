// No beat, onset, palette travel, camera travel or slow scene evolution is
// allowed to hide a missing sustained-note response in any composition.
const assert=require('node:assert/strict');
const World=require('../mini projects/spotify/web/reactive.js');
const Journey=require('../mini projects/spotify/web/journey.js');
const Stages=require('../mini projects/spotify/web/stage_geometry.js');
const input={energy:.32,bass:.2,treble:.1,beat:0,flux:0,width:.65,tonality:.8,
 bands:Array.from({length:48},(_,i)=>.03+.28*Math.sin(i*.31)**4),waveform:Array(128).fill(0)};
const w=new World({geometry:false}),j=new Journey();
for(let i=0;i<240;i++){w.step(input,1/30);j.step(w,1/30,input);}
function quietAccents(){Object.assign(j.motion,{kick:0,snap:0,tick:0,spring:0,velocity:0,rebound:0});j.motion.details.fill(0);}
function points(stage){const groups=[];let id=0;
 Stages.render(stage,{stroke(p,c,width,a,key){groups.push({key:String(key??id++),p});},line(){},face(){}},w,j);
 groups.sort((a,b)=>a.key.localeCompare(b.key));return groups.flatMap(p=>p.p.map(v=>v.slice(0,2)));
}
quietAccents();const old=Journey.names.map((_,stage)=>points(stage));
// Only the sustained articulation owner advances. World, journey, old global
// animation clocks, slow forms and wave samples stay exactly frozen.
// A relaxed passage now evolves over phrase time instead of a beat-speed clock.
for(let i=0;i<120;i++)j.motion.step(input,1/30);
quietAccents();
const shapeChanges=[];
const rms=Journey.names.map((name,stage)=>{
 const a=old[stage],b=points(stage);assert.equal(a.length,b.length);
 const value=Math.sqrt(a.reduce((sum,p,i)=>sum+(p[0]-b[i][0])**2+(p[1]-b[i][1])**2,0)/a.length);
 assert(value>Stages.bendLimits[stage]*.12,`${name} must visibly move during a sustained note: ${value}`);
 // Remove the best translation/rotation/uniform-scale fit. The response must
 // change the internal form, not merely drift the whole drawing around.
 const mean=p=>p.reduce((sum,v)=>[sum[0]+v[0]/p.length,sum[1]+v[1]/p.length],[0,0]);
 const ac=mean(a),bc=mean(b);let dot=0,cross=0,norm=0;
 for(let i=0;i<a.length;i++){const x=a[i][0]-ac[0],y=a[i][1]-ac[1],u=b[i][0]-bc[0],v=b[i][1]-bc[1];dot+=x*u+y*v;cross+=x*v-y*u;norm+=x*x+y*y;}
 const c=dot/norm,s=cross/norm;
 const shape=Math.sqrt(a.reduce((sum,p,i)=>{const x=p[0]-ac[0],y=p[1]-ac[1];return sum+(c*x-s*y+bc[0]-b[i][0])**2+(s*x+c*y+bc[1]-b[i][1])**2;},0)/a.length);
 assert(shape>Stages.bendLimits[stage]*.05,`${name} must reshape internally under sustained sound: ${shape}`);shapeChanges.push(+shape.toFixed(2));
 return +value.toFixed(2);
});
const phase=j.motion.flowPhases.slice();j.motion.step({energy:0},1/30);assert.deepEqual(j.motion.flowPhases,phase);
// An isolated upper voice must travel without generating a phantom bass clock.
const high=new Journey().motion,signal={...input,bands:Array(48).fill(0)};signal.bands[40]=.6;
for(let i=0;i<150;i++)high.step(signal,1/30);
assert(high.flowPhases[6]>.1);assert.equal(high.flowPhases[0],0);assert.equal(high.flowPhases[1],0);
const lowTone=new Journey().motion,highTone=new Journey().motion;
const lowSignal={...input,bands:Array(48).fill(0)},highSignal={...input,bands:Array(48).fill(0)};
lowSignal.bands[24]=highSignal.bands[29]=.6;
for(let i=0;i<120;i++){lowTone.step(lowSignal,1/30);highTone.step(highSignal,1/30);}
assert(highTone.flowPhases[4]>lowTone.flowPhases[4]*1.8,'pitch distribution must matter even at identical loudness and no beat');
const state=JSON.stringify([w.snapshot(),j.snapshot()]);points(13);points(13);assert.equal(JSON.stringify([w.snapshot(),j.snapshot()]),state);
console.log(JSON.stringify({passed:true,scenes:rms.length,sustainedShapeRms:rms,internalShapeRms:shapeChanges,beatResponseDisabled:true,otherAnimationClocksFrozen:true,silenceHolds:true}));
