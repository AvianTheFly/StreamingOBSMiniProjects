// Finite isolated renderer CPU profile. Serves local files and synthetic audio;
// never connects to Spotify, the Hub or OBS, or changes personal settings.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const web=path.resolve(process.env.SPOTIFY_PROFILE_WEB||'mini projects/spotify/web');
 const out=path.resolve(process.env.SPOTIFY_PROFILE_OUTPUT||'output/spotify-gpu-20261014/profile.json');
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://profile.test/**',r=>{
   const u=new URL(r.request().url());if(u.pathname==='/api/state')return r.fulfill({json:{playing:false}});
   const file=u.pathname==='/overlay'?'overlay.html':u.pathname.slice(1);
   return r.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://profile.test/overlay');
  await page.waitForFunction(()=>VisualMorph.status().plans.prepared===VisualJourney.names.length*(VisualJourney.names.length-1));
  await page.evaluate(()=>{
   cancelAnimationFrame(frame);frame=0;window.fetch=()=>new Promise(()=>{});
   window.studyRenderer=new VisualStageRenderer();
   window.studySignal={playing:true,energy:.4,bass:.23,treble:.12,beat:.3,flux:.1,width:.5,pitch:.3,tonality:.6,
    voice_levels:Array.from({length:8},(_,i)=>.08+.1*Math.sin(i*.9)**2),
    bands:Array.from({length:48},(_,i)=>.04+.3*Math.sin(i*.25)**2),waveform:Array.from({length:128},(_,i)=>Math.sin(i*.2)*.4)};
   for(let i=0;i<120;i++){world.step(studySignal,.01);journey.step(world,.01,studySignal);}
  });
  const cdp=await page.context().newCDPSession(page),system=await browser.newBrowserCDPSession();
  await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});
  await cdp.send('Profiler.start');const before=await system.send('SystemInfo.getProcessInfo');
  const result=await page.evaluate(()=>{
   const r=studyRenderer,gl=r.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
   const specs=VisualJourney.names.map((name,stage)=>({name,stage,next:(stage+1)%VisualJourney.names.length,mix:0}));
   specs.push(...[[0,5],[5,6],[6,7],[2,3]].map(([stage,next])=>({name:`${stage}:${next}`,stage,next,mix:.5})));
   const cases=[];
   for(const spec of specs){
    const times=[];
    for(let i=0;i<100;i++){
     const s={...studySignal,bass:.15+.12*Math.sin(i*.4)**2,beat:i%13===0?.6:0};
     for(let j=0;j<3;j++){world.step(s,.01);journey.step(world,.01,s);}
     journey.stage=spec.stage;journey.next=spec.next;journey.transitioning=spec.mix>0;journey.mix=spec.mix;
     const t=performance.now();r.paint(null,world,journey);const ms=performance.now()-t;gl.finish();
     if(i>=20)times.push(ms);
    }
    times.sort((a,b)=>a-b);cases.push({...spec,medianMs:times[times.length>>1],p95Ms:times[Math.floor(times.length*.95)],vertices:r.count});
   }
   return {cases,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,glError:gl.getError(),resources:r.resources.length};
  });
  const after=await system.send('SystemInfo.getProcessInfo'),{profile}=await cdp.send('Profiler.stop');
  const counts=new Map();for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
  result.hotspots=profile.nodes.map(n=>({name:n.callFrame.functionName,file:n.callFrame.url.split('/').pop(),line:n.callFrame.lineNumber+1,samples:counts.get(n.id)||0})).sort((a,b)=>b.samples-a.samples).slice(0,30);
  result.cpu=after.processInfo.map(p=>({type:p.type,pid:p.id,seconds:p.cpuTime-(before.processInfo.find(q=>q.id===p.id)?.cpuTime||p.cpuTime)}));
  result.errors=errors;fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));
  fs.writeFileSync(out.replace(/\.json$/,'.cpuprofile'),JSON.stringify(profile));
  console.log(JSON.stringify(result));if(errors.length||result.glError)throw Error('Renderer failed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
