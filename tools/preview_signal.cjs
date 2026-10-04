// Finite private render; does not dispatch playback or change OBS/settings.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const output=process.env.MOOD_CUES_TEST_OUTPUT;
 if(!output)throw Error('Set MOOD_CUES_TEST_OUTPUT to a directory with free space.');
 const folder=path.join(output,'signal-frames');fs.mkdirSync(folder,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://127.0.0.1:7444/presentation/love_me/preview.html');
  const response=await page.request.get('http://127.0.0.1:7420/api/mood-cues');
  const row=(await response.json()).variations.find(row=>row.id==='signal_found');
  await page.evaluate(async row=>{
   document.body.style.background='radial-gradient(ellipse at center,#274145,#10232c 70%)';
   const {MoodRenderer}=await import('./renderer.js');window.renderer=new MoodRenderer(document.querySelector('canvas'));
   await window.renderer.prepare(row);window.score=row;
  },row);
  const fps=Math.max(10,Math.min(60,Number(process.env.MOOD_CUES_RENDER_FPS)||20));
  const renderSeconds=Math.min(row.duration,Number(process.env.MOOD_CUES_RENDER_SECONDS)||row.duration);
  const renderStart=Math.max(0,Math.min(renderSeconds-.1,Number(process.env.MOOD_CUES_RENDER_START)||0));
  const total=Math.ceil((renderSeconds-renderStart)*fps);
  for(let i=0;i<total;i++){
   await page.evaluate(t=>window.renderer.draw(t,window.score),renderStart+i/fps);
   await page.screenshot({path:path.join(folder,String(i).padStart(5,'0')+'.png')});
   if(i%100===0)console.log(`Signal preview ${i}/${total}`);
  }
  fs.writeFileSync(path.join(output,'signal-preview-spec.json'),JSON.stringify({folder,fps,duration:row.duration,renderStart,renderSeconds,audio:row.audio_file,audio_start:row.audio_start,audio_rate:row.audio_rate}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
