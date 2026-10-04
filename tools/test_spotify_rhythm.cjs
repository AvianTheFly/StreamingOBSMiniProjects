// Whole-body size must have an identifiable audio cause: low-register attacks
// arrive immediately, sustained presence acts slowly, and orbit cannot zoom.
const assert=require('node:assert/strict'),fs=require('node:fs');
const Motion=require('../mini projects/spotify/web/music_motion.js');
const World=require('../mini projects/spotify/web/reactive.js');
const Journey=require('../mini projects/spotify/web/journey.js');
const Feed=require('../mini projects/spotify/web/music_feed.js');
const Depth=require('../mini projects/spotify/web/stage_depth.js');
const Palette=require('../mini projects/spotify/web/stage_palette.js');
require('../mini projects/spotify/web/stage_renderer.js');
const size=VisualStageRenderer.bodyScale;
const steady={energy:.25,loudness:.2,width:.5,beat:0,voice_levels:Array(8).fill(.05),bands:Array(48).fill(.2)};
const m=new Motion();let lo=Infinity,hi=0;
for(let i=0;i<1200;i++){
 m.step({...steady,beat:i%13===0?.9:0,bands:steady.bands.map((v,k)=>v+.15*Math.sin(i*.2+k))},.01);
 lo=Math.min(lo,size(m));hi=Math.max(hi,size(m));
}
assert.equal(m.counts[0],0,'display-bar/timbre changes at steady physical bass energy cannot invent body pulses');
assert(hi-lo<1e-10,'a held physical input cannot resize the body on a separate animation clock');
for(let i=0;i<100;i++)m.step({...steady,voice_levels:steady.voice_levels.map((v,k)=>k>=2&&k<6?.2:v)},.01);
assert.equal(m.counts[0],0,'low-mid/vocal notes cannot be misidentified as the body bass accent');
assert(m.counts[1]>0,'those notes retain their own midrange articulation');
const base=size(m);m.kick=.8;m.spring=-.08;
assert(size(m)>base+.065,'the first detected attack expands the figure instead of shrinking it');
for(const yaw of [-.72,0,.72])for(const tilt of [-.46,0,.46]){
 const lens=Depth.camera({space:{yaw,tilt,roll:.18}}).lens;
 assert.equal(lens.framing,.475);assert.equal(lens.focal,500,'changing view angles cannot produce unrelated zoom');
}
const luminance=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
const quiet={motion:{pacing:{intensity:.5,swell:0,release:.6}}},build={motion:{pacing:{intensity:.5,swell:.6,release:0}}};
assert(luminance(Palette.color(6,1,build))>luminance(Palette.color(6,1,quiet)),'phrase lift brightens the authored accent without changing its harmony');
let pcm;
if(process.argv[2]){
 const fixture=JSON.parse(fs.readFileSync(process.argv[2]));
 const w=new World({geometry:false}),j=new Journey(),feed=new Feed(w,j),hits=[],timeline=[];let count=0;
 for(const frame of fixture.frames){
  feed.accept(frame,frame.sample_time*1000);timeline.push({time:frame.sample_time,size:size(j.motion)});
  if(j.motion.counts[0]!==count){hits.push({time:frame.sample_time,strength:j.motion.kick});count=j.motion.counts[0];}
 }
 assert.equal(hits.length,fixture.events.length,'all known beats and no additional bass events');
 const delays=fixture.events.map(event=>{
  const hit=hits.find(h=>h.time>=event&&h.time<event+.08);assert(hit,'known PCM onset must be detected within 80 ms');
  const window=timeline.filter(p=>p.time>=event&&p.time<event+.10),peak=window.reduce((a,b)=>b.size>a.size?b:a);
  assert(peak.time-event<.04,'the body size crest must remain at the actual attack, rather than a late spring rebound');
  return hit.time-event;
 });
 const mean=(a,b)=>hits.filter(h=>h.time>=a&&h.time<b).reduce((s,h)=>s+h.strength,0)/hits.filter(h=>h.time>=a&&h.time<b).length;
 const strong=mean(4,8),soft=mean(8,12);assert(soft<strong*.75,'calibration must not flatten quieter kicks into full-strength accents');
 pcm={beats:hits.length,maximumOnsetDelayMs:Math.max(...delays)*1000,quietToStrong:soft/strong,gain:feed.gain};
}
console.log(JSON.stringify({passed:true,noPhantomZoom:true,noTimbreBassPulses:true,immediateSizeAccent:true,pcm}));
