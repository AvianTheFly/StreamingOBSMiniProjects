// Finite real-audio/canvas QA; fixture traffic never reaches the live Hub.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),web=path.join(root,'lib/browser_effects/web');
const out=path.join(root,'output/spam-cues'),assets=path.resolve(root,'../Assets/VisualAndAudio/soundboard');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'mini projects/soundboard/browser_effects.json')));
const profileFile=path.join(root,'mini projects/soundboard/hotkeys_editor.json');
const profileBytes=fs.readFileSync(profileFile),profile=JSON.parse(profileBytes).profiles.default;
const expected=['lizzard-1','gary_meow','mac-quack','bonk_7zPAD7C','piuw'];
assert.deepEqual(profile.hotkeys['2'],expected,'preserve the personal random queue');
assert.equal(profile.hotkeys['@'],'hooray');
const labels=['Tom: button and popcorn','Gary: meow and snacks','Mac Quack: duck desktop','Bonk: soft mallet crew','Piuw: toy space cadets'];
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const sounds=expected.map((stem,i)=>({stem,label:labels[i],key:['lizard','gary','quack','bonk','piuw'][i],effect:catalog[stem],
 file:path.join(assets,stem+'.mp3'),sha256:hash(fs.readFileSync(path.join(assets,stem+'.mp3')))}));
