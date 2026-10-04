/* Bounded coupled strings: motion advances this 8 x 65 grid; rendering only
 * samples it. Local pulls propagate, reflect, damp, and excite their neighbours. */
(function(root){
 'use strict';
 const LANES=8,NODES=65,SIZE=LANES*NODES,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // C1 interpolation keeps traveling curves smooth between physics nodes.
 const cubic=(a,b,c,d,q)=>b+.5*q*(c-a+q*(2*a-5*b+4*c-d+q*(3*(b-c)+d-a))); 
 class Strings{
  constructor(){
   this.displacement=new Float32Array(SIZE);this.velocity=new Float32Array(SIZE);
   this.acceleration=new Float32Array(SIZE);this.weights=new Float32Array(SIZE);this.previous=new Float32Array(LANES);
   this.targets=new Float32Array(LANES);this.sources=new Float32Array(LANES);this.time=0;
  }
  step(m,bands,dt){
   const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
   for(let lane=0;lane<LANES;lane++){
    let level=0;for(let k=0;k<6;k++)level+=Math.max(0,Math.min(1,bands[lane*6+k]||0))/6;
    const amplitude=m.absoluteVoices?m.presenceVoices[lane]:Math.sqrt(level),change=amplitude-this.previous[lane];this.previous[lane]=amplitude;
    const source=13+(m.voiceBalances[lane]+1)*9+m.voiceTones[lane]*8;this.sources[lane]=source;
    for(let i=1;i<NODES-1;i++)this.weights[lane*NODES+i]=Math.exp(-(((i-source)/2.1)**2));
    const phase=m.flowPhases[lane];
    this.targets[lane]=amplitude*42*(Math.sin(phase*1.7)*.7+Math.sin(phase*.77)*.3);
    // Fresh rises and releases launch signed waves, bypassing envelope delay.
    for(let i=Math.max(1,Math.floor(source)-3);i<=Math.min(NODES-2,Math.ceil(source)+3);i++)
     this.velocity[lane*NODES+i]+=clamp(change,-.8,.8)*230*Math.exp(-(((i-source)/1.8)**2));
   }
   for(let step=0;step<steps;step++){
    for(let lane=0;lane<LANES;lane++)for(let i=1;i<NODES-1;i++){
     const index=lane*NODES+i,u=this.displacement[index],v=this.velocity[index];
     const along=this.displacement[index-1]+this.displacement[index+1]-2*u;
     const neighbour=(lane?this.displacement[index-NODES]:u)+(lane<LANES-1?this.displacement[index+NODES]:u)-2*u;
     const weight=this.weights[index];
     this.acceleration[index]=2500*along+46*neighbour-2.6*v-3*u+(this.targets[lane]-u)*420*weight;
    }
    for(let lane=0;lane<LANES;lane++)for(let i=1;i<NODES-1;i++){
     const index=lane*NODES+i;
     this.velocity[index]=clamp(this.velocity[index]+this.acceleration[index]*h,-350,350);
     this.displacement[index]=clamp(this.displacement[index]+this.velocity[index]*h,-38,38);
    }
   }this.time+=dt;
  }
  at(lane,u){
   const x=clamp(u,0,1)*(NODES-1),i=Math.min(NODES-2,Math.floor(x)),q=x-i;
   const row=clamp(lane,0,LANES-1),lo=Math.min(LANES-2,Math.floor(row)),v=row-lo;
   const a=lo*NODES+i,b=a+NODES,d=this.displacement,left=i>0?1:0,right=i<NODES-2?2:1;
   return cubic(d[a-left],d[a],d[a+1],d[a+right],q)*(1-v)+cubic(d[b-left],d[b],d[b+1],d[b+right],q)*v;
  }
  snapshot(){return {time:this.time,displacement:Array.from(this.displacement),velocity:Array.from(this.velocity)};}
 }
 Strings.lanes=LANES;Strings.nodes=NODES;root.MusicStrings=Strings;
 if(typeof module!=='undefined'&&module.exports)module.exports=Strings;
})(globalThis);
