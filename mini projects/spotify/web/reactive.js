/* A family of audio instruments sharing the same strand/vertex topology.
 * No scene clock, random particles, prerecorded motion, or decorative emitters.
 * The three phase integrals are low/mid/high-frequency musical travel, not time.
 * Inspired by custom waveform mapping in MilkDrop and Synesthesia's audio clocks.
 */
(function(root){
 'use strict';
 const TAU=Math.PI*2,COUNT=9,SAMPLES=129;
 const surface=typeof module!=='undefined'&&module.exports?require('./surface.js'):root.ReactiveSurface;
 const forms=typeof module!=='undefined'&&module.exports?require('./forms.js'):root.ReactiveForms;
 const {names,styles,colors}=forms;
 const Performance=typeof module!=='undefined'&&module.exports?require('./performance.js'):root.ReactivePerformance;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
 const mix=(a,b,t)=>t===0?a:t===1?b:a+(b-a)*t;
 const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
 function sample(values,t){
  const p=clamp(t)* (values.length-1),i=Math.floor(p),f=p-i;
  return mix(values[i]||0,values[Math.min(i+1,values.length-1)]||0,f);
 }
 class ReactiveWorld{
  constructor(options={}){
   this.geometryEnabled=options.geometry!==false;
   this.stage=24;this.next=20;this.charge=0;this.transitions=0;this.onsets=0;
   this.phase=[0,0,0];this.bands=Array(48).fill(0);this.wave=Array(128).fill(0);
   this.levels=Array(COUNT).fill(0);this.attacks=Array(COUNT).fill(0);
   this.previous=Array(COUNT).fill(0);this.visits=Array(names.length).fill(0);this.visits[this.stage]=1;
   this.f={energy:0,bass:0,mid:0,treble:0,beat:0,flux:0,centroid:.4,pitch:.3,tonality:.6,width:0,balance:0};
   this.strands=Array.from({length:COUNT},()=>Array.from({length:SAMPLES},()=>[0,0,0]));
   this.targets=this.strands.map(line=>line.map(()=>[0,0,0]));
   this.velocity=this.strands.map(line=>line.map(()=>[0,0,0]));
   this.lightPhase=Array.from({length:COUNT},(_,i)=>i*.113);
   this.particles=Array.from({length:144},(_,i)=>({row:i%COUNT,u:(Math.floor(i/COUNT)+.5)/16,x:0,y:0,vx:0,vy:0,trail:[]}));
   this.residence=0;this.exploration=0;this.morph=0;this.transitioning=false;
   this.phrase=[.4,.3,0];this.previousTone=[.4,.3,0];this.initialized=false;
   this.active=false;
   this.performance=new Performance();
  }
  get blend(){return ease(this.morph);}
  get name(){return names[this.stage];}
  get flow(){return this.phase[1];}
  get hue(){return mix(colors[this.stage],colors[this.stage]+((colors[this.next]-colors[this.stage]+540)%360-180),this.blend)-this.f.centroid*80;}
  get style(){return styles[this.stage].map((value,i)=>mix(value,styles[this.next][i],this.blend));}
  changeTrack(){ /* The musical history continues across a metadata change. */ }
  chooseNext(){
   // Timbre chooses among the less explored forms. A phrase cannot abruptly cut
   // the geometry: this choice is fixed before a continuous vertex morph starts.
   const minimum=Math.min(...this.visits.filter((_,i)=>i!==this.stage));
   const affinity=forms.affinity;
   let selected=0,score=Infinity;
   for(let i=0;i<names.length;i++)if(i!==this.stage&&this.visits[i]===minimum){
    const value=Math.abs(affinity[i]-this.f.centroid)+Math.abs(i-this.stage)*.008;
    if(value<score){selected=i;score=value;}
   }
   return selected;
  }
  step(data,dt){
   dt=clamp(dt,0,.07);
   if((data.energy||0)<.001){this.active=false;return;}
   this.active=true;
   const rate=1-Math.exp(-dt*120),release=1-Math.exp(-dt*15);
   for(let i=0;i<48;i++){
    const v=clamp(data.bands?.[i]);this.bands[i]=mix(this.bands[i],v,v>this.bands[i]?rate:release);
   }
   // Align sample windows by correlation. WASAPI windows start at arbitrary
   // phases; anchoring the real waveform avoids a whole-object strobe.
   const input=Array.from({length:128},(_,i)=>clamp(data.waveform?.[i],-1,1));
   let shift=0,best=-Infinity;
   for(let offset=0;offset<128;offset+=2){
    let correlation=0;for(let i=0;i<128;i+=4)correlation+=this.wave[i]*input[(i+offset)%128];
    if(correlation>best){best=correlation;shift=offset;}
   }
   for(let i=0;i<128;i++)this.wave[i]=mix(this.wave[i],input[(i+shift)%128],rate);
   let flux=0,sum=0,weighted=0;
   for(let row=0;row<COUNT;row++){
    const start=Math.floor(row*48/COUNT),end=Math.floor((row+1)*48/COUNT);
    let value=0;for(let i=start;i<end;i++)value+=this.bands[i];value/=end-start;
    const rise=Math.max(0,value-this.previous[row]-.012);
    this.attacks[row]=Math.max(this.attacks[row]*Math.exp(-dt*7),clamp(rise*8));
    if(rise>.045)this.onsets++;
    flux+=rise;this.previous[row]=value;this.levels[row]=value;
   }
   for(let i=0;i<48;i++){sum+=this.bands[i];weighted+=this.bands[i]*i/47;}
   const mid=this.bands.slice(15,32).reduce((a,b)=>a+b,0)/17;
   const centroid=sum>.001?weighted/sum:this.f.centroid;
   const values={energy:clamp(data.energy),bass:clamp(data.bass),mid,treble:clamp(data.treble),beat:clamp(data.beat),flux:clamp(Math.max(flux*2,data.flux||0)),centroid,
    pitch:clamp(data.pitch??centroid),tonality:clamp(data.tonality??.6),width:clamp(data.width||0),balance:clamp(data.balance||0,-1,1)};
   for(const key in values){const speed=['centroid','pitch','tonality','width'].includes(key)?1-Math.exp(-dt*2):rate;this.f[key]=mix(this.f[key],values[key],speed);}
   // Integral speeds encode which part of the spectrum carries the music.
   this.phase[0]+=dt*Math.sqrt(this.f.bass)*2.4;
   this.phase[1]+=dt*Math.sqrt(this.f.mid)*2.8;
   this.phase[2]+=dt*Math.sqrt(this.f.treble)*3.2;
   for(let row=0;row<COUNT;row++)this.lightPhase[row]+=dt*(Math.sqrt(this.levels[row])*(.16+this.f.pitch*.24)+this.attacks[row]*.15);
   this.performance.step(this,dt);
   if(!this.geometryEnabled)return;
   this.advancePhrase(dt);
   this.updateGeometry(dt);
   this.updateParticles(dt);
   this.performance.remember(this,dt);
  }
  advancePhrase(dt){
   const tone=[this.f.centroid,this.f.pitch,this.f.width];
   const novelty=tone.reduce((sum,v,i)=>sum+Math.abs(v-this.previousTone[i]),0);
   this.previousTone=tone.slice();
   const difference=tone.reduce((sum,v,i)=>sum+Math.abs(v-this.phrase[i]),0);
   this.residence+=dt;
   this.exploration+=dt*(this.f.energy*.038+this.f.flux*.15+difference*.04)+novelty*.11;
   // Each instrument explores changing folds, circulation and materials first.
   // A new musical phrase can invite a morph after that exploration. Sustained
   // music can eventually wander too, without a metronomic preset rotation.
   const depth=1.9+styles[this.stage][1]*1.25+this.f.tonality*.45;
   if(!this.transitioning&&this.residence>28&&this.exploration>depth&&
      ((difference>.13&&this.f.flux>.025)||this.exploration>depth*1.6)){
    this.next=this.chooseNext();this.transitioning=true;this.morph=0;
   }
   if(this.transitioning){
    this.morph+=dt*(this.f.energy*.036+this.f.mid*.018+this.f.flux*.026);
    if(this.morph>=1){
     this.stage=this.next;this.visits[this.stage]++;this.transitions++;
     this.next=this.chooseNext();this.morph=0;this.transitioning=false;
     this.residence=0;this.exploration=0;this.phrase=tone.slice();
    }
   }
   this.charge=this.transitioning?this.morph:this.exploration;
  }
  curl(x,y,row=0){
   // Curl of a smooth two-frequency scalar potential. Opposing components
   // form coherent eddies, with measured bass/mids/treble driving its phases.
   const a=x*.055+this.phase[0]+row*.10,b=y*.06-this.phase[1];
   const c=(x+y)*.037+this.phase[2];
   return [Math.sin(a)*Math.cos(b)+.35*Math.cos(c),-(.055/.06)*Math.cos(a)*Math.sin(b)-.35*Math.cos(c)];
  }
  deform(point,u,row){
   const f=this.f,q=row/(COUNT-1),a=TAU*u;
   const signal=(1-Math.cos(a))*.5;
   const band=sample(this.bands,(signal*.63+q*.37+f.pitch*.1)%1);
   const local=Math.sqrt(band),attack=this.attacks[row],wave=sample(this.wave,signal);
   const twist=Math.sin(a+this.phase[1]+q*.6)*(.025+Math.sqrt(f.mid)*.15)+wave*f.energy*.04;
   const flow=this.curl(point[0],point[1],row);
   const bend=(1+local*3+attack*3)*(.65+f.width*.35);
   const traveling=Math.sin(a*3+f.pitch*3-this.phase[0]*1.3+q*3);
   return [point[0]*Math.cos(twist)-point[1]*Math.sin(twist)+flow[0]*bend+f.balance*5,
    point[1]*Math.cos(twist)+point[0]*Math.sin(twist)+flow[1]*bend+traveling*Math.sqrt(f.bass)*3.5,
    point[2]+Math.cos(a+this.phase[2]+q*4)*(f.width*13+local*9)];
  }
  lightAt(row,u){
   const distance=(a,b)=>Math.abs(((a-b+1.5)%1)-.5);
   const head=this.lightPhase[row]%1;
   const spot=Math.exp(-((distance(u,head)/.095)**2));
   const echo=Math.exp(-((distance(u,(head*.71+.43)%1)/.15)**2));
   const bin=sample(this.bands,(row/(COUNT-1)*.6+u*.4)%1);
   return clamp(.025+Math.sqrt(bin)*.10+spot*(.72+this.attacks[row]*.25)+echo*.24);
  }
  point(mode,u,row){return forms.point(this,mode,u,row);}
  updateGeometry(dt=1/30){
   const blend=this.blend,stiffness=48+this.f.tonality*34;
   for(let row=0;row<COUNT;row++)for(let i=0;i<SAMPLES;i++){
    const u=i/(SAMPLES-1),a=this.point(this.stage,u,row),b=this.point(this.next,u,row);
    const target=this.deform(a.map((value,d)=>mix(value,b[d],blend)),u,row);
    const p=this.strands[row][i],v=this.velocity[row][i];
    for(let d=0;d<3;d++){
     this.targets[row][i][d]=target[d];
     if(!this.initialized){p[d]=target[d];continue;}
     v[d]=clamp(v[d]+((target[d]-p[d])*stiffness-v[d]*12)*dt,-130,130);
     p[d]+=v[d]*dt;
    }
   }
   this.initialized=true;
  }
  updateParticles(dt){
   for(const p of this.particles){
    const level=Math.sqrt(this.levels[p.row]),attack=this.attacks[p.row];
    p.u=(p.u+dt*(level*.13+this.f.treble*.11+attack*.09))%1;
    const index=p.u*(SAMPLES-1),i=Math.floor(index),t=index-i;
    const a=this.strands[p.row][i],b=this.strands[p.row][Math.min(i+1,SAMPLES-1)];
    const flow=this.curl(p.x,p.y,p.row),drift=(1-this.f.tonality)*7+this.f.width*5+attack*8;
    const x=mix(a[0],b[0],t)+flow[0]*drift,y=mix(a[1],b[1],t)+flow[1]*drift;
    if(!p.trail.length){p.x=x;p.y=y;}
    p.vx=clamp(p.vx+((x-p.x)*32-p.vx*8)*dt,-100,100);
    p.vy=clamp(p.vy+((y-p.y)*32-p.vy*8)*dt,-100,100);
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.trail.push([p.x,p.y]);if(p.trail.length>5)p.trail.shift();
   }
  }
  paint(ctx){surface.paint(ctx,this);}
  snapshot(){return {stage:this.stage,next:this.next,name:this.name,progress:this.charge,blend:this.blend,
   onsets:this.onsets,transitions:this.transitions,phase:this.phase.slice(),visits:this.visits.slice(),
   levels:this.levels.slice(),attacks:this.attacks.slice(),features:{...this.f},
   lightPhase:this.lightPhase.slice(),residence:this.residence,exploration:this.exploration,transitioning:this.transitioning,
   performance:this.performance.snapshot(),
   particles:this.particles.map(p=>({x:p.x,y:p.y,u:p.u,trail:p.trail.map(v=>v.slice())})),
   strands:this.strands.map(points=>points.map(p=>p.slice()))};}
 }
 ReactiveWorld.names=names;root.ReactiveWorld=ReactiveWorld;
 if(typeof module!=='undefined'&&module.exports)module.exports=ReactiveWorld;
})(typeof globalThis==='undefined'?this:globalThis);
