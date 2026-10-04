// Finite local HTTP + real-browser benchmark. Measures a published spectrum step
// reaching half-amplitude in an actually submitted production paint, not speaker
// latency or display scanout. Baseline assets are explicitly supplied, immutable.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const baseline=process.env.SPOTIFY_BASELINE_WEB;
assert(baseline,'Set SPOTIFY_BASELINE_WEB to the saved previous assets');
(async()=>{
 let signal={playing:true,title:'Latency fixture',artist:'No audio output',revision:1,audio_revision:0,energy:.12,beat:0,bass:.04,treble:.04,width:.4,balance:0,tonality:.7,
  bands:Array(48).fill(.04),waveform:Array(128).fill(0)},web=baseline;
 const pending=new Map();
 function send(res){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(signal));}
 function flush(){for(const [res,timer] of pending){clearTimeout(timer);pending.delete(res);if(!res.destroyed)send(res);}}
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/state'){
   if(url.searchParams.has('audio_after')&&Number(url.searchParams.get('audio_after'))===signal.audio_revision){
    const timer=setTimeout(()=>{pending.delete(res);if(!res.destroyed)send(res);},250);pending.set(res,timer);
    res.on('close',()=>{clearTimeout(timer);pending.delete(res);});return;
   }return send(res);
  }
  const name=url.pathname==='/overlay'?'overlay.html':url.pathname.slice(1);
  if(!/^[a-z_]+\.(html|css|js)$/.test(name)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  res.end(fs.readFileSync(path.join(web,name)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const ticker=setInterval(()=>{signal.audio_revision++;flush();},20);
 const browser=await chromium.launch({headless:true,channel:'chrome'}),evidence={};
 try{
  for(const [label,folder] of [['before',baseline],['after',path.resolve('mini projects/spotify/web')]]){
   web=folder;signal.bands.fill(.04);
   const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let receive;
   await page.exposeFunction('paintReached',()=>receive?.(performance.now()));
   await page.goto(`http://127.0.0.1:${server.address().port}/overlay`);
   await page.waitForFunction(()=>radiance?.frames>8);
   await page.evaluate(()=>{
    journey.stage=9;journey.age=0;journey.transitioning=false;
    window.probeArmed=false;
    const paint=present;present=function(){paint();if(window.probeArmed&&journey.motion.voices[3]>(Math.sqrt(.04)+Math.sqrt(.4))/2){window.probeArmed=false;window.paintReached();}};
   });
   const trials=[];
   for(let trial=0;trial<10;trial++){
    signal.bands.fill(.04);signal.audio_revision++;flush();
    await page.waitForTimeout(600);
    await page.waitForFunction(()=>journey.motion.voices[3]<.21);
    await page.evaluate(()=>window.probeArmed=true);
    const reached=new Promise(resolve=>receive=resolve),began=performance.now();
    signal.bands.fill(.4);signal.audio_revision++;flush();
    const timeout=setTimeout(()=>receive?.(NaN),1500);
    trials.push((await reached)-began);clearTimeout(timeout);receive=null;
    assert(Number.isFinite(trials.at(-1)),'production paint never reached the new amplitude');
   }
   const status=await page.evaluate(()=>({graphics:radiance.status(),lit:ctx.getImageData(0,0,1200,660).data.filter((v,i)=>i%4===3&&v>20).length}));
   assert(status.lit>1500);assert.deepEqual(errors,[]);
   const sorted=trials.toSorted((a,b)=>a-b);
   evidence[label]={trialsMs:trials,medianMs:sorted[5],p90Ms:sorted[9],lit:status.lit,resources:status.graphics.resources};
   await page.close();
  }
  evidence.reductionPercent=100*(1-evidence.after.medianMs/evidence.before.medianMs);
  console.log(JSON.stringify(evidence));
  if(process.env.SPOTIFY_LATENCY_REPORT)fs.writeFileSync(process.env.SPOTIFY_LATENCY_REPORT,JSON.stringify(evidence,null,2));
  assert(evidence.after.medianMs<evidence.before.medianMs*.7,'response must materially improve');
  assert(evidence.after.medianMs<90,'median published-signal response must stay below 90ms');
 }finally{await browser.close();clearInterval(ticker);for(const timer of pending.values())clearTimeout(timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
