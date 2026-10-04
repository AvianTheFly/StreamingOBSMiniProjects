// Real Chromium audio/canvas tests with isolated HTTP fixtures; no desktop input.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const web = path.resolve(__dirname, '../lib/browser_effects/web');
const output = process.env.EFFECT_PREVIEW_PATH || path.resolve(__dirname, '../tmp_obs_debug/muffin-preview.png');
function silence(seconds) {
 const samples=44100*seconds, file=Buffer.alloc(44+samples*2);
 file.write('RIFF');file.writeUInt32LE(file.length-8,4);file.write('WAVEfmt ',8);
 file.writeUInt32LE(16,16);file.writeUInt16LE(1,20);file.writeUInt16LE(1,22);
 file.writeUInt32LE(44100,24);file.writeUInt32LE(88200,28);file.writeUInt16LE(2,32);
 file.writeUInt16LE(16,34);file.write('data',36);file.writeUInt32LE(samples*2,40);return file;
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[],acks=[],wave=silence(4);let active=null,offline=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let release;
   window.borderTestReadiness=new Promise(r=>release=r);window.releaseBorderArt=release;
   window.testAudio=[];window.testFrames=0;window.testCanvasClears=0;
   const clearOriginal=CanvasRenderingContext2D.prototype.clearRect;
   CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='effects')window.testCanvasClears++;return clearOriginal.apply(this,args);};
   const AudioOriginal=window.Audio, rafOriginal=window.requestAnimationFrame;
   window.Audio=function(...args){const audio=new AudioOriginal(...args);window.testAudio.push(audio);return audio;};
   window.requestAnimationFrame=fn=>rafOriginal(t=>{window.testFrames++;fn(t);});
  });
  await page.route('http://effects.test/**',async route=>{
   const url=new URL(route.request().url()), name=url.pathname.split('/').pop();
   if(url.pathname.startsWith('/api/state/')){
    if(offline)return route.abort();
    return route.fulfill({json:{active}});
   }
   if(url.pathname.startsWith('/api/ack/')){acks.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});}
   if(url.pathname.startsWith('/audio/'))return route.fulfill({body:wave,contentType:'audio/wav'});
   const file=url.pathname.startsWith('/overlay/')?'overlay.html':name;
   if(!['overlay.html','overlay.css','mash-dance.png','playback.js','muffins.js','borders.js','production.js','rave.js','subtle.js','renderers.js'].includes(file))return route.fulfill({status:404});
   let body=fs.readFileSync(path.join(web,file));
   if(file==='rave.js'){
    const source=body.toString();assert(source.includes('export const artReady=Promise.all([momFrogSprites.ready,spamSprites.ready]);'));
    body=source.replace('export const artReady=Promise.all([momFrogSprites.ready,spamSprites.ready]);','export const artReady=Promise.all([momFrogSprites.ready,spamSprites.ready,window.borderTestReadiness]);');
   }
   return route.fulfill({body,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
  });
  await page.goto('http://effects.test/overlay/soundboard');
  const envelopes=await page.evaluate(async()=>{
   const {presentationEnvelope}=await import('/subtle.js');
   return [.417875,.432086,.496327,.522449,1.149388].map(d=>({d,start:presentationEnvelope(.012,d,{shortCue:true}),tail:presentationEnvelope(d-.018,d,{shortCue:true}),end:presentationEnvelope(d,d,{shortCue:true}),after:presentationEnvelope(d+.1,d,{shortCue:true}),legacy:presentationEnvelope(.1,8)}));
  });
  for(const e of envelopes){assert.equal(e.start,1);assert.equal(e.tail,1);assert.equal(e.end,0);assert.equal(e.after,0);assert(e.legacy<.1,'long/other presentations keep their established fades');}
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>window.testFrames),0,'idle must not animate');
  active={id:'loading-art',stem:'die die die',effect:{renderer:'muffins',bpm:126},elapsed:0,paused:false};
  await page.waitForFunction(()=>window.testAudio.at(-1)?.readyState>=1);
  assert.equal(await page.evaluate(()=>window.testAudio.at(-1).paused),true,'audio waits for renderer readiness');
  active=null;await page.waitForFunction(()=>window.testAudio.at(-1).getAttribute('src')===null);
  await page.evaluate(()=>window.releaseBorderArt());
  assert(!acks.some(x=>x.id==='loading-art'&&x.status==='playing'),'cancelled renderer readiness must not start audio');
  active={id:'preview',stem:'die die die',effect:{renderer:'muffins',bpm:126},elapsed:0,paused:true};
  await page.waitForFunction(()=>window.testAudio.at(-1)?.readyState>=1);
  const frame=await page.evaluate(async()=>{
   const {MuffinShow}=await import('/muffins.js');const canvas=document.getElementById('effects'),show=new MuffinShow(canvas);await show.ready;show.draw(2,7,{bpm:126});
   const c=canvas.getContext('2d');const center=c.getImageData(240,170,1440,670).data;
   let centralPixels=0;for(let i=3;i<center.length;i+=4)if(center[i])centralPixels++;
   const all=c.getImageData(0,0,1920,1080).data;let painted=0;for(let i=3;i<all.length;i+=4)if(all[i])painted++;
   return {centralPixels,painted};
  });
  assert.equal(frame.centralPixels,0,'gameplay center must stay transparent');assert(frame.painted>20000,'border show must draw characters');
  fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:output,omitBackground:true});
  active=null;await page.waitForFunction(()=>window.testAudio.at(-1).getAttribute('src')===null);
  active={id:'first',stem:'die die die',effect:{renderer:'muffins',bpm:126},elapsed:0,started:false,paused:false};
  await page.waitForFunction(()=>window.testAudio.at(-1)?.currentTime>.3);
  assert(acks.some(x=>x.id==='first'&&x.status==='playing'),'actual audio must acknowledge playing');
  active={...active,paused:true};await page.waitForFunction(()=>window.testAudio.at(-1).paused);
  const paused=await page.evaluate(()=>({time:window.testAudio.at(-1).currentTime,frames:window.testFrames}));
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>window.testAudio.at(-1).currentTime),paused.time,'pause freezes audio');
  assert.equal(await page.evaluate(()=>window.testFrames),paused.frames,'pause freezes visuals');
  active={...active,paused:false};await page.waitForFunction(()=>!window.testAudio.at(-1).paused);
  await page.waitForFunction(()=>window.testAudio.at(-1).getAttribute('src')===null,{},{timeout:8000});
  assert(acks.some(x=>x.id==='first'&&x.status==='ended'),'natural completion must acknowledge ended');
  active=null;await page.waitForTimeout(400);
  const idleClears=await page.evaluate(()=>window.testCanvasClears);
  await page.waitForTimeout(750);
  assert.equal(await page.evaluate(()=>window.testCanvasClears),idleClears,'idle polling must not repeatedly clear the full canvas');
  active={id:'offline',stem:'die die die',effect:{renderer:'muffins',bpm:126},elapsed:0,paused:false};
  await page.waitForFunction(()=>!window.testAudio.at(-1).paused);offline=true;
  await page.waitForTimeout(2850);
  assert.equal(await page.evaluate(()=>window.testAudio.at(-1).getAttribute('src')),null,'server loss must stop audio');
  const pixels=await page.evaluate(()=>document.getElementById('effects').getContext('2d').getImageData(0,0,1920,1080).data.some((x,i)=>i%4===3&&x));
  assert.equal(pixels,false,'completion and offline recovery must clear the canvas');
  const borders=await page.evaluate(async()=>{
   const {BorderShow}=await import('/borders.js'),canvas=document.getElementById('effects'),show=new BorderShow(canvas),c=canvas.getContext('2d');await show.ready;
   return ['confetti','oops','arena','bonk','sparkles','disco','coffin','party','crabs','balloons','rats','raccoon','shades','racing','equalizer','cats','nyan','mash'].map(style=>{
    show.draw(.3,4,{style,label:'BORDER TEST',bpm:126});
    const center=c.getImageData(240,170,1440,670).data,all=c.getImageData(0,0,1920,1080).data;
    const centralPixels=center.some((x,i)=>i%4===3&&x);let painted=0;for(let i=3;i<all.length;i+=4)if(all[i])painted++;
    return {style,centralPixels,painted};
   });
  });
  for(const b of borders){assert.equal(b.centralPixels,false,b.style+' must keep center clear');assert(b.painted>3000,b.style+' must draw props');}
  const track=await page.evaluate(async()=>{
   const {nightRunTrack:point,nightRunMotion:motion,NIGHT_RUN_TRACK_LENGTH:length}=await import('/rave.js');
   const {BorderShow}=await import('/borders.js'),canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
   const c=canvas.getContext('2d',{willReadFrequently:true}),show=new BorderShow(canvas);await show.ready;
   const arc=Math.PI*45,joins=[0,1692,1692+arc,2450+arc,2450+arc*2,4142+arc*2,4142+arc*3,4900+arc*3,length];
   const continuity=joins.every(s=>{const a=point(s-.01),b=point(s+.01);return Math.hypot(a.x-b.x,a.y-b.y)<.021&&Math.cos(a.angle-b.angle)>.999;});
   const a=point(37),b=point(37+length);
   let clear=true,deterministic=true;
   for(const t of [.8,3.4,6.6,8.5]){
    show.draw(t,12,{style:'racing',label:'DEJA VU',bpm:154});
    clear&&=!c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v);
    const first=canvas.toDataURL();show.draw(t,12,{style:'racing',label:'DEJA VU',bpm:154});deterministic&&=first===canvas.toDataURL();
   }
   const duration=6.873107;
   const gears=[.05,.21,.41,.61,.81].map(p=>motion(p*duration,duration).gear);
   const speeds=[.1,.4,.8].map(p=>(motion(p*duration+.01,duration).distance-motion(p*duration,duration).distance)/.01);
   return{continuity,wrapped:Math.hypot(a.x-b.x,a.y-b.y)<1e-6,clear,deterministic,
    gears:gears.join(',')==='1,2,3,4,5',accelerating:speeds[0]<speeds[1]&&speeds[1]<speeds[2],fullCircuit:motion(duration-.65,duration).distance>=length};
  });
  assert.deepEqual(track,{continuity:true,wrapped:true,clear:true,deterministic:true,gears:true,accelerating:true,fullCircuit:true},'Car traverses corners and lap seam smoothly, shifts 1–5, accelerates and completes a lap inside the actual clip; gameplay and paused frames stay clear');
  const progression=await page.evaluate(async()=>{
   const {BorderShow,choreography}=await import('/borders.js'),canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
   // Readback-heavy determinism checks use one software backing store; Chromium's
   // GPU-to-CPU migration otherwise changes premultiplied RGB rounding by one.
   const c=canvas.getContext('2d',{willReadFrequently:true}),show=new BorderShow(canvas);await show.ready;
   if(show.dancer)await show.dancer.decode();
   const result=[];
   for(const style of ['arena','crabs','nyan','mash','disco','raccoon','rats','racing','party','coffin','balloons','shades','equalizer','bonk','oops','sparkles','confetti','cats','tantrum','kitchen','meltdown','rewind','violin','spill','heartbreak','arcade','approval']){
    const frames=[];
    for(const fraction of [.08,.3,.6,.9]){
     show.draw(7.175*fraction,7.175,{style,label:'PRODUCTION TEST',bpm:126,rave:true});
     const central=c.getImageData(240,170,1440,670).data,all=c.getImageData(0,0,1920,1080).data;let maxAlpha=0;for(let i=3;i<all.length;i+=4)maxAlpha=Math.max(maxAlpha,all[i]);
     const first=canvas.toDataURL();show.draw(7.175*fraction,7.175,{style,label:'PRODUCTION TEST',bpm:126,rave:true});
     frames.push({maxAlpha,phase:choreography(7.175*fraction,7.175).phase,clear:!central.some((x,i)=>i%4===3&&x),deterministic:first===canvas.toDataURL(),image:first});
    }
    result.push({style,solidForeground:frames.some(x=>x.maxAlpha>=230),phases:frames.map(x=>x.phase),clear:frames.every(x=>x.clear),deterministic:frames.every(x=>x.deterministic),distinct:new Set(frames.map(x=>x.image)).size});
   }
   return {result,short:choreography(3,5).phase,long:choreography(60,100).phase};
  });
  for(const r of progression.result){assert.deepEqual(r.phases,[0,1,2,3]);assert(r.solidForeground,r.style+' must retain visible solid foregrounds');assert(r.clear,r.style+' must stay clear in all chapters');assert(r.deterministic,r.style+' must redraw identically at paused time');assert.equal(r.distinct,4,r.style+' must evolve throughout playback');}
  assert.equal(progression.short,progression.long,'chapters must scale to actual clip duration');
  await page.evaluate(async()=>{
   const {BorderShow}=await import('/borders.js');
   document.documentElement.style.cssText='height:auto;overflow:visible';
   document.body.style.cssText='height:auto;overflow:visible;width:auto;margin:0;background:#111624;color:#f7f8ff;font-family:Arial;display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:22px';
   document.getElementById('effects').style.display='none';
   for(const [style,label]of [['arena','JOHN CENA / CAMERAS & SPOTLIGHTS'],['crabs','CRAB RAVE'],['mash','BLING BANG BANG BORN'],['nyan','NYAN CAT / RAINBOW FLIGHT']]){
    const section=document.createElement('section');section.innerHTML='<h2 style="font-size:20px;letter-spacing:2px">'+label+'</h2>';
    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.style.cssText='position:static;display:block;width:100%;height:auto;background:#070c18;border-radius:14px';section.appendChild(canvas);document.body.appendChild(section);
    const show=new BorderShow(canvas);await show.ready;if(show.dancer)await show.dancer.decode();show.draw(4.5,7.175,{style,label:style==='nyan'?'NYAN CAT':style==='arena'?'THE CHAMP IS HERE':label,bpm:126});
   }
  });
  const celebrationPreview=path.join(path.dirname(output),'celebration-borders.png');await page.screenshot({path:celebrationPreview,fullPage:true});
  await page.evaluate(()=>{document.querySelectorAll('section').forEach(x=>x.remove());document.getElementById('effects').style.display='';document.body.removeAttribute('style');document.documentElement.removeAttribute('style');});
  offline=false;active=null;await page.waitForTimeout(400);
  for(const [id,stem,effect]of [['border-audio','celebrate',{renderer:'borders',style:'party',label:'CELEBRATE!'}],['hooray-audio','hooray',{renderer:'hooray'}]]){
   active={id,stem,effect,elapsed:0,started:false,paused:false};
   await page.waitForFunction(()=>!window.testAudio.at(-1).paused);
   await page.waitForFunction(()=>window.testAudio.at(-1).getAttribute('src')===null,{},{timeout:8000});
   assert(acks.some(x=>x.id===id&&x.status==='playing'));
   assert(acks.some(x=>x.id===id&&x.status==='ended'));
   active=null;await page.waitForTimeout(400);
  }
  assert.deepEqual(errors,[]);console.log('Browser audio, pause/resume, transparency, idle and offline cleanup passed. Preview: '+output);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
