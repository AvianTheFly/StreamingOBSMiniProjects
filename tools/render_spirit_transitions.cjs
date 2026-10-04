// Offline deterministic renderer. No OBS changes, desktop input or browser polling.
// NODE_PATH must point at the bundled Node packages (Playwright).
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');const {once}=require('node:events');
const {chromium}=require('playwright');
const {serve,web}=require('./spirit_fixture.cjs');
let fixture;
const dest=process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v11';
const timing=JSON.parse(fs.readFileSync(path.join(web,'timing.json'),'utf8'));
const frameCount=Math.round(timing.duration*timing.fps);
const previewOnly=process.argv.includes('--preview-only');
const all=['bear','bear-alt','turtle','turtle-alt','ram','ram-alt','phoenix','phoenix-alt'];
const ids=process.argv.filter(x=>all.includes(x));
const chosen=ids.length?ids:all;
(async()=>{
 fs.mkdirSync(dest,{recursive:true});fixture=await serve();
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});
 try{const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(fixture.url);await page.waitForFunction(()=>!!window.spiritPreview);
 for(const id of chosen){
  const clipTiming={...timing,...(timing.animations?.[id.split('-')[0]]||{})};
  await page.evaluate(async id=>{const {SpiritTransition}=await import('./renderer.js');const next=await new SpiritTransition(document.createElement('canvas')).load(id);window.renderShow?.dispose();window.renderShow=next;},id);
  for(const t of [0,.4,1,1.6,2.3,2.9,3.5,clipTiming.coveredFrom,clipTiming.cut,clipTiming.coveredUntil,4.6,5.1,5.6,6.2,timing.duration]){
   const result=await page.evaluate(t=>{const s=window.renderShow;s.draw(t);const d=s.c.getImageData(0,0,1920,1080).data;let min=255,max=0,painted=0;for(let i=3;i<d.length;i+=4){min=Math.min(min,d[i]);max=Math.max(max,d[i]);if(d[i])painted++;}return {min,max,painted,png:s.canvas.toDataURL().split(',')[1]};},t);
   if(t>=clipTiming.coveredFrom&&t<=clipTiming.coveredUntil&&result.min!==255)throw Error(`${id} cut coverage failed at ${t}: alpha ${result.min}`);
   if((t===0||t===timing.duration)&&result.max!==0)throw Error(`${id} transparent boundary failed`);
   if(t===1.6&&result.painted<10000)throw Error(`${id} missing entrance`);
   fs.writeFileSync(path.join(dest,`${id}-${String(t).replace('.','_')}.png`),Buffer.from(result.png,'base64'));
  }
  console.log(`${id}: boundaries, entrance and opaque cut window verified`);
  if(previewOnly)continue;
  const file=path.join(dest,`${id}.webm`),temporary=path.join(dest,`${id}.rendering.webm`);
  const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-threads','1','-f','image2pipe','-framerate',String(timing.fps),'-vcodec','png','-i','pipe:0','-i',path.join(web,'audio',`${id}.wav`),'-map','0:v','-map','1:a','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','0','-lossless','1','-deadline','good','-cpu-used','4','-row-mt','1','-threads','4','-filter_threads','2','-auto-alt-ref','0','-c:a','libopus','-b:a','128k','-t',String(timing.duration),temporary],{stdio:['pipe','ignore','pipe']});
  let stderr='',exited=false;encoder.stderr.on('data',d=>{stderr+=d;fs.appendFileSync(path.join(dest,`${id}-encoder.log`),d);});const closed=once(encoder,'close').then(result=>{exited=true;return result;});encoder.stdin.on('error',()=>{});
  try{
  for(let f=0;f<frameCount;f++){
   const png=await page.evaluate(t=>{window.renderShow.draw(t);return window.renderShow.canvas.toDataURL('image/png').split(',')[1];},f/timing.fps);
   if(exited)throw Error(stderr||'Encoder exited before all frames');
   if(!encoder.stdin.write(Buffer.from(png,'base64')))await Promise.race([once(encoder.stdin,'drain'),closed.then(()=>{throw Error(stderr||'Encoder closed its input');})]);
   if(f%timing.fps===0)console.log(`${id}: ${f}/${frameCount} frames`);
  }encoder.stdin.end();const [code]=await closed;if(code!==0)throw Error(stderr||`Encoder exited ${code}`);fs.renameSync(temporary,file);console.log(`${id}: saved ${file}`);
  }finally{if(!exited){encoder.kill();await closed;}}
 }
 if(errors.length)throw Error(errors.join('\n'));
 if(!previewOnly){fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({version:11,width:1920,height:1080,fps:timing.fps,duration:timing.duration,cut_ms:Math.round(timing.cut*1000),animations:timing.animations,opaque_from_ms:Math.round(timing.coveredFrom*1000),opaque_until_ms:Math.round(timing.coveredUntil*1000),tail_guard_ms:Math.round(timing.tailGuard*1000),clips:all.filter(id=>fs.existsSync(path.join(dest,`${id}.webm`))),spirits:['bear','turtle','ram','phoenix'].filter(id=>fs.existsSync(path.join(dest,`${id}.webm`)))},null,2));}
 }finally{await browser.close();fixture.close();}
})().catch(e=>{console.error(e);fixture?.close();process.exitCode=1;});

