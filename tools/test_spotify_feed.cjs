// A short sound between paints must reach the instrument. Calibration must
// preserve subsequent builds, held sounds and arbitrarily long quiet passages.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const web=path.resolve('mini projects/spotify/web');
const World=require(path.join(web,'reactive.js')),Journey=require(path.join(web,'journey.js')),Feed=require(path.join(web,'music_feed.js'));
function instrument(){const w=new World({geometry:false}),j=new Journey();return {w,j,f:new Feed(w,j)};}
function signal(n,level=.2,band=.2){return {playing:true,title:'One track',artist:'Test',audio_revision:n,sample_time:100+n*.01,
 energy:level,loudness:level,bands:Array(48).fill(band),voice_levels:Array(8).fill(level*.3),waveform:Array(128).fill(0),beat:0,tonality:.7,width:.4};}
const a=instrument(),b=instrument(),legacy=instrument();
for(let n=1;n<=300;n++){
 const s=signal(n,.2,n===42?.75:.2);
 // Physical energy and display bars must describe the same 10-ms attack.
 // A bar-only change at constant register energy is a timbre change, not a kick.
 if(n===42){s.voice_levels[0]=.28;s.voice_levels[1]=.28;}
 a.f.accept(s,n*10);b.f.accept(s,n*10);
 // An unlucky 30-FPS latest-frame consumer never sees the 10-ms attack.
 if(n%3===1){legacy.w.step(s,.03);legacy.j.step(legacy.w,.03,s);}
}
assert(a.j.motion.counts[0]>0,'the between-paint attack reaches bass articulation');
assert.equal(legacy.j.motion.counts[0],0,'latest-only 30-FPS sampling misses the same attack');
assert.deepEqual(a.j.snapshot(),b.j.snapshot(),'drawing cadence does not advance musical state');
assert(a.f.status().generations===300);
const duplicate=a.f.status().seconds;a.f.accept(signal(300),5000);assert.equal(a.f.status().seconds,duplicate);
a.f.accept({...signal(301),sample_time:99},5010);assert.equal(a.f.status().seconds,duplicate,'stale capture clocks do not rewind state');
for(let n=301;n<=1000;n++)a.f.accept(signal(n),n*10);
const gain=a.f.gain;assert(a.f.status().calibrated);
let grow=0,release=0;
for(let n=1001;n<=1600;n++){
 const level=.2+(n-1001)/599*.45;a.f.accept(signal(n,level),n*10);grow=Math.max(grow,a.j.motion.pacing.swell);
}
const loud=a.j.motion.presenceVoices.slice(),strong=a.j.energy;
assert.equal(a.f.gain,gain,'a later build cannot lower the locked track gain');
for(let n=1601;n<=7600;n++){
 a.f.accept(signal(n,.04),n*10);release=Math.max(release,a.j.motion.pacing.release);
}
assert.equal(a.f.gain,gain,'a minute-long break cannot turn its gain back up');
assert(a.j.motion.presenceVoices.every((v,i)=>v<loud[i]*.20));
assert(a.j.energy<strong*.15&&a.j.active,'quiet music keeps a smaller, active instrument');
assert(grow>.15&&release>.25,'both the build and the release have visible gestures');
const seconds=a.f.status().seconds;a.f.accept({...signal(7601),playing:false},90000);assert.equal(a.f.status().seconds,seconds);
a.f.accept(signal(7602),90010);assert(a.f.status().seconds-seconds<.02,'resume does not replay paused time');
if(process.argv[2]){
 const rows=JSON.parse(fs.readFileSync(process.argv[2])),live=instrument();
 for(const s of rows)live.f.accept(s,s.observed*1000);
 assert(live.f.generations>1000&&live.j.active);assert(live.j.energy>.02);
 console.log(JSON.stringify({liveTrack:rows[0].title,feed:live.f.status(),counts:live.j.motion.counts,body:live.j.motion.body,presence:live.j.motion.pacing.presence}));
}
console.log(JSON.stringify({passed:true,captureClock:true,betweenPaintAttack:true,lockedGain:true,build:grow,release}));
