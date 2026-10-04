// Presentation-only operating dialogs. Playback and settings stay with feature owners.
import { api } from '../api.js';
import { state } from '../state.js';
import { feature, icon, TOOLS } from '../catalog.js';
import { esc } from '../utils.js';
import { runWithFeedback } from '../action-feedback.js';
import { activityText } from './desk-view.js';
import { playbackPresentation } from './desk-playback.js';
const PANELS={scenes:['Scenes','scene','scenes','scene_voice_switcher','Scene controls'],clips:['Clips & replays','replay','clips','instant_replay','Replay studio'],music:['Music','music','songs','specific_song','Music library & controls'],sounds:['Sounds & effects','soundboard','sounds','soundboard','Soundboard controls'],waiting:['Starting Soon','spark','playlists','starting_soon','Starting Soon controls'],automation:['Alerts & overlays','automation'],workflows:['Workflows','desk']};
async function request(path,body){const r=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok||data.ok===false||data.error)throw Error(data.error||data.message||'Request failed');return data;}
export function mountDeskControls(root,refresh,getPauses=()=>({})){
  let disposed=false,generation=0,panel='',project='',source='soundboard',opener=null,rows=[],limit=30,loading=false,transportKey='';
  const dialog=document.createElement('dialog');dialog.className='desk-dialog';dialog.setAttribute('aria-labelledby','deskPanelTitle');
  dialog.innerHTML=`<header class="desk-picker-header"><span id="deskPanelIcon"></span><h2 id="deskPanelTitle"></h2><button class="btn btn-quiet" id="deskPanelClose" aria-label="Close controls">Close ×</button></header><div class="desk-picker-main"><div id="deskPanelOptions"></div><label class="library-search" id="deskPanelSearchLabel">${icon('search')}<input id="deskPanelSearch" type="search" aria-label="Find in these controls" autocomplete="off"></label><div class="desk-results-heading"><span id="deskResultCount" role="status"></span><span id="deskConnection"></span></div><div class="desk-panel-results" id="deskPanelResults"></div><button class="btn btn-secondary" id="deskMore" hidden>Show more</button></div><div id="deskPanelTransport" class="desk-panel-transport" hidden></div><footer class="desk-picker-footer"><span id="deskPanelFeedback" role="status" aria-live="polite"></span><a class="desk-text-link" id="deskPanelDetail"></a></footer>`;
  document.body.append(dialog);const find=id=>dialog.querySelector('#'+id),search=find('deskPanelSearch'),results=find('deskPanelResults');
  find('deskPanelClose').onclick=()=>dialog.close();dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dialog.close();}});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}if(e.target.closest('a[href^="#"]'))dialog.close();});
  dialog.addEventListener('close',()=>{generation++;opener?.focus();});search.oninput=()=>{limit=30;renderRows();};find('deskMore').onclick=()=>{limit+=30;renderRows();};
  function bind(button,fn,message){const token=generation;button.onclick=async()=>{const result=await runWithFeedback(button,fn,message);if(disposed)return;if(token===generation&&result!==undefined)find('deskPanelFeedback').textContent=message;refresh();update();};}
  function renderTransport(){
    const p=state.get('projects').find(p=>p.name===project),host=find('deskPanelTransport');
    host.hidden=!p?.is_active||['scenes','automation','workflows'].includes(panel);
    if(host.hidden)return;
    const presentation=playbackPresentation(p,getPauses());
    const actions=panel==='waiting'?presentation.controls.filter(c=>c.key==='finish'):presentation.controls;
    if(transportKey!==project||!host.children.length) {
      transportKey=project;
      host.innerHTML='<span class="desk-playback-status"><i></i><span id="deskPanelActivity"></span></span><div></div>';
    }
    const group=host.querySelector('div'),existing=[...group.children],target=project;
    actions.forEach((action,index)=>{
      let b=existing[index];
      if(!b) {b=document.createElement('button');b.className='btn btn-secondary';b.dataset.controlProject=target;group.append(b);bind(b,()=>api.runProjectAction(target,b.dataset.action),`Playback control requested · ${feature(target).label}`);}
      b.dataset.canRun=String(action.enabled);
      if(!b.hasAttribute('aria-busy')) {b.dataset.action=action.key;b.textContent=action.label;b.title=action.enabled?'':presentation.status;}
    });
    existing.slice(actions.length).forEach(b=>b.remove());
    find('deskPanelActivity').textContent=(presentation.paused?presentation.status+' · ':'')+activityText(p.current_activity||'Active');
  }
  function update(){
    if(disposed||!dialog.open)return;renderTransport();const connected=state.get('connected'),projects=state.get('projects');
    dialog.querySelectorAll('[data-control-project]').forEach(b=>{const p=projects.find(p=>p.name===b.dataset.controlProject),available=connected&&!!p&&b.dataset.canRun!=='false'&&(!b.dataset.action||p.actions?.some(a=>a.key===b.dataset.action));b.dataset.available=String(available);if(!b.hasAttribute('aria-busy'))b.disabled=!available;});
    dialog.querySelectorAll('[data-workflow]').forEach(b=>{b.dataset.available=String(connected);if(!b.hasAttribute('aria-busy'))b.disabled=!connected;});
    find('deskConnection').textContent=!connected?'Hub disconnected':project&&!projects.some(p=>p.name===project)?'Feature unavailable':'';
    dialog.querySelectorAll('[data-feature-status]').forEach(el=>{const p=projects.find(p=>p.name===el.dataset.featureStatus);el.textContent=!connected?'Status unavailable':!p?'Unavailable':p.is_paused?'Paused':p.is_active?activityText(p.current_activity||'Active'):'Ready';});
    dialog.querySelectorAll('[data-feature-control]').forEach(button => {
      const p=projects.find(p=>p.name===button.dataset.featureControl);
      const control=p ? playbackPresentation(p,getPauses()).controls.find(c=>['pause','resume'].includes(c.key)) : null;
      button.hidden=!control;
      button.dataset.available=String(connected && !!control?.enabled);
      if(!button.hasAttribute('aria-busy') && control) {
        button.textContent=control.label;
        button.dataset.action=control.key;
        button.disabled=!connected || !control.enabled;
        button.setAttribute('aria-label', `${control.label} ${feature(p.name).label}`);
        button.title=control.enabled?'':playbackPresentation(p,getPauses()).status;
      }
    });
  }
  function renderRows(){
    if(loading)return;const query=search.value.trim().toLowerCase(),matched=rows.filter(r=>`${r.label} ${r.detail||''} ${r.keywords||''}`.toLowerCase().includes(query)),shown=matched.slice(0,limit);
    find('deskResultCount').textContent=`${matched.length} ${PANELS[panel]?.[2]||'workflows'}`;
    results.innerHTML=shown.length?shown.map((r,i)=>`<div class="desk-choice">${icon(r.icon||PANELS[panel][1])}<div><strong>${esc(r.label)}</strong>${r.detail?`<small>${esc(r.detail)}</small>`:''}</div><button class="btn btn-primary" data-row="${i}" ${r.project?`data-control-project="${esc(r.project)}"`:'data-workflow="true"'}>${esc(r.verb||'Play')}</button></div>`).join(''):`<div class="desk-picker-empty"><strong>${query?'No matches':`No ${PANELS[panel]?.[2]||'saved workflows'} yet`}</strong>${query?'<button class="btn btn-secondary" id="deskClearSearch">Clear search</button>':''}</div>`;
    results.querySelectorAll('[data-row]').forEach(b=>{const row=shown[Number(b.dataset.row)];bind(b,row.run,`${row.verb||'Play'} requested · ${row.label}`);});const clear=find('deskClearSearch');if(clear)clear.onclick=()=>{search.value='';renderRows();search.focus();};find('deskMore').hidden=matched.length<=limit;find('deskMore').textContent=`Show more (${Math.max(0,matched.length-limit)})`;update();
  }
  async function loadList(token){
    loading=true;rows=[];find('deskMore').hidden=true;results.innerHTML='<div class="desk-picker-empty">Loading…</div>';find('deskResultCount').textContent='Loading…';const selectedSource=source,selectedPanel=panel,target=project;
    try{
      let next=[];
      if(selectedPanel==='scenes'){const data=await api.getLobbies();next=[...(data.game_scene?[{label:'Gameplay',detail:data.game_scene,project:target,verb:'Show',run:()=>api.switchScene(data.game_scene)}]:[]),{label:'Another lobby',detail:'Choose another world from your rotation',project:target,verb:'Enter',run:()=>api.selectLobby()},...(data.lobbies||[]).map(name=>{const world=(data.locations||[]).find(l=>l.source===name);return {label:world?.label||name.replace(/([a-z])([A-Z])/g,'$1 $2'),detail:[name===data.current_lobby?'On screen':world?.description,world?.rotation===false?'Outside automatic rotation':''].filter(Boolean).join(' · '),project:target,verb:'Enter',run:()=>api.selectLobby(name)};})];}
      if(selectedPanel==='clips'){const data=await api.getReplayClips();next=(data.clips||[]).filter(c=>c.valid!==false).map(c=>({label:c.title||c.name||c.path.split(/[\\/]/).pop(),detail:[c.game,c.tag].filter(Boolean).join(' · '),project:target,verb:'Show clip',run:()=>api.playReplayClip(c.path,find('deskReplayMode').value)}));}
      if(selectedPanel==='music'){const data=await api.getSongLibrary();next=data.map(s=>({label:s.name||s.source,keywords:(s.aliases||[]).join(' '),project:target,run:()=>api.playSong(s.source)}));}
      if(selectedPanel==='sounds'){const data=selectedSource==='soundboard'?await request('/api/projects/soundboard/assets'):await api.getSfxLibrary();next=data.map(s=>({label:typeof s==='string'?s:s.name||s.source,project:selectedSource,run:()=>selectedSource==='soundboard'?request('/api/projects/soundboard/play-asset',{source:s.source}):api.playSfx(s)}));}
      if(selectedPanel==='waiting'){const data=await request('/api/starting-soon');next=(data.playlists||[]).filter(p=>p.paths?.length).map(p=>({label:p.name,detail:`${p.paths.length} clips`,project:target,verb:'Show playlist',run:async()=>{await request('/api/starting-soon/start',{});return request('/api/starting-soon/play',{paths:p.paths});}}));}
      if(selectedPanel==='workflows'){const data=await api.getHubActions();next=(data.workflows||[]).filter(w=>w.id&&w.steps?.length).map(w=>({label:w.name,detail:`${w.steps.length} steps`,verb:'Run',run:()=>api.runWorkflow(w.id)}));}
      if(disposed||token!==generation||!dialog.open)return;loading=false;rows=next;renderRows();
    }catch(e){if(disposed||token!==generation||!dialog.open)return;loading=false;find('deskResultCount').textContent='Library unavailable';results.innerHTML=`<div class="desk-picker-empty"><strong>Couldn’t load ${PANELS[panel][2]||'workflows'}</strong><span>${esc(e.message)}</span><button class="btn btn-secondary" id="deskRetry">Retry</button></div>`;find('deskRetry').onclick=()=>loadList(++generation);}
  }
  function open(id,button){
    const config=PANELS[id];if(!config)return;panel=id;project=config[3]||'';source='soundboard';opener=button;const token=++generation;rows=[];limit=30;loading=false;transportKey='';search.value='';results.innerHTML='';find('deskPanelOptions').innerHTML='';find('deskPanelTransport').innerHTML='';find('deskPanelTransport').hidden=true;
    find('deskPanelTitle').textContent=config[0];find('deskPanelIcon').innerHTML=icon(config[1]);search.placeholder=`Search ${config[2]||''}`;find('deskPanelSearchLabel').hidden=!config[2];find('deskMore').hidden=true;find('deskPanelFeedback').textContent='';
    const detail=find('deskPanelDetail');detail.href=project?feature(project).href:id==='workflows'?'#settings':'#library';detail.innerHTML=`${esc(config[4]||(id==='workflows'?'Manage workflows':'All controls'))} ${icon('arrow')}`;
    if(id==='clips')find('deskPanelOptions').innerHTML='<label class="desk-picker-option">Layout<select id="deskReplayMode"><option value="showcase">Clip showcase</option><option value="replay">Instant replay</option></select></label>';
    if(id==='sounds'){find('deskPanelOptions').innerHTML='<div class="desk-filter-pills" role="group" aria-label="Sound library"><button data-source="soundboard" aria-pressed="true">Soundboard</button><button data-source="sound_effects" aria-pressed="false">Audio cues</button></div>';find('deskPanelOptions').querySelectorAll('button').forEach(b=>b.onclick=()=>{source=b.dataset.source;project=source;search.value='';limit=30;find('deskPanelFeedback').textContent='';find('deskPanelOptions').querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===b)));detail.href=feature(source).href;detail.innerHTML=`${source==='soundboard'?'Soundboard controls':'Audio cue controls'} ${icon('arrow')}`;update();loadList(++generation);});}
    if(!dialog.open)dialog.showModal();(config[2]?search:find('deskPanelClose')).focus();
    if(id==='automation') {
      const names=['league','league_api','league_stats','twitch_celebrations','spotify','love_me','tik_tok'];
      const items=names.map(feature).concat(TOOLS.filter(t=>['chat','rewards','transitions'].includes(t.id)));
      find('deskResultCount').textContent=`${items.length} features`;
      results.innerHTML=items.map(f=>`<div class="desk-choice desk-feature-row">${icon(f.icon)}<div><strong>${esc(f.label)}</strong><small ${names.includes(f.id)?`data-feature-status="${esc(f.id)}"`:''}>${esc(f.description||'')}</small></div>${names.includes(f.id)?`<button class="btn btn-secondary" data-feature-control="${esc(f.id)}" hidden></button>`:''}<a class="desk-text-link" href="${esc(f.href)}" aria-label="${esc(f.label)} controls" ${f.href.startsWith('#')?'':'target="_blank" rel="noopener"'}>Controls ${icon('arrow')}</a></div>`).join('');
      results.querySelectorAll('[data-feature-control]').forEach(b=>bind(b,()=>api.runProjectAction(b.dataset.featureControl,b.dataset.action),`Control requested · ${feature(b.dataset.featureControl).label}`));
    }else loadList(token);update();
  }
  const click=e=>{const b=e.target.closest('[data-desk-panel]');if(b&&root.contains(b))open(b.dataset.deskPanel,b);};root.addEventListener('click',click);const unwatch=[state.watch('projects',update),state.watch('connected',update)];
  return {update,dispose(){disposed=true;generation++;unwatch.forEach(fn=>fn());root.removeEventListener('click',click);dialog.remove();}};
}
