// Pitch direction and stereo must change choreography even at equal loudness.
// Shared hinges and attached tendrils must remain joined throughout that motion.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Dance=require('../mini projects/spotify/web/music_dance.js');
const Designs=require('../mini projects/spotify/web/stage_designs.js');
function perform(bin,pan=0,dt=1/100){
 const dance=new Dance(),m={presenceVoices:Array(8).fill(.4),voiceBalances:Array(8).fill(pan)};
 const input={energy:.4,bands:Array.from({length:48},(_,i)=>i%6===bin?.8:.03)};
 for(let i=0;i<Math.round(3/dt);i++)dance.step(input,m,dt);
 return {dance,m,input};
}
const low=perform(0),high=perform(5),left=perform(2,-.7),right=perform(2,.7);
assert(low.dance.turn[3]<-.2&&high.dance.turn[3]>.2,'equal-level notes must curl in different directions');
assert(high.dance.flow[3]>low.dance.flow[3]*2,'pitch changes flowing speed without changing loudness');
assert(left.dance.sway[3]<-.25&&right.dance.sway[3]>.25,'stereo must steer a separate dimension');
const old=high.dance.at(3,.5),now=high.dance.at(3,0);
assert(Math.abs(old-now)>.05,'the line must contain a traveling musical history');
const held=high.dance.snapshot();high.dance.step({energy:0},high.m,.03);
assert.deepEqual(high.dance.snapshot(),held,'silence holds motion and history');
const slow=perform(5,0,1/30).dance;
assert(Math.abs(slow.turn[3]-held.turn[3])<.015,'capture cadence must not change steady curl');
assert(Math.abs(slow.flow[3]-held.flow[3])<.1,'capture cadence must not change audible speed');
const coupled=new Dance(),m={presenceVoices:Array(8).fill(0),voiceBalances:Array(8).fill(0)};
m.presenceVoices[3]=.5;
for(let i=0;i<200;i++)coupled.step(low.input,m,.01);
assert(Math.abs(coupled.turn[2])>.01,'a played register transfers tension into its neighbour');
assert(Math.abs(coupled.turn[0])<Math.abs(coupled.turn[2])*.2,'transferred tension must decay with distance');
const history=coupled.history;
for(let i=0;i<10000;i++)coupled.step(high.input,m,.01);
assert.equal(coupled.history,history);assert.equal(history.length,512);
assert([...history,...coupled.turn,...coupled.velocity].every(Number.isFinite),'long playback remains finite');
const paths=new Map(),faces=new Map(),designs=Designs.create({TAU:Math.PI*2,mix:(a,b,t)=>a+(b-a)*t,
 color:()=>[1,1,1],path:(_s,p,_c,_w,_a,_j,_o,key)=>paths.set(key,p),project:p=>p,rot:p=>p,
 evolution:()=>({open:.7,depth:.6,twist:.4,contour:.3})});