const includeFrog=process.argv.includes('--include-frog');
if(includeFrog){
 const file=path.join(assets,'mom frog.mp4');
 sounds.push({stem:'mom frog',label:'Mom Frog: flowing pond concert',key:'frog',effect:catalog['mom frog'],file,sha256:hash(fs.readFileSync(file))});
}
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],acks=[],report=[];
  let active=null;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const AudioOriginal=window.Audio;window.audioInstances=[];window.liveSamples=[];window.playbackFrames=[];window.playbackEnds=[];
   const probe=document.createElement('canvas');probe.width=360;probe.height=203;const probeContext=probe.getContext('2d',{willReadFrequently:true});
   const sample=(audio,renderTime)=>{
    const canvas=document.getElementById('effects');if(!canvas)return;
    probeContext.clearRect(0,0,360,203);probeContext.drawImage(canvas,0,0,360,203);
    const pixels=probeContext.getImageData(0,0,360,203).data;let painted=0;
    for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)painted++;
    window.playbackFrames.push({src:audio.src,time:renderTime,painted});
   };
   window.Audio=function(...args){const audio=new AudioOriginal(...args);window.audioInstances.push(audio);
    audio.addEventListener('playing',()=>{const time=audio.currentTime;queueMicrotask(()=>sample(audio,time));});
    audio.addEventListener('ended',()=>{const src=audio.src;setTimeout(()=>{
     const c=document.getElementById('effects').getContext('2d');
     window.playbackEnds.push({src,clear:!c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v)});
    },0);});return audio;};
   const raf=window.requestAnimationFrame;
   window.requestAnimationFrame=callback=>raf(time=>{
    const renderTime=window.audioInstances.at(-1)?.currentTime;
    callback(time);const audio=window.audioInstances.at(-1),canvas=document.getElementById('effects');
    if(audio&&!audio.paused&&audio.currentTime>0&&canvas){
     sample(audio,renderTime);
    }
    if(audio&&audio.duration&&audio.currentTime>audio.duration*.28&&!audio.sampled){
     audio.sampled=true;const c=canvas.getContext('2d',{willReadFrequently:true});
     const pixels=c.getImageData(0,0,1920,1080).data;let painted=0;
     for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)painted++;
     const center=c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v);
     window.liveSamples.push({src:audio.src,duration:audio.duration,painted,center});
    }
   });
  });
  await page.route('http://spam.test/**',route=>{
   const url=new URL(route.request().url()),name=url.pathname.split('/').pop();
   if(url.pathname.startsWith('/api/state/'))return route.fulfill({json:{active,ready:true}});
   if(url.pathname.startsWith('/api/ack/')){acks.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});}
   if(url.pathname.startsWith('/audio/')){
    const sound=sounds.find(s=>name==='live-'+s.key||name==='probe-'+s.key);
    return sound?route.fulfill({body:fs.readFileSync(sound.file),contentType:sound.file.endsWith('.mp4')?'video/mp4':'audio/mpeg'}):route.fulfill({status:404});
   }
   const file=url.pathname.startsWith('/overlay/')?'overlay.html':name;
   if(!['overlay.html','overlay.css','playback.js','renderers.js','muffins.js','borders.js','rave.js','subtle.js','mash-dance.png'].includes(file))return route.fulfill({status:404});
   return route.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
  });
  await page.goto('http://spam.test/overlay/soundboard');
  for(const sound of sounds){
   active={id:'live-'+sound.key,stem:sound.stem,effect:sound.effect,paused:false,elapsed:0,started:false};
   const deadline=Date.now()+6000;
   while(!acks.some(a=>a.id===active.id&&a.status==='ended')){
    assert(Date.now()<deadline,sound.stem+' did not complete');await page.waitForTimeout(50);
   }
   assert(acks.some(a=>a.id===active.id&&a.status==='playing'),sound.stem+' did not start');
   active=null;await page.waitForTimeout(120);
   const live=await page.evaluate(()=>window.liveSamples.at(-1));
   assert(live&&live.src.endsWith('/live-'+sound.key),sound.stem+' missing actual audio frame');
   assert(live.painted>12000,sound.stem+' has no readable live cast');assert(!live.center);
   const timing=await page.evaluate(key=>({frames:window.playbackFrames.filter(f=>f.src.endsWith('/live-'+key)),end:window.playbackEnds.find(f=>f.src.endsWith('/live-'+key))}),sound.key);
   assert(timing.end?.clear,sound.stem+' did not clear on its actual audio ended event');
   assert(timing.frames.find(f=>f.painted>350)?.time<.06,sound.stem+' artwork appeared too late: '+JSON.stringify(timing));
   const check=await page.evaluate(async({effect,duration})=>{
    const {BorderShow}=await import('/borders.js');const canvas=document.getElementById('effects');
    const show=new BorderShow(canvas);await show.ready;window.reviewShow=show;window.reviewEffect=effect;window.reviewDuration=duration;
    const c=canvas.getContext('2d',{willReadFrequently:true}),frames=[];
    for(const p of [.12,.35,.60,.86]){
     show.draw(duration*p,duration,effect);const data=c.getImageData(0,0,1920,1080).data;
     let solid=0,glass=0;for(let i=3;i<data.length;i+=4){if(data[i]>230)solid++;else if(data[i]>15&&data[i]<180)glass++;}
     frames.push({solid,glass,center:c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v),image:canvas.toDataURL()});
    }
    show.draw(duration*.4,duration,effect);const paused=canvas.toDataURL();
    show.draw(duration*.4,duration,effect);const deterministic=paused===canvas.toDataURL();
    show.draw(duration,duration,effect);const ended=c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v);
    show.clear();const cleared=c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v);
    const start=performance.now();for(let i=0;i<45;i++)show.draw(duration*(i+.5)/45,duration,effect);
    show.draw(duration*.4,duration,effect);
    return {frames,deterministic,ended,cleared,frameMs:(performance.now()-start)/45};
   },{effect:sound.effect,duration:live.duration});
   assert(check.frames.every(f=>!f.center));assert(check.frames.some(f=>f.solid>12000));
   assert(check.frames.some(f=>f.glass>800));assert.equal(new Set(check.frames.map(f=>f.image)).size,4);
   if(sound.key==='piuw')assert(check.frames.slice(1,3).every(f=>f.glass>45000),'Piuw needs flowing plasma borders, not only props');
   if(sound.key==='frog')assert(check.frames.slice(1,3).every(f=>f.glass>70000),'Frog needs flowing pond borders, not only props');
   assert(check.deterministic&&!check.ended&&!check.cleared);
   const image=await page.evaluate(()=>document.getElementById('effects').toDataURL().split(',')[1]);
   fs.writeFileSync(path.join(out,sound.key+'-border.png'),Buffer.from(image,'base64'));
   await page.evaluate(()=>document.body.style.background='#29433f');
   await page.screenshot({path:path.join(out,sound.key+'-desktop.png')});
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,sound.key+'-mobile.png')});
   await page.setViewportSize({width:1920,height:1080});
   const frameDir=path.join(out,sound.key+'-frames');fs.mkdirSync(frameDir,{recursive:true});
   const frameCount=Math.ceil(live.duration*60),fps=frameCount/live.duration;
   for(let i=0;i<frameCount;i++){
    await page.evaluate(t=>window.reviewShow.draw(t,window.reviewDuration,window.reviewEffect),(i+.5)*live.duration/frameCount);
    const png=await page.evaluate(()=>document.getElementById('effects').toDataURL().split(',')[1]);
    fs.writeFileSync(path.join(frameDir,String(i).padStart(3,'0')+'.png'),Buffer.from(png,'base64'));
   }
   const video=path.join(out,sound.key+'-preview.mp4');
   execFileSync('ffmpeg',['-nostdin','-v','error','-y','-framerate',String(fps),'-i',path.join(frameDir,'%03d.png'),
    '-i',sound.file,'-f','lavfi','-i',`color=c=0x29433f:s=1920x1080:r=${fps}`,'-filter_complex',`[2:v][0:v]overlay=shortest=1[v];[1:a]apad=whole_dur=${live.duration},atrim=duration=${live.duration},asetpts=PTS-STARTPTS[a]`,
    '-map','[v]','-map','[a]','-t',String(live.duration),'-c:v','libx264','-preset','fast','-crf','18','-threads','2',
    '-filter_complex_threads','1','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-video_track_timescale','1000000','-movflags','+faststart',video],{windowsHide:true,timeout:30000});
   assert.equal(hash(fs.readFileSync(sound.file)),sound.sha256,'original audio changed');
   report.push({stem:sound.stem,key:sound.key,live,timing,sha256:sound.sha256,exportFrameCount:frameCount,...check,frames:check.frames.map(({image,...f})=>f)});
  }
  assert.deepEqual(errors,[]);assert(fs.readFileSync(profileFile).equals(profileBytes),'personal profile changed');
  await page.goto('about:blank');
  await page.evaluate(cards=>{
   document.body.style.cssText='margin:0;background:#171f23;color:#e5edf0;font:16px Segoe UI;padding:24px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px';
   for(const card of cards){const section=document.createElement('section'),label=document.createElement('div'),image=document.createElement('img');
    label.textContent=card.label;label.style.cssText='margin-bottom:10px';image.src=card.image;image.style.cssText='display:block;width:100%;aspect-ratio:16/9;background:#29433f';section.append(label,image);document.body.append(section);}
  },sounds.map(s=>({label:s.label,image:'data:image/png;base64,'+fs.readFileSync(path.join(out,s.key+'-border.png')).toString('base64')})));
  await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
  await page.screenshot({path:path.join(out,'five-cue-review.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'render-verification.json'),JSON.stringify({passed:true,profile_sha256:hash(profileBytes),shows:report},null,2));
  const title=includeFrog?'Soundboard Borders':'Soundboard 2';
  const cards=sounds.map(s=>`<section data-duration="${report.find(r=>r.key===s.key).live.duration}"><h2>${s.label}</h2><video preload="auto" playsinline poster="${s.key}-desktop.png" src="${s.key}-preview.mp4"></video><div class="transport"><button data-play aria-label="Play" title="Play">&#9654;</button><button data-replay aria-label="Replay" title="Replay">&#8634;</button><input type="range" min="0" step="0.001" value="0" aria-label="Playback position"><output></output><label><input type="checkbox" checked>Loop</label></div></section>`).join('');
  fs.copyFileSync(path.join(__dirname,'sound_preview_player.js'),path.join(out,'preview-player.js'));
  fs.copyFileSync(path.join(__dirname,'sound_preview_player.css'),path.join(out,'preview-player.css'));
  fs.writeFileSync(path.join(out,'review.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="preview-player.css"><h1>${title}</h1><main>${cards}</main><script src="preview-player.js"></script></html>`);
  console.log(JSON.stringify({passed:true,shows:report.map(s=>({stem:s.stem,duration:s.live.duration,frameMs:s.frameMs})),audioAndProfilePreserved:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
