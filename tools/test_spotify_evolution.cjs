// Every family must change its internal shape without a transition, a beat,
// camera rotation, uniform scaling or changing frequency data doing the work.
const assert=require('node:assert/strict');
const World=require('../mini projects/spotify/web/reactive.js');
const Journey=require('../mini projects/spotify/web/journey.js');
const Stages=require('../mini projects/spotify/web/stage_geometry.js');
const w=new World({geometry:false}),j=new Journey();
const input={energy:.4,bass:.2,treble:.12,beat:0,flux:.1,width:.5,pitch:.3,tonality:.7,
 bands:Array.from({length:48},(_,i)=>.06+.2*Math.sin(i*.2)**2),waveform:Array.from({length:128},(_,i)=>Math.sin(i*.2)*.4)};
for(let i=0;i<90;i++){w.step(input,1/30);j.step(w,1/30,input);}
function points(stage,phase){
 j.evolution=j.shapeAt(phase);const paths=[];let id=0;
 Stages.render(stage,{stroke(p,c,width,a,key){paths.push({key:String(key??id++),p});},line(){},face(){}},w,j);
 paths.sort((a,b)=>a.key.localeCompare(b.key));return paths.flatMap(p=>p.p.map(v=>v.slice(0,2)));
}
function residual(a,b){
 assert.equal(a.length,b.length);const n=a.length;
 const mean=p=>p.reduce((s,v)=>[s[0]+v[0]/n,s[1]+v[1]/n],[0,0]);
 const ac=mean(a),bc=mean(b);let dot=0,cross=0,norm=0;
 for(let i=0;i<n;i++){const x=a[i][0]-ac[0],y=a[i][1]-ac[1],u=b[i][0]-bc[0],v=b[i][1]-bc[1];dot+=x*u+y*v;cross+=x*v-y*u;norm+=x*x+y*y;}
 const c=dot/norm,s=cross/norm;let error=0;
 for(let i=0;i<n;i++){const x=a[i][0]-ac[0],y=a[i][1]-ac[1];error+=(c*x-s*y+bc[0]-b[i][0])**2+(s*x+c*y+bc[1]-b[i][1])**2;}
 return Math.sqrt(error/n);
}
const changes=[],steps=[];
for(let stage=0;stage<Journey.names.length;stage++){
 const a=points(stage,0),b=points(stage,4),near=points(stage,4.001);
 changes.push(residual(a,b));steps.push(residual(b,near));
 assert(changes.at(-1)>1.5,'scene '+stage+' must reshape beyond a rigid transform');
 assert(steps.at(-1)<.3,'shape evolution must remain continuous');
}
const start=j.shapePhase;j.age=0;j.exposure=0;j.transitioning=false;
for(let i=0;i<30*30;i++){w.step(input,1/30);j.step(w,1/30,input);}
assert(j.shapePhase>start+3);assert.equal(j.transitioning,false,'shape development starts well before any family handoff');
const held=j.shapePhase;w.step({energy:0},1/30);j.step(w,1/30);assert.equal(j.shapePhase,held);
// The four new sculptures are fully framed even as their camera and shape
// phases diverge. A prior unbounded lattice roll clipped its top and bottom.
j.motion.spring=.3;j.motion.width=.9;
for(const name of ['Resonance lattice','Waveform loom','Phase helix','Morphic shell']){
 const stage=Journey.names.indexOf(name);assert(stage>=0);
 for(let phase=0;phase<40;phase+=.5){
  j.travel=phase*4;
  const geometry=points(stage,phase);
  assert(geometry.every(p=>Math.abs(p[0])<184&&Math.abs(p[1])<104),`${name} must stay inside the presentation margins`);
 }
}
console.log(JSON.stringify({passed:true,internalShapeRms:changes.map(v=>+v.toFixed(2)),maximumSmallStep:Math.max(...steps),silenceHolds:true}));