const j={motion:{...high.m,dance:high.dance},travel:2},sink={face:(p,_c,_a,key)=>faces.set(key,p)};
designs.folded(sink,{},j);
for(let i=0;i<7;i++){
 const a=faces.get('fold-panel-'+i),b=faces.get('fold-panel-'+(i+1));
 assert.deepEqual(a[1],b[0]);assert.deepEqual(a[2],b[3],'both ends of the folding hinge must stay attached');
}
designs.medusa(sink,{},j);
for(let i=0;i<8;i++){
 const rim=paths.get('canopy-6')[i*9],tip=paths.get('tendril-'+i)[0];
 assert(Math.hypot(...rim.map((v,k)=>v-tip[k]))<1e-10,'tendrils must start exactly on their canopy rim');
}
designs.knot(sink,{},j);
for(const name of ['infinity-0','infinity-1','infinity-seam']){
 const p=paths.get(name);assert(Math.hypot(...p[0].map((v,k)=>v-p.at(-1)[k]))<1e-10,'ribbon seams must close');
}
// Change only a partner's delayed note. The receiving contour's own register,
// amplitude, travel and camera remain fixed: this proves actual cross-part pull.
const interactionChecks=[];
for(const [design,key,peer] of [['vortex','vortex-0-0',3],['folded','fold-edge-0',3],
 ['aurora','aurora-0-0',2],['knot','infinity-0',7],['medusa','tendril-0',1],['mandala','rosette-0',2]]){
 const motion={presenceVoices:Array(8).fill(0),dance:{flow:Array(8).fill(0),at:()=>0}};
 const state={...j,motion};designs[design](sink,{},state);const resting=paths.get(key);
 motion.dance.at=(lane,age)=>Math.max(0,1-Math.abs(lane-peer))*.4*Math.sin(Math.PI*age);
 designs[design](sink,{},state);const answering=paths.get(key);
 const rms=Math.sqrt(resting.reduce((sum,p,i)=>sum+p.reduce((n,v,k)=>n+(v-answering[i][k])**2,0),0)/resting.length);
 assert(rms>1,'partner notes must visibly reshape '+design+': '+rms);
 interactionChecks.push({design,partnerOnlyRms:rms});
}
// Both strands in each curtain pair revolve around a shared axis, so crossings
// in the picture have real depth separation rather than lying on top of each other.
designs.aurora(sink,{},j);
for(let pair=0;pair<2;pair++){
 const center=curtain=>paths.get(`aurora-${curtain}-0`).map((p,i)=>p.map((v,k)=>(v+paths.get(`aurora-${curtain}-1`)[i][k])*.5));
 const a=center(pair*2),b=center(pair*2+1);let crossings=0;
 for(let i=1;i<a.length;i++){
  const old=a[i-1][1]-b[i-1][1],next=a[i][1]-b[i][1];
  if(old*next<0){crossings++;assert(Math.abs(a[i][2]-b[i][2])>15,'woven crossings need depth clearance');}
 }
 assert(crossings>=2,'each curtain pair must weave across its partner');
}
(async()=>{
 const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1240,height:1120}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://dance.test/**',route=>{
   const url=new URL(route.request().url());if(url.pathname==='/api/state')return route.fulfill({json:{playing:false}});
   const name=url.pathname==='/overlay'?'overlay.html':url.pathname.slice(1);
   return route.fulfill({body:fs.readFileSync(path.resolve('mini projects/spotify/web',name)),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html'});
  });
  await page.goto('http://dance.test/overlay');
  const rows=await page.evaluate(()=>{
   cancelAnimationFrame(frame);frame=0;window.fetch=()=>new Promise(()=>{});
   const signal={energy:.4,loudness:.3,bass:.2,treble:.15,tonality:.7,width:.5,
    voice_levels:Array(8).fill(.15),voice_balances:Array(8).fill(.2),
    bands:Array.from({length:48},(_,i)=>i%6===4?.8:.05),waveform:Array(128).fill(0)};
   for(let i=0;i<240;i++){world.step(signal,1/60);journey.step(world,1/60,signal);}
   const renderer=new VisualStageRenderer(),rows=[],cards=[];
   try{
    for(let stage=0;stage<VisualJourney.names.length;stage++){
     journey.stage=stage;journey.transitioning=false;
     // Hold all other music/camera/evolution state. Only change the gesture
     // history to measure the extra dimension introduced by choreography.
     const dance=journey.motion.dance,original=new Float32Array(dance.history);
     let baseline;
     for(const phase of [0,1]){
      if(phase)for(let i=0;i<dance.history.length;i++)dance.history[i]=-original[i];
      renderer.paint(null,world,journey);
      const c=document.createElement('canvas');c.width=400;c.height=220;
      const ctx=c.getContext('2d');ctx.drawImage(renderer.canvas,0,0,400,220);
      const pixels=ctx.getImageData(0,0,400,220).data;
      if(!phase){baseline=pixels;cards.push({name:journey.name,url:c.toDataURL()});}
      else{
       let changed=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i+3]-baseline[i+3])>20)changed++;
       rows.push({stage,name:journey.name,changed});
      }
     }
     dance.history.set(original);
    }
   }finally{renderer.dispose();}
   document.body.innerHTML='';document.body.style.cssText='margin:10px;background:#080d17;display:grid;grid-template-columns:repeat(3,400px);gap:10px;color:#d8edf5';
   for(const card of cards){const box=document.createElement('div'),img=document.createElement('img'),label=document.createElement('div');
    img.src=card.url;label.textContent=card.name;label.style.cssText='text-align:center;font:15px Segoe UI';box.append(img,label);document.body.append(box);}
   return rows;
  });
  assert.deepEqual(errors,[]);
  for(const row of rows)assert(row.changed>200,'gesture history must visibly reshape '+row.name+': '+row.changed);
  await page.screenshot({path:'output/spotify/dance-catalog.png',fullPage:true});
  console.log(JSON.stringify({passed:true,spectralCurl:[low.dance.turn[3],held.turn[3]],interactions:interactionChecks,scenes:rows}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
