// Real GPU lifetime/geometry proof; optional frozen reference for before/after QA.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),web=path.resolve(__dirname,'../mini projects/spotify/web');
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://reuse.test/**',r=>{
   const u=new URL(r.request().url());if(u.pathname==='/api/state')return r.fulfill({json:{playing:false}});
   const file=u.pathname==='/overlay'?'overlay.html':u.pathname.slice(1);
   return r.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://reuse.test/overlay');await page.waitForFunction(()=>VisualMorph.status().plans.prepared===VisualJourney.names.length*(VisualJourney.names.length-1));
  if(process.env.SPOTIFY_REFERENCE_DIR){
   const field=path.join(process.env.SPOTIFY_REFERENCE_DIR,'stage_articulation.js');
   if(fs.existsSync(field))await page.addScriptTag({content:fs.readFileSync(field,'utf8').replace('root.VisualArticulation=','root.ReferenceArticulation=')});
   for(const [file,name,substitute] of [['stage_morph.js','VisualMorph','ReferenceMorph'],['stage_renderer.js','VisualStageRenderer','ReferenceRenderer']])
    await page.addScriptTag({content:fs.readFileSync(path.join(process.env.SPOTIFY_REFERENCE_DIR,file),'utf8').replace('root.'+name+'=','root.'+substitute+'=')});
  }
  const report=await page.evaluate(()=>{
   const optimized=VisualMorph,original=globalThis.ReferenceMorph,renderer=new VisualStageRenderer(),oldRenderer=original?new ReferenceRenderer():null;
   const field=globalThis.VisualArticulation,oldField=globalThis.ReferenceArticulation;
   const signal={energy:.4,bass:.2,treble:.12,beat:.3,flux:.1,width:.5,pitch:.3,tonality:.6,
    bands:Array.from({length:48},(_,i)=>.04+.3*Math.sin(i*.25)**2),waveform:Array.from({length:128},(_,i)=>Math.sin(i*.2)*.4)};
   for(let i=0;i<90;i++){world.step(signal,1/30);journey.step(world,1/30,signal);}
   const specs=VisualJourney.names.map((name,from)=>({name,from,to:(from+1)%VisualJourney.names.length,mix:0}));
   for(const [from,to] of [[0,5],[5,6],[6,7],[2,3]])specs.push({name:`${from}:${to}`,from,to,mix:.5});
   function paint(r,m){globalThis.VisualMorph=m;globalThis.VisualArticulation=m===original&&oldField?oldField:field;const start=performance.now();r.paint(null,world,journey);const ms=performance.now()-start;r.gl.finish();return ms;}
   function pixels(r){const p=new Uint8Array(1200*660*4);r.gl.readPixels(0,0,1200,660,r.gl.RGBA,r.gl.UNSIGNED_BYTE,p);return p;}
   const cases=[];let exactVertices=true,exactPixels=true,reusedCommands=true;
   try{
    for(const spec of specs){
     journey.stage=spec.from;journey.next=spec.to;journey.transitioning=spec.mix>0;journey.mix=spec.mix;
     const firstAfter=paint(renderer,optimized),firstBefore=original?paint(oldRenderer,original):null;
     if(original){
      const a=renderer.ordered.subarray(0,renderer.count*10),b=oldRenderer.ordered.subarray(0,oldRenderer.count*10);
      exactVertices=exactVertices&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
      const p=pixels(renderer),q=pixels(oldRenderer);exactPixels=exactPixels&&p.every((v,i)=>v===q[i]);
     }
     for(let i=0;i<8;i++){paint(renderer,optimized);if(original)paint(oldRenderer,original);}
     const pool=renderer.commandPool.slice(),before=[],after=[];
     for(let i=0;i<35;i++){
      // Capture stays at 100 Hz while this fixture paints at roughly 30 FPS.
      // Evolving sound/camera tests retained ordering across changing depths.
      const live={...signal,bass:.15+.12*Math.sin(i*.4)**2,beat:i%13===0?.6:0};
      for(let sample=0;sample<3;sample++){world.step(live,.01);journey.step(world,.01,live);}
      if(i%2&&original)before.push(paint(oldRenderer,original));after.push(paint(renderer,optimized));if(!(i%2)&&original)before.push(paint(oldRenderer,original));
      if(original){const a=renderer.ordered.subarray(0,renderer.count*10),b=oldRenderer.ordered.subarray(0,oldRenderer.count*10);
       exactVertices=exactVertices&&a.length===b.length&&a.every((v,k)=>Object.is(v,b[k]));}
     }
     reusedCommands=reusedCommands&&pool.every((q,i)=>q===renderer.commandPool[i]);
     const median=values=>values.length?values.sort((a,b)=>a-b)[Math.floor(values.length/2)]:null;
     if(original){const p=pixels(renderer),q=pixels(oldRenderer);exactPixels=exactPixels&&p.every((v,i)=>v===q[i]);}
     cases.push({...spec,firstBefore,firstAfter,beforeMs:median(before),afterMs:median(after),vertices:renderer.count,commands:renderer.commands.length});
    }
    const resources=renderer.status().resources,glError=renderer.gl.getError(),memory=optimized.status();
    renderer.dispose();optimized.clear();
    const released=renderer.resources.length===0&&renderer.commandPool.length===0&&renderer.vertices===null&&optimized.status().references===0&&optimized.planCount()===0;
    return {originalReference:!!original,evolvingSound:true,exactVertices,exactPixels,reusedCommands,resources,glError,released,memory,cases};
   }finally{renderer.dispose();oldRenderer?.dispose();globalThis.VisualMorph=optimized;globalThis.VisualArticulation=field;}
  });
  assert(report.exactVertices&&report.exactPixels,'optimization must preserve exact packed vertices and actual GPU pixels');
  assert(report.reusedCommands&&report.released);assert.equal(report.resources,3);assert.equal(report.glError,0);assert.deepEqual(errors,[]);
  if(process.env.SPOTIFY_REUSE_OUTPUT)fs.writeFileSync(process.env.SPOTIFY_REUSE_OUTPUT,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
