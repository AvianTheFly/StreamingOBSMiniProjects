// Audit the encoded files and their actual decoded playback, not only metadata.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const out=path.resolve(__dirname,'../output/spam-cues');
const report=JSON.parse(fs.readFileSync(path.join(out,'render-verification.json')));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://preview.test/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1)||'review.html';
   if(path.basename(name)!==name)return route.fulfill({status:404});
   const file=path.join(out,name);
   if(!fs.existsSync(file))return route.fulfill({status:404});
   const type=name.endsWith('.mp4')?'video/mp4':name.endsWith('.png')?'image/png':name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html';
   return route.fulfill({body:fs.readFileSync(file),contentType:type});
  });
  await page.goto('http://preview.test/');
  await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.readyState>=2));
  assert.equal(await page.locator('video').count(),report.shows.length);
  for(const show of report.shows){
   const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,start_time,duration','-of','json',path.join(out,show.key+'-preview.mp4')],{encoding:'utf8',windowsHide:true}));
   const video=metadata.streams.find(s=>s.codec_type==='video'),audio=metadata.streams.find(s=>s.codec_type==='audio');
   assert.equal(Number(video.start_time),0);assert.equal(Number(audio.start_time),0);
   assert(Math.abs(Number(video.duration)-show.live.duration)<.002,show.key+' video tail drift');
   assert(Math.abs(Number(audio.duration)-show.live.duration)<.002,show.key+' audio trim drift');
   assert(Math.abs(Number(video.duration)-Number(audio.duration))<.002,show.key+' A/V cutoff drift');
   const section=page.locator('section').filter({has:page.locator(`video[src="${show.key}-preview.mp4"]`)});
   await section.locator('input[type=checkbox]').uncheck();
   await section.locator('video').evaluate(v=>{
    window.decodedFrames=[];const canvas=document.createElement('canvas');canvas.width=480;canvas.height=270;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    const frame=(_,meta)=>{
     c.drawImage(v,0,0,480,270);const pixels=c.getImageData(0,0,480,270).data;let painted=0;
     // The review background is a flat RGB (41,67,63), with codec rounding.
     for(let y=0;y<270;y++)for(let x=0;x<480;x++){
      if(x>=60&&x<420&&y>=43&&y<210)continue;
      const i=(y*480+x)*4;
      if(Math.max(Math.abs(pixels[i]-41),Math.abs(pixels[i+1]-67),Math.abs(pixels[i+2]-63))>22)painted++;
     }
     window.decodedFrames.push({time:meta.mediaTime,painted});
     if(!v.ended)v.requestVideoFrameCallback(frame);
    };v.requestVideoFrameCallback(frame);
   });
   await section.locator('[data-play]').click();
   await page.waitForFunction(key=>document.querySelector(`video[src="${key}-preview.mp4"]`).ended,show.key);
   const frames=await page.evaluate(()=>window.decodedFrames);
   assert(frames.length>=8,show.key+' did not actually decode its motion');
   assert(frames.filter(f=>f.painted>650).length/frames.length>.8,show.key+' is mostly blank during playback');
   assert(frames.find(f=>f.painted>650)?.time<.035,show.key+' decoded artwork starts late');
   assert.equal(await section.locator('video').evaluate(v=>v.style.opacity),'0','one-shot picture clears when sound ends');
   await section.locator('input[type=checkbox]').check();await section.locator('[data-replay]').click();
   await page.waitForTimeout(show.live.duration*2300);
   assert.equal(await section.locator('video').evaluate(v=>v.paused),false,'short cues remain watchable by looping');
   await section.locator('[data-play]').click();
   const paused=await section.locator('video').evaluate(v=>v.currentTime);await page.waitForTimeout(80);
   assert.equal(await section.locator('video').evaluate(v=>v.currentTime),paused,'pause freezes encoded audio and picture together');
   results.push({key:show.key,videoDuration:Number(video.duration),audioDuration:Number(audio.duration),decodedFrames:frames.length,visibleFraction:frames.filter(f=>f.painted>650).length/frames.length,firstVisible:frames.find(f=>f.painted>650).time});
  }
  const sections=page.locator('section');await sections.nth(0).locator('[data-replay]').click();await sections.nth(1).locator('[data-replay]').click();
  assert.equal(await page.locator('video').evaluateAll(v=>v.filter(x=>!x.paused).length),1,'only one preview may be audible');
  await page.locator('video').evaluateAll(v=>v.forEach(x=>x.pause()));
  await page.screenshot({path:path.join(out,'verified-preview-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'mobile controls overflow');
  await page.screenshot({path:path.join(out,'verified-preview-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  const proof={passed:true,actualDecodedPlayback:true,oneAudiblePreview:true,results};
  fs.writeFileSync(path.join(out,'preview-timing-verification.json'),JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
