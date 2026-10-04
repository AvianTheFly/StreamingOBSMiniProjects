// Read-only live Spotify QA. Serves current static code to a private browser,
// consumes the running Hub's existing process-capture state, never controls music.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const out=path.resolve(process.env.SPOTIFY_STILL_OUTPUT||'output/spotify/live-response');fs.mkdirSync(out,{recursive:true});
 const web=path.resolve(__dirname,'../mini projects/spotify/web');
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:800,height:600},recordVideo:{dir:out,size:{width:800,height:600}}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:7447/**',route=>{
   const u=new URL(route.request().url());if(u.pathname==='/api/state')return route.continue();
   const name=u.pathname==='/overlay'?'overlay.html':u.pathname.slice(1);
   if(!/^[a-z_]+\.(html|css|js)$/.test(name))return route.abort();
   return route.fulfill({body:fs.readFileSync(path.join(web,name)),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://127.0.0.1:7447/overlay');await page.addStyleTag({content:'body{background:#080d17}'});
  await page.waitForFunction(()=>data.playing&&world.active&&radiance?.frames>5);
  if(process.env.SPOTIFY_LIVE_HANDOFF)await page.evaluate(()=>{journey.age=66;journey.exposure=29;});
  if(process.env.SPOTIFY_LIVE_PAIR){
   const [from,to]=process.env.SPOTIFY_LIVE_PAIR.split(',').map(Number);
   await page.evaluate(({from,to})=>{if(!VisualJourney.names[from]||!VisualJourney.names[to])throw Error('Unknown live morph pair');
    journey.stage=from;journey.next=to;journey.transitioning=true;journey.mix=0;journey.age=0;journey.exposure=0;}, {from,to});
  }
  const samples=[];
  await page.evaluate(()=>{window.qaTimings=[];setInterval(()=>{if(qaTimings.length<450)qaTimings.push({...visualizerTiming,timestampValid:data.timestamp_valid,audioRevision:data.audio_revision});},50);});
  const stages=(process.env.SPOTIFY_LIVE_STAGES||'').split(',').filter(Boolean).map(Number);
  const sampleCount=Math.ceil(Number(process.env.SPOTIFY_LIVE_SECONDS||20)/2);
  if(!Number.isSafeInteger(sampleCount)||sampleCount<1||sampleCount>30)throw Error('Live preview is limited to 60 seconds');
  for(let i=0;i<sampleCount;i++){
   if(stages.length)await page.evaluate(stage=>{if(!VisualJourney.names[stage])throw Error('Unknown live QA stage');journey.stage=stage;journey.transitioning=false;journey.age=0;journey.exposure=0;},stages[Math.floor(i*stages.length/10)]);
   await page.waitForTimeout(2000);
   samples.push(await page.evaluate(()=>({title:data.title,playing:data.playing,energy:data.energy,bass:data.bass,beat:data.beat,motion:journey.motion.snapshot(),scene:journey.name,blend:journey.blend,palettePhase:journey.palettePhase,shapePhase:journey.shapePhase,evolution:{...journey.evolution},graphics:radiance.status()})));
  }
  await page.screenshot({path:path.join(out,'live.png')});
  const timings=await page.evaluate(()=>window.qaTimings);
  const video=page.video();await page.close();await video.saveAs(path.join(out,'live-spotify-response.webm'));
  fs.writeFileSync(path.join(out,'live-evidence.json'),JSON.stringify({errors,samples,timings},null,2));
  if(errors.length)throw Error(errors.join('\n'));
  if(samples.at(-1).shapePhase<=samples[0].shapePhase)throw Error('Live music did not advance structural evolution');
  if(process.env.SPOTIFY_LIVE_HANDOFF&&!samples.some(s=>s.blend>.1&&s.blend<.9))throw Error('Live audio did not carry a transition');
  console.log(JSON.stringify({errors,track:samples.at(-1).title,playing:samples.at(-1).playing,accents:samples.at(-1).motion.counts,
   activeStages:[...new Set(samples.filter(s=>s.playing&&s.energy>.003).map(s=>s.scene))],inactiveSamples:samples.filter(s=>!s.playing).length,
   timingSamples:timings.length,medianSampleAgeMs:timings.map(t=>t.sampleAgeMs).sort((a,b)=>a-b)[Math.floor(timings.length/2)],medianPaintMs:timings.map(t=>t.paintMs).sort((a,b)=>a-b)[Math.floor(timings.length/2)],timestampValid:timings.every(t=>t.timestampValid),maxSpring:Math.max(...samples.map(s=>s.motion.spring)),morphObserved:samples.some(s=>s.blend>.1&&s.blend<.9),paletteTravel:samples.at(-1).palettePhase-samples[0].palettePhase,frames:samples.at(-1).graphics.frames,video:path.join(out,'live-spotify-response.webm')}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
