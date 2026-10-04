/* Finite procedural/visual QA: organic variety, soft crowding, synchronized layers. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out='C:/StreamingMedia/SpiritLobby/2026-10-03/review',assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
async function main(){
  const temp=fs.mkdtempSync(path.join(out,'auto-fixture-')),python=execFileSync('py',['-3.11','-c','import sys;print(sys.executable)'],{encoding:'utf8'}).trim();
  const fixture=spawn(python,['-B','-X','utf8',path.join(__dirname,'spirit_lobby_fixture.py'),'--root',temp],{cwd:root,windowsHide:true});let browser,stderr='';fixture.stderr.on('data',s=>stderr+=s);
  try{
    const port=await new Promise((resolve,reject)=>{let s='';const timer=setTimeout(()=>reject(new Error(stderr||'Fixture timeout')),10000);fixture.stdout.on('data',chunk=>{s+=chunk;if(/^\d+\r?\n/.test(s)){clearTimeout(timer);resolve(Number(s.split('\n')[0]));}});fixture.once('exit',()=>{clearTimeout(timer);reject(new Error(stderr));});});
    const base=`http://127.0.0.1:${port}/spirit-lobby/`;browser=await chromium.launch({headless:true,channel:'chrome'});
    const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'index.html?paused=1&party=off');await page.locator('canvas[data-ready=true]').waitFor();
    const simulation=await page.evaluate(async()=>{
      const {Celebration}=await import('./celebration.js'),{PartyDirector}=await import('./party-director.js');
      const template=new Celebration();await template.load();const results={},anchor=1770000011;
      for(const mode of ['gentle','lively','wild']){
        const e=new Celebration();e.catalog=template.catalog;const d=new PartyDirector(e),ids=new Set(),kinds=new Set(),counts=new Set(),samples=[],starts=[];let maxPlans=0,maxAttempts=0;
        for(let t=0;t<1800;t+=.5){d.tick(t,mode,anchor+t);maxPlans=Math.max(maxPlans,d.plans.size);maxAttempts=Math.max(maxAttempts,d.attempts.size);counts.add(e.instances.length);for(const event of e.instances)if(!ids.has(event.id)){ids.add(event.id);kinds.add(event.kind);starts.push(event.wallStarted);}if(t%60===0)samples.push(e.instances.length);}
        const first=d.plan(Math.floor(anchor/60),'lively').map(e=>e.kind).join(','),next=d.plan(Math.floor(anchor/60)+1,'lively').map(e=>e.kind).join(',');
        const frozen=e.instances.map(e=>e.id);d.dispose();d.tick(1900,mode,anchor+1900);results[mode]={events:ids.size,kinds:[...kinds],counts:[...counts].sort((a,b)=>a-b),samples,maxPlans,maxAttempts,plans:d.plans.size,attempts:d.attempts.size,differentPlans:first!==next,disposed:JSON.stringify(frozen)===JSON.stringify(e.instances.map(e=>e.id))};
      }
      const a=new Celebration(),b=new Celebration();a.catalog=b.catalog=template.catalog;const da=new PartyDirector(a),db=new PartyDirector(b);let synchronized=true;
      for(let t=0;t<90;t+=.25){da.tick(100+t,'lively',anchor+t);db.tick(200+t,'lively',anchor+t);const normalize=(e,clock)=>e.instances.map(x=>({id:x.id,seed:x.seed,age:Math.round((clock-x.started)*1000)})).sort((x,y)=>x.id.localeCompare(y.id));if(JSON.stringify(normalize(a,100+t))!==JSON.stringify(normalize(b,200+t)))synchronized=false;}
      const manual=new Celebration();manual.catalog=template.catalog;const dm=new PartyDirector(manual),manualId=crypto.randomUUID();manual.trigger(0,'confetti',manualId);for(let t=0;t<5;t+=.1)dm.tick(t,'lively',anchor+t);const kept=manual.instances.find(e=>e.id===manualId)?.started===0;
      const off=new Celebration();off.catalog=template.catalog;const od=new PartyDirector(off);for(let t=0;t<100;t++)od.tick(t,'off',anchor+t);
      const speedEvents={};for(const speed of [.35,1.7]){const effects=new Celebration();effects.catalog=template.catalog;const director=new PartyDirector(effects),ids=new Set();for(let t=0;t<600;t+=.5){director.tick(t*speed,'lively',anchor+t,speed);for(const e of effects.instances)ids.add(e.id);}speedEvents[speed]=ids.size;director.dispose();}
      return {results,synchronized,manualPreserved:kept,offEmpty:off.instances.length===0,speedEvents};
    });
    assert(simulation.synchronized,'Two render layers generated different automatic cameos');assert(simulation.manualPreserved,'Automatic rhythm interrupted a manual burst');assert(simulation.offEmpty,'Manual-only mode started automatic accents');
    for(const [mode,result] of Object.entries(simulation.results)){assert(result.kinds.length===17,mode+' never selected some surprises');assert(result.counts.length>=4&&result.differentPlans,mode+' became a fixed-count repeating cycle');assert(result.maxPlans<=4&&result.maxAttempts<=256&&result.plans===0&&result.attempts===0&&result.disposed,'Director cache or teardown failed');}
    assert(simulation.speedEvents['0.35']<simulation.speedEvents['1.7'],'Automatic cadence ignored the motion speed');
    assert(simulation.results.gentle.events<simulation.results.lively.events&&simulation.results.lively.events<simulation.results.wild.events,'Rhythm controls failed to change the party pace');
    // Render every new cameo in context at a deliberate readable moment.
    for(const [kind,at] of [['lanterns',4],['jellyfish',4],['planes',3],['robot',3],['portal',3.4],['balloons',4],['pinball',3],['fireflies',3],['moon',2.6],['fireworks',2.5]]){
      await page.evaluate(async([kind,at])=>{const {Celebration}=await import('./celebration.js'),{palettes}=await import('./config.js');const e=new Celebration();await e.load();e.trigger(0,kind);const c=document.querySelector('canvas').getContext('2d');e.draw(c,at,palettes.electric,e.catalog.find(x=>x.id===kind).stage);},[kind,at]);
      await page.locator('canvas').screenshot({path:path.join(out,`auto-${kind}.png`)});await page.reload();await page.locator('canvas[data-ready=true]').waitFor();
    }
    await page.goto(base+'studio.html');await page.locator('[data-action]').last().waitFor();assert(await page.locator('[data-action]').count()===18,'New surprises missing from the controls');const frame=page.frames().find(f=>f.url().includes('index.html'));await frame.locator('canvas[data-ready=true]').waitFor();
    await frame.waitForFunction(()=>Number(document.querySelector('canvas').dataset.ambientCount)>0);await page.screenshot({path:path.join(out,'automatic-studio.png'),fullPage:true});
    await page.getByLabel('The party runs itself').selectOption('gentle');await frame.waitForFunction(()=>document.querySelector('canvas').dataset.party==='gentle');assert((await page.locator('#url').inputValue()).includes('party=gentle'),'Copied OBS links lost the chosen rhythm');
    await page.getByRole('button',{name:'Pause motion',exact:true}).click();await frame.waitForFunction(()=>document.querySelector('canvas').dataset.paused==='true');const frozen=await frame.locator('canvas').getAttribute('data-effects');await page.waitForTimeout(450);assert(await frame.locator('canvas').getAttribute('data-effects')===frozen,'Paused automatic party kept advancing');
    await page.getByLabel('The party runs itself').selectOption('off');await page.locator('#party-clear').click();await page.getByRole('button',{name:'Resume motion',exact:true}).click();await frame.waitForFunction(()=>document.querySelector('canvas').dataset.party==='off'&&document.querySelector('canvas').dataset.effectCount==='0');await page.waitForTimeout(800);assert(await frame.locator('canvas').getAttribute('data-effect-count')==='0','Manual only did not stay quiet');
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'18-button controls overflow on mobile');await page.screenshot({path:path.join(out,'automatic-mobile.png'),fullPage:true});
    const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:path.join(out,'auto-video'),size:{width:1280,height:720}}}),videoPage=await context.newPage();videoPage.on('pageerror',e=>errors.push(e.message));await videoPage.goto(base+'index.html');await videoPage.locator('canvas[data-ready=true]').waitFor();const history=[],types=new Set();
    for(let i=0;i<18;i++){await videoPage.waitForTimeout(2000);const effects=await videoPage.evaluate(()=>JSON.parse(document.querySelector('canvas').dataset.effects));history.push(effects.map(e=>e.kind));for(const e of effects)types.add(e.kind);}
    assert(types.size>=5,'The real party failed to keep discovering new things without button presses');const paintMs=await videoPage.locator('canvas').getAttribute('data-paint-ms'),video=videoPage.video();await context.close();await video.saveAs(path.join(out,'spirit-autoparty-preview.webm'));
    assert(errors.length===0,errors.join('\n'));const report={simulation,realAutomatic:{kinds:[...types],history,paintMs},newArtists:true,controls:true,pause:true,mobile:true,errors};fs.writeFileSync(path.join(out,'autoparty-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser?.close();fixture.kill();const resolved=path.resolve(temp);if(resolved.startsWith(path.resolve(out)+path.sep)&&path.basename(resolved).startsWith('auto-fixture-'))fs.rmSync(resolved,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
