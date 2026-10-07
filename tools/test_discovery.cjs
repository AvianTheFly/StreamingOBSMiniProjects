// Guide integration: safe exploration, real controls, coverage and deep navigation.
// Live mode blocks every non-GET request; only fixtures exercise playback.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),app=path.join(root,'hub_ui/app');
const output=process.env.HUB_UI_TEST_OUTPUT||path.join(root,'output/discovery');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'output/workflow-map/catalog-fixture.json'),'utf8'));
const projects=['instant_replay','starting_soon','specific_song','soundboard','sound_effects','tik_tok','scene_voice_switcher','spotify','love_me','league_api','league','league_stats','twitch_celebrations','twitch_commands'].map(name=>({name,is_active:name==='instant_replay',is_paused:false,current_activity:name==='instant_replay'?'Showing clip':null,actions:['random','start','play_replay','pause','resume','revert'].map(key=>({key,label:key})),produces_audio:true}));
async function main(){
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const live=process.argv.includes('--live'),page=await browser.newPage({viewport:{width:1600,height:1100}}),calls=[],errors=[];let currentProjects=projects,coordination={scenes:{scene:'Replay',observing:true,temporary_owner:'instant_replay'},stream:{active:false},pauses:{}},failCoordination=false;
  page.on('pageerror',e=>errors.push(e.message));
  if(!live)await page.addInitScript(()=>{window.EventSource=class{constructor(){queueMicrotask(()=>this.onopen?.());}close(){}};});
  if(live)await page.route(url=>new URL(url).pathname!=='/api/events',r=>{calls.push({method:r.request().method(),path:new URL(r.request().url()).pathname});return r.request().method()==='GET'?r.continue():r.abort();});
  else await page.route('http://guide.test/**',async route=>{
   const req=route.request(),url=new URL(req.url());calls.push({method:req.method(),path:url.pathname,body:req.postDataJSON()});
   if(req.method()!=='GET')return route.fulfill({json:{ok:true}});
   if(url.pathname==='/api/events')return route.fulfill({body:'event: status_update\ndata: '+JSON.stringify({projects:currentProjects})+'\n\n',contentType:'text/event-stream'});
   if(url.pathname==='/api/status')return route.fulfill({json:{projects:currentProjects}});
   if(url.pathname==='/api/coordination')return route.fulfill(failCoordination?{status:503,json:{error:'fixture unavailable'}}:{json:coordination});
   if(url.pathname==='/api/workflow-map')return route.fulfill({json:{...catalog,projects:currentProjects}});
   if(url.pathname==='/api/workflow-map/live')return route.fulfill({json:{state:{scene:coordination.scenes,projects:currentProjects},recent:[],recording:true}});
   if(url.pathname==='/api/projects/soundboard/assets')return route.fulfill({json:[{source:'hooray',name:'Hooray'},{source:'a cue',name:'A cue'}]});
   if(url.pathname==='/api/editor-profiles')return route.fulfill({json:{projects:[{key:'soundboard',name:'Soundboard',profiles:[{name:'default',live:true,hotkey_map:{'@':'hooray'}}]}]}});
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});
   const file=path.resolve(app,url.pathname==='/'?'index.html':'.'+url.pathname);if(!file.startsWith(app+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  const base=live?'http://127.0.0.1:7420/':'http://guide.test/';
  await page.goto(base+'#library',{waitUntil:'domcontentloaded'});await page.locator('.guide-area').first().waitFor();
  assert.equal(new URL(page.url()).hash,'#library','Guided discovery remains directly accessible');
  assert.equal(await page.locator('.guide-area').count(),6);assert.equal(await page.locator('.library-tile').count(),0);
  assert.match(await page.title(),/^Your stream/);
  const coverage=await page.evaluate(async()=>{const {IDEAS,AREAS}=await import('/js/discovery/catalog.js');const {FEATURES,TOOLS}=await import('/js/catalog.js');const c=await (await fetch('/api/workflow-map')).json();const owners=new Set(IDEAS.flatMap(i=>[i.owner,...i.also||[]]));return {missing:[...Object.keys(FEATURES),...TOOLS.map(t=>t.id)].filter(id=>!owners.has(id)),badFlows:IDEAS.filter(i=>i.flow&&!c.flows.some(f=>f.id===i.flow)).map(i=>i.flow),large:AREAS.filter(a=>a.ideas.length>6).map(a=>a.id),count:IDEAS.length};});
  assert.deepEqual(coverage.missing,[]);assert.deepEqual(coverage.badFlows,[]);assert.deepEqual(coverage.large,[]);assert(coverage.count>=25);
  if(!live){await page.waitForFunction(()=>document.querySelector('#guideScene').textContent==='Replay');assert.match(await page.locator('#guideOwnership').textContent(),/Replay studio holds/);assert.equal(await page.locator('#guideStream').textContent(),'Not streaming');}
  await page.screenshot({path:path.join(output,live?'live-guide-home.png':'guide-home.png'),animations:'disabled',fullPage:true});
  await page.locator('[data-tour]').click();assert.match(await page.locator('#guideTourStep').textContent(),/^1 of 3/);assert.match(await page.locator('#guideIdeaTitle').textContent(),/sound/);
  assert(calls.every(c=>c.method==='GET'),'Exploring and starting the tour must not operate OBS');
  await page.locator('[data-guide-bindings]').click();await page.waitForFunction(()=>!document.querySelector('#guideBindings').textContent.includes('Reading'));
  if(!live)assert.match(await page.locator('#guideBindings').textContent(),/@.*hooray/s);
  assert(await page.locator('.guide-dialog').evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs((r.left+r.right)/2-innerWidth/2)<2;}),'Idea dialog must be centered');await page.screenshot({path:path.join(output,live?'live-guide-idea.png':'guide-idea.png'),animations:'disabled'});
  await page.locator('.guide-dialog [data-desk-panel="sounds"]').click();await page.locator('#deskResultCount').filter({hasNotText:'Loading'}).waitFor();
  if(!live){await page.locator('.desk-choice').filter({hasText:'Hooray'}).getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#deskPanelFeedback').textContent.includes('requested'));assert.deepEqual(calls.find(c=>c.path==='/api/projects/soundboard/play-asset')?.body,{source:'hooray'});}
  await page.locator('#deskPanelClose').click();await page.locator('[data-tour-next]').click();assert.match(await page.locator('#guideIdeaTitle').textContent(),/lobby world/);await page.locator('[data-tour-next]').click();assert.match(await page.locator('#guideIdeaTitle').textContent(),/Replay/);await page.locator('[data-tour-back]').click();assert.match(await page.locator('#guideIdeaTitle').textContent(),/lobby world/);await page.locator('[data-guide-close]').click();assert(await page.locator('[data-tour]').evaluate(el=>el===document.activeElement));
  await page.locator('.guide-area[href*="area=moments"]').click();await page.locator('.guide-idea').first().waitFor();assert.equal(await page.locator('.guide-idea').count(),6);
  await page.locator('[data-guide-idea="replay-show"]').click();assert.match(await page.locator('.guide-dialog-copy').textContent(),/What viewers get.*Starts with.*Your next step/s);
  await page.locator('.guide-deeper a').filter({hasText:'Understand'}).click();await page.locator('.wf-map-node').first().waitFor();assert.match(await page.locator('.wf-breadcrumbs').textContent(),/Show a replay/);assert.match(await page.locator('.wf-map-caption').textContent(),/Play a replay/);assert.equal(await page.locator('.desk-dialog').count(),0,'Guide dialogs must be removed on navigation');
  await page.goto(base+'#library?area=viewers');await page.locator('[data-guide-idea="commands"]').click();assert.match(await page.locator('.guide-dialog-copy').textContent(),/permissions and cooldowns/);assert.equal(await page.locator('.guide-idea-actions a').first().getAttribute('href'),'#projects/twitch_commands');await page.locator('[data-guide-close]').click();
  await page.locator('a[data-page="library"]').click();await page.locator('.guide-area').first().waitFor();
  await page.locator('#libraryQuery').fill('raid');assert(await page.locator('[data-guide-idea="celebrations"]').count()>0);await page.locator('#libraryQuery').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('#libraryResults img').count(),0);assert.equal(await page.locator('#libraryResults .guide-idea').count(),0);await page.locator('#libraryQuery').fill('');
  await page.locator('.guide-automatic a[href*="area=after"]').click();await page.locator('.wf-map-node').first().waitFor();assert.match(await page.locator('.wf-breadcrumbs').textContent(),/After a match/);
  for(const width of [390,768,1200]){await page.setViewportSize({width,height:1000});await page.goto(base+'#library');await page.locator('.guide-area').first().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Guide overflow at ${width}`);await page.locator('[data-tour]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Idea overflow at ${width}`);await page.locator('[data-guide-close]').click();if(width===390)await page.screenshot({path:path.join(output,live?'live-guide-phone.png':'guide-phone.png'),animations:'disabled',fullPage:true});}
  if(!live){await page.setViewportSize({width:1600,height:1100});currentProjects=[...projects,{name:'future_feature',actions:[],is_active:false}];await page.evaluate(async projects=>{(await import('/js/state.js')).state.set({projects});},currentProjects);await page.goto(base+'#library?q=future');await page.locator('#libraryResults .library-tile').waitFor();assert.match(await page.locator('#libraryResults').textContent(),/Future Feature/i);await page.goto(base+'#library?idea=sound');await page.locator('.guide-dialog[open]').waitFor();await page.evaluate(async()=>{const {state}=await import('/js/state.js');state.set({connected:false});});assert.equal(await page.locator('#guideScene').textContent(),'Hub disconnected');assert.equal(await page.locator('.guide-availability').textContent(),'Status unavailable');await page.locator('[data-desk-panel="sounds"]').click();await page.locator('#deskPanelResults [data-row]').first().waitFor();assert(await page.locator('#deskPanelResults [data-row]').first().isDisabled());await page.locator('#deskPanelClose').click();await page.locator('[data-guide-close]').click();}
  assert.deepEqual(errors,[]);if(live)assert(calls.every(c=>c.method==='GET'));
  console.log(`Guided discovery ${live?'live read-only':'fixture'}: startup, feature/tool coverage, tour, viewer outcomes, controls, saved keys, behavior links, search, disconnection and responsive layouts passed.`);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
