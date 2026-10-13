// Production PCM -> capture-clock gestures -> actual 400-pixel WebGL output.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const Motion=require('../mini projects/spotify/web/music_motion.js');
const Field=require('../mini projects/spotify/web/stage_articulation.js');
const fixture=JSON.parse(fs.readFileSync(path.resolve('output/spotify/articulation-fixture.json')));
const results={};
for(const [name,frames] of Object.entries(fixture)){
 const m=new Motion();let peak=0;
 for(const f of frames){m.step(f,.01);peak=Math.max(peak,m.articulation.attack);}
 results[name]={...m.articulation.snapshot(),peak};
 const held=m.snapshot();m.step({energy:0},.01);assert.deepEqual(m.snapshot(),held,'silence cannot advance a gesture');
}
assert(results.phrase.lead>results.strikes.lead*2,'held tone must own the sustained structural bend');
assert(results.strikes.serial>=5&&results.strikes.serial<=8,'six strikes need distinct released gestures');
assert(results.phrase.serial<=2,'held harmonic phrase cannot keep bursting');
assert(results.hiss.serial<=2,'held hiss cannot manufacture repeated attacks');
assert(results.plucks.serial>=5&&results.plucks.serial<=8,'pitched plucks still need attacks distinct from sustained phrases');
assert(results.hiss.airPhase>1,'high-register texture moves independently of the lead phrase');
assert(results.mixture.lead>results.phrase.lead*.6&&results.mixture.serial>=5,'simultaneous roles must survive a mixture');
assert(results.quiet.lead<results.phrase.lead*.3,'quiet phrases stay smaller');
// Freeze time and all global motion. One register must move and illuminate its
// own structural region in XYZ; adjacent unrelated regions must remain still.
const silent={absoluteVoices:true,presenceVoices:Array(8).fill(0),flowPhases:Array(8).fill(.8),voiceBalances:Array(8).fill(0)};
for(const lane of [0,3,7]){
 const p=[-154+44*lane,30,20],base=Field.create(silent).sample(p);
 const state={...silent,presenceVoices:Array(8).fill(0)};state.presenceVoices[lane]=.5;
 const strong=Field.create(state).sample(p);state.presenceVoices[lane]=.05;
 const soft=Field.create(state).sample(p);
 assert(strong.light>soft.light*2,'local brightness must retain amplitude contrast');
 const displacement=q=>Math.hypot(...q.point.map((v,i)=>v-base.point[i]));
 assert(displacement(strong)>displacement(soft)*2,'quiet musical regions must retain smaller deformation');
 assert(Math.abs(strong.point[0]-base.point[0])>1,'register must bend sideways as well as grow');
 const verticalMotion=Math.max(...[-50,0,50].map(y=>{
  const point=[p[0],y,p[2]],full={...state,presenceVoices:state.presenceVoices.map((v,i)=>i===lane?.5:v)};
  return Math.abs(Field.create(full).sample(point).point[1]-Field.create(silent).sample(point).point[1]);
 }));
 assert(verticalMotion>5,'register must bend its region; a single nodal point may remain still');
 assert(Math.abs(strong.point[2]-base.point[2])>3,'register must change real depth');
 const far=[lane===0?154:-154,0,0];
 assert.deepEqual(Field.create(state).sample(far),Field.create(silent).sample(far),'inactive distant register cannot inherit an active register');
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:840,height:1500}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://articulation.test/**',route=>{
   const p=new URL(route.request().url()).pathname;
   if(p==='/api/state')return route.fulfill({json:{playing:false}});
   const name=p==='/overlay'?'overlay.html':p.slice(1);
   return route.fulfill({body:fs.readFileSync(path.resolve('mini projects/spotify/web',name)),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://articulation.test/overlay');
  const metrics=await page.evaluate(fixtures=>{
   const renderer=new VisualStageRenderer(),cards=[],checks=[],comparisons=[];
   const create=VisualArticulation.create;
   const counters={line:0,face:0,stroke:0};
   for(const kind of Object.keys(counters)){
    const original=renderer[kind].bind(renderer);
    renderer[kind]=(...args)=>{counters[kind]++;return original(...args);};
   }
   try{
    for(const name of ['phrase','strikes','mixture'])for(const stage of [6,1]){
     const w=new ReactiveWorld({geometry:false}),j=new VisualJourney(),feed=new MusicFeed(w,j);
     j.stage=stage;j.next=3;
     for(const frame of fixtures[name]){if(frame.sample_time>1.56)break;feed.accept(frame,frame.sample_time*1000);}
     let before,beforeCalls;
     for(const enabled of [false,true]){
      VisualArticulation.create=enabled?create:()=>({sample:p=>({point:p,presence:0,light:0})});
      for(const kind of Object.keys(counters))counters[kind]=0;
      renderer.paint(null,w,j);
      const c=document.createElement('canvas');c.width=400;c.height=220;
      const ctx=c.getContext('2d');ctx.drawImage(renderer.canvas,0,0,400,220);
      const pixels=ctx.getImageData(0,0,400,220).data;
      const coverage=pixels.filter((v,i)=>i%4===3&&v>60).length;
      cards.push({name,stage,enabled,url:c.toDataURL(),coverage});
      if(!enabled){before=pixels;beforeCalls={...counters};}
      else{
       let changed=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i+3]-before[i+3])>20)changed++;
       comparisons.push({name,stage,changed,beforeCalls,afterCalls:{...counters}});
      }
     }
     VisualArticulation.create=create;
     for(let stage=0;stage<VisualJourney.names.length;stage++){
      j.stage=stage;j.next=(stage+1)%VisualJourney.names.length;renderer.paint(null,w,j);
      checks.push({stage,vertices:renderer.count,error:renderer.gl.getError()});
     }
    }
   }finally{VisualArticulation.create=create;renderer.dispose();}
   // Separate proof sheet, using the production pixels at installed scale.
   const sheet=document.createElement('div');sheet.id='proof';
   Object.assign(sheet.style,{position:'absolute',inset:'0',background:'#15202d',display:'grid',gridTemplateColumns:'400px 400px',gap:'12px',padding:'14px',color:'#e5f3ff',font:'14px system-ui'});
   for(const card of cards){const cell=document.createElement('div');cell.textContent=card.name+' / stage '+card.stage+' / '+(card.enabled?'frequency-driven structure':'field disabled');const img=document.createElement('img');img.src=card.url;img.style.display='block';cell.append(img);sheet.append(cell);}
   document.body.append(sheet);
   return {cards:cards.map(({url,...card})=>card),checks,comparisons};
  },fixture);
  await page.screenshot({path:path.resolve('output/spotify/articulation-comparison.png')});
  assert.deepEqual(errors,[]);
  for(const check of metrics.checks){assert.equal(check.error,0);assert(check.vertices<120000);}
  for(const comparison of metrics.comparisons){
   assert(comparison.changed>100,'structural response must be visible at stream size: '+JSON.stringify(comparison));
   assert.deepEqual(comparison.afterCalls,comparison.beforeCalls,'articulation must not emit extra ribbons, bursts or strokes');
  }
  console.log(JSON.stringify({passed:true,signals:results,rendering:metrics}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
