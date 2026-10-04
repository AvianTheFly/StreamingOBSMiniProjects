/* Capture-clock presentation input. No I/O, timers, queues or drawing.
 * Every received generation advances the instrument, even between OBS paints.
 * Track calibration is peak-held, bounded, and never rises in a quiet passage.
 */
(function(root){
 'use strict';
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:0));
 class Feed{
  constructor(world,journey){
   this.world=world;this.journey=journey;this.key='';this.revision=null;this.clock=null;
   this.anchor=.30;this.gain=2.2;this.calibrationAge=0;this.generations=0;this.skipped=0;this.seconds=0;
  }
  accept(input,receivedAt){
   if(!input.playing){this.clock=null;this.revision=null;return false;}
   const key=(input.title||'')+'|'+(input.artist||'');
   if(key!==this.key){this.key=key;this.anchor=.30;this.gain=2.2;this.calibrationAge=0;this.world.changeTrack(key);}
   const revision=Number.isSafeInteger(input.audio_revision)?input.audio_revision:null;
   if(revision!==null&&revision===this.revision)return false;
   // sample_time belongs to the capture clock. Only differences are used;
   // browser and Python clock origins need not agree. Arrival is the fallback.
   const clock=Number.isFinite(input.sample_time)?input.sample_time:receivedAt/1000;
   const elapsed=this.clock===null?1/100:clock-this.clock;
   if(elapsed<=0)return false;
   const dt=clamp(elapsed,.001,.07);
   if(revision!==null&&this.revision!==null&&revision>this.revision)
    this.skipped+=Math.max(0,revision-this.revision-1);
   this.clock=clock;this.revision=revision;
   // Six audible seconds establish a held input reference, then it locks for
   // the track. No gain chasing a build, a break, or a held noise. Max +6.85 dB.
   const level=clamp(input.loudness??input.energy);
   if(level>.006&&this.calibrationAge<6){
    this.anchor=Math.max(this.anchor,level);this.gain=clamp(.66/this.anchor,1,2.2);
    this.calibrationAge+=dt;
   }
   const calibrated={...input,loudness:clamp(level*this.gain),
    voice_levels:input.voice_levels?.map(v=>clamp(v*this.gain)),
    waveform:input.waveform?.map(v=>clamp(v*this.gain,-1,1))};
   this.world.step(calibrated,dt);this.journey.step(this.world,dt,calibrated);
   this.generations++;this.seconds+=dt;return true;
  }
  status(){return {generations:this.generations,skipped:this.skipped,seconds:this.seconds,gain:this.gain,anchor:this.anchor,calibrated:this.calibrationAge>=6};}
 }
 root.MusicFeed=Feed;if(typeof module!=='undefined'&&module.exports)module.exports=Feed;
})(globalThis);
