// One continuous scene: no forced morph, cut, speed change or handoff.
// Original PCM drives both the structural evolution and the faster audio motion.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const root=path.resolve('mini projects/spotify/web'),out=path.resolve(process.env.SPOTIFY_PREVIEW_FRAMES);
  fs.mkdirSync(out,{recursive:true});
  const frames=JSON.parse(fs.readFileSync('output/spotify/audio-study.json','utf8'));
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://morph.test/**',r=>{
   const u=new URL(r.request().url());if(u.pathname==='/api/state')return r.fulfill({json:{playing:false}});
   const file=u.pathname==='/overlay'?'overlay.html':u.pathname.slice(1);
   r.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://morph.test/overlay');await page.addStyleTag({content:'body{background:#080d17}'});
  await page.evaluate(()=>{window.fetch=()=>new Promise(()=>{});cancelAnimationFrame(frame);frame=0;});
  const history=[],length=900,start=900;
  for(let i=0;i<length;i++){
   const status=await page.evaluate(({signal,i})=>{
    if(i===0){journey.stage=5;journey.transitioning=false;journey.palettePhase=0;journey.age=0;journey.exposure=0;}
    data={...signal,playing:true};world.step(data,1/30);journey.step(world,1/30,data);
    widget.hidden=false;title.textContent=journey.name;
    artist.textContent='Continuous form evolution · original audio';
    clear();present();return {stage:journey.stage,next:journey.next,blend:journey.blend,palettePhase:journey.palettePhase,evolution:journey.evolution};
   },{signal:frames[start+i],i});
   if(i%90===0)history.push({seconds:i/30,...status});
   await page.screenshot({path:path.join(out,String(i).padStart(4,'0')+'.png')});
  }
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({errors,history,startSeconds:start/30,frames:length,fps:30},null,2));
  console.log(JSON.stringify({errors,history,graphics:await page.evaluate(()=>radiance.status())}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
