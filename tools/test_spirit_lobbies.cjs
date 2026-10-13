// Browser evidence for actual screen state, saved bounds, finite moments and cleanup.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),sharp=require('sharp');
const {chromium}=require('playwright');
const out=path.resolve('output/lobby-udyr-refresh'),ids=['aurora-camp','phoenix-observatory','sanctuary','forge'];
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
  let visible=true;await page.route('**/api/projects/scene_voice_switcher/display_state?*',route=>route.fulfill({json:{source:new URL(route.request().url()).searchParams.get('source'),visible}}));
  for(const id of ids){
   await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?world='+id+'&paused=1&auto=0');await page.locator('canvas[data-ready=true]').waitFor();
   const holes=await page.evaluate(async id=>(await import('./worlds.js')).loadWorld(id).then(w=>w.scene.holes),id);
   const protectedHoles=await page.evaluate(async ({id,holes})=>{const {habitatDesigns}=await import('./habitat-designs.js');const copy=holes.map(r=>[...r]);copy[1][3]=Math.min(...habitatDesigns[id].cameraEdge.map(p=>p[1]))-copy[1][1]-2;return copy;},{id,holes});
   const alphas=()=>page.evaluate(holes=>{const c=document.querySelector('canvas').getContext('2d');return holes.map(r=>{const d=c.getImageData(...r).data;let max=0,min=255;for(let i=3;i<d.length;i+=4){max=Math.max(max,d[i]);min=Math.min(min,d[i]);}return {max,min};});},protectedHoles);
   assert((await alphas()).every(a=>a.max===0),id+' covered an active live surface');
   visible=false;await page.waitForFunction(()=>document.querySelector('canvas').dataset.displayVisible==='false');const hidden=await alphas();assert.equal(hidden[0].min,255);assert.equal(hidden[1].max,0);assert.equal(hidden[2].max,0);
   visible=true;await page.waitForFunction(()=>document.querySelector('canvas').dataset.displayVisible==='true');assert((await alphas()).every(a=>a.max===0));
   const detail=await page.evaluate(async id=>{
    const {loadWorld}=await import('./worlds.js'),{borderAnchor}=await import('./lobby-moments.js'),{AmbientClock}=await import('./shared/world-motion.js');
    const world=await loadWorld(id),art=await world.createMotion().load(),clock=new AmbientClock(world.cues,71),seen=new Set();
    for(let w=0;w<60;w++)for(const e of clock.plan(w))seen.add(e.kind);clock.dispose();
    const newCues=world.cues.filter(c=>['league-','border-','moment-'].some(p=>c.id.startsWith(p))).map(c=>c.id);
    if(newCues.some(c=>!seen.has(c)))throw Error('New events omitted from automatic planning');
    art.displayVisible=true;art.screenRect=[60,180,896,504];const anchor=borderAnchor(art,world.scene,'goose');art.screenRect=[160,280,896,504];const moved=borderAnchor(art,world.scene,'goose');
    if(moved[0]-anchor[0]!==100||moved[1]-anchor[1]!==100)throw Error('Border guest ignored saved screen placement');
    art.displayVisible=false;const shelf=borderAnchor(art,world.scene,'goose');art.screenRect=[250,50,700,400];if(JSON.stringify(shelf)!==JSON.stringify(borderAnchor(art,world.scene,'goose')))throw Error('Hidden frame left guest floating');
    const c=art.base.getContext('2d'),d=c.getImageData(100,220,800,420).data;let dark=0;for(let p=0;p<d.length;p+=4)dark+=d[p]+d[p+1]+d[p+2]<35;
    const darkFraction=dark/(800*420);if(darkFraction>.35)throw Error('Screen-hidden art is still predominantly black');
    art.dispose();if(art.league.frames.size||art.league.images.size||art.guests.frames.size||art.base.width!==1)throw Error('Decoded resources survived disposal');
    const late=world.createMotion(),loading=late.load();late.dispose();await loading;if(late.league.images.size||late.league.frames.size||late.guests.images.size||late.base.width!==1)throw Error('Late load retained resources');
    return {id,newCues,darkFraction,adaptive:world.scene.adaptiveScreen};
   },id);report.push(detail);
   for(const mode of [0,1]){
    await page.goto(`http://127.0.0.1:7420/lobby-motion/index.html?world=${id}&preview=1&screen=${mode}&paused=1&auto=0&at=30&cue=${mode?'border-climber':'moment-awakening'}&age=5`);await page.locator('canvas[data-ready=true]').waitFor();
    await page.screenshot({path:path.join(out,`${id}-${mode?'screen':'scenery'}.png`)});
   }
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-qa.json'),JSON.stringify({report,errors,visibilityRoundTrip:true,customFrameAnchors:true,normalAndLateDisposal:true},null,2));
  const grid=[];for(const [i,id] of ids.entries())for(const [j,mode] of ['scenery','screen'].entries())grid.push({input:await sharp(path.join(out,`${id}-${mode}.png`)).resize(960,540).toBuffer(),left:j*960,top:i*540});
  await sharp({create:{width:1920,height:2160,channels:3,background:'#101722'}}).composite(grid).png().toFile(path.join(out,'four-rooms.png'));
  console.log('Four rooms: media visibility round trip, full scenery, frame-aware guests, automatic events and normal/late cleanup passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
