const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),root=path.resolve('mini projects/spotify/web'),out=path.resolve(process.env.SPOTIFY_STILL_OUTPUT||'output/spotify/journey');fs.mkdirSync(out,{recursive:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(fs.readFileSync(path.join(root,'overlay.html'),'utf8').replace(/<script.*?<\/script>/g,'').replace(/<link[^>]+>/g,''));
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'overlay.css'),'utf8')+'body{background:#080d17}'});
 for(const file of ['forms.js','performance.js','surface.js','filament.js','reactive.js','radiance.js','music_strings.js', 'music_pacing.js', 'music_motion.js','journey.js','stage_palette.js','stage_spirits.js','stage_geometry.js','stage_morph.js','stage_renderer.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'overlay.js'),'utf8').replace('}poll();','}')});
 const frames=JSON.parse(fs.readFileSync('output/spotify/audio-study.json','utf8'));
 const count=await page.evaluate(()=>VisualJourney.names.length);
 for(let stage=0;stage<count;stage++){
  await page.evaluate(({frames,stage})=>{for(const signal of frames){world.step(signal,1/30);journey.step(world,1/30,signal);}journey.stage=stage;journey.transitioning=false;journey.mix=0;widget.hidden=false;title.textContent=VisualJourney.names[stage];artist.textContent='Audio-driven scene study';clear();present();}, {frames:frames.slice(1500,1680),stage});
  await page.screenshot({path:path.join(out,'stage-'+stage+'.png')});
 }
 console.log(JSON.stringify({errors,graphics:await page.evaluate(()=>radiance.status())}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
