// Read-only browser review: placement, finite rotation, motion and live apertures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const out=path.resolve('output/lobby-festival-20261012');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],report=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/projects/scene_voice_switcher/display_state?*',r=>r.fulfill({json:{visible:true}}));
  await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?world=forge&preview=1&paused=1&auto=0');
  await page.locator('canvas[data-ready=true]').waitFor();
  const result=await page.evaluate(async()=>{
   const {festivalBeat,worldThemes,SLOT_SECONDS,SHOW_SECONDS}=await import('./festival-copy.js');
   const {drawFestival,theaterRect,intersects}=await import('./festival-theater.js');
   const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const c=canvas.getContext('2d',{willReadFrequently:true});
   const evidence=[];
   for(const [i,id] of Object.keys(worldThemes).entries()){
    const offset=i*7,t=576-offset+7,titles=new Set();
    for(let slot=16;slot<32;slot++)titles.add(festivalBeat(id,slot*SLOT_SECONDS-offset+7).title);
    if(titles.size!==16)throw Error(id+' repeated before completing its rotation');
    if(festivalBeat(id,576-offset+SHOW_SECONDS+1)!==null)throw Error('Missing quiet interval');
    const custom=[[40,180,850,600],[980,340,500,650],[1490,200,320,600]],rect=theaterRect(custom);
    if(!rect||custom.some(h=>intersects(rect,h,12)))throw Error('Saved layout obstructed');
    if(theaterRect([[0,0,1920,1080]])!==null)throw Error('Crowded layout should suppress card');
    if(drawFestival(c,t,id,[],{pressure:2})!==null)throw Error('Manual effects should get priority');
    c.clearRect(0,0,1920,1080);drawFestival(c,t,id,custom);const a=c.getImageData(...rect).data;
    c.clearRect(0,0,1920,1080);drawFestival(c,t+1,id,custom);const b=c.getImageData(...rect).data;
    let changed=0;for(let p=0;p<a.length;p+=4)if(Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])>20)changed++;
    if(changed<40)throw Error('Miniature has no visible motion');
    c.clearRect(0,0,1920,1080);drawFestival(c,t,id,custom,{reduced:true});const ra=c.getImageData(rect[0]+12,rect[1]+13,112,100).data;
    c.clearRect(0,0,1920,1080);drawFestival(c,t+1,id,custom,{reduced:true});const rb=c.getImageData(rect[0]+12,rect[1]+13,112,100).data;
    if(ra.some((n,p)=>n!==rb[p]))throw Error('Reduced-motion miniature moved');
    evidence.push({id,at:t,uniqueBeats:titles.size,changedPixels:changed,rect});
   }
   return evidence;
  });
  for(const row of result){
   await page.goto(`http://127.0.0.1:7420/lobby-motion/index.html?world=${row.id}&preview=1&captions=1&screen=0&paused=1&auto=0&at=${row.at}`);
   await page.locator('canvas[data-ready=true]').waitFor();
   assert(await page.locator('canvas').getAttribute('data-festival'),row.id+' missing festival');
   await page.screenshot({path:path.join(out,row.id+'-festival.png')});
   await page.goto(`http://127.0.0.1:7420/lobby-motion/index.html?world=${row.id}&paused=1&auto=0&at=${row.at}`);
   await page.locator('canvas[data-ready=true]').waitFor();
   const protectedPixels=await page.evaluate(async id=>{
    if(document.querySelector('canvas').dataset.festival)throw Error('Native scene showed preview captions');
    const {loadWorld}=await import('./worlds.js'),{scene}=await loadWorld(id),c=document.querySelector('canvas').getContext('2d');
    return scene.holes.every(r=>{const d=c.getImageData(...r).data;for(let i=3;i<d.length;i+=4)if(d[i]!==0)return false;return true;});
   },row.id);assert(protectedPixels,row.id+' covered a live aperture');report.push({...row,protectedPixels});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'festival-qa.json'),JSON.stringify({report,errors},null,2));
  console.log('11 lobbies: unique rotations, quiet gaps, saved aperture protection, visible payoffs, reduced-motion miniatures and manual-effect priority passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
