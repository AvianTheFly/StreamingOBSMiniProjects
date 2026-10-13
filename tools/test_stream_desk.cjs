// Stream-flow controls against disposable HTTP contracts; --live is GET-only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const app = path.resolve(__dirname, '../hub_ui/app');
const output = path.resolve(__dirname, '../output/minimal-stream-desk');
const project = (name, keys) => ({name, actions:keys.map(key=>({key,label:key})), is_active:false});
async function main() {
  if(process.argv.includes('--live')) { require('./test_hub_ui.cjs'); return; }
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[], writes=[];
    const chooseStage=async id=>page.locator(`[data-stage-tile="${id}"]`).click();
    page.on('pageerror',e=>errors.push(e.message));
    let fail=false, buffer=false, currentLobby=null;
    let lobbySelection={mode:'shuffle',source:null};
    let lobbyDisplay={selected:'udyr',options:['udyr','client','desktop','chrome'].map(id=>({id,available:true}))};
    const otherScenes=[{scene:'Spirit Intermission',label:'Be right back'}];
    const worlds=[{source:'TavernLobby',label:'Tavern',art_url:'/test-art/forge.png'},{source:'ForgeLobby',label:'Spirit forge',art_url:'/test-art/forge.png'},{source:'Spirit Afterparty',label:'Spirit afterparty',art_url:'/test-art/forge.png'}];
    let startingConfig={opening_catalog:{cinematic:{available:true},available:true,title:'Sanctuary',seconds:40},opening:false,revision:1,artwork:['fjord.png','forest.png'],rotate_artwork:true,artwork_catalog:[{file:'fjord.png',title:'Fjord Sanctuary'},{file:'forest.png',title:'The Spirit Grove'}]};
    let scenes={scene:'Test',observing:true,automatic_holds:[]}, stream={active:false};
    let stage={active:false,pending:false,capture:{status:'idle'}};
    const sceneFeature=project('scene_voice_switcher',['hold_scene','follow_scenes']);
    sceneFeature.workflow={session:{held:false,stage:null,lobby:null}};
    const league=project('league_api',['champion_select','queue_lobby','show_draft','show_loading','show_queue']);
    league.workflow={connected:true,phase:'Lobby',loading_scene:'League Spirit Loading',stage:{loading:false,queue:false},champion_scene:'League Champion Select World',scene_automation:true};
    const projects=[project('starting_soon',['start','finish','intro','skip-intro']),project('instant_replay',['quick_replay','save','play_replay','revert']),sceneFeature,league];
    const setScene=(scene,temporary_owner=null)=>{scenes={...scenes,scene,temporary_owner};};
    await page.addInitScript(()=>{
      window.EventSource=class {constructor(){window.deskSource=this;queueMicrotask(()=>this.onopen?.());}close(){}};
      const original=window.setTimeout.bind(window);
      window.setTimeout=(callback,delay,...args)=>original(callback,[3000,4000].includes(delay)?80:delay,...args);
    });
    await page.route('http://desk.test/**',async route=>{
      const req=route.request(), url=new URL(req.url());
      if(req.method()==='POST') {
        const body=req.postDataJSON();
        writes.push({path:url.pathname,body});
        await new Promise(r=>setTimeout(r,120));
        if(fail)return route.fulfill({status:409,json:{error:'Fixture rejected action'}});
        if(url.pathname.endsWith('/selection'))lobbySelection={mode:body.mode,source:body.source};
        if(url.pathname.endsWith('/screen_content')){lobbyDisplay={...lobbyDisplay,selected:body.content};return route.fulfill({json:{ok:true,...lobbyDisplay}});}
        if(url.pathname.endsWith('/queue-theme'))league.workflow.queue_theme=body.theme;
        if(url.pathname==='/api/starting-soon/settings'){startingConfig={...startingConfig,...body,revision:startingConfig.revision+1};return route.fulfill({json:startingConfig});}
        if(url.pathname.endsWith('/starting-soon/start')){projects[0].is_active=true;setScene('Starting Soon','starting_soon');}
        if(url.pathname.endsWith('/starting-soon/set-art')){startingConfig.artwork_index=startingConfig.artwork.indexOf(body.file);projects[0].workflow={...projects[0].workflow,artwork_file:body.file};}
        if(url.pathname.endsWith('/starting-soon/next-art')){startingConfig.artwork_index=((startingConfig.artwork_index||0)+1)%startingConfig.artwork.length;projects[0].workflow={...projects[0].workflow,artwork_file:startingConfig.artwork[startingConfig.artwork_index]};}
        if(url.pathname.endsWith('/starting-soon/cinematic')){startingConfig.opening=true;projects[0].workflow={opening:true,cinematic:true};setScene('Hub Starting Soon Stage','starting_soon');}
        if(url.pathname.endsWith('/starting-soon/intro')){startingConfig.opening=true;projects[0].workflow={opening:true};setScene('Hub Starting Soon Stage','starting_soon');}
        if(url.pathname.endsWith('/starting-soon/skip-intro')){startingConfig.opening=false;projects[0].workflow={opening:false};currentLobby='TavernLobby';setScene('Lobbies');}
        if(url.pathname.endsWith('/next_lobby')){currentLobby='ForgeLobby';setScene('Lobbies');}
        if(url.pathname.endsWith('/select_stage')) {
          const held=['break','ending'].includes(body.stage);
          currentLobby=body.stage==='game'?null:body.source||'TavernLobby';
          setScene(body.stage==='game'?'Test':'Lobbies');
          scenes.automatic_holds=held?['scene_voice_switcher']:[];
          sceneFeature.workflow.session={held,stage:body.stage,lobby:currentLobby};
        }
        if(url.pathname.endsWith('/hold_scene')) {scenes.automatic_holds=['scene_voice_switcher'];sceneFeature.workflow.session.held=true;}
        if(url.pathname.endsWith('/follow_scenes')) {scenes.automatic_holds=[];sceneFeature.workflow.session={held:false};}
        if(url.pathname.endsWith('/show_loading'))setScene('League Spirit Loading');
        if(url.pathname.endsWith('/show_draft'))setScene('League Champion Select World');
        if(url.pathname.endsWith('/show_queue')){currentLobby='TavernLobby';setScene('Lobbies');}
        if(url.pathname.endsWith('/switch_scene'))setScene(body.scene);
        if(url.pathname.endsWith('/start_stream'))stream.active=true;
        if(url.pathname.endsWith('/stop_stream'))stream.active=false;
        if(url.pathname.endsWith('/start_replay_buffer'))buffer=true;
        if(url.pathname.endsWith('/quick_replay'))stage={active:false,pending:true,capture:{status:'saving',purpose:'replay_only'}};
        if(url.pathname.endsWith('/revert')) {stage={active:false,pending:false,capture:{status:'ready'}};setScene('Test');}
        return route.fulfill({json:{ok:true,lobby:currentLobby,selection:lobbySelection}});
      }
      if(url.pathname==='/api/league-stage')return route.fulfill({json:{selected:'sanctuary',revision:0,images:[{id:'sanctuary',title:'Sanctuary',image_url:'/test-art/forge.png'}]}});
      if(url.pathname==='/api/status')return route.fulfill({json:{projects}});
      if(url.pathname==='/api/coordination')return route.fulfill({json:{scenes,stream,replay_buffer:{active:buffer},display:{visible:false},pauses:{}}});
      if(url.pathname==='/api/starting-soon')return route.fulfill({json:startingConfig});
      if(url.pathname.endsWith('/catalog'))return route.fulfill({json:{locations:worlds.map(w=>({...w,effects:{actions:w.source==='ForgeLobby'?[{id:'duck',label:'Duck delivery'},{id:'moth',label:'Ember moth'},{id:'runes',label:'Wall runes'},{id:'hammer',label:'Tiny hammer'}]:[]}})),selection:lobbySelection}});
      if(url.pathname==='/api/spirit-lobby/actions')return route.fulfill({json:{actions:[{id:'wave',label:'Wave hello'}]}});
      if(url.pathname.startsWith('/starting-soon/art/'))return route.fulfill({body:fs.readFileSync(path.resolve(__dirname,'../mini projects/starting_soon/art',decodeURIComponent(url.pathname.split('/').pop()))),contentType:'image/png'});
      if(url.pathname==='/test-art/forge.png')return route.fulfill({body:fs.readFileSync(path.resolve(__dirname,'../mini projects/scene_voice_switcher/art/forge-base.png')),contentType:'image/png'});
      if(url.pathname.endsWith('/lobbies'))return route.fulfill({json:{selection:lobbySelection,display:lobbyDisplay,locations:worlds,game_scene:'Test',program_scene:scenes.scene,current_lobby:currentLobby,other_scenes:otherScenes,lobbies:['TavernLobby','ForgeLobby','Spirit Afterparty']}});
      if(url.pathname.endsWith('/stage'))return route.fulfill({json:stage});
      if(url.pathname.endsWith('/instant_replay/clips'))return route.fulfill({json:{ready:true,revision:1,clips:[{id:'clip1',name:'Saved moment',path:'C:/fixture.mp4',purpose:'highlight',saved_at:1791550000,size_bytes:1048576}],groups:[]}});
      if(url.pathname==='/api/obs/audio')return route.fulfill({json:{inputs:[{name:'Microphone',kind:'wasapi_input_capture',volume_db:-6,muted:false},{name:'Desktop audio',kind:'wasapi_output_capture',volume_db:-12,muted:false}]}});
      if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});
      const file=path.resolve(app,url.pathname==='/'?'index.html':'.'+url.pathname);
      if(!file.startsWith(app+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
      return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
    });
    const emit=()=>page.evaluate(projects=>window.deskSource.onmessage?.({data:JSON.stringify({type:'status_update',payload:{projects}})}),projects);
    await page.goto('http://desk.test/');
    const current=async id=>page.waitForFunction(id=>document.querySelector(`[data-stage-tile="${id}"]`).classList.contains('is-current'),id);
    await current('game');assert.equal(writes.length,0);
    await chooseStage('lobby');await page.locator('[data-lobby-content="udyr"]').waitFor({state:'visible'});
    await page.locator('[data-lobby-content="chrome"]').click();await page.waitForFunction(()=>document.querySelector('[data-lobby-content="chrome"]').getAttribute('aria-pressed')==='true');assert.equal(lobbyDisplay.selected,'chrome');assert.equal(scenes.scene,'Test','Display choice does not switch program scene');
    await page.locator('[data-queue-theme="turtle"]').click();await page.waitForFunction(()=>document.querySelector('[data-queue-theme="turtle"]').getAttribute('aria-pressed')==='true');assert.equal(league.workflow.queue_theme,'turtle');assert.equal(scenes.scene,'Test','Theme choice does not switch program scene');
    assert.equal(await page.locator('#deskQueuePreview iframe').getAttribute('src'),null);
    await page.screenshot({path:path.join(output,'queue-controls.png'),fullPage:true});
    writes.length=0;await chooseStage('game');
    const stageChoices=await page.locator('[data-stage-tile]').evaluateAll(items=>items.map(e=>e.dataset.stageTile));
    for(const required of ['starting','cinematics','lobby','replay','draft','loading','game','ending'])assert(stageChoices.includes(required),required+' control is missing');
    assert.equal(await page.locator('#deskPictureTitle').innerText(),'In game');
    await chooseStage('cinematics');assert.equal(writes.length,0);assert(await page.locator('#deskChangeImage').isHidden());
    await page.locator('#deskShowStage').click();await current('cinematics');
    assert.equal(writes.at(-1).path,'/api/starting-soon/cinematic');
    await page.locator('[data-cue="skip-cinematic"]').click();await current('lobby');
    writes.length=0;
    await chooseStage('starting');assert.equal(writes.length,0);assert(await page.locator('#deskShowStage').isEnabled());
    await page.locator('#deskShowStage').click();await current('starting');
    assert(writes.some(w=>w.path==='/api/starting-soon/start'));
    await page.locator('#deskChangeImage').click();await page.locator('[data-image="forest.png"]').click();
    assert(!writes.some(w=>w.path.endsWith('/set-art')));
    await page.locator('#useStageImage').click();await page.waitForFunction(()=>!document.querySelector('.stage-appearance-dialog').open);
    assert.equal(startingConfig.artwork[startingConfig.artwork_index],'forest.png');
    assert.equal(startingConfig.rotate_artwork,true,'An image choice preserves personal rotation');
    await page.locator('[data-cue="intro"]').click();await page.waitForFunction(()=>!document.querySelector('[data-cue="intro"]').hasAttribute('aria-busy'));
    assert(startingConfig.opening);
    await chooseStage('lobby');await page.locator('#deskChangeImage').click();await page.locator('[data-image="ForgeLobby"]').click();await page.locator('#useStageImage').click();
    await page.waitForFunction(()=>!document.querySelector('.stage-appearance-dialog').open);
    assert.equal(scenes.scene,'Hub Starting Soon Stage','Changing the lobby choice does not switch OBS');
    await page.locator('#deskShowStage').click();await current('lobby');assert.equal(currentLobby,'ForgeLobby');
    await page.getByRole('button',{name:'Duck delivery',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('[data-cue="effect"]').hasAttribute('aria-busy'));
    assert.deepEqual(writes.at(-1),{path:'/api/projects/scene_voice_switcher/effect',body:{source:'ForgeLobby',action:'duck'}});
    league.workflow.phase='Matchmaking';league.workflow.stage.queue=true;await emit();await current('lobby');
    assert.equal(await page.locator('[data-stage-tile="draft"]').innerText(),'◇\nBans & picks');
    const beforeNext=writes.length;
    await page.getByRole('button',{name:'Show Bans & picks now',exact:true}).click();
    await current('draft');
    assert.equal(writes.length,beforeNext+1,'A next-scene card sends one deliberate command');
    assert.equal(writes.at(-1).path,'/api/project-actions/league_api/show_draft');
    league.workflow.phase='ChampSelect';league.workflow.stage.queue=false;await emit();await chooseStage('draft');
    assert.equal(scenes.scene,'League Champion Select World');
    await page.getByRole('button',{name:'Show Loading now',exact:true}).click();await current('loading');
    await chooseStage('draft');await page.locator('#deskShowStage').click();await current('draft');
    league.workflow.connected=false;league.workflow.phase='None';league.workflow.stage.loading=false;await emit();
    await chooseStage('loading');assert(await page.locator('#deskShowStage').isEnabled(),'Manual loading works without the League client');
    await page.locator('#deskShowStage').click();await current('loading');
    assert(writes.some(w=>w.path.endsWith('/show_loading')));
    await chooseStage('draft');await page.locator('#deskShowStage').click();await current('draft');
    assert.equal(scenes.scene,'League Champion Select World');
    const liveActions=league.actions;league.actions=league.actions.filter(a=>!a.key.startsWith('show_'));await emit();
    await chooseStage('loading');await page.locator('#deskShowStage').click();await current('loading');
    assert.deepEqual(writes.at(-1),{path:'/api/projects/scene_voice_switcher/switch_scene',body:{scene:'League Spirit Loading'}},'A running older Hub remains usable without a restart');
    await chooseStage('draft');await page.locator('#deskShowStage').click();await current('draft');
    assert.equal(writes.at(-1).body.scene,'League Champion Select World');
    league.actions=liveActions;league.workflow.connected=true;
    league.workflow.phase='GameStart';league.workflow.stage.loading=true;await emit();await chooseStage('loading');
    await page.locator('#deskShowStage').click();await current('loading');
    await page.locator('[data-cue="mastery"]').click();await page.waitForFunction(()=>!document.querySelector('[data-cue="mastery"]').hasAttribute('aria-busy'));
    assert.deepEqual(writes.at(-1),{path:'/api/projects/tik_tok/play-asset',body:{source:'loading screen mastery'}});
    await page.locator('#deskAuto').click();await page.waitForFunction(()=>document.querySelector('#deskAuto').textContent.includes('Resume'));
    assert.deepEqual(scenes.automatic_holds,['scene_voice_switcher']);
    await page.locator('#deskAuto').click();await page.waitForFunction(()=>document.querySelector('#deskAuto').textContent.includes('Hold view'));
    await chooseStage('game');await page.locator('#deskShowStage').click();await current('game');
    assert(await page.locator('[data-cue="replay"]').isDisabled());buffer=true;
    await page.waitForFunction(()=>!document.querySelector('[data-cue="replay"]').disabled);
    await page.locator('[data-cue="replay"]').click();await page.waitForFunction(()=>document.querySelector('[data-cue="replay"]').disabled&&!document.querySelector('[data-cue="replay"]').hasAttribute('aria-busy'));
    assert.equal(stage.pending,true,'Replay capture stays gated through pending state');
    stage={active:false,pending:false,capture:{status:'idle'}};buffer=false;
    const beforeReplay=writes.length;await chooseStage('replay');await page.locator('.replay-play-card').waitFor();
    assert.equal(writes.length,beforeReplay,'Opening the replay workspace sends no commands');
    assert(await page.locator('.stage-editor-layout').isHidden());
    assert.equal(await page.locator('#irPresentation,#irEditor,#irTrim,#irNotes').count(),0,'The live desk contains playback, not the editor');
    await page.locator('.replay-play-card:not([disabled])').waitFor();
    assert(await page.locator('.replay-play-card').isEnabled(),'Saved clips can play with the capture buffer stopped');
    await page.locator('.replay-play-card').click();
    await page.waitForFunction(()=>!document.querySelector('.replay-play-card').hasAttribute('aria-busy'));
    assert.deepEqual(writes.at(-1),{path:'/api/projects/instant_replay/play',body:{path:'C:/fixture.mp4',mode:'showcase'}});
    await chooseStage('game');
    assert.equal(await page.locator('.replay-picker').count(),0,'Closing Replay releases the playback picker');
    await chooseStage('replay');await page.locator('.replay-play-card').waitFor();
    await page.screenshot({path:path.join(output,'replay-desk.png'),animations:'disabled'});
    await page.setViewportSize({width:390,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Replay desk fits a phone');
    await page.screenshot({path:path.join(output,'replay-desk-mobile.png'),animations:'disabled'});
    await page.setViewportSize({width:1440,height:1000});await chooseStage('game');
    await page.locator('#deskBroadcast').click();await page.waitForFunction(()=>document.querySelector('#deskBroadcast').textContent==='End stream');
    await chooseStage('ending');await page.locator('#deskShowStage').click();await current('ending');
    assert.equal(currentLobby,'Spirit Afterparty');assert.equal(stream.active,true);
    await page.locator('#deskBroadcast').click();await page.getByRole('button',{name:'Keep streaming',exact:true}).click();assert.equal(stream.active,true);
    await page.locator('#deskBroadcast').click();await page.getByRole('button',{name:'End stream now',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#deskBroadcast').textContent==='Go live');
    assert.equal(stream.active,false);
    scenes.observing=false;await page.waitForFunction(()=>document.querySelector('#deskBroadcast').disabled);
    assert(await page.locator('#deskAuto').isDisabled());
    await chooseStage('lobby');assert(await page.getByRole('button',{name:'Show Bans & picks now',exact:true}).isDisabled());
    await chooseStage('starting');assert(await page.locator('#deskShowStage').isDisabled());
    assert(await page.locator('#deskChangeImage').isEnabled(),'Art editing needs the Hub, not an OBS connection');
    scenes.observing=true;stream={};await page.waitForFunction(()=>!document.querySelector('#deskShowStage').disabled);
    assert(await page.locator('#deskBroadcast').isDisabled(),'Unknown output status is not treated as offline');
    await page.goto('http://desk.test/#library');await page.locator('.guide-area').first().waitFor();
    assert.equal(await page.locator('.stage-appearance-dialog,.desk-end-dialog,.stage-sounds-dialog').count(),0);
    assert.deepEqual(errors,[]);
    console.log('Stream desk: actual stage, read-only browsing, image selection, lobby effects, draft/loading, mastery, holds, replay gating, broadcast confirmation and teardown passed.');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
