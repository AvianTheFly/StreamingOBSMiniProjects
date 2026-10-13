// Clip management assembly; the live dashboard has a separate playback picker.
import { api } from '../api.js';
import { state } from '../state.js';
import { toast } from '../toast.js';
import { mountPresentation } from './replay-presentation.js';
import { mountClipDesk } from './replay-clip-desk.js';

let root, desk, disposePresentation, unwatch, ready = false, busy = false, bufferActive = null, generation = 0;
const $ = selector => root?.querySelector(selector);
const button = (id,label) => `<button id="${id}" class="btn btn-secondary btn-sm">${label}</button>`;

export function mount(container) {
  root=container;ready=false;busy=false;bufferActive=null;const token=++generation;root.classList.add('replay-workspace');
  root.innerHTML=`<div class="page-header ir-page-heading"><div><div class="page-title">Manage clips</div><div class="page-subtitle">Trim, add notes, and build montages.</div></div><div class="ir-mark-action"><button id="irMark" class="btn btn-primary">◇ Mark last 60s</button><a href="#dashboard" class="desk-text-link">Back to live desk ↗</a></div></div>
    <details class="ir-management-settings"><summary>Capture &amp; replay settings</summary><section id="irPresentation" aria-label="Replay presentation studio"></section></details>
    <div class="ir-live card"><div><span id="irIndicator" class="state-indicator"></span> <strong id="irStatus">Connecting…</strong><span id="irActivity" class="ir-muted"></span></div><div id="irBufferSetup" hidden><span id="irBufferStatus" class="ir-muted"></span> ${button('irStartBuffer','Start replay buffer')}</div><div class="ir-actions">${button('irPause','Pause')}${button('irResume','Resume')}${button('irSkip','Next clip')}${button('irStop','Return to live')}</div></div>
    <details class="ir-help"><summary>Voice shortcuts <span class="ir-muted">· press |, then speak</span></summary><div class="ir-help-grid"><div><h3>Save for later</h3><p><code>mark</code> saves the last 60 seconds for review. <code>mark 30</code> changes the length; <code>mark full</code> saves the buffer. These clips stay out of automatic replays.</p></div><div><h3>Replay a moment</h3><p><code>quick replay</code> captures and replays 15 seconds. <code>quick replay 30</code> changes its duration. <code>replay</code> plays the latest eligible capture.</p></div><div><h3>Keep a highlight</h3><p><code>save</code> captures the game moment and requests a Twitch clip. <code>save 30</code> chooses its length. <code>save and replay</code> also plays it. <code>showcase</code> and <code>random</code> use replay-ready highlights.</p></div></div></details><section id="irClipDesk"></section>`;
  $('#irPresentation').parentElement.append($('.ir-live'),$('.ir-help'));
  disposePresentation=mountPresentation($('#irPresentation'),{canCapture:()=>ready&&bufferActive===true&&!busy});
  const bind=(id,fn)=>$(id)?.addEventListener('click',fn);
  for(const [id,action] of [['irRandom','play_random'],['irHighlights','play_highlights'],['irSaveReplay','save_replay'],['irReplay','play_replay'],['irLatest','play_showcase']])bind(`#${id}`,()=>live(()=>api.runProjectAction('instant_replay',action)));
  bind('#irQuickReplay',()=>live(()=>api.captureQuickReplay(Number($('#irQuickSeconds').value)),'Capturing a replay-only moment'));
  bind('#irMark',()=>perform(()=>api.runProjectAction('instant_replay','mark'),'Saving the last 60 seconds for review'));
  bind('#irSaveBuffer',()=>perform(()=>api.runProjectAction('instant_replay','save'),'Saving a replay-ready highlight'));
  bind('#irPause',()=>perform(()=>api.pauseProject('instant_replay')));
  bind('#irResume',()=>perform(()=>api.resumeProject('instant_replay')));
  bind('#irSkip',()=>perform(()=>api.skipReplayClip()));
  bind('#irStop',()=>perform(()=>api.revertProject('instant_replay')));
  async function refreshBuffer(){
    try{const data=await api.getCoordination();if(!root || generation!==token)return;bufferActive=data.scenes?.observing?data.replay_buffer?.active ?? null:null;}
    catch{if(generation!==token)return;bufferActive=null;}
    updateStatus(state.get('projects'));
  }
  bind('#irStartBuffer',async()=>{$('#irStartBuffer').disabled=true;await perform(()=>api.runHubAction('start_replay_buffer'),'Replay buffer requested');if(root && generation===token)await refreshBuffer();});
  desk=mountClipDesk($('#irClipDesk'),{canPlay:()=>ready&&!busy,onPlay:live,onCatalog(data){ready=!!data.ready;updateTwitch(data.twitch_clip);updateStatus(state.get('projects'));refreshBuffer();}});
  unwatch=state.watch('projects',updateStatus);updateStatus(state.get('projects'));
}
export function beforeLeave(){return desk?.beforeLeave() ?? true;}
export function unmount(){generation++;unwatch?.();disposePresentation?.();desk?.dispose();root?.classList.remove('replay-workspace');root=null;desk=null;unwatch=null;disposePresentation=null;}
async function perform(fn,message){try{const data=await fn();if(data?.ok===false)throw Error(data.error||'Action unavailable');if(message)toast.success(message);return data;}catch(e){toast.error(e.message);return null;}}
async function live(fn,message='Playback requested in OBS'){
  if(!ready){toast.error('Replay playback is offline. Open OBS to enable it.');return;}
  if(busy){toast.error('Stop the current replay before starting another.');return;}
  desk?.pausePreview();await perform(fn,message);
}
function updateTwitch(twitch){
  let target=$('#irTwitchClip');
  if(!target){target=document.createElement('p');target.id='irTwitchClip';target.className='ir-muted';$('#irSaveBuffer').parentElement.after(target);}
  target.textContent=twitch?.message||'';
  if(twitch?.status==='ready' && /^https:\/\/(clips\.twitch\.tv|www\.twitch\.tv)\//.test(twitch.url)){
    const link=document.createElement('a');link.href=twitch.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' Open Twitch clip';target.append(link);
  }
}
function updateStatus(projects=[]){
  if(!root)return;
  const project=projects?.find(p=>p.name==='instant_replay'),waiting=project?.current_activity==='saving for replay';
  busy=!!project?.is_active||waiting;const paused=busy&&(project?.current_activity||'').includes('paused');
  $('#irStatus').textContent=!ready?'Playback offline':waiting?'Saving for replay':paused?'Paused in OBS':busy?'Playing in OBS':'Ready for replay';
  $('#irActivity').textContent=!ready?' · You can still review and trim clips':busy?` · ${project.current_activity||'replay'}`:' · Clip previews stay off stream';
  $('#irIndicator').className=`state-indicator state-indicator--${busy?'active':'idle'}`;
  $('.ir-live .ir-actions').hidden=!busy;
  $('#irPause').disabled=!busy||paused||waiting;$('#irPause').hidden=paused;$('#irResume').disabled=!paused;$('#irResume').hidden=!paused;
  $('#irSkip').disabled=!busy||waiting;$('#irStop').disabled=!busy;
  for(const id of ['irRandom','irLatest','irReplay','irHighlights'])$(`#${id}`).disabled=!ready||busy;
  for(const id of ['irQuickReplay','irSaveReplay'])$(`#${id}`).disabled=!ready||bufferActive!==true||busy;
  $('#irSaveBuffer').disabled=!ready||bufferActive!==true;$('#irMark').disabled=!ready||bufferActive!==true;
  $('#irBufferSetup').hidden=bufferActive===true;$('#irStartBuffer').disabled=!ready||bufferActive!==false;
  $('#irBufferStatus').textContent=bufferActive===false?'Capture is stopped.':!ready?'Open OBS to capture.':'Checking replay buffer…';desk?.updateStatus();
}
