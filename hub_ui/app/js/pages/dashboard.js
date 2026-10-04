// Live desk presents existing feature contracts; it owns no playback or OBS state.
import { api } from '../api.js';
import { state } from '../state.js';
import { feature } from '../catalog.js';
import { esc, timestamp } from '../utils.js';
import { runWithFeedback } from '../action-feedback.js';
import { watchTwitchSettings } from '../twitch-stream-settings.js';
import { mountDeskControls } from './desk-controls.js';
import { deskView } from './desk-view.js';
import { mountDeskPlayback } from './desk-playback.js';
import { mountDeskAudio } from './desk-audio.js';

let _dispose = null;
let _events = [];
const MAX_EVENTS = 60;
let workspaceMode = 'produce';

export function mount(container) {
  let disposed = false;
  let timer = null;
  let stopChecks = null;
  let sceneKnown = false;
  let gameScene = null;
  let voice = null;
  const disposers = [];
  container.innerHTML = deskView();
  const lobbyBtn = container.querySelector('#lobbyAction');
  const gameBtn = container.querySelector('#gameAction');
  const diagnostics = container.querySelector('.desk-diagnostics');
  let coordination = null;
  const controls = mountDeskControls(container, refreshAfterAction, () => coordination?.pauses || {});
  const playback = mountDeskPlayback(container.querySelector('#activeFeatures'), refreshAfterAction);
  const audio = mountDeskAudio(container.querySelector('#deskAudioChannels'), container.querySelector('#deskAudioFeedback'));
  function setMode(mode) {
    workspaceMode = mode;
    container.dataset.deskMode = mode;
    container.querySelector('#gameTools').hidden = mode !== 'game';
    container.querySelectorAll('[data-produce-only]').forEach(el => { el.hidden = mode === 'game'; });
    container.querySelectorAll('[data-desk-mode]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.deskMode === mode)));

  }
  container.querySelectorAll('[data-desk-mode]').forEach(btn => btn.addEventListener('click', () => { setMode(btn.dataset.deskMode); refreshVoice(); }));
  setMode(workspaceMode);
  function update() {
    if (disposed) return;
    const projects = state.get('projects');
    const connected = state.get('connected');
    container.querySelectorAll('[data-hub-action]').forEach(btn => {
      btn.dataset.available = String(connected && sceneKnown);
      if(!btn.hasAttribute('aria-busy')) btn.disabled = btn.dataset.available === 'false';
    });
    const automatic = projects.filter(p => ['league', 'league_api', 'twitch_celebrations'].includes(p.name));
    const held = automatic.filter(p => p.is_paused || coordination?.pauses?.[p.name]);
    container.querySelector('#automationState').textContent = !connected ? 'Automation status unavailable' : held.length ? `${held.length} automation features paused` : `${automatic.length} automation features connected`;
    container.querySelectorAll('[data-project][data-action]').forEach(btn => {
      const p = projects.find(p => p.name === btn.dataset.project);
      const action = btn.dataset.action;
      let available = connected && !!p?.actions?.some(a => a.key === action);
      const ownsVoice = voice?.owner === btn.dataset.project;
      if (['stop_listen', 'abort_listen'].includes(action)) {
        btn.hidden = !ownsVoice || !(voice?.recording || voice?.transcribing);
        available &&= ownsVoice && (action === 'abort_listen' || voice?.recording);
      }
      if (action === 'start_listen') available &&= voice?.ready === true && !voice?.recording && !voice?.transcribing;
      btn.dataset.available = String(available);
      if (!btn.hasAttribute('aria-busy')) btn.disabled = !available;
      btn.title = available ? (p.actions.find(a => a.key === btn.dataset.action)?.description || '') : 'This feature is not available right now';
    });
    const sceneFeature = !!projects.find(p => p.name === 'scene_voice_switcher');
    lobbyBtn.disabled = !connected || !sceneKnown || !sceneFeature || lobbyBtn.hasAttribute('aria-busy');
    gameBtn.disabled = !connected || !sceneKnown || !gameScene || !sceneFeature || gameBtn.hasAttribute('aria-busy');
    lobbyBtn.dataset.available = String(connected && sceneKnown && sceneFeature);
    gameBtn.dataset.available = String(connected && sceneKnown && !!gameScene && sceneFeature);
    const stopBtn = container.querySelector('#stopAudioAction');
    stopBtn.dataset.available = String(connected && projects.some(p => p.is_active && p.produces_audio));
    stopBtn.hidden = !projects.some(p => p.is_active && p.produces_audio);
    if (!stopBtn.hasAttribute('aria-busy')) stopBtn.disabled = stopBtn.dataset.available === 'false';

    const active = projects.filter(p => p.is_active);
    container.querySelector('#activeCount').textContent = connected ? active.length : '—';
    container.querySelector('#loadedCount').textContent = connected ? `${projects.length} features loaded` : 'Hub disconnected · controls will return when connected';
    playback.update(projects, connected, coordination?.pauses);
    controls.update();
    if (!connected) {
      sceneKnown = false;
      container.querySelector('#obsIndicator').textContent = 'Hub disconnected';
      container.querySelector('#obsIndicator').classList.remove('is-connected');
      container.querySelector('#sceneCaption').textContent = 'Last observed OBS scene · reconnecting';
      container.querySelector('#streamState').textContent = 'Stream status unavailable';
      container.querySelector('#streamState').classList.remove('is-live');
      container.querySelector('#desktopState').textContent = 'Desktop status unavailable';
    }
  }
  // Subscribe before any async work, and never replace focused control DOM on status updates.
  disposers.push(state.watch('projects', update), state.watch('connected', update));
  container.querySelectorAll('[data-project][data-action]').forEach(btn => btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    const messages = { save: 'Saving your replay clip', play_replay: 'Playing the latest replay', random: 'Playing a sound', revert: 'Hub music stopped', start: 'Starting soon opened', finish: 'Waiting room finished' };
    await runWithFeedback(btn, () => api.runProjectAction(btn.dataset.project, action), messages[action] || 'Control applied');
    update(); refreshAfterAction();
    if(action.includes('listen'))refreshVoice();
  }));
  container.querySelectorAll('[data-hub-action]').forEach(btn=>btn.addEventListener('click',async()=>{await runWithFeedback(btn,()=>api.runHubAction(btn.dataset.hubAction),'Desktop visibility requested');refreshAfterAction();}));
  lobbyBtn.addEventListener('click', async () => { await runWithFeedback(lobbyBtn, () => api.selectLobby(), r => `Showing ${r.lobby || 'a lobby'}`); refreshScene(); });
  gameBtn.addEventListener('click', async () => { await runWithFeedback(gameBtn, () => api.switchScene(gameScene), 'Gameplay scene selected'); refreshScene(); });
  container.querySelector('#stopAudioAction').addEventListener('click', async e => {await runWithFeedback(e.currentTarget, () => api.runHubAction('abort_all_audio'), 'Stop Hub audio requested');refreshAfterAction();});
  diagnostics.addEventListener('toggle', () => {
    if (diagnostics.open && !stopChecks) { stopChecks = watchTwitchSettings(container.querySelector('#twitchStartupCheck')); renderEvents(container); }
    if (!diagnostics.open && stopChecks) { stopChecks(); stopChecks = null; }
  });
  container.querySelector('#clearLogBtn').addEventListener('click', () => { _events = []; renderEvents(container); });
  let inFlight = false;
  let statusInFlight = false;
  async function refreshAfterAction() {
    if(disposed)return;
    refreshScene();
    if(statusInFlight)return;
    statusInFlight=true;
    try {const data=await api.getStatus();if(!disposed && Array.isArray(data.projects))state.set({projects:data.projects});}
    catch {} finally {statusInFlight=false;}
  }
  async function refreshScene() {
    if (disposed || inFlight) return;
    clearTimeout(timer);
    if (document.hidden) { timer = setTimeout(refreshScene, 4000); return; }
    inFlight = true;
    try {
      const data = await api.getCoordination();
      if (disposed) return;
      coordination = data;
      const streamActive = data.stream?.active;
      container.querySelector('#streamState').textContent = streamActive === true ? 'Live · OBS' : streamActive === false ? 'Not streaming' : 'Stream status unavailable';
      container.querySelector('#streamState').classList.toggle('is-live', streamActive === true);
      sceneKnown = data.scenes?.observing === true;
      container.querySelector('#currentScene').textContent = data.scenes?.scene || 'No scene reported';
      container.querySelector('#obsIndicator').textContent = sceneKnown ? 'OBS connected' : 'OBS unavailable';
      container.querySelector('#obsIndicator').classList.toggle('is-connected', sceneKnown);
      container.querySelector('#sceneCaption').textContent = sceneKnown ? (data.scenes.temporary_owner ? 'Temporary presentation in OBS' : '') : 'Last observed scene · check the OBS connection';
      container.querySelector('#desktopState').textContent = data.display?.visible === true ? 'Desktop visible' : data.display?.visible === false ? 'Desktop hidden' : 'Desktop status unavailable';
      container.querySelectorAll('[data-hub-action]').forEach(btn=>btn.setAttribute('aria-pressed',String(sceneKnown && data.display?.visible === (btn.dataset.hubAction === 'show_screen'))));
      gameBtn.setAttribute('aria-pressed',String(sceneKnown && data.scenes?.scene === gameScene));
      if(data.scenes?.temporary_owner)container.querySelector('#sceneCaption').textContent=`${feature(data.scenes.temporary_owner).label} owns this presentation`;
    } catch {
      if (!disposed) { sceneKnown = false; container.querySelector('#obsIndicator').textContent = 'OBS status unavailable'; container.querySelector('#obsIndicator').classList.remove('is-connected');container.querySelector('#streamState').textContent='Stream status unavailable';container.querySelector('#streamState').classList.remove('is-live');container.querySelector('#desktopState').textContent='Desktop status unavailable'; }
    } finally {
      inFlight = false;
      if (!disposed) { update(); timer = setTimeout(refreshScene, 4000); }
    }
  }
  let voiceTimer;
  let voiceInFlight = false;
  async function refreshVoice() {
    if(disposed || voiceInFlight)return;
    clearTimeout(voiceTimer);
    if(workspaceMode==='game' && !document.hidden) {
      voiceInFlight=true;
      try{const v=await fetch('/api/voice').then(r=>{if(!r.ok)throw Error();return r.json();});if(!disposed){voice=v;container.querySelector('#voiceState').textContent=v.recording?'Listening':v.transcribing?'Processing voice':v.ready?'Microphone ready':v.startup_error?'Voice unavailable':'Microphone starting';update();controls.update();}}
      catch{if(!disposed){voice=null;container.querySelector('#voiceState').textContent='Voice status unavailable';update();controls.update();}}
      finally{voiceInFlight=false;}
    }
    if(!disposed)voiceTimer=setTimeout(refreshVoice,4000);
  }
  refreshVoice();
  api.getLobbies().then(data => { if (!disposed) { gameScene = data.game_scene || null; update(); } }).catch(() => {});
  update();
  refreshScene();
  _dispose = () => { disposed = true; clearTimeout(timer);clearTimeout(voiceTimer); controls.dispose();playback.dispose();audio.dispose(); disposers.forEach(fn => fn()); stopChecks?.(); };
}
export function unmount() { _dispose?.(); _dispose = null; }

export function onEvent(type, payload) {
  if (type === 'status_update') return;
  _events.push({ time: timestamp(), type, payload });
  if (_events.length > MAX_EVENTS) _events.shift();
  const host = document.querySelector('.desk-diagnostics[open]');
  if (host) renderEvents(host);
}
function renderEvents(container) {
  const log = container.querySelector('#eventLog');
  if (!log) return;
  const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 12;
  log.innerHTML = _events.length ? _events.map(e => `<div class="event-row"><span class="event-time">${esc(e.time)}</span><span class="event-type">${esc(e.type)}</span><span class="event-data">${esc(JSON.stringify(e.payload))}</span></div>`).join('') : '<p class="desk-empty">Activity will appear here as you use the Hub.</p>';
  if (atBottom) log.scrollTop = log.scrollHeight;
}
