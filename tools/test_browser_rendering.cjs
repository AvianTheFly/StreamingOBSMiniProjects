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
   window.testAudio=[];window.testFrames=0;
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
   if(!['overlay.html','overlay.css','playback.js','muffins.js','borders.js','renderers.js'].includes(file))return route.fulfill({status:404});
   return route.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://effects.test/overlay/soundboard');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>window.testFrames),0,'idle must not animate');
  active={id:'preview',stem:'die die die',effect:{renderer:'muffins',bpm:126},elapsed:0,paused:true};
  await page.waitForFunction(()=>window.testAudio.at(-1)?.readyState>=1);
  const frame=await page.evaluate(async()=>{
   const {MuffinShow}=await import('/muffins.js');const canvas=document.getElementById('effects'),show=new MuffinShow(canvas);show.draw(2,7,{bpm:126});
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
  active={id:'offline',stem:'die die die',effect:{renderer:'muffins',bpm:126},elapsed:0,paused:false};
  await page.waitForFunction(()=>!window.testAudio.at(-1).paused);offline=true;
  await page.waitForTimeout(2850);
  assert.equal(await page.evaluate(()=>window.testAudio.at(-1).getAttribute('src')),null,'server loss must stop audio');
  const pixels=await page.evaluate(()=>document.getElementById('effects').getContext('2d').getImageData(0,0,1920,1080).data.some((x,i)=>i%4===3&&x));
  assert.equal(pixels,false,'completion and offline recovery must clear the canvas');
  const borders=await page.evaluate(async()=>{
   const {BorderShow}=await import('/borders.js'),canvas=document.getElementById('effects'),show=new BorderShow(canvas),c=canvas.getContext('2d');
   return ['confetti','oops','arena','bonk','sparkles','disco','coffin','party','crabs','balloons','rats','raccoon','shades','racing','equalizer','cats'].map(style=>{
    show.draw(.3,4,{style,label:'BORDER TEST',bpm:126});
    const center=c.getImageData(240,170,1440,670).data,all=c.getImageData(0,0,1920,1080).data;
    const centralPixels=center.some((x,i)=>i%4===3&&x);let painted=0;for(let i=3;i<all.length;i+=4)if(all[i])painted++;
    return {style,centralPixels,painted};
   });
  });
  for(const b of borders){assert.equal(b.centralPixels,false,b.style+' must keep center clear');assert(b.painted>3000,b.style+' must draw props');}
  offline=false;active=null;await page.waitForTimeout(400);
  active={id:'border-audio',stem:'celebrate',effect:{renderer:'borders',style:'party',label:'CELEBRATE!'},elapsed:0,started:false,paused:false};
  await page.waitForFunction(()=>!window.testAudio.at(-1).paused);
  await page.waitForFunction(()=>window.testAudio.at(-1).getAttribute('src')===null,{},{timeout:8000});
  assert(acks.some(x=>x.id==='border-audio'&&x.status==='playing'));
  assert(acks.some(x=>x.id==='border-audio'&&x.status==='ended'));
  assert.deepEqual(errors,[]);console.log('Browser audio, pause/resume, transparency, idle and offline cleanup passed. Preview: '+output);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
