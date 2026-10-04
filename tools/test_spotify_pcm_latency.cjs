// Real PCM -> production DSP fixture -> HTTP -> production geometry paint.
// Models the saved 30-fps source and the new 60-fps source explicitly. No audio
// is played and no live service/settings are touched. Fixtures retain timestamps.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.SPOTIFY_REALTIME_OUTPUT;
assert(base,'Set SPOTIFY_REALTIME_OUTPUT to the immutable baseline and PCM fixture folder');
const cases=JSON.parse(fs.readFileSync(path.join(base,'pcm-fixture.json')));
(async()=>{
 let web,signal,published=0;
 const pending=new Map();
 function send(res){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...signal,playing:true,title:'PCM latency fixture',artist:'No speaker output',revision:1,audio_revision:published}));}
 function flush(){for(const [res,timer] of pending){clearTimeout(timer);pending.delete(res);if(!res.destroyed)send(res);}}
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/api/state'){
   if(Number(u.searchParams.get('audio_after'))===published&&u.searchParams.has('audio_after')){
    const timer=setTimeout(()=>{pending.delete(res);if(!res.destroyed)send(res);},250);pending.set(res,timer);
    res.on('close',()=>{clearTimeout(timer);pending.delete(res);});return;
   }return send(res);
  }
  const name=u.pathname==='/overlay'?'overlay.html':u.pathname.slice(1);
  if(!/^[a-z_]+\.(html|css|js)$/.test(name)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(path.join(web,name)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'chrome'}),evidence={};
 try{
  for(const label of ['before','after']){
   web=label==='before'?path.join(base,'before-web'):path.resolve('mini projects/spotify/web');
   evidence[label]=[];
   for(const item of cases){
    const frames=item[label],quiet=frames[0],loud=frames.at(-1),lane=loud.bands.indexOf(Math.max(...loud.bands)),voice=Math.floor(lane/6);
    const amplitude=f=>Math.sqrt(f.bands.slice(voice*6,voice*6+6).reduce((a,b)=>a+b,0)/6);
    const threshold=amplitude(quiet)+(amplitude(loud)-amplitude(quiet))*.9;
    signal=quiet;published++;flush();
    const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));let reach;
    await page.exposeFunction('reached',()=>reach?.(performance.now()));
    await page.addInitScript(fps=>{
     const raf=requestAnimationFrame.bind(window);let last=0;
     window.requestAnimationFrame=callback=>raf(function frame(now){if(now-last>=1000/fps-1){last=now;callback(now);}else raf(frame);});
    },label==='before'?30:60);
    await page.goto(`http://127.0.0.1:${server.address().port}/overlay`);
    await page.waitForFunction(()=>radiance?.frames>8,null,{polling:50});
    await page.evaluate(({voice,threshold})=>{
     journey.stage=9;journey.transitioning=false;window.armed=false;
     const paint=present;present=()=>{paint();if(window.armed&&journey.motion.voices[voice]>=threshold){window.armed=false;window.reached();}};
    },{voice,threshold});
    const trials=[];
    for(let trial=0;trial<8;trial++){
     signal=quiet;published++;flush();await page.waitForTimeout(650+trial*3);
     await page.waitForFunction(({voice,level})=>Math.abs(journey.motion.voices[voice]-level)<.001,{voice,level:amplitude(quiet)},{polling:50});
     await page.evaluate(()=>window.armed=true);
     const done=new Promise(r=>reach=r),start=performance.now();let index=frames.findIndex(f=>f.timeMs>=0)-1;
     const timer=setInterval(()=>{
      const age=performance.now()-start;let newest=index;
      while(newest+1<frames.length&&frames[newest+1].timeMs<=age)newest++;
      if(newest!==index){index=newest;signal=frames[index];published++;flush();}
     },2);
     const timeout=setTimeout(()=>reach?.(NaN),1500);
     trials.push((await done)-start);clearInterval(timer);clearTimeout(timeout);reach=null;
     assert(Number.isFinite(trials.at(-1)),'PCM response never reached 90% in a production paint');
    }
    const lit=await page.evaluate(()=>ctx.getImageData(0,0,1200,660).data.filter((v,i)=>i%4===3&&v>20).length);
    assert(lit>1500);assert.deepEqual(errors,[]);
    const sorted=trials.toSorted((a,b)=>a-b);
    evidence[label].push({frequency:item.frequency,voice,trialsMs:trials,medianMs:sorted[4],p90Ms:sorted[7],lit});
    await page.close();
   }
  }
  evidence.reductions=evidence.after.map((v,i)=>({frequency:v.frequency,percent:100*(1-v.medianMs/evidence.before[i].medianMs)}));
  fs.writeFileSync(path.join(base,'pcm-to-paint.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
  for(let i=0;i<3;i++)assert(evidence.after[i].medianMs<evidence.before[i].medianMs*.75,'complete PCM-to-paint response must materially improve');
  assert(evidence.after.every(v=>v.medianMs<75),'all frequency registers must reach 90% within 75ms in this fixture');
 }finally{
  await browser.close();for(const timer of pending.values())clearTimeout(timer);
  server.closeAllConnections();await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
