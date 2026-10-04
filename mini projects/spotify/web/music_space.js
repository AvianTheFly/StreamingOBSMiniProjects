/* Bounded musical memory and spatial phrasing. Advances only with audible input;
 * current voices remain immediate. Presentation never owns this history. */
(function(root){
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
 class MusicSpace{
  constructor(){
   this.capacity=96;this.voices=8;this.levels=new Float32Array(96*8);
   this.head=-1;this.count=0;this.charge=0;this.time=0;
   this.complexity=0;this.depth=.35;this.focus=.5;this.yaw=0;this.tilt=0;this.roll=0;this.viewPhase=0;
  }
  step(m,input,dt){
   if((input.energy||0)<.001)return;
   dt=clamp(dt,0,.07);this.time+=dt;this.charge+=dt;
   let total=0,moment=0,entropy=0;
   const voices=m.absoluteVoices?m.presenceVoices:m.voices;
   for(let i=0;i<8;i++){const v=voices[i]**2;total+=v;moment+=v*i/7;}
   if(total>.0001)for(let i=0;i<8;i++){const p=voices[i]**2/total;if(p>0)entropy-=p*Math.log(p)/Math.log(8);}
   const smooth=1-Math.exp(-dt*2.5);
   this.complexity+=(entropy-this.complexity)*smooth;
   this.focus+=((total>.0001?moment/total:.5)-this.focus)*smooth;
   this.depth+=(clamp(.22+m.width*.46+entropy*.22+m.breath*.12)-this.depth)*smooth;
   // One continuous audible orbit reveals side and overhead views. It survives
   // scene/song handoffs; no hit resets the camera or changes its direction.
   const intensity=m.pacing?.intensity||0,fullness=m.pacing?.fullness||0;
   this.viewPhase+=dt*(.065+intensity*.08+m.width*.025)*clamp(.4+m.body*.7);
   const targets={
    yaw:clamp(Math.sin(this.viewPhase)*(.44+this.depth*.18+fullness*.10)+m.balance*.07,-.72,.72),
    tilt:clamp(Math.cos(this.viewPhase*.73)*(.30+this.depth*.08)+m.breath*.045,-.46,.46),
    roll:clamp(Math.sin(this.viewPhase*.47)*(.085+m.width*.05)+m.balance*.02,-.18,.18)
   };
   const turn=1-Math.exp(-dt*1.4);
   for(const key of Object.keys(targets))this[key]+=(targets[key]-this[key])*turn;
   while(this.charge>=.05){
    this.charge-=.05;this.head=(this.head+1)%this.capacity;
    for(let i=0;i<8;i++)this.levels[this.head*8+i]=voices[i];
    this.count=Math.min(this.capacity,this.count+1);
   }
  }
  at(voice,seconds,current=0){
   if(!this.count)return current;
   const age=clamp(seconds/.05,0,this.count-1),lo=Math.floor(age),q=age-lo;
   const get=a=>this.levels[((this.head-a+this.capacity)%this.capacity)*8+voice];
   return get(lo)*(1-q)+get(Math.min(lo+1,this.count-1))*q;
  }
  snapshot(){return {samples:this.count,capacity:this.capacity,time:this.time,complexity:this.complexity,
   depth:this.depth,focus:this.focus,yaw:this.yaw,tilt:this.tilt,roll:this.roll,viewPhase:this.viewPhase};}
 }
 root.MusicSpace=MusicSpace;if(typeof module!=='undefined'&&module.exports)module.exports=MusicSpace;
})(globalThis);
