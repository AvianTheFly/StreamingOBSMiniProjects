// Read-only UI checks against disposable catalog/live/history fixtures.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=process.env.WORKFLOW_MAP_OUTPUT_DIR||path.join(root,'output/workflow-map');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'output/workflow-map/catalog-fixture.json'),'utf8'));
const now=Date.now()/1000;
const state={scene:{scene:'Replay',temporary_owner:'instant_replay',pending_scene:'Lobbies',observing:true},
  projects:fixture.modules.map(m=>({name:m.id,is_active:m.id==='instant_replay',current_activity:m.id==='instant_replay'?'Showing clip':''})),
  playback:{instant_replay:{ready:true,allowed:true}},pauses:{specific_song:{claims:1,resume_on_release:true,owners:[{owner:'instant_replay',kind:'playback',sequence:8}]}},
  voice:{state:'idle',owner:null},conversions:{capacity:3,used:1,queued:2}};
const records=[
  {id:7,time:now,session:'fixture',event:'runtime.state',owner:'hub',phase:'observed',...state},
  {id:6,time:now-1,session:'fixture',event:'game.disconnected',dispatch:1,listener:'scene_voice_switcher.main.disconnected',phase:'received'},
  {id:5,time:now-1,session:'fixture',event:'game.disconnected',dispatch:1,listener:'hub_ui.updates.forward',phase:'received'},
  {id:4,time:now-1,session:'fixture',event:'game.disconnected',dispatch:1,phase:'emitted',listeners:['scene_voice_switcher.main.disconnected','hub_ui.updates.forward']},
  {id:3,time:now-3,session:'fixture',event:'scene.decision',owner:'league_api',scene:'Lobbies',phase:'deferred',reason:'Temporary owner active'},
  {id:2,time:now-5,session:'fixture',event:'source.playback',owner:'instant_replay',source:'replay:media',phase:'started'},
  {id:1,time:now-10,session:'fixture',event:'hub.started',owner:'hub',phase:'observed'}];
