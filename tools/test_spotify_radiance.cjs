// Real browser/GPU regressions: transparency, bounded resources, read-only
// presentation, full frame cost and context-loss recovery. No live service I/O.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const web=path.resolve(__dirname,'../mini projects/spotify/web');
const signal={playing:true,title:'Radiance study',artist:'Original test signal',energy:.38,bass:.23,treble:.08,beat:.2,
 pitch:.35,tonality:.75,width:.35,balance:0,flux:.12,
 bands:Array.from({length:48},(_,i)=>.012+.45*Math.exp(-(((i-9)/7)**2))+.12*Math.exp(-(((i-25)/5)**2))),
 waveform:Array.from({length:128},(_,i)=>.45*Math.sin(i*.18))};
async function route(page){await page.route('http://radiance.test/**',route=>{
 const name=new URL(route.request().url()).pathname;
 if(name==='/api/state')return route.fulfill({json:signal});
 const file=name==='/overlay'?'overlay.html':name.slice(1);
 return route.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
});}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:400,height:300}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await route(page);await page.goto('http://radiance.test/overlay');
  await page.waitForFunction(()=>document.getElementById('widget').dataset.renderer==='webgl2');
  // Production paints directly into WebGL. Read a fresh paint through a
  // separate canvas; a drawing surface cannot also acquire a 2D context.
  await page.evaluate(()=>{window.readRadiancePixels=()=>{
   const probe=document.createElement('canvas');probe.width=canvas.width;probe.height=canvas.height;
   const context=probe.getContext('2d');context.drawImage(canvas,0,0);return context;
  };});
  const evidence=await page.evaluate(()=>{
   cancelAnimationFrame(frame);frame=0;
   const initial=radiance.status(),samples=[];
   for(let stage=0;stage<VisualJourney.names.length;stage++){
    journey.stage=stage;journey.next=(stage+1)%VisualJourney.names.length;journey.mix=.4;journey.transitioning=true;
    const start=performance.now();
    for(let i=0;i<6;i++){world.step(data,1/30);journey.step(world,1/30);clear();present();}
    samples.push((performance.now()-start)/6);
   }
   const snapshot=JSON.stringify([world.snapshot(),journey.snapshot()]);for(let i=0;i<3;i++){clear();present();}
   const c=readRadiancePixels(),pixels=c.getImageData(360,90,480,480).data;
   let lit=0,white=0;
   for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>30){lit++;if(pixels[i]>245&&pixels[i+1]>245&&pixels[i+2]>245)white++;}}
   const border=c.getImageData(0,0,12,660).data.some((v,i)=>i%4===3&&v>0);
   return {initial,final:radiance.status(),samples,readOnly:snapshot===JSON.stringify([world.snapshot(),journey.snapshot()]),
    error:radiance.gl.getError(),lit,white,border,history:journey.history.length};
  });
  assert(evidence.readOnly,'repeated paints must not alter musical history');
  assert.equal(evidence.error,0,'all instruments and morphs must render without GL errors');
  assert.equal(evidence.initial.resources,evidence.final.resources,'GPU resources must not accumulate across frames/forms');
  assert(evidence.final.vertices>1000&&evidence.final.vertices<evidence.final.capacity);assert(evidence.history<=48);
  assert.equal(evidence.final.bloom,false,'the contour renderer must not add a diffuse halo');
  assert.deepEqual(evidence.final.resolution,[1200,660]);
  assert(evidence.lit>1500,'ordinary audio must illuminate a substantial sculptural surface');
  assert(evidence.white/evidence.lit<.025,'the material should retain color, even on accents: '+JSON.stringify({white:evidence.white,lit:evidence.lit}));assert.equal(evidence.border,false);
  const lightChanges=await page.evaluate(()=>{
   const changes=[];journey.transitioning=false;
   for(let stage=0;stage<VisualJourney.names.length;stage++){
    journey.stage=stage;journey.lamp=0;clear();present();
    const a=readRadiancePixels().getImageData(0,0,1200,660).data;
    journey.lamp=2.8;clear();present();const b=readRadiancePixels().getImageData(0,0,1200,660).data;
    let delta=0,lit=0,moved=0;for(let i=0;i<a.length;i+=4){if(a[i+3]>15||b[i+3]>15){
     // A moving highlight can change color at constant opacity. Compare its
     // visible premultiplied color as well as coverage on a transparent source.
     let change=Math.abs(a[i+3]-b[i+3]);
     for(let k=0;k<3;k++)change+=Math.abs(a[i+k]*a[i+3]-b[i+k]*b[i+3])/(255*3);
     delta+=change;if(change>2)moved++;
     lit++;
    }}
    changes.push({mean:delta/Math.max(lit,1),moved:moved/Math.max(lit,1)});
   }
   return changes;
  });
  // Supporting highlights occupy a small part of the clean silhouette. Require
  // visible changes above two levels over at least 0.5% of its lit pixels;
  // averaging over the entire opaque body would demand a whole-body flash.
  assert(lightChanges.every(v=>v.moved>.005),'rendered highlights must travel in every scene, even with path motion held: '+JSON.stringify(lightChanges));
  const physicalChanges=await page.evaluate(()=>{
   const changes=[];journey.transitioning=false;journey.motion.kickAge=.08;
   for(let stage=0;stage<VisualJourney.names.length;stage++){
    journey.stage=stage;journey.motion.spring=0;clear();present();const a=readRadiancePixels().getImageData(0,0,1200,660).data;
    journey.motion.spring=.35;clear();present();const b=readRadiancePixels().getImageData(0,0,1200,660).data;
    let delta=0,lit=0;for(let i=0;i<a.length;i+=4){if(a[i+3]>15||b[i+3]>15){delta+=Math.abs(a[i+3]-b[i+3]);lit++;}}
    changes.push(delta/Math.max(lit,1));
   }return changes;
  });
  assert(physicalChanges.every(v=>v>8),'a bass rebound must visibly displace the rendered structure in every scene');
  // A broad threshold avoids treating machine load as a deterministic benchmark.
  assert(evidence.samples.reduce((s,v)=>s+v,0)/evidence.samples.length<28,'full GPU presentation and simulation must fit a 30-fps frame');
  await page.evaluate(()=>{window.lostRenderer=radiance;window.contextControl=radiance.gl.getExtension('WEBGL_lose_context');contextControl.loseContext();});
  await page.waitForFunction(()=>lostRenderer.lost);
  await page.evaluate(()=>{clear();present();});assert.equal(await page.locator('#widget').getAttribute('data-renderer'),'canvas');
  await page.evaluate(()=>contextControl.restoreContext());
  await page.waitForFunction(()=>lostRenderer.disposed);await page.evaluate(()=>{clear();present();});
  assert.equal(await page.locator('#widget').getAttribute('data-renderer'),'webgl2');
  const released=await page.evaluate(()=>{const old=radiance;radiance.dispose();radiance.dispose();return old.status().resources;});assert.equal(released,0);
  const fallback=await browser.newPage();await route(fallback);
  await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);};});
  await fallback.goto('http://radiance.test/overlay');await fallback.waitForFunction(()=>document.getElementById('widget').dataset.renderer==='canvas');
  assert(await fallback.evaluate(()=>graphicsUnavailable&&radiance===null),'unavailable GPU must select a stable Canvas fallback');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,meanFrameMs:evidence.samples.reduce((s,v)=>s+v,0)/evidence.samples.length,
   byInstrument:evidence.samples.map(v=>+v.toFixed(2)),litPixels:evidence.lit,whitePixels:evidence.white,
   resources:evidence.final.resources,lightChanges,physicalChanges,contextRecovery:true,canvasFallback:true}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
