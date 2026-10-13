/* Sustained phrase and transient gestures. Capture-clock state only; no timers,
 * particles, source classification or gain adaptation. */
(function(root){
 'use strict';
 const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
 class Articulation{
  constructor(){this.lead=0;this.pitch=.5;this.phase=0;this.air=0;this.airPhase=0;this.attack=0;this.age=10;this.hold=0;this.previous=0;this.serial=0;}
  step(input,dt){
   const level=clamp(input.lead_level),air=clamp(input.air_level),hit=clamp(input.attack_level);
   const smooth=(old,target,speed)=>old+(target-old)*(1-Math.exp(-dt*speed));
   this.lead=smooth(this.lead,Math.pow(level,.65),level>this.lead?18:7);
   if(level>.003)this.pitch=smooth(this.pitch,clamp(input.lead_pitch),14);
   this.air=smooth(this.air,Math.pow(air,.65),16);
   this.airPhase+=dt*this.air*4;
   this.phase+=dt*this.lead*(.8+this.pitch*2.4);
   this.age+=dt;this.hold=Math.max(0,this.hold-dt);this.attack*=Math.exp(-dt*10);
   // Rising novelty triggers one released gesture. A held noisy texture cannot
   // repeatedly restart a burst just because it contains high frequencies.
   if(this.hold===0&&hit>.014&&hit>this.previous*1.3+.008){
    this.attack=clamp(Math.sqrt(hit)*2.2);this.age=0;this.hold=.09;this.serial++;
   }
   this.previous=smooth(this.previous,hit,25);
  }
  snapshot(){return {lead:this.lead,pitch:this.pitch,phase:this.phase,air:this.air,airPhase:this.airPhase,attack:this.attack,age:this.age,serial:this.serial};}
 }
 root.MusicArticulation=Articulation;if(typeof module!=='undefined'&&module.exports)module.exports=Articulation;
})(globalThis);
