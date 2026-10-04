/* Musical scene direction. No rendering, clocks, I/O or genre guessing.
 * Audible exposure, phrase changes and attack envelopes conduct a varied show.
 */
(function(root){
 'use strict';
 const Motion=typeof module!=='undefined'&&module.exports?require('./music_motion.js'):root.MusicMotion;
 const Space=typeof module!=='undefined'&&module.exports?require('./music_space.js'):root.MusicSpace;
 const names=['Prism drive','Interference silk','Orbit engine','Crystal assembly','Copper dunes','Petal chamber','Signal architecture','Flow choreography',
  'Resonance lattice','Waveform loom','Phase helix','Morphic shell',
  'Faerie constellation','Cinder phoenix','Stormclaw bear','Verdant turtle','Sundering ram'];
 const affinity=[.9,.4,.65,.75,.1,.55,.85,.25,.8,.3,.7,.45,.2,.8,.9,.35,.65];
 // Favor comparable silhouettes during transport; less-visited families can
 // still win. This prevents arbitrary tunnel-to-animal tangles dominating a song.
 const neighbours=[[2,5,11],[9,4,7],[0,11,5],[6,8,16],[9,1,8],[11,0,12],[3,8,9],[1,9,12],
  [6,3,4],[1,10,4],[9,11,13],[5,2,15],[5,7,13],[12,10,14],[16,15,13],[11,14,16],[14,15,3]];
 const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
 class Journey{
  constructor(){
   this.motion=new Motion();this.space=new Space();
   this.stage=0;this.next=1;this.mix=0;this.transitioning=false;this.transitions=0;
   this.age=0;this.exposure=0;this.travel=0;this.lamp=0;this.impact=0;
   this.energy=0;this.drive=0;this.warmth=0;this.tone=.4;this.phrase=.4;this.palettePhase=0;
   this.shapePhase=0;this.evolution=this.shapeAt(0);
   this.previousBeat=0;this.refractory=0;this.visits=names.map(()=>0);this.visits[0]=1;
   this.recent=[0];this.history=[];this.sampleCharge=0;this.active=false;
  }
  get name(){return names[this.stage];}
  get blend(){return this.mix*this.mix*(3-2*this.mix);}
  shapeAt(phase){return {open:.5+.5*Math.sin(phase*.69),twist:Math.sin(phase*.43+1.2),
   depth:.5+.5*Math.sin(phase*.83-.7),contour:.5+.5*Math.sin(phase*.57+2.4)};}
  choose(world){
   let selected=-1,best=-Infinity;
   const minimum=Math.min(...this.visits.filter((_,i)=>!this.recent.includes(i)));
   for(let i=0;i<names.length;i++){
    if(this.recent.includes(i)||this.visits[i]!==minimum)continue;
    const fit=1-Math.abs(affinity[i]-this.drive);
    const score=fit*1.7-this.visits[i]*.85-(neighbours[this.stage].includes(i)?0:1.3)+Math.sin(i*2.4+world.f.pitch*4)*.12;
    if(score>best){best=score;selected=i;}
   }
   return selected;
  }
  step(world,dt,input=null){
   this.active=world.active;if(!this.active)return;
   dt=Math.max(0,Math.min(.07,dt));const f=world.f;
   this.motion.step(input||{...f,bands:world.bands},dt);
   this.space.step(this.motion,input||f,dt);
   const smooth=1-Math.exp(-dt*.8),energy=clamp(input?.loudness??f.energy),pace=this.motion.pacing.speed;
   this.energy+=(energy-this.energy)*Math.min(1,dt*6);
   this.drive+=(clamp(f.bass*.65+f.flux*.8+f.treble*.45+energy*.3)-this.drive)*smooth;
   this.warmth+=(clamp(f.tonality*(1-this.drive)) - this.warmth)*smooth;
   this.tone+=(f.centroid-this.tone)*smooth;
   // A nonzero audible floor keeps light moving even when a frequency lane is quiet.
   this.travel+=dt*pace*Math.sqrt(energy)*(.55+Math.sqrt(f.mid)*.45+this.drive*.3);
   this.lamp+=dt*Math.sqrt(pace)*Math.sqrt(energy)*(1.15+f.treble*.8+f.width*.35);
   // A continuous musical color clock survives scene and song handoffs. Quiet
   // passages drift; wider, brighter passages travel faster through the palette.
   this.palettePhase+=dt*Math.sqrt(pace)*Math.sqrt(energy)*(1.3+this.motion.mid+this.motion.width*.5);
   // Slow, independent shape dimensions run throughout every scene. They never
   // reset at a beat, song change or family handoff; transients remain separate.
   this.shapePhase+=dt*Math.sqrt(pace)*(.15+Math.sqrt(energy)*.10+f.tonality*.055+f.width*.04);
   const drift=this.shapeAt(this.shapePhase),m=this.motion;
   // Preserve continuous internal evolution, while musical presence steers
   // opening, tension and depth. No onset resets or unrelated shape jumps.
   const expression=m.pacing;
   const targets={open:clamp(drift.open*.15+expression.presence*.5+expression.fullness*.2+expression.release*.15),
    twist:drift.twist*.25+m.balance*.45+(expression.swell-expression.release)*.3,
    depth:clamp(drift.depth*.2+m.width*.3+m.mid*.25+expression.fullness*.25),
    contour:clamp(drift.contour*.1+expression.roundness*.9)};
   for(const key of Object.keys(targets))this.evolution[key]+=(targets[key]-this.evolution[key])*(1-Math.exp(-dt*1.2));
   this.impact=this.motion.kick;
   this.age+=dt;this.exposure+=dt*(.3+energy*.9+f.flux*.5);
   const novelty=Math.abs(this.tone-this.phrase);
   if(!this.transitioning&&this.age>45&&this.exposure>28&&
      (novelty>.075||expression.release>.20||expression.swell>.20||this.age>90)){
    this.next=this.choose(world);this.transitioning=true;this.mix=0;
   }
   if(this.transitioning){
    this.mix+=dt*(.030+this.drive*.012);
    if(this.mix>=1){
     this.stage=this.next;this.visits[this.stage]++;this.recent.push(this.stage);
     if(this.recent.length>3)this.recent.shift();
     this.age=0;this.exposure=0;this.mix=0;this.transitioning=false;this.transitions++;this.phrase=this.tone;
    }
   }
   this.sampleCharge+=dt;
   if(this.sampleCharge>=.1){
    this.sampleCharge%=.1;
    this.history.push(this.motion.absoluteVoices?world.bands.map(v=>v>0?clamp(Math.pow(10,(v*60-75)/20)*4):0):world.bands.slice());
    if(this.history.length>48)this.history.shift();
   }
  }
  snapshot(){return {stage:this.stage,next:this.next,blend:this.blend,age:this.age,travel:this.travel,lamp:this.lamp,
   impact:this.impact,motion:this.motion.snapshot(),drive:this.drive,warmth:this.warmth,palettePhase:this.palettePhase,
   shapePhase:this.shapePhase,evolution:{...this.evolution},space:this.space.snapshot(),transitions:this.transitions,history:this.history.length,visits:this.visits.slice()};}
 }
 Journey.names=names;root.VisualJourney=Journey;
 if(typeof module!=='undefined'&&module.exports)module.exports=Journey;
})(globalThis);
