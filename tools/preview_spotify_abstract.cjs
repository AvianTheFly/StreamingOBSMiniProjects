// Natural-pace preview driven by actual PCM through production AudioAnalysis.
// Never forces a stage, morph, palette, or movement rate.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const root=path.resolve(__dirname,'../mini projects/spotify/web');
  const frames=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../output/spotify/audio-study.json'),'utf8')).slice(0,Number(process.env.SPOTIFY_PREVIEW_LENGTH)||Infinity);
  const out=path.resolve(process.env.SPOTIFY_PREVIEW_FRAMES||path.resolve(__dirname,'../output/spotify/natural-preview-frames'));fs.mkdirSync(out,{recursive:true});
  const page=await browser.newPage({viewport:{width:Number(process.env.SPOTIFY_PREVIEW_WIDTH)||400,height:(Number(process.env.SPOTIFY_PREVIEW_WIDTH)||400)*.75}});
  await page.setContent(fs.readFileSync(path.join(root,'overlay.html'),'utf8').replace(/<script.*?<\/script>/g,'').replace(/<link[^>]+>/g,''));
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'overlay.css'),'utf8')+'body{background:#090e18}'});
  for(const script of ['forms.js','performance.js','surface.js','filament.js','reactive.js','radiance.js','music_strings.js', 'music_pacing.js', 'music_motion.js','journey.js','stage_palette.js','stage_spirits.js','stage_geometry.js','stage_morph.js','stage_renderer.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,script),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'overlay.js'),'utf8').replace('}poll();','}')});
  const fps=Math.min(30,Math.max(1,Number(process.env.SPOTIFY_PREVIEW_FPS)||10)),stride=Math.max(1,Math.round(30/fps));
  const start=Math.max(0,Math.floor(Number(process.env.SPOTIFY_PREVIEW_START)||0));
  if(start)await page.evaluate(signals=>{for(const signal of signals){world.step(signal,1/30);journey.step(world,1/30,signal);}},frames.slice(0,start));
  let outputIndex=0;
  const history=[];
  for(let i=start;i<frames.length;i+=stride){
   const status=await page.evaluate(batch=>{
    for(const features of batch){
     data={...features,playing:true};
     widget.hidden=false;title.textContent='Bass & rhythm study';artist.textContent='Original audio · natural scene timing';
     lastSuccess=performance.now();lastFrame=lastSuccess-1000/30;draw(lastSuccess);
     cancelAnimationFrame(frame);frame=0;
    }
    return {name:journey.name,morph:journey.blend,residence:journey.age,transitions:journey.transitions,exploration:journey.exposure};
   },frames.slice(i,i+stride));
   if(i%300===0){history.push({seconds:i/30,...status});}
   await page.screenshot({path:path.join(out,`${String(outputIndex++).padStart(4,'0')}.png`)});
  }
  fs.writeFileSync(path.join(out,'render.json'),JSON.stringify({fps:30/stride,startSeconds:start/30,frames:outputIndex}));
  fs.writeFileSync(path.join(out,'history.json'),JSON.stringify(history,null,2));
  console.log(JSON.stringify(history));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
