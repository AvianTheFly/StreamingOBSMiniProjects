/* Finite browser regression: independent lifetimes, visible artwork, real SSE relay. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out='C:/StreamingMedia/SpiritLobby/2026-10-03/review',assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
async function main(){
  const temp=fs.mkdtempSync(path.join(out,'party-fixture-')),python=execFileSync('py',['-3.11','-c','import sys;print(sys.executable)'],{encoding:'utf8'}).trim();
  const fixture=spawn(python,['-B','-X','utf8',path.join(__dirname,'spirit_lobby_fixture.py'),'--root',temp],{cwd:root,windowsHide:true});let browser,stderr='';fixture.stderr.on('data',s=>stderr+=s);
  try{
    const port=await new Promise((resolve,reject)=>{let s='';const timer=setTimeout(()=>reject(new Error(stderr||'Fixture timeout')),10000);fixture.stdout.on('data',chunk=>{s+=chunk;if(/^\d+\r?\n/.test(s)){clearTimeout(timer);resolve(Number(s.split('\n')[0]));}});fixture.once('exit',()=>{clearTimeout(timer);reject(new Error(stderr));});});
    const base=`http://127.0.0.1:${port}/spirit-lobby/`;browser=await chromium.launch({headless:true,channel:'chrome'});
    const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'index.html?paused=1&party=off');await page.locator('canvas[data-ready=true]').waitFor();
    const unit=await page.evaluate(async()=>{
      const {Celebration}=await import('./celebration.js'),e=new Celebration();await e.load();
      const first=crypto.randomUUID(),second=crypto.randomUUID();e.trigger(0,'confetti',first);e.trigger(1,'confetti',second);e.trigger(1,'confetti',first);
      const repeat=e.instances.map(x=>({id:x.id,started:x.started,seed:x.seed}));e.prune(10);const expiry=e.instances.map(x=>x.id);e.prune(11);const empty=e.instances.length===0;
      e.trigger(12,'wave');e.trigger(12.2,'wave');const waves=e.instances.map(x=>({start:x.waveStart,end:x.waveEnd,index:x.waveIndex}));const poses=[e.waveTime(12.3),e.waveTime(12.8)];
      e.clear();for(let i=0;i<24;i++)e.trigger(20,'confetti');const before=e.instances.map(x=>x.id),rejection=e.trigger(20,'confetti'),unchanged=JSON.stringify(before)===JSON.stringify(e.instances.map(x=>x.id));e.prune(30);const recovered=e.trigger(30,'confetti').ok;
      const pixels={},art=document.createElement('canvas');art.width=1920;art.height=1080;const c=art.getContext('2d',{willReadFrequently:true});
      for(const spec of e.catalog){e.clear();e.trigger(0,spec.id);c.clearRect(0,0,1920,1080);e.draw(c,spec.id==='ducks'?3.5:spec.id==='wave'?.6:3,['#63fff0','#ed69ff','#a88aff','#ffc86a'],spec.stage);const data=c.getImageData(0,0,1920,1080).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i]>20)count++;pixels[spec.id]=count;}
      e.dispose();return {repeat,expiry,empty,waves,poses,rejection,unchanged,recovered,pixels,disposed:e.instances.length===0&&e.disposed};
    });
    assert(unit.repeat.length===2&&unit.repeat[0].started===0&&unit.repeat[1].started===1&&unit.repeat[0].seed!==unit.repeat[1].seed,'Repeat replaced or duplicated an accepted burst');
    assert(unit.expiry.length===1&&unit.expiry[0]===unit.repeat[1].id&&unit.empty,'Independent expiry broke');
    assert(unit.waves[0].start===12&&unit.waves[1].start===12.7&&unit.poses[0]<1.9&&unit.poses[1]>3.1,'Queued alternating waves interrupted each other');
    assert(!unit.rejection.ok&&unit.unchanged&&unit.recovered&&unit.disposed,'Bounded admission cancelled existing effects or failed cleanup');
    for(const [kind,count] of Object.entries(unit.pixels))assert(count>100,kind+' artwork failed to paint');
    await page.goto(base+'studio.html?party=off');await page.locator('[data-action]').last().waitFor();const preview=page.frames().find(f=>f.url().includes('index.html'));await preview.locator('canvas[data-ready=true]').waitFor();
    const background=await browser.newPage(),foreground=await browser.newPage();for(const [p,layer] of [[background,'background'],[foreground,'foreground']]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(layer+': '+m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(layer+': '+r.status()+' '+r.url());});await p.goto(base+'index.html?party=off&layer='+layer);try{await p.locator('canvas[data-ready=true]').waitFor();}catch(e){throw new Error(layer+': '+errors.join('\n')+' '+await p.locator('#loading').textContent()+' '+e.message);}}
    await page.locator('[data-action=confetti]').click();await preview.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.effects).filter(x=>x.kind==='confetti').length===1);
    const first=await preview.evaluate(()=>JSON.parse(document.querySelector('canvas').dataset.effects)[0]);
    await page.waitForTimeout(300);await page.locator('[data-action=confetti]').click();await page.locator('[data-action=bubbles]').click();
    for(const p of [preview,background,foreground])await p.waitForFunction(()=>document.querySelector('canvas').dataset.effectCount==='3');
    const combined=await preview.evaluate(()=>JSON.parse(document.querySelector('canvas').dataset.effects));assert(combined.some(e=>e.id===first.id&&e.started===first.started),'Studio repeat erased or restarted the first burst');
    for(const p of [background,foreground]){const ids=await p.evaluate(()=>JSON.parse(document.querySelector('canvas').dataset.effects).map(x=>x.id).sort());assert(JSON.stringify(ids)===JSON.stringify(combined.map(x=>x.id).sort()),'Live layers missed or duplicated a cue');}
    for(const kind of ['visitor','vinyl','meteors','bloom','ducks','wave'])await page.locator(`[data-action=${kind}]`).click();
    await preview.waitForFunction(()=>document.querySelector('canvas').dataset.effectCount==='9');await page.waitForTimeout(2100);await preview.locator('canvas').screenshot({path:path.join(out,'party-combination.png')});
    const cameraAlpha=await foreground.evaluate(()=>document.querySelector('canvas').getContext('2d').getImageData(960,520,1,1).data[3]);assert(cameraAlpha===0,'Accents covered the live face opening');
    await page.screenshot({path:path.join(out,'party-studio.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Party controls overflow on mobile');
    await page.screenshot({path:path.join(out,'party-mobile.png'),fullPage:true});
    const lifecycle=await foreground.evaluate(async()=>{const {ActionLink}=await import('./action-link.js');let received=0;const link=new ActionLink(()=>received++);link.start();const source=link.source;source.onmessage({data:JSON.stringify({type:'spirit_lobby_action',payload:{issuedAt:Date.now()/1000-5}})});const stale=received===0;link.start();const single=link.source===source;link.stop();const closed=source.readyState===2&&link.source===null;link.dispose();link.start();return {stale,single,closed,disposed:link.source===null};});
    assert(Object.values(lifecycle).every(Boolean),'Stream lifetime or stale-cue guard failed');
    await page.locator('#party-live').uncheck();await page.setViewportSize({width:1920,height:1080});await page.locator('#party-clear').click();await preview.waitForFunction(()=>document.querySelector('canvas').dataset.effectCount==='0');
    await background.close();await foreground.close();
    // Record the real rendered scene while a series of distinct actions overlap.
    const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:path.join(out,'party-video'),size:{width:1280,height:720}}}),videoPage=await context.newPage();
    await videoPage.goto(base+'index.html?at=20&party=off');await videoPage.locator('canvas[data-ready=true]').waitFor();
    for(const key of ['Space','b','u','v','s','n','d','w','Space']){await videoPage.keyboard.press(key);await videoPage.waitForTimeout(450);}
    await videoPage.waitForTimeout(9500);const paintMs=await videoPage.locator('canvas').getAttribute('data-paint-ms'),video=videoPage.video();await context.close();await video.saveAs(path.join(out,'spirit-party-preview.webm'));
    assert(errors.length===0,errors.join('\n'));const report={unit,combined,lifecycle,cameraAlpha,mobile:true,liveLayers:true,paintMs,errors};fs.writeFileSync(path.join(out,'party-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser?.close();fixture.kill();const resolved=path.resolve(temp);if(resolved.startsWith(path.resolve(out)+path.sep)&&path.basename(resolved).startsWith('party-fixture-'))fs.rmSync(resolved,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
