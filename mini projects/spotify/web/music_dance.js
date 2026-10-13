/* Capture-clock choreography. Eight coupled gesture springs and a fixed history
 * turn note direction, register changes and stereo into traveling line motion.
 * No renderer, timer, randomness, particle lifetime or level normalization. */
(function(root){
 'use strict';
 const N=64,LANES=8,clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
 class Dance{
  constructor(){
   this.turn=new Float64Array(LANES);this.velocity=new Float64Array(LANES);
   this.pitch=new Float64Array(LANES).fill(.5);this.previous=new Float64Array(LANES);
   this.flow=new Float64Array(LANES);this.sway=new Float64Array(LANES);
   this.targets=new Float64Array(LANES);
   this.history=new Float32Array(LANES*N);this.head=0;this.charge=0;this.time=0;
  }
  step(input,m,dt){
   if(!(input.energy>.001))return;
   dt=clamp(dt,0,.07);const targets=this.targets;
   for(let lane=0;lane<LANES;lane++){
    const amplitude=m.presenceVoices[lane],bands=input.bands||[];
    let sum=0,weighted=0;
    for(let k=0;k<6;k++){
     const b=bands[lane*6+k]||0,power=b>0?Math.pow(10,(b*60-75)/10):0;
     sum+=power;weighted+=power*k/5;
    }
    const pitch=sum>1e-12?weighted/sum:this.pitch[lane];
    const glide=clamp((pitch-this.pitch[lane])*12);
    this.pitch[lane]+=(pitch-this.pitch[lane])*(1-Math.exp(-dt*14));
    const rise=clamp((amplitude-this.previous[lane])/Math.max(.005,dt)*.16);
    this.previous[lane]=amplitude;
    // A note's spectral direction changes its curl, while rise/release applies
    // opposite impulses. Steady tones retain an audible-time flowing orbit.
    targets[lane]=amplitude*((this.pitch[lane]-.5)*1.5+glide*.7+(m.voiceBalances[lane]||0)*.35);
    this.velocity[lane]+=rise*amplitude*3;
    this.flow[lane]+=dt*amplitude*(.7+this.pitch[lane]*2.8+Math.abs(glide)*1.3);
    this.sway[lane]+=(amplitude*(m.voiceBalances[lane]||0)-this.sway[lane])*(1-Math.exp(-dt*8));
   }
   const count=Math.max(1,Math.ceil(dt*120)),h=dt/count;
   for(let step=0;step<count;step++){
    for(let lane=0;lane<LANES;lane++){
     const neighbour=(this.turn[Math.max(0,lane-1)]+this.turn[Math.min(7,lane+1)])*.5;
     this.velocity[lane]+=(70*(targets[lane]-this.turn[lane])+12*(neighbour-this.turn[lane])-11*this.velocity[lane])*h;
    }
    for(let lane=0;lane<LANES;lane++)this.turn[lane]=clamp(this.turn[lane]+this.velocity[lane]*h,-.85,.85);
   }
   this.charge+=dt;
   while(this.charge>=.025){
    this.charge-=.025;this.head=(this.head+1)%N;
    for(let lane=0;lane<LANES;lane++){
     const amplitude=m.presenceVoices[lane];
     this.history[lane*N+this.head]=this.turn[lane]+amplitude*Math.sin(this.flow[lane]*2.3+lane*.4)*.38;
    }
   }
   this.time+=dt;
  }
  at(lane,age=0){
   const row=clamp(lane,0,7),lo=Math.min(6,Math.floor(row)),q=row-lo;
   const t=clamp(age,0,1)*(N-1),a=Math.floor(t),v=t-a;
   const read=r=>{
    const at=k=>this.history[r*N+(this.head-clamp(k,0,N-1)+N)%N];
    const p=at(a-1),x=at(a),y=at(a+1),z=at(a+2);
    return x+.5*v*(y-p+v*(2*p-5*x+4*y-z+v*(3*(x-y)+z-p)));
   };
   return read(lo)*(1-q)+read(lo+1)*q;
  }
  snapshot(){return {turn:Array.from(this.turn),flow:Array.from(this.flow),sway:Array.from(this.sway),
   pitch:Array.from(this.pitch),history:Array.from(this.history),head:this.head,time:this.time};}
 }
 root.MusicDance=Dance;if(typeof module!=='undefined'&&module.exports)module.exports=Dance;
})(globalThis);
