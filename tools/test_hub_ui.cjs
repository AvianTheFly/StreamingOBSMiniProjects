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
  { name: 'instant_replay', actions: ['save', 'play_replay', 'play_random', 'pause', 'resume', 'skip', 'revert'].map(action) },
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
      // Chromium's stream interception can delay EventSource headers; its native
      // GET transport stays direct while every other request is read-only.
      await page.route(url => new URL(url).pathname !== '/api/events', route => route.request().method() === 'GET' ? route.continue() : route.abort());
      await page.goto('http://127.0.0.1:7420/#dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#loadedCount')?.textContent.includes('features loaded')).catch(async error=>{
        console.error('Live browser errors:',errors);
        console.error('Live page:',await page.locator('#page').innerText());
        throw error;
      });
      await page.locator('#currentScene').filter({ hasNotText: '—' }).waitFor();
      await page.waitForFunction(() => !document.querySelector('[data-action="save"]').disabled);
      await page.locator('.desk-audio-channel').first().waitFor();
      await page.screenshot({ path: path.join(output, 'live-desk.png'), animations: 'disabled' });
      await page.getByRole('button',{name:'In game',exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('#voiceState').textContent.includes('Checking'));
      await page.screenshot({path:path.join(output,'live-in-game.png'),animations:'disabled'});
      await page.getByRole('button',{name:'Out of game',exact:true}).click();
      for (const panel of ['scenes','clips','music','sounds','waiting']) {
        await page.locator(`[data-desk-panel="${panel}"]`).click();
        await page.waitForFunction(()=>!document.querySelector('#deskResultCount').textContent.includes('Loading'));
        assert.equal(await page.locator('#deskRetry').count(),0,`${panel} catalog must be available`);
        await page.screenshot({path:path.join(output,`live-controls-${panel}.png`),animations:'disabled'});
        await page.locator('#deskPanelClose').click();
      }
      await page.locator('a[data-page="library"]').click();
      await page.locator('.library-tile').first().waitFor();
      await page.screenshot({ path: path.join(output, 'live-library.png'), animations: 'disabled' });
      await page.locator('a[data-page="projects/soundboard"]').click();
      await page.getByText('Ready to play', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(output, 'live-soundboard.png'), animations: 'disabled' });
      await page.locator('a[data-page="mixer"]').click();
      await page.locator('.mixer-channel').first().waitFor();
      await page.screenshot({ path: path.join(output, 'live-audio.png'), animations: 'disabled' });
      await page.locator('a[data-page="projects/scene_voice_switcher"]').click();
      await page.locator('.scene-location').first().waitFor();
      await page.screenshot({ path: path.join(output, 'live-scenes.png'), animations: 'disabled' });
      await page.goto('http://127.0.0.1:7420/#projects/spotify');
      await page.locator('#genActions button').first().waitFor();
      await page.screenshot({ path: path.join(output, 'live-spotify.png'), animations: 'disabled' });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto('http://127.0.0.1:7420/#dashboard');
      await page.waitForFunction(() => document.querySelector('#loadedCount')?.textContent.includes('features loaded'));
      await page.waitForFunction(() => document.querySelector('#currentScene')?.textContent !== '—');
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
        requests.push({ path: url.pathname, body: req.postDataJSON() });
        await new Promise(resolve => setTimeout(resolve, 350));
        if (!failAction && url.pathname === '/api/obs/audio') {
          const { input, ...changes } = req.postDataJSON();
          Object.assign(audioInputs.find(item => item.name === input), changes);
        }
        const scoped=url.pathname.match(/^\/api\/project-actions\/([^/]+)\/(pause|resume|stop|finish|revert)$/);
        if(!failAction && scoped)serverProjects=serverProjects.map(p=>p.name===scoped[1]?{...p,...(['pause','resume'].includes(scoped[2])?{is_paused:scoped[2]==='pause'}:{is_active:false})}:p);
        return route.fulfill({ json: failAction ? { ok: false, error: 'Fixture rejected action' } : { ok: true, lobby: 'TavernLobby' } });
      }
      if (url.pathname === '/api/status') return route.fulfill({ json: { projects:serverProjects } });
      if (url.pathname === '/api/coordination') {
        coordinationCalls++;
        if (staleCoordination) await new Promise(resolve => setTimeout(resolve, 600));
        return route.fulfill({ json: { scenes: { scene: 'Lobbies', observing: true }, display: {visible:false}, stream:{active:streamActive}, pauses:pauseClaims } });
      }
      if (url.pathname.endsWith('/lobbies')) return route.fulfill({ json: { game_scene: 'Test', program_scene:'Lobbies', current_lobby:'TavernLobby', screen:{visible:false}, lobbies: ['TavernLobby','ForgeLobby'], locations:['TavernLobby','ForgeLobby'].map(source=>({source,label:source==='TavernLobby'?'Tavern Lobby':'Spirit forge',description:source==='TavernLobby'?'Conversation in the tavern':'Amber smithy',managed:true,rotation:true,ready:true,layout:{screen:[100,200,600,300],camera:[800,300,400,500],chat:[1500,200,300,500]}})) } });
      if (url.pathname === '/api/projects/soundboard/assets') {
        if (staleCoordination) await new Promise(resolve=>setTimeout(resolve,600));
        return route.fulfill({json:[{source:'hooray',name:'Hooray'},{source:'die die die',name:'Muffin Dance'},...(largeCatalog?Array.from({length:45},(_,i)=>({source:`sound-${i}`,name:`Sound ${i}`})):[])]});
      }
      if (url.pathname === '/api/projects/sound_effects/library') return route.fulfill({json:['Sad violin','Hooray cue']});
      if (url.pathname === '/api/projects/specific_song/library') return route.fulfill({json:[{source:'Loreen',name:'Tattoo',aliases:['Loreen']}]});
      if (url.pathname === '/api/projects/instant_replay/clips') return route.fulfill({json:{clips:[{title:'A good escape',path:'C:/fixture/escape.mp4'}]}});
      if (url.pathname === '/api/voice') return route.fulfill({json:{ready:true,recording:false}});
      if (url.pathname === '/api/hub-actions') return route.fulfill({json:{workflows:[{id:'break',name:'Take a break',steps:[{project:'starting_soon',action:'start'}]}]}});
      if (url.pathname === '/api/starting-soon') return route.fulfill({json:{playlists:[{id:'best',name:'Best moments',paths:['C:/fixture/escape.mp4']}]}});
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
    await page.getByRole('button', { name: 'Save clip', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-action="save"]').disabled);
    assert.equal(await page.locator('#loadedCount').innerText(), '13 features loaded');
    assert.equal(profileCalls, 0, 'Home must not wait on profile discovery');
    assert.equal(checks, 0, 'Collapsed diagnostics do not poll Twitch');
    assert.equal(await page.locator('#currentScene').innerText(), 'Lobbies');
    await page.setViewportSize({width:1280,height:720});
    await page.screenshot({path:path.join(output,'fixture-compact.png'),animations:'disabled'});
    assert(await page.locator('.desk-launch').last().evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight), 'Main destinations fit a 720px desktop');
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({ path: path.join(output, 'fixture-desk.png'), animations: 'disabled' });

    // The operating surface controls the actual named sources and active owners.
    await page.locator('.desk-audio-channel').first().waitFor();
    assert.equal(await page.locator('.desk-audio-channel').count(),2);
    assert.equal(await page.locator('#streamState').innerText(),'Not streaming');
    assert.equal(await page.locator('#stopAudioAction').isVisible(),false,'Spotify overlay is not an audio producer');
    const homeMic=page.getByRole('slider',{name:'Microphone volume',exact:true});
    await homeMic.focus();
    await page.evaluate(p=>window.emitStatus(p),projects);
    assert.equal(await homeMic.evaluate(el=>document.activeElement===el),true);
    holdNextAudio=true;
    await homeMic.press('ArrowLeft');
    await until(()=>releaseAudio);
    await homeMic.press('ArrowLeft');
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Microphone volume"]').hasAttribute('aria-busy'));
    releaseAudio();releaseAudio=null;
    await page.waitForTimeout(60);
    assert.equal(await homeMic.inputValue(),'-7','Old audio responses cannot replace a newer adjustment');
    assert.equal(await homeMic.evaluate(el=>document.activeElement===el),true,'Saving a fader preserves keyboard focus');
    await homeMic.press('ArrowRight');await homeMic.press('ArrowRight');await homeMic.press('ArrowRight');
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Microphone volume"]').hasAttribute('aria-busy'));
    assert.equal(audioInputs.find(i=>i.name==='Microphone').volume_db,-5.5,'Continuous fader input applies the latest requested level');
    assert.equal(audioInputs.find(i=>i.name==='Desktop audio').volume_db,-12);
    assert.equal(audioInputs.find(i=>i.name==='Media music').volume_db,-9);
    failAction=true;
    await homeMic.press('ArrowLeft');
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Microphone volume"]').hasAttribute('aria-busy'));
    assert.equal(await homeMic.inputValue(),'-5.5','Rejected volume restores the last accepted value');
    await page.getByRole('button',{name:'Mute Microphone',exact:true}).click();
    await page.getByText('Fixture rejected action',{exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('[data-audio-input="Microphone"] button').disabled);
    assert.equal(await page.locator('[data-audio-input="Microphone"] button').innerText(),'Mute','Rejected mute retains OBS state');
    failAction=false;
    await page.getByRole('button',{name:'Mute Microphone',exact:true}).click();
    await page.getByRole('button',{name:'Unmute Microphone',exact:true}).waitFor();
    await page.getByRole('button',{name:'Unmute Microphone',exact:true}).click();
    await page.getByRole('button',{name:'Mute Microphone',exact:true}).waitFor();

    serverProjects=projects.map(p=>p.name==='specific_song'?{...p,is_active:true,current_activity:'Playing: Tattoo'}:p);
    await page.evaluate(p=>window.emitStatus(p),serverProjects);
    streamActive=true;
    const homeMusic=page.locator('[data-playback-project="specific_song"]');
    await homeMusic.getByRole('button',{name:'Pause Music',exact:true}).click();
    await homeMusic.getByRole('button',{name:'Resume Music',exact:true}).waitFor();
    assert.equal(requests.at(-1).path,'/api/project-actions/specific_song/pause');
    assert.equal(await page.locator('#streamState').innerText(),'Live · OBS');
    assert.equal(await homeMusic.locator('.desk-playback-state').innerText(),'Paused');
    pauseClaims={specific_song:{owners:[{kind:'playback',owner:'instant_replay',sequence:4}]}};
    await page.getByRole('button',{name:'Gameplay',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-playback-project="specific_song"] .desk-playback-state').textContent.includes('Waiting for'));
    assert(await homeMusic.getByRole('button',{name:'Resume Music',exact:true}).isDisabled(),'Resume cannot bypass another playback owner');
    await page.screenshot({path:path.join(output,'fixture-production-active.png'),animations:'disabled'});
    pauseClaims={};
    await page.getByRole('button',{name:'Gameplay',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('[data-playback-project="specific_song"] [data-action="resume"]').disabled);
    await homeMusic.getByRole('button',{name:'Resume Music',exact:true}).focus();
    await page.evaluate(p=>window.emitStatus(p),serverProjects);
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Resume');
    await homeMusic.getByRole('button',{name:'Resume Music',exact:true}).click();
    await homeMusic.getByRole('button',{name:'Pause Music',exact:true}).waitFor();
    await homeMusic.getByRole('button',{name:'Stop Music',exact:true}).click();
    await homeMusic.waitFor({state:'detached'});
    assert.equal(requests.at(-1).path,'/api/project-actions/specific_song/revert');
    assert.equal(serverProjects.find(p=>p.name==='spotify').is_active,true,'Stop acts on the chosen project only');
    await page.getByRole('button',{name:'Hide overlay Spotify overlay',exact:true}).click();
    await page.getByRole('button',{name:'Show overlay Spotify overlay',exact:true}).waitFor();
    await page.getByRole('button',{name:'Show overlay Spotify overlay',exact:true}).click();
    await page.getByRole('button',{name:'Hide overlay Spotify overlay',exact:true}).waitFor();
    streamActive=false;serverProjects=projects;

    await page.getByRole('button',{name:'Alerts & overlays',exact:true}).click();
    await page.getByRole('button',{name:'Pause League events',exact:true}).click();
    await page.getByRole('button',{name:'Resume League events',exact:true}).waitFor();
    assert.equal(requests.at(-1).path,'/api/project-actions/league/pause');
    assert.equal(serverProjects.find(p=>p.name==='league_api').is_paused,undefined,'Pause is scoped to the selected feature');
    await page.getByRole('button',{name:'Resume League events',exact:true}).click();
    await page.getByRole('button',{name:'Pause League events',exact:true}).waitFor();
    await page.locator('#deskPanelClose').click();

    // Focus modes affect presentation only. Browsing a focused catalog is read-only.
    const beforeModes=requests.length;
    await page.getByRole('button',{name:'In game',exact:true}).click();
    assert.equal(await page.locator('#gameTools').isVisible(),true);
    await page.waitForFunction(()=>document.querySelector('#voiceState').textContent==='Microphone ready');
    assert.equal(await page.locator('[data-action="stop_listen"]').isVisible(),false,'Idle voice hides finish controls');
    assert.equal(await page.locator('[data-desk-panel="scenes"]').isVisible(),false);
    assert.equal(requests.length,beforeModes);
    await page.screenshot({path:path.join(output,'fixture-in-game.png'),animations:'disabled'});
    await page.getByRole('button',{name:'Out of game',exact:true}).click();
    const sounds=page.locator('.desk-launch[data-desk-panel="sounds"]');
    await sounds.click();
    await page.locator('.desk-choice strong').filter({hasText:'Hooray'}).waitFor();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'deskPanelSearch','Picker starts with search focused');
    assert.equal(await page.locator('#deskPanelTransport').isVisible(),false,'Idle players hide playback controls');
    await page.locator('#deskPanelSearch').fill('missing sound');
    await page.getByRole('button',{name:'Clear search',exact:true}).click();
    assert.equal(await page.locator('#deskPanelSearch').inputValue(),'');
    const playing=projects.map(p=>p.name==='soundboard'?{...p,is_active:true,is_paused:false,current_activity:'Playing: Hooray'}:p);
    await page.evaluate(p=>window.emitStatus(p),playing);
    assert.equal(await page.locator('#deskPanelTransport').isVisible(),true);
    assert.equal(await page.locator('#deskPanelTransport button').allTextContents().then(a=>a.join(',')),'Pause,Skip,Stop');
    assert.equal(await page.locator('#deskPanelActivity').innerText(),'Hooray');
    await page.evaluate(p=>window.emitStatus(p),playing.map(p=>p.name==='soundboard'?{...p,is_paused:true}:p));
    assert.equal(await page.locator('#deskPanelTransport button').allTextContents().then(a=>a.join(',')),'Resume,Skip,Stop');
    await page.evaluate(()=>window.fixtureSources.at(-1).onerror());
    assert.equal(await page.locator('#deskConnection').innerText(),'Hub disconnected');
    assert(await page.locator('.desk-choice button').first().isDisabled());
    await page.waitForFunction(()=>window.fixtureSources.length>1 && document.querySelector('#statusText').textContent.includes('connected'));
    await page.evaluate(p=>window.emitStatus(p),projects);
    assert.equal(requests.length,beforeModes,'Opening a catalog must not trigger playback');
    await page.getByRole('searchbox',{name:'Find in these controls'}).fill('hooray');
    assert.equal(await page.locator('.desk-choice').count(),1);
    await page.screenshot({path:path.join(output,'fixture-sounds.png'),animations:'disabled'});
    const play=page.locator('.desk-choice button');
    await play.click();
    assert(await play.isDisabled());
    await page.waitForFunction(()=>!document.querySelector('.desk-choice button').disabled);
    assert.deepEqual(requests.at(-1),{path:'/api/projects/soundboard/play-asset',body:{source:'hooray'}});
    assert.equal(await page.locator('#deskPanelFeedback').innerText(),'Play requested · Hooray');
    await page.getByRole('button',{name:'Audio cues',exact:true}).click();
    await page.locator('.desk-choice strong').filter({hasText:'Sad violin'}).waitFor();
    await page.getByRole('searchbox',{name:'Find in these controls'}).fill('Sad');
    await page.locator('.desk-choice button').click();
    await page.waitForFunction(()=>!document.querySelector('.desk-choice button').disabled);
    assert.deepEqual(requests.at(-1),{path:'/api/projects/sound_effects/play',body:{source:'Sad violin'}});
    await page.locator('#deskPanelSearch').press('Escape');
    await page.waitForFunction(()=>document.activeElement?.matches('.desk-launch[data-desk-panel="sounds"]'));
    assert.equal(await sounds.evaluate(el=>el===document.activeElement),true,'Closing restores focus');

    await page.locator('.desk-launch[data-desk-panel="clips"]').click();
    await page.locator('.desk-choice strong').filter({hasText:'A good escape'}).waitFor();
    await page.locator('#deskReplayMode').selectOption('replay');
    await page.locator('.desk-choice button').click();
    await page.waitForFunction(()=>!document.querySelector('.desk-choice button').disabled);
    assert.deepEqual(requests.at(-1),{path:'/api/projects/instant_replay/play',body:{path:'C:/fixture/escape.mp4',mode:'replay'}});
    await page.locator('#deskPanelClose').click();

    await page.locator('.desk-launch[data-desk-panel="music"]').click();
    await page.locator('.desk-choice strong').filter({hasText:'Tattoo'}).waitFor();
    await page.locator('.desk-choice button').click();
    await page.waitForFunction(()=>!document.querySelector('.desk-choice button').disabled);
    assert.deepEqual(requests.at(-1),{path:'/api/projects/specific_song/play',body:{source:'Loreen'}});
    await page.locator('#deskPanelClose').click();

    await page.locator('.desk-launch[data-desk-panel="waiting"]').click();
    await page.locator('.desk-choice strong').filter({hasText:'Best moments'}).waitFor();
    await page.getByRole('button',{name:'Show playlist',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.desk-choice button').disabled);
    assert.deepEqual(requests.slice(-2),[{path:'/api/starting-soon/start',body:{}},{path:'/api/starting-soon/play',body:{paths:['C:/fixture/escape.mp4']}}]);
    await page.locator('#deskPanelClose').click();

    await page.getByRole('button',{name:'Run a workflow',exact:true}).click();
    await page.getByRole('button',{name:'Run',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('[data-workflow]').disabled);
    assert.equal(requests.at(-1).path,'/api/workflows/break');
    await page.locator('#deskPanelClose').click();
    await page.getByRole('button',{name:'Show desktop',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('[data-hub-action="show_screen"]').disabled);
    assert.equal(requests.at(-1).path,'/api/hub-actions/show_screen');

    // Late catalog responses cannot overwrite a reopened panel or a newer route.
    staleCoordination=true;
    await sounds.click();
    await page.locator('#deskPanelClose').click();
    await page.locator('[data-desk-panel="scenes"]').click();
    await page.getByRole('button',{name:'Show',exact:true}).first().waitFor();
    await page.waitForTimeout(650);
    assert.equal(await page.locator('#deskPanelTitle').innerText(),'Scenes');
    assert.equal(await page.locator('.desk-choice strong').first().innerText(),'Gameplay');
    await page.locator('#deskPanelClose').click();staleCoordination=false;

    // Preserve focused controls on SSE updates and block repeated pending actions.
    await page.getByRole('button', { name: 'Save clip', exact: true }).focus();
    await page.evaluate(p => window.emitStatus(p), projects);
    assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), 'Save clip');
    await page.getByRole('button', { name: 'Save clip', exact: true }).click();
    assert.equal(await page.locator('[data-action="save"]').getAttribute('aria-busy'), 'true');
    assert(await page.locator('[data-action="save"]').isDisabled());
    await page.waitForFunction(() => !document.querySelector('[data-action="save"]').disabled);
    assert.equal(requests.filter(r => r.path.endsWith('/instant_replay/save')).length, 1);
    await page.getByRole('button', { name: 'Gameplay', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#gameAction').disabled);
    assert.deepEqual(requests.at(-1), { path: '/api/projects/scene_voice_switcher/switch_scene', body: { scene: 'Test' } });
    failAction = true;
    await page.getByRole('button', { name: 'Replay latest', exact: true }).click();
    await page.getByText('Fixture rejected action', { exact: true }).waitFor();
    failAction = false;
    await page.locator('.desk-diagnostics > summary').click();
    await page.getByText('Fixture check ready', { exact: true }).waitFor();
    assert.equal(checks, 1);
    await page.locator('.desk-diagnostics > summary').click();

    // Search navigation, escaping, filter state and deep links.
    await page.getByRole('button', { name: 'Find a control or page' }).click();
    await page.getByRole('searchbox', { name: 'Search controls' }).fill('replay');
    await page.getByRole('searchbox', { name: 'Search controls' }).press('Enter');
    assert.equal(new URL(page.url()).hash, '#projects/instant_replay');
    await page.locator('a[data-page="library"]').click();
    assert.equal(await page.locator('.library-tile').count(), 17);
    await page.getByRole('searchbox', { name: 'Search library' }).fill('music');
    assert.equal(await page.locator('.library-tile').count(), 1);
    await page.getByRole('searchbox', { name: 'Search library' }).fill('<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('.library-tile').count(), 0);
    await page.getByRole('searchbox', { name: 'Search library' }).fill('');
    await page.getByRole('button', { name: 'On screen', exact: true }).click();
    assert.equal(await page.locator('.library-group h2').innerText(), 'On screen');
    await page.screenshot({ path: path.join(output, 'fixture-library.png'), animations: 'disabled' });

    // No hidden profile editor fetch until requested. A late response cannot
    // replace a newer mount after leaving and opening a different feature.
    await page.locator('a[data-page="projects/soundboard"]').click();
    assert.equal(profileCalls, 0);
    await page.locator('.feature-disclosure > summary').filter({ hasText: 'Hotkeys & profiles' }).click();
    await page.locator('a[data-page="projects/specific_song"]').click();
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
    await page.getByRole('button', { name: 'Save clip', exact: true }).waitFor();
    await page.evaluate(() => window.fixtureSources.at(-1).onerror());
    assert(await page.getByRole('button', { name: 'Save clip', exact: true }).isDisabled());
    await page.evaluate(() => window.fixtureSources.at(-1).onopen());
    await page.waitForFunction(() => !document.querySelector('[data-action="save"]').disabled);
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
      if (width === 390) {
        largeCatalog=true;
        await page.setViewportSize({width:390,height:640});
        await page.locator('.desk-launch[data-desk-panel="sounds"]').click();
        await page.locator('.desk-choice strong').filter({hasText:'Hooray'}).waitFor();
        assert.equal(await page.locator('.desk-dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
        const searchTop=await page.locator('#deskPanelSearch').evaluate(el=>el.getBoundingClientRect().top);
        await page.locator('#deskPanelResults').evaluate(el=>{el.scrollTop=el.scrollHeight;});
        assert.equal(await page.locator('#deskPanelSearch').evaluate(el=>el.getBoundingClientRect().top),searchTop,'Search stays visible while browsing long lists');
        assert(await page.locator('#deskPanelDetail').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight),'Specialized controls remain visible on short screens');
        await page.screenshot({path:path.join(output,'fixture-mobile-controls.png'),animations:'disabled'});
        await page.locator('#deskPanelClose').click();
        await page.setViewportSize({width:390,height:900});
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
    console.log('Hub UI: navigation, actions, errors, focus, faders, stale updates, lifecycle, diagnostics and four responsive widths passed.');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
