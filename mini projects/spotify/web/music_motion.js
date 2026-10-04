/* Sound-to-motion articulation. Fast measured onsets stay separate from sustained
 * loudness. Released accents, sustained spectral voices, a bass spring and coupled
 * strings have distinct jobs; no rendering or I/O.
 */
(function(root){
 'use strict';
 const Pacing=typeof module!=='undefined'&&module.exports?require('./music_pacing.js'):root.MusicPacing;
 const Strings=typeof module!=='undefined'&&module.exports?require('./music_strings.js'):root.MusicStrings;
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:0));
 class MusicMotion{
  constructor(){
   this.floor=[0,0,0];this.attackFloor=[0,0,0];this.attackNoise=[.001,.001,.001];this.previous=[0,0,0];this.hold=[0,0,0];this.counts=[0,0,0];
   this.kick=0;this.snap=0;this.tick=0;this.previousBeat=0;this.ready=false;
   this.body=0;this.bass=0;this.mid=0;this.high=0;this.width=0;this.balance=0;
   this.spring=0;this.velocity=0;this.rebound=0;this.kickAge=10;this.peaks=Array(24).fill(0);
   this.voices=Array(8).fill(0);this.presenceVoices=Array(8).fill(0);this.absoluteVoices=false;
   this.details=Array(8).fill(0);this.previousVoices=Array(8).fill(0);this.forceBands=new Float32Array(48);
   this.tonal=.5;this.air=0;this.pitch=.4;
   this.flowPhases=Array(8).fill(0);this.voiceTones=Array(8).fill(.5);
   this.voiceWidths=Array(8).fill(0);this.voiceBalances=Array(8).fill(0);
   this.sustained=0;this.phraseBody=0;this.breath=0;this.strings=new Strings();this.pacing=new Pacing();
   this.roughness=0;this.grain=0;this.textureRate=70;this.texturePhase=0;
   this.sway=0;this.swayVelocity=0;
  }
  step(input,dt){
   if((input.energy||0)<.001)return;
   dt=clamp(dt,0,.07);const bands=input.bands||[];this.pacing.step(input,dt);
   const wasAbsolute=this.absoluteVoices;
   this.absoluteVoices=Array.isArray(input.voice_levels)&&input.voice_levels.length===8;
   if(wasAbsolute!==this.absoluteVoices)this.ready=false;
   if(this.rebound>0){this.velocity+=this.rebound*13;this.rebound=0;}
   const ranges=[[0,14],[14,32],[32,48]];
   // Display bars are logarithmic: they do not preserve the strength of an
   // attack. Production audio supplies fixed-gain register energy instead.
   // The body accent uses 40–178 Hz; changing vocals/low mids cannot resize it.
   const levels=this.absoluteVoices?[[0,2],[2,6],[6,8]].map(([a,b])=>Math.hypot(...input.voice_levels.slice(a,b))):
    ranges.map(([a,b])=>{let value=0;for(let i=a;i<b;i++)value+=clamp(bands[i]);return value/(b-a);});
   const beat=clamp(input.beat),energy=clamp(input.loudness??input.energy),accents=[0,0,0];
   if(!this.ready){this.floor=levels.slice();this.attackFloor=levels.slice();this.previous=levels.slice();this.previousBeat=beat;this.ready=true;}
   for(let k=0;k<3;k++){
    this.hold[k]=Math.max(0,this.hold[k]-dt);
    // An attack can span several capture packets. Compare it with a short
    // envelope as well as the last packet; detection must not depend on FPS.
    const rise=Math.max(0,levels[k]-this.previous[k],levels[k]-this.attackFloor[k]);
    const threshold=this.absoluteVoices?Math.max(.008,this.floor[k]*.20,this.attackNoise[k]*3.5):Math.max(.022,this.floor[k]*.14);
    const beatRise=!this.absoluteVoices&&k===0?Math.max(0,beat-this.previousBeat):0;
    const supportedBeat=beatRise>.12&&rise>.012&&levels[k]>this.floor[k]+.018;
    if(this.hold[k]===0&&energy>.012&&((rise>threshold&&levels[k]>(this.absoluteVoices ? .01 : .04))||supportedBeat)){
     const spectral=rise/Math.max(.045,this.floor[k]*.42);
     // Absolute attack force must retain dynamics. Dividing it by the local
     // average made a quiet kick nearly as large as a loud one after calibration.
     const force=this.absoluteVoices?Math.sqrt(rise)*3.2:Math.sqrt(Math.max(spectral,beatRise*2.4));
     const strength=clamp(force)*clamp(Math.sqrt(energy)*1.55);
     if(strength>(this.absoluteVoices ? .12 : .18)){accents[k]=strength;this.counts[k]++;this.hold[k]=(this.absoluteVoices?[.12,.10,.065]:[.19,.14,.11])[k];}
    }
    // Learn ordinary fluctuations, excluding detected attacks and their tail.
    // This changes the rejection threshold, never the signal gain or playback.
    if(this.absoluteVoices&&this.hold[k]===0){
     const noise=Math.min(Math.abs(levels[k]-this.attackFloor[k]),this.attackNoise[k]*3+.001);
     this.attackNoise[k]+=(noise-this.attackNoise[k])*(1-Math.exp(-dt*2));
    }
    this.floor[k]+=(levels[k]-this.floor[k])*(1-Math.exp(-dt*1.1));
    this.attackFloor[k]+=(levels[k]-this.attackFloor[k])*(1-Math.exp(-dt*25));this.previous[k]=levels[k];
   }
   this.previousBeat=beat;
   this.kick=Math.max(this.kick*Math.exp(-dt*7.5),accents[0]);
   this.snap=Math.max(this.snap*Math.exp(-dt*11),accents[1]);
   this.tick=Math.max(this.tick*Math.exp(-dt*19),accents[2]);
   this.kickAge+=dt;
   if(accents[0]>0){
    // The first frame compresses; the impulse then lifts a substantial mass.
    this.spring=-accents[0]*.10;this.velocity=0;this.rebound=accents[0];this.kickAge=0;
   }
   const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
   for(let i=0;i<steps;i++){
    this.velocity+=(-360*this.spring-19*this.velocity)*h;
    this.spring=clamp(this.spring+this.velocity*h,-.18,.65);
   }
   // Midrange articulation rocks the same mass in alternate directions.
   // It is a damped response to detected notes, not an independent dance loop.
   if(accents[1]>0)this.swayVelocity+=(this.counts[1]%2?1:-1)*accents[1]*1.8;
   for(let i=0;i<steps;i++){
    this.swayVelocity+=(-64*this.sway-7*this.swayVelocity)*h;
    this.sway=clamp(this.sway+this.swayVelocity*h,-.16,.16);
   }
   // Large structures follow musical presence; direct accents and current
   // voices keep their fast path. Small FFT fluctuations cannot jerk the body.
   const structural=this.absoluteVoices?[[0,3],[3,6],[6,8]].map(([a,b])=>
    Math.pow(clamp(Math.hypot(...input.voice_levels.slice(a,b))),.65)):levels.map(Math.sqrt);
   for(const [key,target,speed] of [['body',Math.sqrt(energy),16],['bass',structural[0],24],
    ['mid',structural[1],20],['high',structural[2],22],['width',clamp(input.width),8],['balance',clamp(input.balance,-1,1),10]])
    this[key]+=(target-this[key])*(1-Math.exp(-dt*(target>this[key]?speed:8)));
   for(let i=0;i<24;i++)this.peaks[i]=Math.max(this.peaks[i]*Math.exp(-dt*2.8),clamp(bands[i*2]));
   // Eight local voices retain spectral detail that a single bass envelope
   // cannot describe. Attacks release independently of sustained band energy.
   for(let i=0;i<8;i++){
    let level=0,weighted=0;
    for(let k=0;k<6;k++){const value=clamp(bands[i*6+k]);level+=value/6;weighted+=value*k/5;}
    const rise=Math.max(0,level-this.previousVoices[i]);this.previousVoices[i]=level;
    this.voices[i]+=(Math.sqrt(level)-this.voices[i])*(1-Math.exp(-dt*(Math.sqrt(level)>this.voices[i]?140:15)));
    const presence=this.absoluteVoices?Math.pow(clamp(input.voice_levels[i]),.65):this.voices[i];
    this.presenceVoices[i]+=(presence-this.presenceVoices[i])*(1-Math.exp(-dt*(presence>this.presenceVoices[i]?20:7)));
    this.details[i]=Math.max(this.details[i]*Math.exp(-dt*(8+i)),clamp((rise-.015)*5));
    const tone=level>.001?weighted/(level*6):this.voiceTones[i];
    this.voiceTones[i]+=(tone-this.voiceTones[i])*(1-Math.exp(-dt*32));
    this.voiceWidths[i]+=(clamp(input.voice_widths?.[i]??input.width)-this.voiceWidths[i])*(1-Math.exp(-dt*18));
    this.voiceBalances[i]+=(clamp(input.voice_balances?.[i]??input.balance,-1,1)-this.voiceBalances[i])*(1-Math.exp(-dt*24));
    // No beat, flux or transient enters this sustained-motion clock.
    this.flowPhases[i]+=dt*this.pacing.speed*(this.absoluteVoices?this.presenceVoices[i]:this.voices[i])*(.7+this.voiceTones[i]*2.7+i*.12);
   }
   for(let i=0;i<48;i++)this.forceBands[i]+=(clamp(bands[i])-this.forceBands[i])*(1-Math.exp(-dt*20));
   this.strings.step(this,this.forceBands,dt);
   for(const [key,target] of [['roughness',clamp(input.roughness)],['grain',clamp(input.noisiness??(1-(input.tonality??1)))]])
    this[key]+=(target-this[key])*(1-Math.exp(-dt*(target>this[key]?12:5)));
   const rate=clamp(input.texture_rate||70,20,160);
   this.textureRate+=(rate-this.textureRate)*(1-Math.exp(-dt*4));
   // The display cannot reproduce 20–160-Hz audio modulation directly. A
   // bounded visual carrier preserves its relative rate on fine geometry only.
   // Broadband hiss has no stable pair of beating partials. Keep its softer
   // grain moving too, rather than leaving a static corrugation after its hit.
   const textureDrive=clamp(this.roughness+this.grain*.35);
   this.texturePhase+=dt*Math.PI*2*clamp(this.textureRate/10,4,10)*textureDrive;
   this.sustained+=(Math.sqrt(energy)-this.sustained)*(1-Math.exp(-dt*3));
   this.phraseBody+=(this.sustained-this.phraseBody)*(1-Math.exp(-dt*.45));
   this.breath=clamp((this.sustained-this.phraseBody)*3,-1,1);
   for(const [key,target] of [['tonal',clamp(input.tonality??.5)],['air',clamp(input.flux)],['pitch',clamp(input.pitch??.4)]])
    this[key]+=(target-this[key])*(1-Math.exp(-dt*3));
  }
  snapshot(){return {kick:this.kick,snap:this.snap,tick:this.tick,spring:this.spring,velocity:this.velocity,
   body:this.body,bass:this.bass,mid:this.mid,high:this.high,width:this.width,balance:this.balance,
   counts:this.counts.slice(),attackNoise:this.attackNoise.slice(),kickAge:this.kickAge,rebound:this.rebound,peaks:this.peaks.slice(),
   voices:this.voices.slice(),presenceVoices:this.presenceVoices.slice(),details:this.details.slice(),tonal:this.tonal,air:this.air,pitch:this.pitch,
   flowPhases:this.flowPhases.slice(),voiceTones:this.voiceTones.slice(),voiceWidths:this.voiceWidths.slice(),
   voiceBalances:this.voiceBalances.slice(),sustained:this.sustained,phraseBody:this.phraseBody,breath:this.breath,
   roughness:this.roughness,grain:this.grain,textureRate:this.textureRate,texturePhase:this.texturePhase,sway:this.sway,swayVelocity:this.swayVelocity,
   strings:this.strings.snapshot(),pacing:this.pacing.snapshot()};}
 }
 root.MusicMotion=MusicMotion;if(typeof module!=='undefined'&&module.exports)module.exports=MusicMotion;
})(globalThis);
