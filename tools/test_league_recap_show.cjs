// Two independent browser clients against the real feature owner in a temp archive.
const {spawn}=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/league-postgame/show-v3');
async function main(){fs.mkdirSync(out,{recursive:true});const server=spawn('py',['-3.11','-X','utf8','-u','tools/league_recap_fixture.py'],{cwd:root,windowsHide:true});let errors='';server.stderr.on('data',d=>errors+=d);
 const port=await new Promise((resolve,reject)=>{server.stdout.once('data',d=>resolve(Number(String(d).trim())));server.once('exit',c=>reject(Error(`Fixture exited ${c}: ${errors}`)));});assert.ok(port);
 const base=`http://127.0.0.1:${port}`,browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const control=await browser.newPage({viewport:{width:960,height:660}}),obs=await browser.newPage({viewport:{width:960,height:540}}),pageErrors=[];
  for(const p of [control,obs])p.on('pageerror',e=>pageErrors.push(e.message));
  await control.goto(base+'/league-stats/postgame.html?control=1');await obs.goto(base+'/league-stats/postgame.html?stream=1');await control.locator('#chronicle').waitFor({state:'visible'});await obs.locator('#chronicle').waitFor({state:'visible'});
  await control.getByRole('button',{name:'Pause automatic pages',exact:true}).click();
  for(const size of [{width:960,height:540},{width:640,height:360}]){await obs.setViewportSize(size);for(let i=0;i<7;i++){
   await control.locator(`[data-view="${i}"]`).click();await obs.waitForFunction(i=>document.querySelector(`[data-view="${i}"]`)?.getAttribute('aria-current')==='true',i);
   await obs.screenshot({path:path.join(out,`show-${size.width}-${i}.png`)});
   const clipped=await obs.evaluate(()=>{const r=document.getElementById('view').getBoundingClientRect();return [...document.querySelectorAll('#view .cohort,#view .feat small,#view .event,#view .skill-section,#view .chart-note,#view .survival-strip,#view .objective-bottom,#view .cast-row')].filter(e=>e.getBoundingClientRect().bottom>r.bottom+1).map(e=>({class:e.className,bottom:e.getBoundingClientRect().bottom,limit:r.bottom}));});assert.deepEqual(clipped,[],`Clipping in ${size.width} view ${i}`);
   assert.equal(await obs.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }}
  await control.locator('[data-view="3"]').click();await control.getByRole('button',{name:'Next detail',exact:true}).click();await obs.waitForFunction(()=>document.querySelector('.build-head h2')?.textContent.includes('2/3'));
  await control.getByRole('button',{name:'Hide from OBS',exact:true}).click();await obs.locator('#chronicle').waitFor({state:'hidden'});assert.equal(await control.locator('#chronicle').isVisible(),true);assert.match(await control.locator('#showStatus').textContent(),/Preview/);
  await control.getByRole('button',{name:'Show on OBS',exact:true}).click();await obs.locator('#chronicle').waitFor({state:'visible'});
  await fetch(base+'/test-phase',{method:'POST',body:JSON.stringify({phase:'InProgress'})});await obs.locator('#chronicle').waitFor({state:'hidden'});await control.getByRole('button',{name:'Show on OBS',exact:true}).waitFor();await control.waitForFunction(()=>document.getElementById('showToggle').disabled);
  await fetch(base+'/test-phase',{method:'POST',body:JSON.stringify({phase:'Lobby'})});await control.getByRole('button',{name:'Auto after games',exact:true}).click();await control.locator('[data-view="0"]').click();
  await fetch(base+'/test-clock',{method:'POST',body:JSON.stringify({seconds:29})});await obs.waitForFunction(()=>document.querySelector('[data-view="0"]')?.getAttribute('aria-current')==='true');
  await fetch(base+'/test-clock',{method:'POST',body:JSON.stringify({seconds:1})});await obs.waitForFunction(()=>document.querySelector('[data-view="1"]')?.getAttribute('aria-current')==='true');
  await control.locator('[data-view="0"]').click();await control.getByRole('button',{name:'Pause automatic pages',exact:true}).click();await control.getByRole('button',{name:'Resume automatic pages',exact:true}).click();
  await fetch(base+'/test-clock',{method:'POST',body:JSON.stringify({seconds:13})});await obs.waitForFunction(()=>document.querySelector('[data-view="1"]')?.getAttribute('aria-current')==='true');
  const before=await fetch(base+'/api/league-stats/postgame').then(r=>r.json());const stale=await fetch(base+'/api/league-stats/postgame-control',{method:'POST',body:JSON.stringify({action:'hide',match_id:before.match.id,revision:before.show.revision-1})});assert.equal(stale.status,400);
  await control.locator('#allEvents').click();assert.equal(await control.locator('#fullTimeline').isVisible(),true);assert.ok(await control.locator('#fullEvents .event').count()>40);
  const host=await browser.newPage({viewport:{width:1040,height:800}});let hostReads=0;host.on('request',r=>{if(r.url().endsWith('/api/league-stats/postgame'))hostReads++;});await host.goto(base+'/test-controller');
  await host.frameLocator('iframe').locator('#chronicle').waitFor({state:'visible'});await host.screenshot({path:path.join(out,'hub-controller.png')});
  await host.locator('summary').click();await host.waitForFunction(()=>!document.querySelector('iframe'));const reads=hostReads;await host.waitForTimeout(1250);assert.equal(hostReads,reads,'Collapsed Hub controller stops polling');
  await host.locator('summary').click();await host.frameLocator('iframe').locator('#chronicle').waitFor({state:'visible'});await host.locator('#destroy').click();assert.equal(await host.locator('iframe').count(),0);await host.close();
  assert.deepEqual(pageErrors,[]);console.log('PASS: real-owner two-client OBS sync, 960/640 layouts, paging, hide/show, gameplay gate, autoplay, stale controls, full detail.');
 }finally{await browser.close();server.kill();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
