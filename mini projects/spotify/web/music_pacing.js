/* Phrase-scale motion policy. Energy, spectral activity and relative dynamics
 * estimate visual intensity; this does not estimate BPM or classify emotions.
 * Fast musical articulation retains its real-time clock in MusicMotion. */
(function(root){
 'use strict';
 const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
 class Pacing{
  constructor(){
   this.previous=new Float32Array(48);this.ready=false;this.reference=0;
   this.presence=0;this.sustainedPresence=0;this.activity=0;this.fullness=0;this.brightness=0;
   this.intensity=0;this.speed=.32;this.targetSpeed=.32;
   this.tension=0;this.roundness=1;this.expanse=0;this.release=0;this.swell=0;
   this.phrasePresence=0;this.phraseFullness=0;
  }
  step(input,dt){
   dt=Math.max(0,Math.min(.07,dt));if(!dt||!(input.energy>.001))return;
   const energy=clamp(input.loudness??input.energy),bands=input.bands||[];
   let change=0,full=0,upper=0,total=0;
   for(let i=0;i<48;i++){
    const level=clamp(bands[i]);change+=Math.abs(level-this.previous[i])/48;
    this.previous[i]=level;total+=level;upper+=i>=24?level:0;
    full+=clamp((level-.18)/.55)/48;
   }
   if(Array.isArray(input.voice_levels)&&input.voice_levels.length===8)
    full=input.voice_levels.reduce((sum,v)=>sum+clamp((v-.012)/.20)/8,0);
   if(!this.ready){this.reference=energy;this.sustainedPresence=energy;this.phrasePresence=energy;this.phraseFullness=full;change=0;this.ready=true;}
   this.presence+=(energy-this.presence)*(1-Math.exp(-dt*2.5));
   // A separate phrase envelope sets resting size. Individual kick peaks keep
   // their immediate articulation instead of being smeared into a delayed zoom.
   this.sustainedPresence+=(energy-this.sustainedPresence)*(1-Math.exp(-dt*.8));
   this.activity+=(clamp(change/dt*.32)-this.activity)*(1-Math.exp(-dt*1.7));
   this.fullness+=(full-this.fullness)*(1-Math.exp(-dt*1.8));
   this.brightness+=(clamp(upper/Math.max(.01,total)*1.6)-this.brightness)*(1-Math.exp(-dt*1.5));
   // A long reference retains verse/chorus contrast even in mastered songs.
   const relative=clamp(.35+(this.presence-this.reference)/Math.max(.12,this.reference)*.8);
   this.reference+=(energy-this.reference)*(1-Math.exp(-dt/24));
   const target=clamp(this.presence*.38+this.activity*.30+this.fullness*.17+this.brightness*.05+relative*.10);
   this.intensity+=(target-this.intensity)*(1-Math.exp(-dt*(target>this.intensity?1.6:.75)));
   this.targetSpeed=.25+1.8*this.intensity*this.intensity;
   // Ease speed, not timestamps or onset envelopes: no added reaction latency.
   this.speed+=(this.targetSpeed-this.speed)*(1-Math.exp(-dt*2));
   // Context measures rising/falling phrases; it never divides signal levels
   // or increases gain during a quiet break. Timbre has its own lasting role.
   const direction=(this.presence-this.phrasePresence)*1.8+(this.fullness-this.phraseFullness)*.7;
   const rough=clamp(input.roughness||0),noise=clamp(input.noisiness??(1-(input.tonality??1)));
   const tension=clamp((rough*.55+noise*.25+this.activity*.20)*(.35+this.presence*.65));
   const targets={tension,roundness:clamp(1-tension*.8-this.activity*.2),
    expanse:clamp((input.width||0)*.65+(1-this.intensity)*.35),
    release:clamp(-direction),swell:clamp(direction)};
   for(const key of Object.keys(targets))this[key]+=(targets[key]-this[key])*(1-Math.exp(-dt*1.5));
   this.phrasePresence+=(this.presence-this.phrasePresence)*(1-Math.exp(-dt/6));
   this.phraseFullness+=(this.fullness-this.phraseFullness)*(1-Math.exp(-dt/6));
  }
  snapshot(){return {presence:this.presence,sustainedPresence:this.sustainedPresence,activity:this.activity,fullness:this.fullness,brightness:this.brightness,
   intensity:this.intensity,speed:this.speed,targetSpeed:this.targetSpeed,reference:this.reference,
   tension:this.tension,roundness:this.roundness,expanse:this.expanse,release:this.release,swell:this.swell};}
 }
 root.MusicPacing=Pacing;if(typeof module!=='undefined'&&module.exports)module.exports=Pacing;
})(globalThis);
