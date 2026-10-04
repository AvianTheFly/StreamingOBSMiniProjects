/* Bounded musical envelopes and sampled motion memory. This simulation advances
 * only for audible frames; presentation may read it any number of times.
 */
(function(root){
 'use strict';
 class Performance{
  constructor(){
   this.presence=0;this.impact=0;this.lift=0;this.beats=0;
   this.previous=0;this.refractory=0;this.history=[];this.sampleCharge=0;
  }
  step(world,dt){
   const f=world.f;
   const target=Math.min(1,Math.sqrt(f.energy)*(.5+Math.sqrt(f.bass)*.38+f.flux*.2));
   this.presence+=(target-this.presence)*(1-Math.exp(-dt*(target>this.presence?.75:.35)));
   this.lift+=(f.treble-f.bass-this.lift)*(1-Math.exp(-dt*.65));
   this.refractory=Math.max(0,this.refractory-dt);
   const hit=Math.max(f.beat,world.attacks[0]*.85,world.attacks[1]*.7);
   const rise=hit-this.previous;this.previous=hit;
   this.impact*=Math.exp(-dt*4.8);
   if(this.refractory===0&&rise>.045&&hit>.16){
    this.impact=Math.max(this.impact,hit);this.beats++;this.refractory=.19;
   }
  }
  remember(world,dt){
   this.sampleCharge+=dt;
   if(this.sampleCharge<.095)return;
   this.sampleCharge%=.095;
   this.history.push(world.strands.map(line=>line.filter((_,i)=>i%4===0).map(p=>p.slice())));
   if(this.history.length>8)this.history.shift();
  }
  snapshot(){return {presence:this.presence,impact:this.impact,lift:this.lift,beats:this.beats,
   history:this.history.map(mesh=>mesh.map(line=>line.map(p=>p.slice())))};}
 }
 root.ReactivePerformance=Performance;
 if(typeof module!=='undefined'&&module.exports)module.exports=Performance;
})(globalThis);
