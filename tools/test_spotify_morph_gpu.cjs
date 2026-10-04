// Actual GPU pixels across every directed transition, including both seams.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],web=path.resolve('mini projects/spotify/web');
  page.on('pageerror',e=>errors.push(e.message));
  const signal={playing:true,title:'Continuous scene study',artist:'Original audio response',energy:.4,bass:.2,treble:.12,beat:.3,flux:.1,width:.5,pitch:.3,tonality:.6,
   bands:Array.from({length:48},(_,i)=>.04+.3*Math.sin(i*.25)**2),waveform:Array.from({length:128},(_,i)=>Math.sin(i*.2)*.4)};
  await page.route('http://morph.test/**',r=>{const u=new URL(r.request().url());if(u.pathname==='/api/state')return r.fulfill({json:signal});
   const file=u.pathname==='/overlay'?'overlay.html':u.pathname.slice(1);
   return r.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('http://morph.test/overlay');await page.waitForFunction(()=>radiance?.frames>2);
  const results=await page.evaluate(()=>{
   cancelAnimationFrame(frame);frame=0;window.fetch=()=>new Promise(()=>{});
   for(let i=0;i<90;i++){world.step(data,1/30);journey.step(world,1/30,data);}
   const results=[],probe=document.createElement('canvas');probe.width=400;probe.height=220;const pc=probe.getContext('2d');
   function shot(){clear();present();pc.clearRect(0,0,400,220);pc.drawImage(canvas,0,0,400,220);const p=pc.getImageData(0,0,400,220).data;
    let lit=0,mass=0;for(let i=3;i<p.length;i+=4){mass+=p[i];if(p[i]>12)lit++;}return {p,lit,mass};}
   function difference(a,b){let d=0,n=0;for(let i=3;i<a.p.length;i+=4)if(a.p[i]>12||b.p[i]>12){n++;d+=Math.abs(a.p[i]-b.p[i]);}return d/Math.max(1,n);}
   for(let from=0;from<VisualJourney.names.length;from++)for(let to=0;to<VisualJourney.names.length;to++)if(from!==to){
    journey.stage=from;journey.next=to;journey.transitioning=true;journey.mix=0;const start=shot();
    journey.mix=.001;const entry=shot();journey.mix=.5;const began=performance.now(),middle=shot(),ms=performance.now()-began;
    journey.mix=.999;const exit=shot();journey.mix=1;const end=shot();
    results.push({from,to,entry:difference(start,entry),exit:difference(exit,end),middleLit:middle.lit,
     middleCoverage:middle.mass/Math.max(1,Math.min(start.mass,end.mass)),ms,vertices:radiance.status().vertices});
   }
   return {pairs:results,resources:radiance.status().resources,error:radiance.gl.getError()};
  });
  const worstEntry=Math.max(...results.pairs.map(p=>p.entry)),worstExit=Math.max(...results.pairs.map(p=>p.exit));
  console.log(JSON.stringify({worstEntry,worstExit,minCoverage:Math.min(...results.pairs.map(p=>p.middleCoverage)),
   meanFrameMs:results.pairs.reduce((s,p)=>s+p.ms,0)/results.pairs.length,maximumFrameMs:Math.max(...results.pairs.map(p=>p.ms)),
   worst:results.pairs.filter(p=>p.entry>4||p.exit>4),resources:results.resources}));
  assert(results.pairs.every(p=>p.middleLit>800&&p.middleCoverage>.18),'the morph must never fade to a blank frame');
  assert(worstEntry<4&&worstExit<4,'both morph seams must match their authored scene pixels');
  assert.equal(results.resources,3);assert.equal(results.error,0);assert.deepEqual(errors,[]);
  if(process.env.SPOTIFY_STILL_OUTPUT){
   await page.addStyleTag({content:'body{background:#080d17}'});
   for(const [from,to] of [[0,5],[5,6],[6,7],[2,3]])for(const mix of [.25,.5,.75]){
    await page.evaluate(({from,to,mix})=>{journey.stage=from;journey.next=to;journey.mix=mix;journey.transitioning=true;clear();present();}, {from,to,mix});
    await page.screenshot({path:path.join(process.env.SPOTIFY_STILL_OUTPUT,`morph-${from}-${to}-${mix}.png`)});
   }
  }
  console.log(JSON.stringify({passed:true,pairs:results.pairs.length,seamContinuity:true,nonblank:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
