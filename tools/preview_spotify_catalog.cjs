// Finite four-up catalog study. Uses production rendering and original analyzed
// PCM at its actual 30-Hz timing; no live playback controls or runtime resources.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const out=path.resolve(process.env.SPOTIFY_PREVIEW_FRAMES),web=path.resolve('mini projects/spotify/web');
 const stages=process.env.SPOTIFY_PREVIEW_STAGES?process.env.SPOTIFY_PREVIEW_STAGES.split(',').map(Number):[8,9,10,11],fps=30;
 const start=Number(process.env.SPOTIFY_PREVIEW_START??30)*fps,length=Number(process.env.SPOTIFY_PREVIEW_SECONDS??24)*fps;
 const pacingStudy=process.env.SPOTIFY_PREVIEW_PACING==='1';
 const noTransients=process.env.SPOTIFY_WITHOUT_TRANSIENTS==='1';
 const mixes=(process.env.SPOTIFY_PREVIEW_MIXES||'').split(',').filter(Boolean).map(Number);
 const destination=Number(process.env.SPOTIFY_PREVIEW_DESTINATION||9);
 const wireframe=process.env.SPOTIFY_PREVIEW_WIREFRAME==='1';
 const columns=stages.length>4?3:2;
 const signals=JSON.parse(fs.readFileSync(process.env.SPOTIFY_PREVIEW_DATA||'output/spotify/audio-study.json','utf8'));
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:640*columns,height:480*Math.ceil(stages.length/columns)}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://catalog.test/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/state')return route.fulfill({json:{playing:false}});
   if(url.pathname==='/study')return route.fulfill({contentType:'text/html',body:
    `<style>body{margin:0;background:#080d17;display:grid;grid-template-columns:repeat(${columns},1fr)}iframe{width:640px;height:480px;border:0;box-sizing:border-box;outline:1px solid #202735}</style>`+
    stages.map(stage=>`<iframe src="/overlay?stage=${stage}"></iframe>`).join('')});
   const file=url.pathname==='/overlay'?'overlay.html':url.pathname.slice(1);
   return route.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://catalog.test/study');
  const panes=page.frames().filter(f=>f!==page.mainFrame());assert.equal(panes.length,stages.length);
  for(let k=0;k<panes.length;k++){
   await panes[k].waitForFunction(()=>typeof journey==='object');
   await panes[k].evaluate(({stage,signals,wireframe})=>{
    window.fetch=()=>new Promise(()=>{});cancelAnimationFrame(frame);frame=0;
    for(const signal of signals){world.step(signal,1/30);journey.step(world,1/30,signal);}
    journey.stage=stage;journey.transitioning=false;journey.age=0;journey.exposure=0;journey.palettePhase=0;
    document.body.style.background='#080d17';
    if(wireframe){clear();present();radiance.face=()=>{};}
   },{stage:stages[k],signals:signals.slice(start-60,start),wireframe});
  }
  const history=[];
  for(let i=0;i<length;i++){
   const state=await Promise.all(panes.map((pane,k)=>pane.evaluate(({signal,noTransients,pacingStudy,morph,destination})=>{
    data={...signal,playing:true};world.step(data,1/30);journey.step(world,1/30,data);
    if(morph!==undefined){journey.next=destination;journey.mix=morph;journey.transitioning=true;}
    if(noTransients){Object.assign(journey.motion,{kick:0,snap:0,tick:0,spring:0,rebound:0,velocity:0});journey.motion.details.fill(0);}
    widget.hidden=false;title.textContent=journey.name;artist.textContent=pacingStudy?`${signal.section} · ${signal.bpm} BPM · movement ${journey.motion.pacing.speed.toFixed(2)}×`:noTransients?'No drums · beat response disabled':'Original audio · continuous evolution';
    clear();present();return {name:journey.name,phase:journey.shapePhase,evolution:journey.evolution,graphics:radiance.status()};
   },{signal:signals[start+i],noTransients,pacingStudy,morph:mixes[k],destination})));
   if(i%90===0)history.push({seconds:i/fps,stages:state});
   await page.screenshot({path:path.join(out,String(i).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({errors,history,startSeconds:start/fps,frames:length,fps,noTransients},null,2));
  console.log(JSON.stringify({passed:true,stages,frames:length,fps,startSeconds:start/fps,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
