// Compare the current renderer to a frozen pre-change renderer on identical
// evolving music. Real GPU pixels, renderer process CPU and bounded lifetime.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const reference=path.resolve(process.env.SPOTIFY_REFERENCE_DIR||'tools/fixtures/spotify-renderer-before-gpu');
 const web=path.resolve(process.env.SPOTIFY_CANDIDATE_DIR||'output/spotify-gpu-20261014/prototype-web'),out=path.resolve(process.env.SPOTIFY_GPU_REPORT||'output/spotify-gpu-20261014/paired.json');
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://paired.test/**',r=>{
   const u=new URL(r.request().url());if(u.pathname==='/api/state')return r.fulfill({json:{playing:false}});
   const file=u.pathname==='/overlay'?'overlay.html':u.pathname.slice(1);
   return r.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://paired.test/overlay');await page.waitForFunction(()=>VisualMorph.status().plans.prepared===VisualJourney.names.length*(VisualJourney.names.length-1));
  await page.addScriptTag({content:fs.readFileSync(path.join(reference,'stage_depth.js'),'utf8').replace('root.VisualDepth=','root.ReferenceDepth=')});
  await page.addScriptTag({content:fs.readFileSync(path.join(reference,'stage_renderer.js'),'utf8').replace('root.VisualStageRenderer=','root.ReferenceRenderer=').replace(/\bVisualDepth\b/g,'ReferenceDepth')});
  await page.evaluate(()=>{
   cancelAnimationFrame(frame);frame=0;window.fetch=()=>new Promise(()=>{});
   window.candidates=[new ReferenceRenderer(),new VisualStageRenderer()];
   window.signalAt=i=>({playing:true,energy:.15+.25*Math.sin(i*.016)**2,bass:.15+.12*Math.sin(i*.4)**2,treble:.12,beat:i%13===0?.6:0,flux:.1,width:.5,pitch:.3,tonality:.6,
    voice_levels:Array.from({length:8},(_,k)=>.03+.25*Math.sin(k*.9+i*.03)**2),
    bands:Array.from({length:48},(_,k)=>.04+.3*Math.sin(k*.25+i*.012)**2),waveform:Array.from({length:128},(_,k)=>Math.sin(k*.2)*.4)});
   window.fixture=()=>{const w=new ReactiveWorld({geometry:false}),j=new VisualJourney();for(let i=0;i<120;i++){const s=signalAt(i);w.step(s,.01);j.step(w,.01,s);}return {w,j};};
  });
  const result=await page.evaluate(({full,shots})=>{
   const {w,j}=fixture(),cases=[],captures=[],r=candidates[1],old=candidates[0];
   const specs=VisualJourney.names.map((name,stage)=>({name,stage,next:(stage+1)%VisualJourney.names.length,mix:0}));
   for(let from=0;from<VisualJourney.names.length;from++)for(let to=0;to<VisualJourney.names.length;to++)if(from!==to&&(full||to===(from+1)%VisualJourney.names.length))
    for(const mix of (full?[.001,.25,.5,.75,.999]:[.001,.5,.999]))specs.push({name:`${from}:${to}`,stage:from,next:to,mix});
   const p=new Uint8Array(1200*660*4),q=new Uint8Array(p.length);
   for(let k=0;k<specs.length;k++){
    const spec=specs[k],s=signalAt(k+120);w.step(s,.03);j.step(w,.03,s);
    j.stage=spec.stage;j.next=spec.next;j.mix=spec.mix;j.transitioning=spec.mix>0;
    for(const [rr,pixels] of [[old,p],[r,q]]){rr.paint(null,w,j);rr.gl.readPixels(0,0,1200,660,rr.gl.RGBA,rr.gl.UNSIGNED_BYTE,pixels);}
    if(shots&&spec.mix===0&&[1,6,11].includes(spec.stage))captures.push({stage:spec.stage,before:old.canvas.toDataURL(),after:r.canvas.toDataURL()});
    let sum=0,max=0,changed=0,large=0,lit=0;
    for(let i=0;i<p.length;i+=4){if(p[i+3]||q[i+3])lit++;let pixel=0;for(let c=0;c<4;c++){const d=Math.abs(p[i+c]-q[i+c]);sum+=d;max=Math.max(max,d);pixel=Math.max(pixel,d);}if(pixel)changed++;if(pixel>8)large++;}
    cases.push({...spec,meanByteError:sum/p.length,maxByteError:max,changedPixels:changed,largePixels:large,litPixels:lit});
   }
   return {cases,captures,resources:r.resources.length,errors:candidates.map(r=>r.gl.getError())};
  },{full:process.env.SPOTIFY_GPU_FULL==='1',shots:!!process.env.SPOTIFY_GPU_SHOTS});
  for(const shot of result.captures)for(const side of ['before','after']){fs.mkdirSync(process.env.SPOTIFY_GPU_SHOTS,{recursive:true});fs.writeFileSync(path.join(process.env.SPOTIFY_GPU_SHOTS,`${shot.stage}-${side}.png`),Buffer.from(shot[side].split(',')[1],'base64'));}
  delete result.captures;
  // Warm the same persistent benchmark function, both renderer paths and the
  // full evolving scene mix before timing. Fresh evaluate closures and cold JIT
  // can overwhelm a small transport improvement and bias serial comparisons.
  await page.evaluate(()=>{
   window.runFrames=(variant,count=480)=>{
    const {w,j}=fixture(),r=candidates[variant],times=[];const began=performance.now();
    for(let i=0;i<count;i++){
     const s=signalAt(i);for(let k=0;k<3;k++){w.step(s,.01);j.step(w,.01,s);}
     j.stage=Math.floor(i/30)%12;j.next=(j.stage+1)%12;j.transitioning=i%30>=20;j.mix=j.transitioning?(i%30-20)/10:0;
     const t=performance.now();r.paint(null,w,j);times.push(performance.now()-t);r.gl.finish();
    }
    times.sort((a,b)=>a-b);return {wallMs:performance.now()-began,medianMs:times[count>>1],p95Ms:times[Math.floor(count*.95)]};
   };
  });
  await page.evaluate(()=>{runFrames(0,1500);runFrames(1,1500);runFrames(1,500);runFrames(0,500);});
  const system=await browser.newBrowserCDPSession();result.cpu=[];
  for(const variant of [0,1,1,0,1,0,0,1,0,1,1,0]){
   const before=await system.send('SystemInfo.getProcessInfo');
   const timing=await page.evaluate(variant=>runFrames(variant),variant);
   const after=await system.send('SystemInfo.getProcessInfo');
   const cpu=after.processInfo.filter(p=>p.type==='renderer').reduce((s,p)=>s+p.cpuTime-(before.processInfo.find(q=>q.id===p.id)?.cpuTime||p.cpuTime),0);
   result.cpu.push({variant:variant?'gpu':'reference',cpuSeconds:cpu,...timing});
  }
  result.release=await page.evaluate(()=>{for(const r of candidates)r.dispose();return candidates.every(r=>!r.resources.length&&r.vertices===null);});
  result.pageErrors=errors;fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));
  console.log(JSON.stringify({frames:result.cases.length,worstMean:Math.max(...result.cases.map(c=>c.meanByteError)),worstLargePixels:Math.max(...result.cases.map(c=>c.largePixels)),cpu:result.cpu,release:result.release,errors}));
  assert.deepEqual(errors,[]);assert(result.errors.every(x=>x===0));assert(result.release);
  assert(result.cases.every(c=>c.meanByteError<.02&&c.largePixels<150),'GPU output must retain the baseline image within tiny floating-point edge differences');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
