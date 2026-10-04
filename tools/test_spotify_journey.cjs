// Scene-level behavior, independent of presentation and live services.
const assert=require('node:assert/strict');
const World=require('../mini projects/spotify/web/reactive.js');
const Journey=require('../mini projects/spotify/web/journey.js');
const Stages=require('../mini projects/spotify/web/stage_geometry.js');
function signal(t,quiet=false){
 const hit=t%.5<.10?1:0;
 return {energy:quiet?.08:.65,bass:quiet?.035:.15+hit*.5,treble:quiet?.02:.18,beat:quiet?0:hit,
  flux:quiet?.01:hit*.5,pitch:.3+.15*Math.sin(t*.19),width:quiet?.1:.65,tonality:quiet?.95:.45,
  bands:Array.from({length:48},(_,i)=>quiet?.03+.03*Math.sin(i+t*.2)**2:.08+.45*Math.sin(i*.4+t*.3)**4+hit*.2),
  waveform:Array.from({length:128},(_,i)=>Math.sin(i*.3+t)*.5)};
}
const visits=[];
for(const quiet of [false,true]){
 const w=new World({geometry:false}),j=new Journey();let previous=0,lastChange=0;
 for(let i=0;i<Journey.names.length*150*30;i++){
  w.step(signal(i/30,quiet),1/30);j.step(w,1/30);
  if(j.stage!==previous){assert(i/30-lastChange>45,'no rapid preset cycling');lastChange=i/30;previous=j.stage;}
  assert(j.history.length<=48);assert(j.recent.length<=3);assert(Number.isFinite(j.travel));
 }
 assert(j.visits.every(v=>v>0),'sustained music must explore every visual family');
 assert(j.transitions>=Journey.names.length,'the show must not get stuck on a single form');
 const before=JSON.stringify(j);w.step({energy:0},1/30);for(let i=0;i<90;i++)j.step(w,1/30);
 const held=JSON.parse(before);held.active=false;assert.deepEqual(JSON.parse(JSON.stringify(j)),held,'silence holds the whole journey');
 visits.push({quiet,visits:j.visits,transitions:j.transitions});
}
const w=new World({geometry:false}),j=new Journey();
for(let i=0;i<180;i++){w.step(signal(i/30),1/30);j.step(w,1/30);}
const signatures=[],motion=[];
for(let stage=0;stage<Journey.names.length;stage++){
 function geometry(lamp){
  const lines=[],faces=[];j.lamp=lamp;
  Stages.render(stage,{line(a,b,c,width,alpha){lines.push([...a.slice(0,2),...b.slice(0,2),alpha]);},face(p){faces.push(p.length);}},w,j);
  assert(lines.length>30&&lines.length<12000);
  assert(lines.flat().every(Number.isFinite));return {lines,faces};
 }
 const a=geometry(0),b=geometry(2.8);
 const fixed=a.lines.filter((p,i)=>p.slice(0,4).every((v,k)=>v===b.lines[i][k])).length;
 assert(fixed/a.lines.length>.98,'light-only check holds paths; orbit beacons may travel');
 const change=a.lines.reduce((s,p,i)=>s+Math.abs(p[4]-b.lines[i][4]),0)/a.lines.length;
 assert(change>.025,'highlights must travel in scene '+stage);
 signatures.push(a.lines.length+':'+a.faces.length);motion.push(+change.toFixed(3));
 const state=JSON.stringify([w.snapshot(),j.snapshot()]);geometry(j.lamp);
 assert.equal(JSON.stringify([w.snapshot(),j.snapshot()]),state,'rendering does not advance music');
}
assert(new Set(signatures).size===Journey.names.length,'the catalog needs distinct geometry, not renamed versions of one mesh');
console.log(JSON.stringify({passed:true,journeys:visits,lightMotion:motion,geometrySignatures:signatures}));
