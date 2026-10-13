// Headless UI regressions against disposable HTTP fixtures. Never sends commands
// to the live Hub or writes personal settings. --live captures read-only views.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const app = path.resolve(__dirname, '../hub_ui/app');
const output = process.env.HUB_UI_TEST_OUTPUT || path.resolve(__dirname, '../output/hub-ui-redesign');
const action = key => ({ key, label: key });
async function until(predicate) {
  const deadline = Date.now() + 4000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Fixture request did not arrive');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
const projects = [
  { name: 'instant_replay', actions: ['quick_replay', 'save', 'play_replay', 'play_random', 'pause', 'resume', 'skip', 'revert'].map(action) },
  { name: 'soundboard', actions: ['random', 'start_listen', 'stop_listen', 'abort_listen', 'pause', 'resume', 'next', 'stop', 'reload', 'test_muffins'].map(action), volume: { profile: 'default', project_volume_db: -4 } },
  { name: 'specific_song', actions: ['pause', 'resume', 'revert'].map(action) },
  { name: 'scene_voice_switcher', actions: [] },
  { name: 'starting_soon', actions: ['start', 'finish'].map(action) },
  { name: 'league_stats', actions: [] }, { name: 'league', actions: ['pause','resume','revert'].map(action) },
  { name: 'league_api', actions: [] }, { name: 'tik_tok', actions: ['random', 'start_listen'].map(action) },
  { name: 'sound_effects', actions: [] }, { name: 'spotify', is_active: true, produces_audio:false, current_activity: 'An actual track name', actions: [{ key: 'pause', label: 'Hide overlay' }, { key: 'resume', label: 'Show overlay' }] },
  { name: 'love_me', actions: [] }, { name: 'twitch_celebrations', actions: [] },
].map(p => ({ is_active: false, produces_audio: true, controlled_scenes: [], ...p }));

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    if (process.argv.includes('--live')) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route(url => new URL(url).pathname !== '/api/events', route => route.request().method() === 'GET' ? route.continue() : route.abort());
      await page.goto('http://127.0.0.1:7420/#dashboard', {waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelector('#streamState')?.textContent !== 'Connecting…');
      await page.locator('[data-stage-tile="loading"]').click();
      await page.screenshot({path:path.join(output,'live-desk.png'),animations:'disabled'});
      await page.locator('#deskChangeImage').click();
      await page.locator('.stage-image-option').first().waitFor();
      await page.screenshot({path:path.join(output,'live-image-chooser.png'),animations:'disabled'});
      await page.locator('.stage-appearance-dialog [data-close]').click();
      await page.locator('#deskSounds').click();
      await page.locator('.stage-sound-list button').first().waitFor();
      await page.locator('.stage-sounds-dialog [data-close]').click();
      await page.locator('a[data-page="library"]').click();
      await page.locator('.guide-area').first().waitFor();
      await page.screenshot({ path: path.join(output, 'live-library.png'), animations: 'disabled' });
      await page.locator('a[data-page="projects/soundboard"]').click();
      await page.getByText('Ready to play', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(output, 'live-soundboard.png'), animations: 'disabled' });
      await page.locator('a[data-page="mixer"]').click();
      await page.locator('.mixer-channel').first().waitFor();
      await page.screenshot({ path: path.join(output, 'live-audio.png'), animations: 'disabled' });
      await page.locator('a[data-page="projects/scene_voice_switcher"]').click();
      await page.locator('[data-location-card]').first().waitFor();
      await page.screenshot({ path: path.join(output, 'live-scenes.png'), animations: 'disabled' });
      await page.goto('http://127.0.0.1:7420/#projects/spotify');
      await page.locator('#genActions button').first().waitFor();
      await page.screenshot({ path: path.join(output, 'live-spotify.png'), animations: 'disabled' });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto('http://127.0.0.1:7420/#dashboard');
      await page.waitForFunction(()=>document.querySelector('#streamState')?.textContent !== 'Connecting…');
      await page.screenshot({ path: path.join(output, 'live-mobile.png'), animations: 'disabled' });
      assert.deepEqual(errors, [], 'Live pages must load without JavaScript errors');
      console.log('Read-only live views verified and captured.');
      return;
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], requests = [];
    let profileCalls = 0, checks = 0, coordinationCalls = 0;
    let failAction = false, staleCoordination = false, largeCatalog = false;
    let holdNextAudio = false, releaseAudio = null;
    let serverProjects=projects, pauseClaims={}, streamActive=false;
    const audioInputs = [
      { name: 'Microphone', kind: 'wasapi_input_capture', volume_db: -6, muted: false },
      { name: 'Desktop audio', kind: 'wasapi_output_capture', volume_db: -12, muted: false },
      { name: 'Media music', kind: 'ffmpeg_source', volume_db: -9, muted: false },
    ];
    const chooseStage=async id=>page.locator(`[data-stage-tile="${id}"]`).click();
    let selectedImage='sanctuary',imageRevision=0,uploaded=false;
    const appearance=()=>({selected:selectedImage,revision:imageRevision,images:[{id:'sanctuary',title:'Spirit sanctuary',image_url:'/assets/loading-mastery.jpg'},{id:'frost',title:'Frost',image_url:'/assets/loading-mastery.jpg'},...(uploaded?[{id:'uploaded',title:'My image',image_url:'/assets/loading-mastery.jpg'}]:[])]});
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.fixtureSources = [];
      window.EventSource = class {
        constructor() { window.fixtureSources.push(this); setTimeout(() => this.onopen?.(), 20); }
        close() {}
      };
      window.emitStatus = projects => window.fixtureSources.at(-1).onmessage?.({ data: JSON.stringify({ type: 'status_update', payload: { projects } }) });
      const originalInterval = window.setInterval.bind(window);
      window.setInterval = (callback, delay, ...args) => {
        if (delay === 8000) window.fixtureAudioPoll = callback;
        return originalInterval(callback, delay, ...args);
      };
    });
    await page.route('http://hub.test/**', async route => {
      const req = route.request(), url = new URL(req.url());
      if (req.method() === 'POST') {
        requests.push({ path: url.pathname, body: url.pathname.endsWith('/upload')?null:req.postDataJSON() });
        if(url.pathname==='/api/league-stage/upload'){uploaded=true;return route.fulfill({json:{...appearance(),uploaded:'uploaded'}});}
        if(url.pathname==='/api/league-stage/select'){selectedImage=req.postDataJSON().image;imageRevision++;return route.fulfill({json:appearance()});}
        await new Promise(resolve => setTimeout(resolve, 350));
        if (!failAction && url.pathname === '/api/obs/audio') {
          const { input, ...changes } = req.postDataJSON();
          Object.assign(audioInputs.find(item => item.name === input), changes);
        }
        const scoped=url.pathname.match(/^\/api\/project-actions\/([^/]+)\/(pause|resume|stop|finish|revert)$/);
        if(!failAction && scoped)serverProjects=serverProjects.map(p=>p.name===scoped[1]?{...p,...(['pause','resume'].includes(scoped[2])?{is_paused:scoped[2]==='pause'}:{is_active:false})}:p);
        return route.fulfill({ json: failAction ? { ok: false, error: 'Fixture rejected action' } : { ok: true, lobby: 'TavernLobby' } });
      }
      if(url.pathname==='/api/league-stage')return route.fulfill({json:appearance()});
      if (url.pathname === '/api/status') return route.fulfill({ json: { projects:serverProjects } });
      if (url.pathname === '/api/coordination') {
        coordinationCalls++;
        if (staleCoordination) await new Promise(resolve => setTimeout(resolve, 600));
        return route.fulfill({ json: { scenes: { scene: 'Lobbies', observing: true }, display: {visible:false}, stream:{active:streamActive}, replay_buffer:{active:true}, pauses:pauseClaims } });
      }
      if (url.pathname.endsWith('/lobbies')) return route.fulfill({ json: { game_scene: 'Test', program_scene:'Lobbies', current_lobby:'TavernLobby', screen:{visible:false}, lobbies: ['TavernLobby','ForgeLobby'], locations:['TavernLobby','ForgeLobby'].map(source=>({source,label:source==='TavernLobby'?'Tavern Lobby':'Spirit forge',description:source==='TavernLobby'?'Conversation in the tavern':'Amber smithy',managed:true,rotation:true,ready:true,layout:{screen:[100,200,600,300],camera:[800,300,400,500],chat:[1500,200,300,500]}})) } });
      if (url.pathname === '/api/projects/soundboard/assets') {
        if (staleCoordination) await new Promise(resolve=>setTimeout(resolve,600));
        return route.fulfill({json:[{source:'hooray',name:'Hooray'},{source:'die die die',name:'Muffin Dance'},...(largeCatalog?Array.from({length:45},(_,i)=>({source:`sound-${i}`,name:`Sound ${i}`})):[])]});
      }
      if (url.pathname === '/api/projects/sound_effects/library') return route.fulfill({json:['Sad violin','Hooray cue']});
      if (url.pathname === '/api/projects/specific_song/library') return route.fulfill({json:[{source:'Loreen',name:'Tattoo',aliases:['Loreen']}]});
      if (url.pathname === '/api/projects/instant_replay/clips') return route.fulfill({json:{clips:[{title:'A good escape',path:'C:/fixture/escape.mp4'}]}});
      if (url.pathname === '/api/projects/instant_replay/stage') return route.fulfill({json:{active:false,pending:false,capture:{status:'idle'}}});
      if (url.pathname === '/api/voice') return route.fulfill({json:{ready:true,recording:false}});
      if (url.pathname === '/api/hub-actions') return route.fulfill({json:{workflows:[{id:'break',name:'Take a break',steps:[{project:'starting_soon',action:'start'}]}]}});
      if (url.pathname === '/api/starting-soon') return route.fulfill({json:{artwork:['one.png'],artwork_index:0,artwork_catalog:[{file:'one.png',title:'One'}],playlists:[{id:'best',name:'Best moments',paths:['C:/fixture/escape.mp4']}]}});
      if (url.pathname === '/api/editor-profiles') {
        profileCalls++;
        await new Promise(resolve => setTimeout(resolve, 450));
        return route.fulfill({ json: { projects: [{ key: 'soundboard', name: 'Soundboard', settings: { current: {} }, profiles: [{ name: 'default', live: true, hotkey_count: 1, hotkey_map: { '@': ['hooray'] }, interface_hotkeys: {} }] }] } });
      }
      if (url.pathname === '/api/twitch-stream-settings') { checks++; return route.fulfill({ json: { message: 'Fixture check ready', busy: false } }); }
      if (url.pathname === '/api/obs/audio') {
        const inputs = structuredClone(audioInputs);
        if (holdNextAudio) {
          holdNextAudio = false;
          await new Promise(resolve => { releaseAudio = resolve; });
        }
        return route.fulfill({ json: { inputs } });
      }
      if (url.pathname === '/api/audio') return route.fulfill({ json: { projects: [] } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
      const file = path.resolve(app, url.pathname === '/' ? 'index.html' : '.' + url.pathname);
      if (!file.startsWith(app + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
      const contentType = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
      return route.fulfill({ body: fs.readFileSync(file), contentType });
    });
    await page.goto('http://hub.test/#dashboard');
    await page.waitForFunction(()=>document.querySelector('#streamState')?.textContent==='Not streaming');
    const beforeBrowsing=requests.length;
    for(const stage of ['starting','lobby','draft','loading','game','ending'])await chooseStage(stage);
    assert.equal(requests.length,beforeBrowsing,'Stage browsing does not change output');
    assert.equal(await page.locator('.desk-extras,.desk-diagnostics,.desk-audio-drawer,[data-desk-panel="music"]').count(),0,'Removed clutter is absent');
    assert.equal(profileCalls,0);assert.equal(checks,0);
    await chooseStage('loading');
    assert(await page.locator('[data-cue="mastery"]').isDisabled());
    assert(await page.locator('#deskShowStage').isDisabled(),'Loading requires a confirmed match');
    await page.locator('#deskChangeImage').click();
    await page.locator('[data-image="frost"]').click();
    assert.equal(requests.length,beforeBrowsing,'Image browsing does not save');
    await page.locator('.stage-appearance-dialog [data-close]').click();
    assert.equal(selectedImage,'sanctuary','Cancel preserves the saved image');
    await page.locator('#deskChangeImage').click();await page.locator('[data-image="frost"]').click();
    await page.locator('#useStageImage').click();
    await page.waitForFunction(()=>!document.querySelector('.stage-appearance-dialog').open);
    assert.deepEqual(requests.at(-1),{path:'/api/league-stage/select',body:{image:'frost',revision:0}});
    assert.equal(await page.locator('#deskArtName').innerText(),'Frost');
    await page.locator('#deskChangeImage').click();
    await page.locator('#stageUpload').setInputFiles({name:'mine.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
    await page.getByText('Uploaded · choose Use image to apply').waitFor();
    assert.equal(selectedImage,'frost','Upload adds to the library without applying');
    await page.locator('#useStageImage').click();await page.waitForFunction(()=>!document.querySelector('.stage-appearance-dialog').open);
    assert.equal(selectedImage,'uploaded');
    for(const stage of ['starting','loading','game']){
      await chooseStage(stage);await page.locator('#deskSounds').click();
      await page.getByRole('searchbox',{name:'Find a sound'}).fill('violin');
      await page.locator('.stage-sound-list button').click();
      await until(()=>requests.at(-1)?.path==='/api/projects/sound_effects/play');
      assert.deepEqual(requests.at(-1).body,{source:'Sad violin'});
      await page.locator('.stage-sounds-dialog [data-close]').click();
    }
    await chooseStage('starting');
    assert.equal(await page.locator('#deskStageCues button').count(),0,'Starting Soon has no obsolete button cluster');
    await page.locator('#deskShowStage').click();await until(()=>requests.at(-1)?.path==='/api/starting-soon/start');
    await page.waitForFunction(()=>!document.querySelector('#deskShowStage').hasAttribute('aria-busy'));
    await page.setViewportSize({width:1280,height:720});
    await page.screenshot({path:path.join(output,'fixture-compact.png'),animations:'disabled'});
    assert(await page.locator('.stage-desk-footer').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'Primary desk fits 720px desktop');
    await page.setViewportSize({width:1440,height:1000});
    const routes=await page.evaluate(async()=>{const {stageRoutes}=await import('/js/pages/desk-stage-map.js');return stageRoutes('loading',{});});
    assert.deepEqual(routes,[['Game clock starts','game'],['Back to client','lobby']]);

    // Search navigation, escaping, filter state and deep links.
    await page.getByRole('button', { name: 'Find a control or page' }).click();
    await page.getByRole('searchbox', { name: 'Search controls' }).fill('replay');
    await page.getByRole('searchbox', { name: 'Search controls' }).press('Enter');
    assert.equal(new URL(page.url()).hash, '#projects/instant_replay');
    await page.locator('a[data-page="library"]').click();
    assert.equal(await page.locator('.guide-area').count(), 6);
    assert.equal(await page.locator('.library-tile').count(), 0,'The default discovery view must not be a long tool list');
    await page.getByRole('searchbox', { name: 'Search your stream' }).fill('music');
    assert(await page.locator('.library-tile').count()>0);
    await page.getByRole('searchbox', { name: 'Search your stream' }).fill('<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('.library-tile').count(), 0);
    await page.getByRole('searchbox', { name: 'Search your stream' }).fill('');
    await page.locator('.guide-area[href*="area=spaces"]').click();
    await page.locator('.guide-idea').first().waitFor();
    assert.equal(await page.locator('.guide-idea').count(),6);
    assert.match(await page.locator('.guide-header h1').innerText(),/atmosphere/);
    await page.screenshot({ path: path.join(output, 'fixture-library.png'), animations: 'disabled' });

    // No hidden profile editor fetch until requested. A late response cannot
    // replace a newer mount after leaving and opening a different feature.
    await page.locator('a[data-page="projects/soundboard"]').click();
    assert.equal(profileCalls, 0);
    await page.locator('.feature-disclosure > summary').filter({ hasText: 'Hotkeys & profiles' }).click();
    await page.goto('http://hub.test/#projects/specific_song');
    await page.goto('http://hub.test/#projects/tik_tok');
    await page.getByRole('heading', { name: 'TikTok clips', exact: true }).waitFor();
    await page.locator('a[data-page="projects/soundboard"]').click();
    await page.getByRole('heading', { name: 'Soundboard', exact: true }).waitFor();
    assert.equal(await page.locator('#sbHotkeys').innerText(), '');
    await page.screenshot({ path: path.join(output, 'fixture-soundboard.png'), animations: 'disabled' });

    await page.locator('a[data-page="projects/scene_voice_switcher"]').click();
    await page.locator('[data-location-card]').first().waitFor();
    await page.locator('[data-lobby="TavernLobby"]').filter({hasText:'Enter lobby'}).click();
    await page.waitForFunction(() => !document.querySelector('[data-lobby="TavernLobby"]').disabled);
    assert.deepEqual(requests.at(-1), { path: '/api/projects/scene_voice_switcher/select_lobby', body: { source: 'TavernLobby' } });
    await page.getByRole('searchbox',{name:'Find a lobby'}).fill('smithy');
    assert.equal(await page.locator('[data-location-card]:visible').count(),1);
    await page.locator('[data-lobby="ForgeLobby"][data-with-screen]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-lobby="ForgeLobby"]').disabled);
    assert.deepEqual(requests.at(-1),{path:'/api/projects/scene_voice_switcher/select_lobby',body:{source:'ForgeLobby',screen_visible:true}});
    assert.equal(await page.getByRole('searchbox',{name:'Find a lobby'}).inputValue(),'smithy');
    await page.getByRole('searchbox',{name:'Find a lobby'}).fill('no such world');
    await page.getByText('No matching lobby. Try another name.').waitFor();
    await page.getByRole('searchbox',{name:'Find a lobby'}).fill('');
    assert.equal(await page.locator('.feature-disclosure').getAttribute('open'), null, 'Scene automation explanation starts collapsed');
    const callsBeforeGeneric = profileCalls;
    await page.goto('http://hub.test/#projects/spotify');
    await page.getByRole('heading', { name: 'Spotify overlay', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('#genActions button')?.disabled);
    assert.equal(profileCalls, callsBeforeGeneric, 'Smaller features do not load hidden editors');
    await page.getByRole('button', { name: 'Hide overlay', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#genActions button').disabled);
    assert.deepEqual(requests.at(-1), { path: '/api/project-actions/spotify/pause', body: null });

    await page.locator('a[data-page="mixer"]').click();
    await page.locator('.mixer-channel').first().waitFor();
    assert.equal(await page.locator('.workspace-tabs [aria-current="page"]').innerText(), 'OBS sources\nLive volume & mute');
    assert.equal(await page.locator('.mixer-channel').count(), 2, 'Start with physical mic and desktop sources');
    assert.equal(await page.locator('.mixer-batch').getAttribute('open'), null);
    await page.getByRole('searchbox', { name: 'Search all OBS audio sources' }).pressSequentially('Media music');
    assert.equal(await page.locator('.mixer-channel').count(), 1);
    assert.equal(await page.locator('#mixerSearch').inputValue(), 'Media music');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'mixerSearch');
    await page.locator('#mixerSearch').fill('');
    await page.locator('#mixerGroup').selectOption('essentials');
    const microphoneLevel = page.locator('.mixer-channel [data-db="Microphone"]');
    await microphoneLevel.fill('-14');
    await microphoneLevel.press('Tab');
    await page.waitForFunction(() => !document.querySelector('.mixer-channel [data-db="Microphone"]').disabled);
    assert.deepEqual(requests.at(-1), { path: '/api/obs/audio', body: { input: 'Microphone', volume_db: -14 } });
    assert.equal(audioInputs.find(item => item.name === 'Media music').volume_db, -9, 'Fader changes only its named source');

    // An in-flight poll may finish after a new fader intent. Its old values
    // must not overwrite the newer adjustment or a subsequent page mount.
    await page.locator('#page').focus();
    holdNextAudio = true;
    await page.evaluate(() => window.fixtureAudioPoll());
    await until(() => releaseAudio);
    await microphoneLevel.fill('-18');
    await microphoneLevel.press('Tab');
    releaseAudio(); releaseAudio = null;
    await page.waitForFunction(() => !document.querySelector('.mixer-channel [data-db="Microphone"]').disabled);
    assert.equal(await microphoneLevel.inputValue(), '-18');
    failAction = true;
    await page.locator('.mixer-channel [data-mute="Microphone"]').click();
    await page.getByText('Microphone: Fixture rejected action', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.mixer-channel [data-mute="Microphone"]').disabled);
    assert.equal(await page.locator('.mixer-channel [data-mute="Microphone"]').innerText(), 'Mute', 'Rejected changes reload the true OBS state');
    failAction = false;
    holdNextAudio = true;
    await page.locator('#page').focus();
    await page.evaluate(() => window.fixtureAudioPoll());
    await until(() => releaseAudio);
    await page.locator('.workspace-tabs a[href="#audio"]').click();
    assert.equal(await page.locator('.workspace-tabs [aria-current="page"]').innerText(), 'Saved media\nProject, profile & file levels');
    await page.locator('a[data-page="mixer"]').click();
    await page.locator('.mixer-channel').first().waitFor();
    await microphoneLevel.fill('-21');
    await microphoneLevel.press('Tab');
    await page.waitForFunction(() => !document.querySelector('.mixer-channel [data-db="Microphone"]').disabled);
    releaseAudio(); releaseAudio = null;
    await page.waitForTimeout(100);
    assert.equal(await microphoneLevel.inputValue(), '-21', 'Late results from the old mount are discarded');

    // Dashboard subscriptions and polling end on navigation; stale scene results
    // cannot write into a different page. Offline controls become unavailable.
    await page.locator('a[data-page="dashboard"]').click();
    await chooseStage('game');
    await page.locator('#deskSounds').waitFor();
    await page.evaluate(() => window.fixtureSources.at(-1).onerror());
    assert(await page.locator('#deskSounds').isDisabled());
    await page.evaluate(() => window.fixtureSources.at(-1).onopen());
    await page.waitForFunction(()=>!document.querySelector('#deskSounds').disabled);
    staleCoordination = true;
    await page.locator('a[data-page="library"]').click();
    await page.locator('.skip-link').focus();
    await page.locator('.skip-link').press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'page');
    assert.equal(new URL(page.url()).hash, '#library', 'Skip link focuses controls without changing routes');
    const callsAfterLeave = coordinationCalls;
    await page.waitForTimeout(4500);
    assert.equal(coordinationCalls, callsAfterLeave, 'Leaving home clears its poll timer');

    // Responsive, accessible navigation with no horizontal overflow.
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://hub.test/#dashboard');
      await page.getByRole('heading', { name: 'Live desk', exact: true }).waitFor();
      const overflow = await page.locator('#page').evaluate(el => el.scrollWidth > el.clientWidth + 1);
      assert.equal(overflow, false, `Desk must fit ${width}px`);
      await chooseStage('game');
      if (width === 390) {
        await page.locator('#deskSounds').click();
        await page.locator('.stage-sound-list button').first().waitFor();
        assert.equal(await page.locator('.stage-sounds-dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
        await page.screenshot({path:path.join(output,'fixture-mobile-controls.png'),animations:'disabled'});
        await page.locator('.stage-sounds-dialog [data-close]').click();
        assert.equal(await page.locator('#nav').evaluate(el => el.inert), true);
        await page.getByRole('button', { name: 'Open navigation' }).click();
        assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'), 'true');
        await page.locator('a[data-page="library"]').click();
        assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#page').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
        await page.screenshot({ path: path.join(output, 'fixture-mobile.png'), animations: 'disabled' });
      }
    }
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('Hub UI: navigation, actions, errors, focus, faders, stale updates, lifecycle, stage image editing, global effects and four responsive widths passed.');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
