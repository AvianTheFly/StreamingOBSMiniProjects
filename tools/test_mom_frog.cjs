// Real Chromium checks at the croak's actual duration, with no live Hub commands.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'lib/browser_effects/web');
const out=path.join(root,'output/mom-frog');
const duration=JSON.parse(fs.readFileSync(path.join(out,'audio-recipe.json'))).duration;
const effect=JSON.parse(fs.readFileSync(path.join(root,'mini projects/soundboard/browser_effects.json')))['mom frog'];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://frog.test/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   if(!name)return route.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#344b48"><canvas width="1920" height="1080" style="width:100%;display:block"></canvas></body></html>'});
   if(!['borders.js','rave.js','subtle.js'].includes(name))return route.fulfill({status:404});
   return route.fulfill({body:fs.readFileSync(path.join(web,name)),contentType:'application/javascript'});
  });
  await page.goto('http://frog.test/');
  const checks=await page.evaluate(async({duration,effect})=>{
   const {BorderShow}=await import('/borders.js');
   const canvas=document.querySelector('canvas'),show=new BorderShow(canvas);await show.ready;
   window.show=show;window.effect=effect;window.duration=duration;
   const c=canvas.getContext('2d',{willReadFrequently:true}),frames=[];
   for(const p of [.15,.35,.60,.85]){
    show.draw(duration*p,duration,effect);
    const data=c.getImageData(0,0,1920,1080).data;
    let solid=0,glass=0;for(let i=3;i<data.length;i+=4){if(data[i]>230)solid++;else if(data[i]>15&&data[i]<180)glass++;}
    const center=c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v);
    frames.push({solid,glass,center,png:canvas.toDataURL()});
   }
   show.draw(duration*.5,duration,effect);const paused=canvas.toDataURL();
   show.draw(duration*.5,duration,effect);const deterministic=paused===canvas.toDataURL();
   show.draw(duration,duration,effect);const ended=c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v);
   const start=performance.now();for(let i=0;i<60;i++)show.draw(duration*(i+.5)/60,duration,effect);
   return {frames,deterministic,ended,frameMs:(performance.now()-start)/60};
  },{duration,effect});
  assert(checks.frames.every(f=>!f.center),'gameplay must remain fully transparent');
  assert(checks.frames.some(f=>f.solid>12000),'photographic frogs must remain readable');
  assert(checks.frames.some(f=>f.glass>3000),'glass ripples must be visible');
  assert(checks.frames.slice(1,3).every(f=>f.glass>70000),'flowing pond ribbons and splash waves must accompany the cast');
  assert.equal(new Set(checks.frames.map(f=>f.png)).size,4,'the short croak must still develop');
  assert(checks.deterministic,'pause/seek must reproduce the frame');assert(!checks.ended,'audio end must clear');
  await page.evaluate(()=>window.show.draw(window.duration*.4,window.duration,window.effect));
  await page.screenshot({path:path.join(out,'mom-frog-desktop.png')});
  const alpha=await page.evaluate(()=>document.querySelector('canvas').toDataURL().split(',')[1]);
  fs.writeFileSync(path.join(out,'mom-frog-border-transparent.png'),Buffer.from(alpha,'base64'));
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'mom-frog-mobile.png')});
  await page.setViewportSize({width:1920,height:1080});
  const frameDir=path.join(out,'frames');fs.mkdirSync(frameDir,{recursive:true});
  for(let i=0;i<Math.ceil(duration*50);i++){
   await page.evaluate(t=>window.show.draw(t,window.duration,window.effect),i/50);
   const data=await page.evaluate(()=>document.querySelector('canvas').toDataURL().split(',')[1]);
   fs.writeFileSync(path.join(frameDir,String(i).padStart(3,'0')+'.png'),Buffer.from(data,'base64'));
  }
  assert.deepEqual(errors,[]);
  const report={passed:true,duration,...checks,frames:checks.frames.map(({png,...f})=>f)};
  fs.writeFileSync(path.join(out,'render-verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
