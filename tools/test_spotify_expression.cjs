// Phrase gestures and absolute register dynamics, plus optional full-file proof.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=process.env.SPOTIFY_WORKSPACE||path.resolve(__dirname,'..');
const Motion=require(path.join(root,'mini projects/spotify/web/music_motion.js'));
const World=require(path.join(root,'mini projects/spotify/web/reactive.js'));
const Journey=require(path.join(root,'mini projects/spotify/web/journey.js'));
const Stages=require(path.join(root,'mini projects/spotify/web/stage_geometry.js'));
const input={energy:.6,loudness:.5,bands:Array(48).fill(.3),roughness:.7,noisiness:.4,
 voice_levels:[.2,.1,.05,.2,.1,.05,.04,.02],tonality:.6,width:.2,beat:0,
 waveform:Array(128).fill(0)};
const m=new Motion();
for(let i=0;i<600;i++)m.step(input,1/60);
const loud=m.presenceVoices.slice(),pressure=m.mid,tension=m.pacing.tension;
assert(tension>.3,'held harsh timbre retains visual tension after its attack');
let release=0;
for(let i=0;i<600;i++){
 m.step({...input,loudness:.05,energy:.1,roughness:.05,noisiness:.02,voice_levels:input.voice_levels.map(v=>v*.1)},1/60);
 release=Math.max(release,m.pacing.release);
}
assert(release>.25,'falling phrase produces a controlled release gesture');
assert(m.presenceVoices.every((v,i)=>v<loud[i]*.25),'equal display bars cannot normalize away quieter absolute energy');
assert(m.mid<pressure*.25,'held structural pressure preserves the same quiet/loud contrast');
assert(m.pacing.roundness>.9&&m.pacing.tension<tension*.25,'soft held timbre has a rounded character at steady volume');
const levels=m.presenceVoices.slice();
for(let i=0;i<3600;i++)m.step({...input,loudness:.05,energy:.1,roughness:.05,noisiness:.02,voice_levels:input.voice_levels.map(v=>v*.1)},1/60);
assert(m.presenceVoices.every((v,i)=>Math.abs(v-levels[i])<1e-6),'a long quiet passage never turns its gain back up');
let fullSong;
if(process.argv[2]){
 const frames=JSON.parse(fs.readFileSync(process.argv[2])),w=new World({geometry:false}),j=new Journey(),timeline=[];
 let maximumJump=0,previous=.32;
 for(let i=0;i<frames.length;i++){
  w.step(frames[i],1/30);j.step(w,1/30,frames[i]);
  maximumJump=Math.max(maximumJump,Math.abs(j.motion.pacing.speed-previous));previous=j.motion.pacing.speed;
  if(i%30===0)timeline.push({seconds:i/30,energy:j.energy,voices:j.motion.presenceVoices.slice(),
   ...j.motion.pacing.snapshot(),evolution:{...j.evolution},stage:j.stage,transitioning:j.transitioning});
  if(i%150===0&&w.active)for(let stage=0;stage<17;stage++)Stages.render(stage,{line(a,b){assert(a.every(Number.isFinite)&&b.every(Number.isFinite));},face(p){assert(p.flat().every(Number.isFinite));}},w,j);
 }
 assert(frames.length>4800,'reference audit must cover the whole 163-second recording');
 const mean=(a,b,key)=>timeline.filter(f=>a<=f.seconds&&f.seconds<b).reduce((s,f)=>s+f[key]/(b-a),0);
 const ranges=[[46,55],[76,85],[120,130],[150,160]],sections=ranges.map(([a,b])=>({seconds:[a,b],
  ...Object.fromEntries(['energy','speed','tension','roundness','fullness'].map(k=>[k,mean(a,b,k)]))}));
 assert(sections[0].tension>sections[1].tension*1.4&&sections[2].tension>sections[3].tension*1.4,'both energetic passages retain stronger tension than their releases');
 assert(sections[0].speed>sections[1].speed*1.2&&sections[2].speed>sections[3].speed*1.2,'both releases slow without quiet-level gain compensation');
 assert(j.transitions>=1,'full-song audit includes actual family morphs');
 fullSong={seconds:frames.length/30,sections,maximumSpeedJump:maximumJump,transitions:j.transitions,timeline};
 if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(fullSong,null,2));
}
console.log(JSON.stringify({passed:true,absoluteRegisterContrast:true,longQuietGainStable:true,
 fullSong:fullSong?{...fullSong,timeline:undefined}:undefined}));
