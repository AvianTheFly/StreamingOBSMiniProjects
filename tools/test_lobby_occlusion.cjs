// Read-only full-resolution artwork comparison; never selects an OBS scene.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.EventSource=class{close(){}};});
  await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?paused=1&auto=0&at=12');
  await page.locator('canvas[data-ready=true]').waitFor();
  const results=await page.evaluate(async()=>{
   const {worlds,loadWorld}=await import('./worlds.js');
   const {screenFrame}=await import('./screen-frame.js');
   let copies=0;const original=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(...args){copies++;return original.apply(this,args);};
   const canvas=()=>{const a=document.createElement('canvas');a.width=1920;a.height=1080;return a;};
   const a=canvas(),b=canvas(),ca=a.getContext('2d',{willReadFrequently:true}),cb=b.getContext('2d',{willReadFrequently:true});
   const results=[];
   try{
    for(const entry of worlds){
     const w=await loadWorld(entry.id),art=w.createMotion();await art.load();
     let fullDraws=0,culledDraws=0,frames=0;
     try{
      for(const holes of [w.scene.holes,[[600,140,800,370],[20,290,450,510],[1500,350,300,520]]]){
       for(const t of [1,12,91]){
        const active=[{...w.cues[0],kind:w.cues[0].id,started:t-3,seed:91,id:'test'}];
        const draw=(c,cull)=>{
         c.clearRect(0,0,1920,1080);copies=0;art.draw(c,t,active,cull?holes:[]);
         // Finite guests retain exactly the same blend and clipping operations.
         const e=active[0];c.save();w.clip?.(c,e);w.artists[e.kind]?.(c,3,e,art);c.restore();
         screenFrame(c,holes[0],w.id);for(const rect of holes)c.clearRect(...rect);
         return copies;
        };
        fullDraws+=draw(ca,false);culledDraws+=draw(cb,true);
        const before=ca.getImageData(0,0,1920,1080).data,after=cb.getImageData(0,0,1920,1080).data;
        if(!before.every((v,i)=>v===after[i]))throw Error('Pixel mismatch: '+entry.id+' at '+t);
        frames++;
       }
      }
      results.push({world:entry.id,pixelIdenticalFrames:frames,fullDraws,culledDraws,saved:fullDraws-culledDraws});
     }finally{art.dispose();}
    }
   }finally{CanvasRenderingContext2D.prototype.drawImage=original;a.width=b.width=1;}
   return results;
  });
  assert.deepEqual(errors,[]);assert.equal(results.length,11);
  assert(results.every(r=>r.fullDraws>=r.culledDraws));assert(results.some(r=>r.saved>0));
  console.log(JSON.stringify({passed:true,results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
