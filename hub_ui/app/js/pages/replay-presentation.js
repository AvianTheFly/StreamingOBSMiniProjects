// Presentation preferences and private previews; capture remains feature-owned.
import { api } from '../api.js';
import { toast } from '../toast.js';

export function mountPresentation(host,{canCapture=()=>true}={}) {
  let disposed=false,timer,pending=false,currentMode='showcase';
  const $=selector=>host.querySelector(selector);
  const sceneOptions=`<option value="move">Quick move · 320 ms</option><option value="wipe">Quick wipe · 320 ms</option><option value="fade">Quick fade · 220 ms</option><option value="cut">Cut</option><option value="current">Current OBS transition</option>`;
  const clipOptions=`<option value="sweep">Spirit sweep</option><option value="iris">Iris</option><option value="fade">Fade</option><option value="cut">Cut</option>`;
  function card(mode) {
    const replay=mode==='replay';
    return `<article class="ir-mode-card"><div class="ir-mode-heading"><span class="ir-mode-icon">${replay?'↺':'▷'}</span><div><span class="ir-mode-kicker">${replay?'IN THE GAME':'BETWEEN GAMES'}</span><h2>${replay?'Quick Replay':'Clip Showcase'}</h2></div><span class="ir-mode-tag">| → ${replay?'quick replay':'highlights'}</span></div>
      <p>${replay?'Replay a moment while the live screen stays visible.':'Saved clips and collections.'}</p>
      <iframe title="${replay?'Quick replay':'Clip showcase'} layout preview, off stream" src="/replay-stage.html?preview=${mode}" tabindex="-1"></iframe>
      <div class="ir-mode-options"><label>Screen<select data-mode="${mode}" data-pref="companion"><option value="${replay?'live':'off'}">${replay?'Live screen':'Off'}</option><option value="${replay?'off':'live'}">${replay?'Off':'Live screen'}</option><option value="desktop">Desktop (show/hide)</option></select></label><label>Scene transition<select data-mode="${mode}" data-pref="transition">${sceneOptions}</select></label><label>Between clips<select data-mode="${mode}" data-pref="clip_transition">${clipOptions}</select></label><div class="ir-camera-choice"><label><input type="checkbox" data-mode="${mode}" data-pref="camera" checked> Face cam</label><button class="btn btn-secondary btn-sm" type="button" data-preview-transition="${mode}">Preview transition</button></div></div>
      ${replay?`<div class="ir-quick-capture"><label>Last<select id="irQuickSeconds" aria-label="Quick replay duration"><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="15" selected>15 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option></select></label><button class="btn btn-primary" id="irQuickReplay">Replay this moment</button></div><p class="ir-capture-note">Replay only · no Twitch clip · excluded from highlight review.</p><div class="ir-mode-buttons"><button class="btn btn-secondary" id="irReplay">Replay latest</button><button class="btn btn-secondary" id="irSaveReplay">Save highlight + replay</button></div>`:`<div class="ir-mode-buttons"><button class="btn btn-primary" id="irHighlights">Game highlights</button><button class="btn btn-secondary" id="irLatest">Latest clip</button><button class="btn btn-secondary" id="irRandom">Shuffle</button></div>`}</article>`;
  }
  host.innerHTML=`<div class="ir-studio-modes">${card('replay')}${card('showcase')}</div>
    <div class="ir-studio-note"><span>Previews stay off stream.</span><label><input type="checkbox" id="irMotion" checked> Motion</label></div><p id="irCaptureStatus" class="ir-muted" role="status"></p>
    <div class="ir-program card"><div class="ir-program-top"><span class="ir-mode-kicker" id="irOnAirLabel">READY</span><span id="irStageTime"></span></div><strong id="irStageClip">Nothing playing</strong><div class="ir-program-progress"><span id="irStageProgress"></span></div><div class="ir-program-bottom"><span id="irStageNext"></span><button class="btn btn-secondary btn-sm" id="irKeepCurrent" hidden>Keep this clip</button><label>Screen<select id="irCompanion"><option value="off">Off</option><option value="live">Live screen</option><option value="desktop">Desktop (show/hide)</option></select></label><label><input id="irCamera" type="checkbox"> Face cam</label></div></div>`;
  function paint(s) {
    if(disposed)return;
    if(!pending){
      for(const mode of ['replay','showcase'])for(const pref of ['companion','transition','clip_transition','camera']){
        const control=$(`[data-mode="${mode}"][data-pref="${pref}"]`);
        if(pref==='camera')control.checked=s.settings?.[mode]?.camera!==false;
        else control.value=s.settings?.[mode]?.[pref]||({companion:mode==='replay'?'live':'off',transition:mode==='replay'?'move':'current',clip_transition:mode==='replay'?'sweep':'iris'})[pref];
      }
      $('#irMotion').checked=s.motion!==false;$('#irCompanion').value=s.view||'off';$('#irCamera').checked=s.camera!==false;
    }
    currentMode=s.mode||'showcase';
    $('#irCaptureStatus').textContent=s.capture?.message||'';
    $('#irCaptureStatus').classList.toggle('is-error',s.capture?.status==='error');
    $('#irQuickReplay').disabled=!canCapture()||!!s.active||!!s.pending||s.capture?.status==='saving';
    $('#irKeepCurrent').hidden=!s.active||s.purpose!=='replay_only'||!s.clip_path;
    $('#irKeepCurrent').dataset.path=s.clip_path||'';
    $('#irCompanion').disabled=!s.active||pending;$('#irCamera').disabled=!s.active||pending;
    const phases={entering:'TRANSITION',covering:'TRANSITION',loading:'LOADING',revealing:'TRANSITION',returning:'RETURNING',playing:'PLAYING'};
    $('#irOnAirLabel').textContent=s.active?`${s.mode==='replay'?'REPLAY':'SHOWCASE'} · ${s.paused?'PAUSED':phases[s.phase]||'PLAYING'}`:s.pending?'SAVING':'READY';
    $('#irStageClip').textContent=s.active?s.title||'Loading':s.pending?'Saving clip':'Nothing playing';
    $('#irStageNext').textContent=s.active?(s.next_title?`Next: ${s.next_title}`:s.total==='∞'?'Shuffle':Number(s.total)>0&&s.index===Number(s.total)?'Last clip':''):'';
    const duration=s.active?(Number(s.duration_ms)||0):0,cursor=s.active?(Number(s.cursor_ms)||0):0;
    $('#irStageProgress').style.width=`${duration?Math.min(100,cursor/duration*100):0}%`;
    const clock=ms=>{const n=Math.floor(ms/1000);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
    $('#irStageTime').textContent=duration?`${clock(cursor)} / ${clock(duration)}`:'';host.classList.toggle('is-on-air',!!s.active);
    for(const mode of ['replay','showcase'])$(`iframe[src*="preview=${mode}"]`).contentWindow?.postMessage({type:'replay-layout',state:{view:s.settings?.[mode]?.companion||(mode==='replay'?'live':'off'),camera:s.settings?.[mode]?.camera!==false,clip_transition:s.settings?.[mode]?.clip_transition||(mode==='replay'?'sweep':'iris'),motion:s.motion}},location.origin);
  }
  async function save(fn){
    if(pending)return;
    pending=true;host.querySelectorAll('select,input').forEach(e=>e.disabled=true);
    try{const result=await fn();pending=false;paint(result);toast.success('Presentation saved');}catch(e){toast.error(e.message);}
    finally{pending=false;if(!disposed){host.querySelectorAll('select,input').forEach(e=>e.disabled=false);refresh();}}
  }
  host.querySelectorAll('[data-pref]').forEach(el=>el.addEventListener('change',()=>save(()=>api.saveReplayPresentation({[el.dataset.mode]:{[el.dataset.pref]:el.type==='checkbox'?el.checked:el.value}}))));
  $('#irMotion').addEventListener('change',()=>save(()=>api.saveReplayPresentation({motion:$('#irMotion').checked})));
  $('#irCompanion').addEventListener('change',()=>save(()=>api.setReplayView($('#irCompanion').value)));
  $('#irCamera').addEventListener('change',()=>save(()=>api.saveReplayPresentation({[currentMode]:{camera:$('#irCamera').checked}})));
  $('#irKeepCurrent').addEventListener('click',async e=>{
    const button=e.currentTarget,path=button.dataset.path;
    if(!path||button.disabled)return;button.disabled=true;
    try{const catalog=await api.getReplayClips();if(disposed)return;
      await api.saveReplayLibrary({action:'purpose',paths:[path],purpose:'highlight',revision:catalog.revision});
      if(!disposed){toast.success('Kept for highlights');refresh();}
    }catch(error){if(!disposed)toast.error(error.message);}
    finally{if(!disposed)button.disabled=false;}
  });
  host.querySelectorAll('[data-preview-transition]').forEach(el=>el.addEventListener('click',()=>{
    const mode=el.dataset.previewTransition,style=$(`[data-mode="${mode}"][data-pref="clip_transition"]`).value;
    $(`iframe[src*="preview=${mode}"]`).contentWindow?.postMessage({type:'replay-transition-preview',style},location.origin);
  }));
  host.querySelectorAll('iframe').forEach(el=>el.addEventListener('load',()=>refresh()));
  async function refresh(){
    clearTimeout(timer);if(disposed)return;let active=false;
    try{const s=await api.getReplayStage();active=!!s.active||!!s.pending||s.capture?.status==='saving';paint(s);}catch{}
    if(!disposed)timer=setTimeout(refresh,active?500:4000);
  }
  refresh();return()=>{disposed=true;clearTimeout(timer);};
}
