const assert=require('node:assert/strict');
const World=require('../mini projects/spotify/web/reactive.js');
const Filament=require('../mini projects/spotify/web/filament.js');
function music(t,kind='rhythm'){
 const hit=kind==='rhythm'?(t%.48<.10?1:0):.18;
 return {energy:.55,bass:.1+hit*.2,treble:.12,beat:hit*.7,pitch:.25+.12*Math.sin(t*.25),tonality:.7,width:.3,
  bands:Array.from({length:48},(_,i)=>.03+.14*Math.sin(t*.7+i*.5)**2+(i<12?hit*.55:hit*.14*Math.sin(i)**2)),
  waveform:Array.from({length:128},(_,i)=>.55*Math.sin(i*.18+t*3)+hit*.18*Math.sin(i*.62))};
}
function run(world,seconds,kind='rhythm'){for(let i=0;i<seconds*30;i++)world.step(music(i/30,kind),1/30);}
function unequal(a,b,message){assert(JSON.stringify(a)!==JSON.stringify(b),message);}
{
 // The rim must share the center's stabilized signed waveform. Identical sound
 // arriving in differently phased capture windows must not make it flicker.
 const steady=new World(),shifted=new World();
 const wave=Array.from({length:128},(_,i)=>Math.sin(i*Math.PI*6/128)*.55);
 for(let frame=0;frame<90;frame++){
  const input={...music(0),waveform:wave};steady.step(input,1/30);
  const offset=frame===0?0:(frame*6)%128;
  shifted.step({...input,waveform:wave.map((_,i)=>wave[(i+offset)%128])},1/30);
 }
 const a=Filament.geometry(steady),b=Filament.geometry(shifted);
 const error=Math.max(...a.map((p,i)=>Math.hypot(p[0]-b[i][0],p[1]-b[i][1])));
 assert(error<1e-6,'capture phase must not jitter the stabilized perimeter');
 const held=steady.snapshot();Filament.geometry(steady);
 assert.deepEqual(steady.snapshot(),held,'presentation reads musical state without advancing it');
}
function residual(a,b){
 const center=p=>[p.reduce((s,v)=>s+v[0],0)/p.length,p.reduce((s,v)=>s+v[1],0)/p.length];
 const ca=center(a),cb=center(b);let dot=0,cross=0,norm=0;
 for(let i=0;i<a.length;i++){
  const x=a[i][0]-ca[0],y=a[i][1]-ca[1],xx=b[i][0]-cb[0],yy=b[i][1]-cb[1];
  dot+=x*xx+y*yy;cross+=x*yy-y*xx;norm+=x*x+y*y;
 }
 const real=dot/norm,imag=cross/norm;
 return Math.sqrt(a.reduce((sum,p,i)=>{const x=p[0]-ca[0],y=p[1]-ca[1];return sum+(real*x-imag*y+cb[0]-b[i][0])**2+(imag*x+real*y+cb[1]-b[i][1])**2;},0)/a.length);
}
{
 const w=new World(),initial=w.snapshot();for(let i=0;i<60;i++)w.step({energy:0},1/30);
 assert.deepEqual(w.snapshot(),initial);run(w,2);const before=w.snapshot();
 for(let i=0;i<60;i++)w.step({energy:0},1/30);
 assert.deepEqual(w.snapshot(),before,'silence cannot advect lights/particles or morph');assert.equal(w.active,false);
}
{
 const beat=new World(),pad=new World();run(beat,12);run(pad,12,'pad');
 assert(beat.onsets>pad.onsets*2);unequal(beat.strands,pad.strands,'equal loudness with different rhythm must dance differently');
 unequal(beat.snapshot().particles,pad.snapshot().particles,'particle flow must carry musical history');
}
{
 const w=new World(),quiet={energy:.4,bass:0,treble:0,bands:Array(48).fill(0),waveform:Array(128).fill(0)};
 for(let i=0;i<10;i++)w.step(quiet,1/30);
 w.step({...quiet,bands:quiet.bands.map((v,i)=>i>=32&&i<37?.8:0)},1/30);
 assert(w.attacks[6]>.5);assert.equal(w.attacks[1],0,'unrelated lanes cannot receive the same attack');
}
{
 const input={energy:.5,bass:.3,treble:.25,beat:0,pitch:.4,tonality:.7,width:.3,bands:Array(48).fill(.3),waveform:Array.from({length:128},(_,i)=>Math.sin(i*.18)*.5)};
 const peak=w=>Array.from({length:128},(_,i)=>w.lightAt(3,i/128)).reduce((best,value,i,all)=>value>all[best]?i:best,0);
 const w=new World();for(let i=0;i<30;i++)w.step(input,1/30);
 const before=w.strands.flat().filter((_,i)=>i%13===0).map(p=>p.slice()),p0=peak(w);
 for(let i=0;i<90;i++)w.step(input,1/30);
 const after=w.strands.flat().filter((_,i)=>i%13===0),error=residual(before,after);
 assert(error>2,'motion must deform individual regions, beyond any translation/rotation/pulsation');
 const shift=Math.min(Math.abs(peak(w)-p0),128-Math.abs(peak(w)-p0));
 assert(shift>15,'brightest surface region must travel at constant loudness');
 assert.equal(w.stage,24,'a form must explore itself rather than rotate presets rapidly');
 console.log('Nonrigid motion RMS / moving light:',error.toFixed(2),shift,'samples');
}
{
 for(let mode=0;mode<World.names.length;mode++){
  const a=new World(),b=new World(),input={energy:.5,bass:.3,treble:.4,bands:Array(48).fill(.3)};
  a.stage=b.stage=mode;
  for(let i=0;i<30;i++){
   a.step({...input,waveform:Array(128).fill(0)},1/30);
   b.step({...input,waveform:Array.from({length:128},(_,j)=>Math.sin(j*.17)*.7)},1/30);
  }
  unequal(a.strands,b.strands,`${World.names[mode]} must respond to waveform detail`);
 }
}
{
 const a=new World(),b=new World(),input=music(0);
 for(let i=0;i<60;i++){a.step({...input,pitch:.1,width:0,tonality:.95},1/30);b.step({...input,pitch:.8,width:.8,tonality:.2},1/30);}
 unequal(a.strands,b.strands,'pitch, stereo space and texture must alter the surface');
 unequal(a.snapshot().particles,b.snapshot().particles,'stereo/texture must change particle spread');
}
{
 // Verify natural musical residence and variable progression independently of
 // renderer frame cost; no forced form changes or accelerated scheduler.
 const quiet=new World(),active=new World();let minimum=Infinity;
 for(let i=0;i<4000*20;i++){
  const t=i/20;
  for(const [w,busy] of [[quiet,false],[active,true]]){
   Object.assign(w.f,{energy:.55,mid:.15,flux:busy?.12:0,centroid:busy?.4+.2*Math.sin(t*.07):.4,pitch:busy?.3+.25*Math.sin(t*.05):.3,width:busy?.3:0});
   const transitioning=w.transitioning;w.advancePhrase(.05);
   if(!transitioning&&w.transitioning)minimum=Math.min(minimum,w.residence);
  }
 }
 assert(minimum>=28,'a new form needs meaningful exploration before a morph');
 assert(active.transitions>quiet.transitions*1.4,'musical changes must affect residence, rather than fixed preset timing');
 assert(active.visits.every(Boolean),'a long evolving musical journey can explore all instruments');
 console.log('Natural journey transitions:',{steady:quiet.transitions,changing:active.transitions,minimumResidence:minimum});
}
{
 const w=new World();run(w,120);
 assert.equal(w.strands.length,9);assert.equal(w.particles.length,144);
 assert(w.strands.every(p=>p.length===129));assert(w.strands.flat(2).every(Number.isFinite));
 assert(w.particles.every(p=>p.trail.length<=5&&Number.isFinite(p.x)));
 assert.equal(w.performance.history.length,8,'motion memory has a fixed capacity');
 assert(w.performance.history.every(mesh=>mesh.length===9&&mesh.every(line=>line.length===33)));
 assert(w.performance.beats>0&&w.performance.presence>0,'measured music must excite phrasing envelopes');
 const identities=w.particles.slice(),positions=w.particles.map(p=>[p.x,p.y]);
 w.transitioning=true;w.morph=.99999;w.next=7;w.step(music(120),1/30);
 assert.equal(w.stage,7);assert.equal(w.blend,0);
 assert(w.particles.every((p,i)=>p===identities[i]&&Math.hypot(p.x-positions[i][0],p.y-positions[i][1])<8),'morph boundary must preserve particle identity and motion');
 w.stage=4;w.next=7;w.morph=1;w.updateGeometry(0);
 const targets=w.targets.map(p=>p.map(v=>v.slice())),style=w.style,hue=w.hue;
 w.stage=7;w.next=3;w.morph=0;w.updateGeometry(0);
 assert.deepEqual(w.targets,targets,'incoming and outgoing surfaces must exactly share the morph endpoint');
 assert.deepEqual(w.style,style);assert(Math.abs(w.hue-hue)<1e-8);
 const held=w.snapshot();w.changeTrack('New title');assert.deepEqual(w.snapshot(),held);
}
console.log('PASS: traveling light, nonrigid dance, local attacks, audio dimensions, natural residence, persistent particles and seamless morphs');

// Closed instruments must not expose the non-periodic FFT/waveform window seam.
for(const mode of require('../mini projects/spotify/web/forms.js').closed){
 const loop=new World();loop.stage=mode;loop.next=mode;
 loop.step({energy:.7,bass:.5,treble:.3,pitch:.37,tonality:.7,width:.4,bands:Array.from({length:48},(_,i)=>i/48),waveform:Array.from({length:128},(_,i)=>i/64-1)},1/30);
 for(const strand of loop.strands)for(let d=0;d<3;d++)assert(Math.abs(strand[0][d]-strand[128][d])<1e-8,'closed form '+mode+' must meet without a cut');
}
console.log('PASS: closed-form audio seams');