let changed=false;const calls=[];
async function main(){
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  let server;
  try{
    const live=process.argv.includes('--live');
    let base='http://127.0.0.1:7420/';
    if(!live){server=http.createServer((req,res)=>{
      calls.push({method:req.method,path:req.url});if(req.method!=='GET'){res.writeHead(405);res.end();return;}
      const url=new URL(req.url,'http://fixture');let data;
      if(url.pathname==='/api/workflow-map'){data=structuredClone(fixture);data.flows.find(f=>f.id==='league_api.idle').steps[0].configured=true;data.projects=state.projects;data.rules=[{requester:'instant_replay',pause:['specific_song'],resume_on_finish:true}];data.saved_workflows=[{id:'fixture',name:'Stream warmup',steps:[{kind:'project',project:'starting_soon',action:'start'},{kind:'project',project:'specific_song',action:'revert'}]}];if(changed){data.revision='changed';data.review_count=1;data.flows[0].verification='review';}}
      else if(url.pathname==='/api/workflow-map/live')data={state,recent:[...records].reverse(),recording:true,storage:'local',retention_days:14,subscriptions:{'game.disconnected':['scene_voice_switcher.main.disconnected','hub_ui.updates.forward']}};
      else if(url.pathname==='/api/workflow-map/history'){const q=(url.searchParams.get('q')||'').toLowerCase();data={records:records.filter(r=>(r.event+' '+r.owner).toLowerCase().includes(q)),next:null};}
      else if(url.pathname==='/api/workflow-map/source')data={text:'def fixture():\n    return True'};
      else if(url.pathname==='/api/status')data={projects:state.projects};
      else if(url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.end(': fixture\n\n');return;}
      else if(url.pathname.startsWith('/api/'))data={};
      if(data!==undefined){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));return;}
      const file=path.join(root,'hub_ui/app',url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));
      if(!file.startsWith(path.join(root,'hub_ui/app'))||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(fs.readFileSync(file));
    });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}/`;}
    const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const screenshot=page.screenshot.bind(page);page.screenshot=async options=>{await page.mouse.move(0,0);return screenshot({...options,animations:'disabled'});};
    if(live)await page.route(url=>new URL(url).pathname!=='/api/events',route=>{calls.push({method:route.request().method(),path:new URL(route.request().url()).pathname});return route.request().method()==='GET'?route.continue():route.abort();});
    await page.goto(base+'#workflows',{waitUntil:'domcontentloaded'});
    try{await page.locator('.wf-map-node').first().waitFor();}catch(error){await page.screenshot({path:path.join(output,'load-failure.png')});console.error('Map load failed:',await page.locator('#page').textContent(),errors);throw error;}
    assert.match(await page.title(),/^Stream map/,'Page title and navigation must use one name');
    assert.equal(await page.locator('.wf-map-node').count(),6,'Overview must fit six understandable areas');
    assert(await page.locator('[data-connection]').count()>0,'Overview must show actual connections');
    assert.equal(await page.locator('.wf-rail').count(),0,'The inventory rail must not return');
    const coverage=await page.evaluate(async()=>{
      const {AREAS,atlas,pathTo,pathForFlow,connections}=await import('/js/workflow/atlas.js');
      const {enrich}=await import('/js/workflow/model.js');
      const catalog=enrich(await (await fetch('/api/workflow-map')).json());
      const items=AREAS.flatMap(function walk(item){return [item,...item.children.flatMap(walk)];});
      const facts=connections(catalog);
      return {unreachable:catalog.flows.filter(f=>!pathForFlow(catalog,f).length).map(f=>f.id),
        large:items.filter(item=>atlas(catalog,pathTo(item.id)).nodes.filter(n=>!n.context&&!n.external).length>6).map(i=>i.id),
        fabricated:atlas(catalog).edges.flatMap(e=>e.facts).some(f=>f.kind==='scenario'?!catalog.flows.some(flow=>flow===f.flow&&pathForFlow(catalog,flow)[0]===f.from.slice(5)):!facts.some(actual=>actual.from===f.from&&actual.to===f.to&&actual.label===f.label))};
    });
    assert.deepEqual(coverage.unreachable,[],'Every described behavior must remain reachable');
    assert.deepEqual(coverage.large,[],'Nested maps must stay small enough to understand at a glance');
    assert.equal(coverage.fabricated,false,'Area connections must retain source evidence');
    await page.locator('[data-connection]').first().press('Enter');
    assert.match(await page.locator('.wf-inspector').textContent(),/Why these connect/i);
    await page.locator('.wf-close').click();
    await page.locator('[data-overview]').click();
    await page.screenshot({path:path.join(output,live?'live-overview.png':'overview.png')});
    await page.locator('[data-node="game"]').click();
    await page.locator('[data-back]').click();
    assert.equal(await page.locator('.wf-map-node').count(),6,'Back must restore the whole-stream map');
    await page.locator('[data-node="game"]').press('Enter');
    await page.locator('[data-node="after"]').click();
    assert.equal(await page.locator('.wf-map-node:not(.wf-map-context):not(.wf-map-external):not(.wf-map-resource)').count(),6,'After a match must show its six reactions');
    assert(await page.locator('.wf-map-resource').count()>1,'A situation must show what its reactions affect');
    await page.screenshot({path:path.join(output,live?'live-game-ends.png':'game-ends.png')});
    await page.locator('[data-resource="scene"]').click();
    assert.equal(await page.locator('.wf-map-node:not(.wf-map-context):not(.wf-map-resource)').count(),3,'Screen focus must hide archiving and stats, but retain the result hold');
    await page.locator('[data-example="result"]').click();
    if(!live){assert(await page.locator('.wf-outcome-wait').count()>0,'Result hold must visibly delay the router');assert(await page.locator('.wf-outcome-skip').count()>0,'Client-owned routing must make the fallback stand down');}
    await page.locator('[data-node="resource:scene"]').press('Enter');
    assert.match(await page.locator('.wf-inspector').textContent(),/no fixed priority|accepted later writes/i);
    assert.match(await page.locator('.wf-inspector').textContent(),/excludes a client router/);
    if(!live){await page.locator('[data-resource-history]').click();assert.equal(await page.locator('.wf-history-search').inputValue(),'scene.decision');await page.waitForFunction(()=>document.querySelectorAll('.wf-history-list .wf-record').length===1);await page.locator('[data-mode="explore"]').click();await page.locator('[data-node="resource:scene"]').press('Enter');}
    await page.locator('.wf-close').click();
    await page.screenshot({path:path.join(output,live?'live-screen-overlap.png':'screen-overlap.png')});
    await page.locator('[data-example="manual"]').click();
    await page.locator('[data-node="resource:scene"]').click();
    assert.match(await page.locator('.wf-inspector').textContent(),/captured before your scene choice|newer manual revision/i);
    await page.locator('.wf-close').click();
    await page.locator('[data-example="temporary"]').click();
    await page.locator('[data-node="resource:scene"]').click();
    assert.match(await page.locator('.wf-inspector').textContent(),/pending target and retries|retry/i);
    if(!live)assert.match(await page.locator('.wf-inspector').textContent(),/Replay|Replay studio/);
    await page.locator('.wf-close').click();
    const explanation=await page.evaluate(async()=>{const {explainEffect,effectsFor}=await import('/js/workflow/behavior.js');const c=await (await fetch('/api/workflow-map')).json();const idle=c.flows.find(f=>f.id==='league_api.idle'),fallback=c.flows.find(f=>f.id==='scene_voice_switcher.end');idle.steps[0].configured=false;return {disabled:explainEffect(c,idle,effectsFor(idle)[0],'normal').status,fallback:explainEffect(c,fallback,effectsFor(fallback)[0],'normal').status};});
    assert.deepEqual(explanation,{disabled:'skip',fallback:'ready'},'Disabled client automation must leave the fallback eligible');
    await page.locator('[data-resource="all"]').click();
    await page.locator('[data-node="flow:scene_voice_switcher.end"]').click();
    assert.match(await page.locator('.wf-breadcrumbs').textContent(),/Your game.*After a match.*Return to a lobby/);
    assert(await page.locator('.wf-map-node').count()<=5,'Interaction must summarize participants before steps');
    await page.locator('[data-node="coordination"]').click();
    assert.match(await page.locator('.wf-inspector').textContent(),/This participant’s part/);
    assert.equal(await page.locator('.wf-open-controls').getAttribute('href'),'#rules','A participant must lead to its existing controls');
    await page.locator('.wf-close').click();
    await page.screenshot({path:path.join(output,live?'live-interaction.png':'interaction.png')});
    await page.locator('[data-details]').click();
    assert(await page.locator('.wf-granular').count()>0,'Selecting a branch must reveal individual steps');
    await page.screenshot({path:path.join(output,live?'live-steps.png':'steps.png')});
    const before=await page.locator('.wf-scale').textContent();await page.locator('[data-zoom="in"]').click();
    assert.notEqual(await page.locator('.wf-scale').textContent(),before);
    await page.locator('[data-mode="live"]').first().click();
    await page.locator('[data-node="scene"]').waitFor();
    if(!live){assert.match(await page.locator('.wf-world').textContent(),/Held by Replay studio/);assert.match(await page.locator('.wf-world').textContent(),/Held by Replay studio/);}
    await page.screenshot({path:path.join(output,live?'live-current.png':'current.png')});
    await page.locator('[data-freeze]').click();assert.match(await page.locator('.wf-recording').textContent(),/recording continues/);await page.locator('[data-freeze]').click();
    await page.locator('[data-mode="history"]').first().click();
    await page.locator('.wf-history-list .wf-record').first().waitFor();
    if(!live){await page.locator('.wf-history-search').fill('game.disconnected');await page.waitForFunction(()=>document.querySelectorAll('.wf-history-list .wf-record').length===3);await page.locator('.wf-history-list .wf-record').last().click();assert.equal(await page.locator('.wf-trace li').count(),2);await page.locator('.wf-close').click();await page.locator('.wf-history-search').fill('');await page.waitForFunction(()=>document.querySelectorAll('.wf-history-list .wf-record').length===7);await page.locator('.wf-history-list .wf-record').first().click();await page.locator('[data-snapshot]').click();assert.match(await page.locator('.wf-location-title').textContent(),/State at/);await page.locator('[data-mode="history"]').first().click();}
    await page.screenshot({path:path.join(output,live?'live-history.png':'history.png')});
    await page.locator('[data-mode="explore"]').click();
    await page.locator('.wf-map-search input').fill('death');
    await page.locator('.wf-search-results [data-flow="league_api.death"]').click();
    assert.match(await page.locator('.wf-breadcrumbs').textContent(),/Your game.*During a match.*Death & respawn/);
    if(!live){await page.locator('[data-overview]').click();await page.locator('[data-node="screen"]').click();await page.locator('[data-node="permission"]').click();await page.locator('[data-node="resource:audio"]').click();assert.match(await page.locator('.wf-inspector').textContent(),/Pause Music while Replay studio plays/);assert.match(await page.locator('.wf-inspector').textContent(),/manual|scoped/);await page.locator('.wf-close').click();await page.locator('[data-node="flow:rules.0"]').click();await page.locator('[data-details]').click();assert.match(await page.locator('.wf-world').textContent(),/Pause Music/);await page.locator('[data-overview]').click();await page.locator('[data-node="you"]').click();await page.locator('[data-node="sequences"]').click();assert.match(await page.locator('.wf-map-world').textContent(),/Stream warmup/);}
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-overview]').click();
    await page.screenshot({path:path.join(output,live?'live-mobile.png':'mobile.png')});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Phone layout must not overflow');
    await page.locator('[data-node="game"]').click();await page.locator('[data-node="after"]').click();await page.screenshot({path:path.join(output,live?'live-mobile-event.png':'mobile-event.png')});
    await page.locator('[data-resource="scene"]').click();await page.locator('[data-node="resource:scene"]').press('Enter');
    assert.match(await page.locator('.wf-inspector').textContent(),/Shared resource/);await page.locator('.wf-close').click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Resource controls must fit on a phone');
    if(!live){await page.setViewportSize({width:1600,height:1000});await page.locator('[data-overview]').click();changed=true;await page.waitForFunction(()=>!document.querySelector('.wf-review').hidden,{},{timeout:20000});assert.match(await page.locator('.wf-sync').textContent(),/review/);}
    assert.deepEqual(errors,[]);assert(calls.every(c=>c.method==='GET'),'Map must never send commands');
    console.log(`Workflow UI ${live?'live read-only':'fixture'} checks passed; ${calls.length} GET requests.`);
  }finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
