// Off-stream recording of the actual four stage documents and screen transitions.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const out=path.resolve('output/lobby-udyr-refresh');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:760},recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:760}}});
 try{
  const page=await context.newPage();await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?preview=1&world=forge&paused=1');await page.locator('canvas[data-ready=true]').waitFor();
  await page.evaluate(()=>{
   window.dispatchEvent(new Event('pagehide'));document.body.innerHTML='';document.body.style.cssText='margin:0;background:#111722;color:#eee;display:grid;grid-template-columns:640px 640px;overflow:hidden';
   for(const [id,name] of [['aurora-camp','Freljord Spirit Camp'],['phoenix-observatory','Cryophoenix Observatory'],['sanctuary','Ionian Spirit Sanctuary'],['forge','Hotfix Foundry']]){
    const box=document.createElement('section');box.style.cssText='width:640px;height:380px';const frame=document.createElement('iframe');frame.style.cssText='width:640px;height:360px;border:0';frame.src=`index.html?world=${id}&preview=1&screen=0&auto=0&at=30`;frame.dataset.world=id;const label=document.createElement('div');label.style.cssText='font:14px Segoe UI;padding-left:12px';label.textContent=name;box.append(frame,label);document.body.append(box);
   }
  });
  for(const frame of page.frames().slice(1))await frame.locator('canvas[data-ready=true]').waitFor();
  await page.evaluate(()=>{
   const frames=[...document.querySelectorAll('iframe')];const send=(i,data)=>frames[i].contentWindow.postMessage({type:'living-lobby',...data},location.origin);
   frames.forEach((f,i)=>{send(i,{cue:'moment-'+(i===1?'weather':i===2?'lanterns':'awakening'),id:'moment-start'});send(i,{cue:'league-udyr',id:'udyr-start'});});
   setTimeout(()=>frames.forEach((f,i)=>{send(i,{displayVisible:true});send(i,{cue:'border-'+(i%2?'climber':'goose'),id:'border-show'});send(i,{cue:'border-poro',id:'poro-show'});}),14000);
   setTimeout(()=>document.body.dataset.done='true',27500);
  });
  await page.locator('body[data-done=true]').waitFor({timeout:35000});const video=page.video();await context.close();await video.saveAs(path.join(out,'spirit-lobbies-review.webm'));console.log('Recorded four real stages, scenic moments and media-frame transitions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
