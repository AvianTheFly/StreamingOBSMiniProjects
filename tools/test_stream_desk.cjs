// Stream-flow controls against disposable HTTP contracts; --live is GET-only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const app = path.resolve(__dirname, '../hub_ui/app');
const output = path.resolve(__dirname, '../output/minimal-stream-desk');
const project = (name, keys) => ({name, actions:keys.map(key=>({key,label:key})), is_active:false});
async function main() {
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[], writes=[];
    const chooseStage=async id=>{if(!await page.locator('#deskStageMenu').evaluate(el=>el.open))await page.locator('#deskStageMenu > summary').click();await page.locator('#deskTab-'+id).click();};
    page.on('pageerror',e=>errors.push(e.message));
    if(process.argv.includes('--live')) {
      await page.route(url=>new URL(url).pathname!=='/api/events',route=>route.request().method()==='GET'?route.continue():route.abort());
      await page.goto('http://127.0.0.1:7420/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelector('#loadedCount')?.textContent.includes('features loaded'));
      assert.equal(new URL(page.url()).hash,'#dashboard');
      await page.waitForFunction(()=>document.querySelector('#obsIndicator').textContent!=='Connecting to OBS');
      const coordination=await page.evaluate(async()=>await (await fetch('/api/coordination')).json());
      if(coordination.scenes?.observing)await page.waitForFunction(()=>document.querySelector('#gameAction')?.disabled===false&&document.querySelector('#obsIndicator').textContent==='OBS connected');
      if(!coordination.scenes?.observing) {
        assert(await page.locator('#startingAction').isDisabled());
        assert(await page.locator('[data-action="quick_replay"]').isDisabled());
      }
      assert.equal(await page.getByRole('button',{name:'Save clip',exact:true}).count(),0);
      await page.screenshot({path:path.join(output,'live-current-desk.png'),fullPage:true});
      await chooseStage('lobby');
      await page.locator('[data-gallery="lobby"]').click();
      await page.locator('#deskGallery-lobby img').first().waitFor();
      assert(await page.locator('[data-gallery="lobby"]').isEnabled(),'Browsing remains available without OBS');
      await page.locator('#deskArtClose').click();
      await page.screenshot({path:path.join(output,'live-lobby-gallery.png'),fullPage:true});
      await chooseStage('starting');
      await page.screenshot({path:path.join(output,'live-desk.png'),fullPage:true});
      await page.setViewportSize({width:390,height:900});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(output,'live-desk-phone.png'),fullPage:true});
      assert.deepEqual(errors,[]);
      console.log('Actual Hub: compact desk, availability, desktop and phone verified with GET-only access.');
      return;
    }
    let fail=false, buffer=false, currentLobby=null;
    let lobbySelection={mode:'shuffle',source:null};
    const otherScenes=[{scene:'Spirit Intermission',label:'Be right back'}];
    const worlds=[{source:'TavernLobby',label:'Tavern',art_url:'/test-art/forge.png'},{source:'ForgeLobby',label:'Spirit forge',art_url:'/test-art/forge.png'},{source:'Spirit Afterparty',label:'Spirit afterparty',art_url:'/test-art/forge.png'}];
    let startingConfig={opening_catalog:{available:true,title:'Sanctuary',seconds:40},opening:false,revision:1,artwork:['fjord.png','forest.png'],rotate_artwork:true,artwork_catalog:[{file:'fjord.png',title:'Fjord Sanctuary'},{file:'forest.png',title:'The Spirit Grove'}]};
    let scenes={scene:'Test',observing:true,automatic_holds:[]}, stream={active:false};
    let stage={active:false,pending:false,capture:{status:'idle'}};
    const sceneFeature=project('scene_voice_switcher',['hold_scene','follow_scenes']);
    sceneFeature.workflow={session:{held:false,stage:null,lobby:null}};
    const league=project('league_api',['champion_select','queue_lobby']);
    league.workflow={connected:true,phase:'Lobby',champion_scene:'League Champion Select World',scene_automation:true};
    const projects=[project('starting_soon',['start','finish','intro','skip-intro']),project('instant_replay',['quick_replay','save','play_replay','revert']),sceneFeature,league];
    const setScene=(scene,temporary_owner=null)=>{scenes={...scenes,scene,temporary_owner};};
    await page.addInitScript(()=>{
      window.EventSource=class {constructor(){window.deskSource=this;queueMicrotask(()=>this.onopen?.());}close(){}};
      const original=window.setTimeout.bind(window);
      window.setTimeout=(callback,delay,...args)=>original(callback,delay===4000?80:delay,...args);
    });
    await page.route('http://desk.test/**',async route=>{
      const req=route.request(), url=new URL(req.url());
      if(req.method()==='POST') {
        const body=req.postDataJSON();
        writes.push({path:url.pathname,body});
        await new Promise(r=>setTimeout(r,120));
        if(fail)return route.fulfill({status:409,json:{error:'Fixture rejected action'}});
        if(url.pathname.endsWith('/selection'))lobbySelection={mode:body.mode,source:body.source};
        if(url.pathname==='/api/starting-soon/settings'){startingConfig={...startingConfig,...body,revision:startingConfig.revision+1};return route.fulfill({json:startingConfig});}
        if(url.pathname.endsWith('/starting-soon/start')){projects[0].is_active=true;setScene('Starting Soon','starting_soon');}
        if(url.pathname.endsWith('/starting-soon/set-art')){startingConfig.artwork_index=startingConfig.artwork.indexOf(body.file);projects[0].workflow={...projects[0].workflow,artwork_file:body.file};}
        if(url.pathname.endsWith('/starting-soon/next-art')){startingConfig.artwork_index=((startingConfig.artwork_index||0)+1)%startingConfig.artwork.length;projects[0].workflow={...projects[0].workflow,artwork_file:startingConfig.artwork[startingConfig.artwork_index]};}
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
        if(url.pathname.endsWith('/champion_select'))setScene('League Champion Select World');
        if(url.pathname.endsWith('/queue_lobby')){currentLobby='TavernLobby';setScene('Lobbies');}
        if(url.pathname.endsWith('/start_stream'))stream.active=true;
        if(url.pathname.endsWith('/stop_stream'))stream.active=false;
        if(url.pathname.endsWith('/start_replay_buffer'))buffer=true;
        if(url.pathname.endsWith('/quick_replay'))stage={active:false,pending:true,capture:{status:'saving',purpose:'replay_only'}};
        if(url.pathname.endsWith('/revert')) {stage={active:false,pending:false,capture:{status:'ready'}};setScene('Test');}
        return route.fulfill({json:{ok:true,lobby:currentLobby,selection:lobbySelection}});
      }
      if(url.pathname==='/api/status')return route.fulfill({json:{projects}});
      if(url.pathname==='/api/coordination')return route.fulfill({json:{scenes,stream,replay_buffer:{active:buffer},display:{visible:false},pauses:{}}});
      if(url.pathname==='/api/starting-soon')return route.fulfill({json:startingConfig});
      if(url.pathname.endsWith('/catalog'))return route.fulfill({json:{locations:worlds.map(w=>({...w,effects:{actions:w.source==='ForgeLobby'?[{id:'duck',label:'Duck delivery'},{id:'moth',label:'Ember moth'},{id:'runes',label:'Wall runes'},{id:'hammer',label:'Tiny hammer'}]:[]}})),selection:lobbySelection}});
      if(url.pathname==='/api/spirit-lobby/actions')return route.fulfill({json:{actions:[{id:'wave',label:'Wave hello'}]}});
      if(url.pathname.startsWith('/starting-soon/art/'))return route.fulfill({body:fs.readFileSync(path.resolve(__dirname,'../mini projects/starting_soon/art',decodeURIComponent(url.pathname.split('/').pop()))),contentType:'image/png'});
      if(url.pathname==='/test-art/forge.png')return route.fulfill({body:fs.readFileSync(path.resolve(__dirname,'../mini projects/scene_voice_switcher/art/forge-base.png')),contentType:'image/png'});
      if(url.pathname.endsWith('/lobbies'))return route.fulfill({json:{selection:lobbySelection,locations:worlds,game_scene:'Test',program_scene:scenes.scene,current_lobby:currentLobby,other_scenes:otherScenes,lobbies:['TavernLobby','ForgeLobby','Spirit Afterparty']}});
      if(url.pathname.endsWith('/stage'))return route.fulfill({json:stage});
      if(url.pathname==='/api/obs/audio')return route.fulfill({json:{inputs:[{name:'Microphone',kind:'wasapi_input_capture',volume_db:-6,muted:false},{name:'Desktop audio',kind:'wasapi_output_capture',volume_db:-12,muted:false}]}});
      if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});
      const file=path.resolve(app,url.pathname==='/'?'index.html':'.'+url.pathname);
      if(!file.startsWith(app+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
      return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
    });
    const emit=()=>page.evaluate(projects=>window.deskSource.onmessage?.({data:JSON.stringify({type:'status_update',payload:{projects}})}),projects);
    await page.goto('http://desk.test/');
    await page.waitForFunction(()=>document.querySelector('#gameAction')?.disabled===false);
    assert.equal(writes.length,0);
    assert(await page.locator('#deskSection-game').isVisible(),'Desk opens to the actual stage');
    assert(await page.locator('#deskSection-starting').isHidden(),'Starting controls leave the live desk during gameplay');
    assert.equal(await page.locator('.desk-flow img, .desk-flow canvas, .desk-flow iframe').count(),0,'No monitor or artwork preview on the control surface');
    assert.equal(await page.locator('#loadingAction, #deskTab-loading').count(),0,'Loading uses game controls');
    assert.equal(await page.getByRole('button',{name:'Save clip',exact:true}).count(),0);
    assert.equal(await page.locator('#deskStageMenu').getAttribute('open'),null);
    await page.locator('#deskStageMenu > summary').click();
    await page.locator('[data-desk-panel="scenes"]').click();
    await page.locator('.desk-choice strong').filter({hasText:'Be right back'}).waitFor();
    assert.equal(await page.locator('.desk-choice').count(),1,'Other scenes does not repeat the lobby gallery');
    assert.equal(writes.length,0,'Scene browsing is read-only');
    await page.locator('#deskPanelClose').click();

    const replay=page.getByRole('button',{name:'Replay last 15s',exact:true});
    assert(await replay.isVisible());assert(await replay.isDisabled());
    await page.getByRole('button',{name:'Enable replays',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('[data-action="quick_replay"]').disabled);
    assert.equal(writes.at(-1).path,'/api/hub-actions/start_replay_buffer');
    await chooseStage('starting');
    assert(await page.locator('#deskBackToCurrent').isVisible());
    const beforeBrowse=writes.length;
    await page.locator('#deskChooseArt').click();
    await page.locator('#deskStartingGallery [data-choice="forest.png"]').click();
    assert.equal(writes.length,beforeBrowse,'Image selection is read-only until Show');
    await page.locator('#startingAction').click();
    await page.waitForFunction(()=>document.querySelector('#startingAction').getAttribute('aria-pressed')==='true');
    assert.equal(stream.active,false);
    await page.locator('#deskChooseArt').click();
    await page.locator('#deskStartingGallery [data-choice="fjord.png"]').click();
    await page.locator('#deskApplyArt').click();
    await page.waitForFunction(()=>document.querySelector('#deskApplyArt').hidden);
    assert.equal(writes.at(-1).path,'/api/starting-soon/set-art');
    assert.equal(startingConfig.artwork[startingConfig.artwork_index],'fjord.png');
    await page.locator('#deskNextArt').click();
    await page.waitForFunction(()=>document.querySelector('#deskStartingName').textContent==='The Spirit Grove');
    await page.locator('#deskGoLive').click();await page.locator('#deskEndStream').waitFor({state:'visible'});
    await page.locator('#deskPlayIntro').click();
    await page.locator('#deskSkipIntro').waitFor({state:'visible'});
    assert.equal(writes.at(-1).path,'/api/starting-soon/intro');
    await page.locator('#deskSkipIntro').click();
    await page.locator('#deskSection-lobby').waitFor({state:'visible'});
    assert.equal(writes.at(-1).path,'/api/starting-soon/skip-intro');
    assert.equal(await page.locator('#deskLobbyNow').innerText(),'Tavern');
    await page.locator('#deskNextLobby').click();
    await page.waitForFunction(()=>document.querySelector('#deskLobbyNow').textContent==='Spirit forge');
    await page.locator('[data-lobby-effect="duck"]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-lobby-effect="duck"]').disabled);
    assert.deepEqual(writes.at(-1),{path:'/api/projects/scene_voice_switcher/effect',body:{source:'ForgeLobby',action:'duck'}});
    await page.locator('#deskKeepLobby').click();
    await page.waitForFunction(()=>document.querySelector('#deskKeepLobby').getAttribute('aria-pressed')==='true');
    assert.deepEqual(lobbySelection,{mode:'fixed',source:'ForgeLobby'});
    await page.locator('#deskShuffleLobbies').click();
    await page.waitForFunction(()=>document.querySelector('#deskShuffleLobbies').getAttribute('aria-pressed')==='true');
    await page.screenshot({path:path.join(output,'context-lobby.png'),fullPage:true});
    const beforeLobbyBrowse=writes.length;
    await page.locator('[data-gallery="lobby"]').click();
    await page.locator('#deskGallery-lobby [data-choice="TavernLobby"]').click();
    assert.equal(writes.length,beforeLobbyBrowse);
    assert.equal(await page.locator('#deskLobbyNow').innerText(),'Spirit forge','A selected destination never changes the current-lobby label');
    await page.locator('#lobbyAction').click();
    await page.waitForFunction(()=>document.querySelector('#deskLobbyNow').textContent==='Tavern');
    league.workflow.phase='ChampSelect';await emit();
    await page.locator('#deskSection-draft').waitFor({state:'visible'});
    await page.locator('#deskChampion').click();
    await page.waitForFunction(()=>document.querySelector('#currentScene').textContent==='League Champion Select World');
    assert.equal(writes.at(-1).path,'/api/project-actions/league_api/champion_select');
    await page.locator('#deskQueue').click();
    await page.waitForFunction(()=>document.querySelector('#currentScene').textContent==='TavernLobby');
    league.workflow.phase='GameStart';setScene('Test');await emit();
    await page.locator('#deskSection-game').waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('#deskLeaguePhase').textContent.includes('Loading'));
    assert(await replay.isVisible(),'Replay remains easy to find while loading/game share a stage');
    await replay.focus();await page.waitForTimeout(200);
    assert(await replay.evaluate(el=>document.activeElement===el));
    await replay.click();assert(await replay.isDisabled());
    await page.waitForFunction(()=>document.querySelector('#deskReplayStatus').textContent.includes('Preparing'));
    assert.equal(writes.filter(w=>w.path.endsWith('/quick_replay')).length,1);
    stage={active:true,pending:false,capture:{status:'ready'}};setScene('InstantReplay','instant_replay');
    await page.locator('#deskReturnLive').waitFor({state:'visible'});await page.locator('#deskReturnLive').click();
    await page.waitForFunction(()=>!document.querySelector('[data-action="quick_replay"]').disabled);
    await page.locator('#deskHold').click();await page.waitForFunction(()=>document.querySelector('#deskHold').getAttribute('aria-pressed')==='true');
    await page.locator('#deskFollow').click();await page.waitForFunction(()=>document.querySelector('#deskFollow').getAttribute('aria-pressed')==='true');
    setScene('Spirit Intermission');await emit();
    await page.locator('#deskSection-other').waitFor({state:'visible'});
    assert(await page.locator('#deskSection-game').isHidden(),'Other scenes have their own minimal controls');
    assert.equal(await page.locator('#deskOtherTitle').innerText(),'Be right back');
    await page.locator('#deskOtherGame').click();
    await page.locator('#deskSection-game').waitFor({state:'visible'});
    await chooseStage('ending');await page.locator('#endingAction').click();
    await page.waitForFunction(()=>document.querySelector('#endingAction').getAttribute('aria-pressed')==='true');
    assert.equal(currentLobby,'Spirit Afterparty');assert.equal(stream.active,true);
    assert(!writes.some(w=>w.path.endsWith('/stop_stream')));
    await page.locator('#deskEndStream').click();await page.getByRole('button',{name:'Keep streaming',exact:true}).click();
    assert(!writes.some(w=>w.path.endsWith('/stop_stream')));
    await page.locator('#deskEndStream').click();await page.getByRole('button',{name:'End stream now',exact:true}).click();
    await page.locator('#deskGoLive').waitFor({state:'visible'});assert.equal(stream.active,false);
    setScene('Test');await page.locator('#deskSection-game').waitFor({state:'visible'});
    buffer=false;await page.waitForFunction(()=>document.querySelector('[data-action="quick_replay"]').disabled);
    assert(await page.getByRole('button',{name:'Replay latest',exact:true}).isEnabled());
    buffer=true;await page.waitForFunction(()=>!document.querySelector('[data-action="quick_replay"]').disabled);
    fail=true;await replay.click();await page.getByText('Fixture rejected action',{exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('[data-action="quick_replay"]').disabled);fail=false;
    scenes.observing=false;await page.waitForFunction(()=>document.querySelector('#gameAction').disabled);
    assert(await replay.isDisabled());assert(await page.locator('#deskGoLive').isDisabled());
    scenes.observing=true;stream={};await page.waitForFunction(()=>!document.querySelector('#gameAction').disabled);
    assert(await page.locator('#deskGoLive').isDisabled(),'Unknown output status is not offline');
    stream={active:false};league.workflow.phase='InProgress';await emit();
    for(const width of [1440,1280,768,390]){
      await page.setViewportSize({width,height:width===1280?720:900});await page.goto('http://desk.test/');
      await page.waitForFunction(()=>!document.querySelector('#gameAction')?.disabled);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(width===1280)assert(await replay.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));
      await page.screenshot({path:path.join(output,`context-game-${width}.png`),fullPage:true});
    }
    await page.locator('.desk-extras > summary').click();await page.locator('a[href="#library"]').filter({hasText:'All controls'}).click();
    await page.locator('.guide-area').first().waitFor();
    assert.equal(await page.locator('.desk-art-dialog, .desk-end-dialog').count(),0);
    assert.deepEqual(errors,[]);
    console.log('Contextual stream desk: actual-stage following, opening/skip, current lobby, live effects, rotation, draft/loading, replay, output confirmation, errors, focus, cleanup and responsive controls passed.');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
