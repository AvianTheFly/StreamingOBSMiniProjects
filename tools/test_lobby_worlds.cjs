/* Finite actual-render checks for the authored living-world catalog. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),{chromium}=require('playwright');
const base='http://127.0.0.1:7420/lobby-motion/',out='C:/StreamingMedia/LivingLobbies/catalog/review';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
async function pixels(page){return sharp(await page.locator('canvas').screenshot()).ensureAlpha().raw().toBuffer();}
function difference(a,b){let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>18)changed++;return changed;}
async function main(){
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],report=[];
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const ready=()=>page.locator('canvas[data-ready=true]').waitFor();
 try{
  await page.goto(base+'index.html?paused=1&auto=0');await ready();const catalog=await page.evaluate(async()=>{const {worlds,loadWorld}=await import('./worlds.js');return Promise.all(worlds.map(async entry=>{const w=await loadWorld(entry.id);return {id:entry.id,source:w.scene.source,holes:w.scene.holes,cues:w.cues.map(c=>c.id)};}));});
  const focus=process.argv.find(a=>a.startsWith('--focus='))?.slice(8),worlds=focus?catalog.filter(w=>w.id===focus):catalog;assert(worlds.length>0,'Unknown focus world');
  for(const world of worlds){
   await page.goto(base+`index.html?world=${world.id}&preview=1&paused=1&auto=0&at=12`);await ready();const baseline=await pixels(page),guests={};
   for(const cue of world.cues){await page.goto(base+`index.html?world=${world.id}&preview=1&paused=1&auto=0&at=12&cue=${cue}&age=5`);await ready();guests[cue]=difference(baseline,await pixels(page));assert(guests[cue]>100,world.id+'/'+cue+' does not visibly draw');await page.screenshot({path:path.join(out,`${world.id}-${cue}.png`)});}
   const painted=await page.evaluate(async id=>{const {loadWorld}=await import('./worlds.js'),world=await loadWorld(id),art=await world.createMotion().load(),surface=document.createElement('canvas');surface.width=1920;surface.height=1080;const c=surface.getContext('2d',{willReadFrequently:true});art.draw(c,1,[]);const a=c.getImageData(0,0,1920,1080).data;c.clearRect(0,0,1920,1080);art.draw(c,3,[]);const b=c.getImageData(0,0,1920,1080).data;let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])>10)changed++;art.dispose();return {changed,released:art.patches.length===0&&art.base.width===1};},world.id);assert(painted.changed>100&&painted.released,'Painting stayed still or retained resources: '+world.id);
   const holes=[[600,140,800,370],[20,290,450,510],[1500,350,300,520]];
   await page.goto(base+`index.html?world=${world.id}&paused=1&at=12&cue=${world.cues[0]}&age=5&holes=`+encodeURIComponent(JSON.stringify(holes)));await ready();const protection=await page.evaluate(holes=>{const c=document.querySelector('canvas').getContext('2d',{willReadFrequently:true});return holes.map(rect=>{const a=c.getImageData(...rect).data;let alpha=0;for(let i=3;i<a.length;i+=4)alpha=Math.max(alpha,a[i]);return alpha;});},holes);assert(protection.every(a=>a===0),'Custom live areas covered: '+world.id);
   report.push({id:world.id,guests,painted,protection});
  }
  await page.goto(base+'studio.html?world=forge');await page.locator('[data-cue=hammer]').waitFor();
  const frame=page.frameLocator('#preview');await frame.locator('canvas[data-ready=true]').waitFor();assert((await page.locator('h1').textContent()).includes('forge'),'World-specific studio copy did not update');
  await page.locator('#world').selectOption('sanctuary');await page.locator('[data-cue=mushroom]').waitFor();await frame.locator('canvas[data-ready=true]').waitFor();
  await page.locator('[data-cue=mushroom]').click();await frame.locator('canvas[data-events*=mushroom]').waitFor();
  assert(!await page.locator('[data-cue=hammer]').count(),'Old world controls survived a world switch');await page.screenshot({path:path.join(out,'world-studio.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'World picker broke mobile layout');
  const requested=process.argv.slice(2).filter(a=>!a.startsWith('--')),record=requested.length?requested:focus?[focus]:['forge','sanctuary'];assert(record.every(id=>worlds.some(w=>w.id===id)),'Unknown record world');
  for(const id of record){
   const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:720}}}),videoPage=await context.newPage();videoPage.on('pageerror',e=>errors.push(e.message));await videoPage.goto(base+`index.html?world=${id}&preview=1&at=1`);await videoPage.locator('canvas[data-ready=true]').waitFor();const seen=new Set();for(let i=0;i<16;i++){await videoPage.waitForTimeout(2000);for(const event of JSON.parse(await videoPage.locator('canvas').getAttribute('data-events')))seen.add(event.kind);}const paintMs=await videoPage.locator('canvas').getAttribute('data-paint-ms'),video=videoPage.video();await context.close();await video.saveAs(path.join(out,id+'-automatic.webm'));assert(seen.size>=3,'Automatic world is too quiet: '+id);Object.assign(report.find(w=>w.id===id),{automatic:[...seen],paintMs});
  }
  assert(errors.length===0,errors.join('\n'));fs.writeFileSync(path.join(out,focus?'world-qa-'+focus+'.json':'world-qa.json'),JSON.stringify({worlds:report,switching:true,mobile:true,errors},null,2));console.log(JSON.stringify({worlds:report,switching:true,mobile:true,errors}));
 }catch(error){console.error('Browser errors:',JSON.stringify(errors));console.error('Frame state:',await Promise.all(page.frames().map(async f=>({url:f.url(),body:await f.locator('body').textContent().catch(()=>'<unavailable>')}))));throw error;}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
