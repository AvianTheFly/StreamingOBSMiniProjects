const assert=require('node:assert/strict');
const Motion=require('../mini projects/spotify/web/music_motion.js');
const World=require('../mini projects/spotify/web/reactive.js');
const Journey=require('../mini projects/spotify/web/journey.js');
const Stages=require('../mini projects/spotify/web/stage_geometry.js');
const baseline={energy:.24,beat:0,width:.1,balance:0,bands:Array(48).fill(.04)};
function primed(){const m=new Motion();for(let i=0;i<60;i++)m.step(baseline,1/30);return m;}
for(let group=0;group<3;group++){
 const m=primed(),ranges=[[0,14],[14,32],[32,48]],bands=baseline.bands.slice();
 for(let i=ranges[group][0];i<ranges[group][1];i++)bands[i]=.8;
 m.step({...baseline,bands,beat:group===0?.8:0},1/30);
 const accents=[m.kick,m.snap,m.tick];assert(accents[group]>.7,'isolated transients must have a decisive response');
 accents.forEach((value,i)=>{if(i!==group)assert.equal(value,0,'separate frequency roles must not all flash together');});
 assert.deepEqual(m.counts,ranges.map((_,i)=>i===group?1:0));
}
const lean=primed();lean.step({...baseline,bands:baseline.bands.map((v,i)=>i>=14&&i<32?.8:v)},1/100);
let tilt=0;for(let i=0;i<30;i++){lean.step(baseline,1/100);tilt=Math.max(tilt,Math.abs(lean.sway));}
assert(tilt>.08&&tilt<.16,'midrange notes produce a visible, bounded physical lean');
for(let i=0;i<200;i++)lean.step(baseline,1/100);assert(Math.abs(lean.sway)<.001,'lean settles instead of becoming an unrelated dance loop');
const steady=primed();assert.deepEqual(steady.counts,[0,0,0],'sustained sound does not repeatedly invent hits');
for(let voice=0;voice<8;voice++){
 const m=primed(),bands=baseline.bands.slice();
 for(let i=voice*6;i<voice*6+6;i++)bands[i]=.8;
 m.step({...baseline,bands},1/30);
 assert(m.details[voice]>.8,'local spectral attack must reach its own articulation');
 m.details.forEach((value,i)=>{if(i!==voice)assert(value<.01,'local attacks must not animate unrelated voices');});
 const detail=m.details[voice];for(let i=0;i<30;i++)m.step({...baseline,bands},1/30);
 assert(m.details[voice]<detail*.01,'sustained local sound must release its accent');
 assert(m.voices[voice]>.8,'released accents must retain sustained spectral depth');
}
const mass=primed();mass.step({...baseline,bands:baseline.bands.map((v,i)=>i<14?.8:v),beat:.8},1/30);
assert(mass.spring<-.04,'a kick first compresses its mass');
let peak=mass.spring;
for(let i=0;i<30;i++){mass.step(baseline,1/30);peak=Math.max(peak,mass.spring);}
assert(peak>.2,'the rebound must be substantial');assert(Math.abs(mass.spring)<.015,'the spring settles before subsequent phrases');
assert(mass.kick<.001,'the accent releases, rather than leaving permanent emphasis');
const held=JSON.stringify(mass);for(let i=0;i<300;i++)mass.step({energy:0},1/30);
assert.equal(JSON.stringify(mass),held,'silence holds motion without decoration');
const stereo=primed();for(let i=0;i<60;i++)stereo.step({...baseline,width:.9,balance:-.7},1/30);
assert(stereo.width>.85&&stereo.balance<-.65,'stereo width and direction remain separate');
const w=new World({geometry:false}),j=new Journey();
for(let i=0;i<90;i++){w.step({...baseline,bass:.15,treble:.1,waveform:Array(128).fill(0)},1/30);j.step(w,1/30,baseline);}
const changes=[];
for(let stage=0;stage<Journey.names.length;stage++){
 function positions(spring){
  j.motion.spring=spring;j.motion.kickAge=.08;const points=[];
  Stages.render(stage,{line(a,b){points.push(a[0],a[1],b[0],b[1]);},face(){}},w,j);return points;
 }
 const resting=positions(0),rebound=positions(.35);
 assert.equal(resting.length,rebound.length);
 const rms=Math.sqrt(resting.reduce((sum,v,i)=>sum+(v-rebound[i])**2,0)/resting.length);
 assert(rms>1.25,'every scene must visibly carry low-frequency mass: '+stage);changes.push(+rms.toFixed(2));
}
console.log(JSON.stringify({passed:true,compressionAndRebound:true,peakSpring:+peak.toFixed(3),independentFrequencyAccents:true,sceneMassRms:changes}));
