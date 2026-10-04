/* Finite real-browser proof of reef motion, individual guests and live apertures. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),{chromium}=require('playwright');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);},out='C:/StreamingMedia/LivingLobbies/Reef/review',base='http://127.0.0.1:7420/lobby-motion/';
async function main(){
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 async function ready(){try{await page.locator('canvas[data-ready=true]').waitFor();}catch(e){throw new Error(errors.join('\n')||e.message);}}
 try{
  await page.goto(base+'index.html?preview=1&paused=1&at=12&auto=0');await ready();
  const mechanics=await page.evaluate(async()=>{
   const {AmbientClock}=await import('./shared/world-motion.js'),{cues}=await import('./reef-cues.js'),clock=new AmbientClock(cues,71),all=new Set(),counts=new Set();for(let t=0;t<1800;t+=.5){const events=clock.active(t);counts.add(events.length);for(const e of events)all.add(e.kind);}const maxCache=clock.cache.size,first=clock.plan(2).map(e=>e.kind).join(','),second=clock.plan(3).map(e=>e.kind).join(',');clock.dispose();return {kinds:[...all],counts:[...counts],maxCache,variety:first!==second,disposed:clock.cache.size===0};
  });assert(mechanics.kinds.length===9&&mechanics.counts.length>=3&&mechanics.maxCache<=4&&mechanics.variety&&mechanics.disposed,'Ambient clock failed variety or bounded cleanup');
  // The painted environment moves even with every guest disabled.
  const motion=await page.evaluate(async()=>{
   const {ReefMotion}=await import('./reef-scene.js'),art=await new ReefMotion().load(),canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const c=canvas.getContext('2d',{willReadFrequently:true});art.draw(c,1,[]);const first=c.getImageData(384,110,270,158).data;c.clearRect(0,0,1920,1080);art.draw(c,3,[]);const second=c.getImageData(384,110,270,158).data;let changed=0;for(let i=0;i<first.length;i+=4)if(Math.abs(first[i]-second[i])+Math.abs(first[i+1]-second[i+1])>6)changed++;art.dispose();return {changed,disposed:art.patches.length===0&&art.base.width===1};
  });assert(motion.changed>100&&motion.disposed,'Original turtle painting stayed still or retained resources');
  const baseline=await sharp(await page.locator('canvas').screenshot()).ensureAlpha().raw().toBuffer();
  const visibleGuests={};
  for(const [cue,age] of [['teapot',4],['diver',4],['manta',4],['jelly',6],['courier',4],['school',5],['crab',5],['treasure',4],['chart',6]]){
   await page.goto(base+`index.html?preview=1&paused=1&at=12&auto=0&cue=${cue}&age=${age}`);await ready();await page.screenshot({path:path.join(out,`reef-${cue}.png`)});
   assert((await page.locator('canvas').getAttribute('data-events')).includes(cue),cue+' failed to appear');
   const pixels=await sharp(await page.locator('canvas').screenshot()).ensureAlpha().raw().toBuffer();let changed=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-baseline[i])+Math.abs(pixels[i+1]-baseline[i+1])+Math.abs(pixels[i+2]-baseline[i+2])>18)changed++;visibleGuests[cue]=changed;
   assert(visibleGuests[cue]>100,cue+' was announced but did not visibly paint');
  }
  const holes=[[600,140,800,370],[20,290,450,510],[1500,350,300,520]];
  await page.goto(base+'index.html?paused=1&at=12&cue=jelly&age=6&holes='+encodeURIComponent(JSON.stringify(holes)));await ready();
  const alpha=await page.evaluate(holes=>{const c=document.querySelector('canvas').getContext('2d',{willReadFrequently:true});return holes.map(([x,y,w,h])=>{const a=c.getImageData(x,y,w,h).data;let max=0;for(let i=3;i<a.length;i+=4)max=Math.max(max,a[i]);return max;});},holes);assert(alpha.every(x=>x===0),'Animation covered a personalized camera, screen or chat aperture');
  await page.goto(base+'index.html?paused=1&at=12');await ready();const ambientBefore=JSON.parse(await page.locator('canvas').getAttribute('data-events'));assert(ambientBefore.length>0,'Automatic continuity fixture has no guests');
  await page.evaluate(()=>{window.postMessage({type:'living-lobby',cue:'crab',id:'continuity'},location.origin);window.postMessage({type:'living-lobby',automatic:false},location.origin);});await page.waitForFunction(()=>document.querySelector('canvas').dataset.automatic==='false');const ambientAfter=JSON.parse(await page.locator('canvas').getAttribute('data-events'));assert(ambientBefore.every(e=>ambientAfter.some(a=>a.id===e.id&&a.started===e.started)),'Manual entry or disabling automatic entrances erased an existing visitor');
  await page.goto(base+'studio.html');await page.locator('[data-cue]').last().waitFor();const frame=page.frames().find(f=>f.url().includes('index.html'));await frame.locator('canvas[data-ready=true]').waitFor();await page.locator('#auto').uncheck();await page.locator('[data-cue=crab]').click();const before=JSON.parse(await frame.locator('canvas').getAttribute('data-events'));await page.locator('[data-cue=crab]').click();await page.locator('[data-cue=diver]').click();const after=JSON.parse(await frame.locator('canvas').getAttribute('data-events'));assert(after.filter(e=>e.kind==='crab'&&e.manual).length===2&&after.some(e=>e.id===before[0].id&&e.started===before[0].started),'Repeat or mixed guest cancelled an earlier entrance');
  await page.locator('#pause').click();const frozen=await frame.locator('canvas').getAttribute('data-time');await page.waitForTimeout(400);assert(await frame.locator('canvas').getAttribute('data-time')===frozen,'Pause retained an active loop');await page.locator('#pause').click();await frame.waitForFunction(t=>Number(document.querySelector('canvas').dataset.time)>Number(t)+.2,frozen);
  await page.screenshot({path:path.join(out,'reef-studio.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Reef preview overflows mobile width');await page.screenshot({path:path.join(out,'reef-mobile.png'),fullPage:true});
  const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:720}}}),videoPage=await context.newPage();videoPage.on('pageerror',e=>errors.push(e.message));await videoPage.goto(base+'index.html?preview=1&at=1');await videoPage.locator('canvas[data-ready=true]').waitFor();const seen=new Set();
  for(let i=0;i<20;i++){await videoPage.waitForTimeout(2000);for(const e of JSON.parse(await videoPage.locator('canvas').getAttribute('data-events')))seen.add(e.kind);}
  const paintMs=await videoPage.locator('canvas').getAttribute('data-paint-ms'),video=videoPage.video();await context.close();await video.saveAs(path.join(out,'living-reef-preview.webm'));assert(seen.size>=5,'Too little happens without manual presses');assert(errors.length===0,errors.join('\n'));
  const report={mechanics,motion,visibleGuests,protectedApertures:alpha,automaticContinuity:true,manualOverlap:true,pause:true,mobile:true,automaticKinds:[...seen],paintMs,errors};fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
