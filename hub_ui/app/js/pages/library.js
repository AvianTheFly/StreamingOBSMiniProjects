// Guided discovery composes public read-only status and existing operating dialogs.
import { api } from '../api.js';
import { state } from '../state.js';
import { feature, icon } from '../catalog.js';
import { esc } from '../utils.js';
import { mountDeskControls } from './desk-controls.js';
import { AREAS, IDEAS, TOUR, ideaById, areaById, behaviorHref } from '../discovery/catalog.js';
import { illustration } from '../discovery/art.js';

let dispose=null;
export function unmount(){dispose?.();dispose=null;}
export function mount(root,params=new URLSearchParams()){
  unmount();let stopped=false,timer,coordination=null,coordinationKnown=false,inFlight=false,dialogToken=0,tourIndex=null,opener=null;
  const initial=ideaById(params.get('idea')),area=areaById(params.get('area')||initial?.area),query=params.get('q')||'';
  const areaHref=id=>'#library?'+new URLSearchParams({area:id});
  const links=item=>item.href||feature(item.owner).href;
  const external=href=>!href.startsWith('#')?'target="_blank" rel="noopener"':'';
  root.innerHTML=`<section class="guide-page">
    <header class="guide-header"><div><p class="desk-eyebrow">Your personal stream guide</p><h1>${area?esc(area.title):'Your stream'}</h1><p>${area?esc(area.hint):'Find something to show, understand what happens, and make it yours.'}</p></div><a class="btn btn-secondary" href="#dashboard">${icon('desk')}Live controls ${icon('arrow')}</a></header>
    <section class="guide-now" aria-label="What is happening now"><div><span class="guide-small-label">On screen in OBS</span><strong id="guideScene">Checking…</strong><span id="guideStream"></span></div><div><span class="guide-small-label">Hub activity</span><strong id="guideActivity">Checking…</strong><span id="guideOwnership"></span></div><a href="#dashboard">See current controls ${icon('arrow')}</a></section>
    <div class="guide-browse-bar"><nav aria-label="Guide breadcrumbs"><a href="#library">Your stream</a>${area?`<span>›</span><span>${esc(area.title)}</span>`:''}</nav><label class="library-search">${icon('search')}<input type="search" id="libraryQuery" aria-label="Search your stream" placeholder="Try ‘replay’, ‘raid’, ‘music’ or a feature name…" value="${esc(query)}"></label></div>
    <div id="guideBrowse">${area?`<p class="guide-section-intro">Choose an idea to see what viewers get and how to use it. Nothing plays just by exploring.</p><div class="guide-ideas">${area.ideas.map(item=>ideaTile({...item,color:area.color})).join('')}</div>`:`<div class="guide-start"><div><h2>What would you like to do?</h2><p>You don’t need to know the module names. Start with the part of your stream you want to change.</p></div><button class="btn btn-primary" data-tour>Show me three things to try ${icon('arrow')}</button></div><div class="guide-areas">${AREAS.map(a=>`<a class="guide-area" href="${areaHref(a.id)}" style="--guide-color:${a.color}">${illustration(a.art,a.color)}<div><h2>${esc(a.title)} ${icon('arrow')}</h2><p>${esc(a.hint)}</p><small>${esc(a.examples)}</small></div></a>`).join('')}</div><section class="guide-automatic"><header><div><h2>What happens on its own?</h2><p>These are possible reactions when their features are enabled. Open a situation to see conditions and overlap.</p></div><a href="#workflows">Whole stream map ${icon('arrow')}</a></header><div>${[['kills','You get a kill','Alerts · replay anchors · match stats'],['after','A match ends','Result timing · lobby return · saved moments'],['viewers','Viewers interact','Chat replies · rewards · celebrations']].map(([id,title,sub])=>`<a href="#workflows?area=${id}"><span>${icon('automation')}</span><strong>${title}</strong><small>${sub}</small>${icon('arrow')}</a>`).join('')}</div></section>`}</div>
    <div id="libraryResults" hidden aria-live="polite"></div><div id="guideExtra"></div>
    <footer class="guide-footer"><span>Want the technical view?</span><a href="#workflows">Understand connections</a><a href="#profiles">Your saved keys</a><a href="#settings">Hub setup</a></footer>
    <dialog class="guide-dialog" aria-labelledby="guideIdeaTitle"><header><button class="btn btn-quiet" data-guide-close aria-label="Close idea">Close ×</button><span id="guideTourStep"></span></header><div id="guideIdeaBody"></div></dialog>
  </section>`;
  const $=s=>root.querySelector(s),dialog=$('.guide-dialog'),search=$('#libraryQuery');
  const controls=mountDeskControls(root,()=>refresh(),()=>coordination?.pauses||{});
  function status(owner){const p=state.getProject(owner);return !state.get('connected')?'Status unavailable':!p?['chat','transitions','rewards','editor','keyboard','voice','hub','audio','lobby_screens','footage_desk'].includes(owner)?'Check in its workspace':'Not loaded':p.current_activity?.startsWith('error:')?'Needs attention':p.is_paused?'Paused':p.is_active?'Active in Hub':'Controls loaded';}
  function update(){
    if(stopped)return;const connected=state.get('connected'),projects=state.get('projects'),active=projects.filter(p=>p.is_active);
    $('#guideScene').textContent=connected&&coordinationKnown?(coordination.scenes?.observing?coordination.scenes.scene||'No scene reported':'OBS unavailable'):connected?'Checking OBS…':'Hub disconnected';
    $('#guideStream').textContent=connected&&coordinationKnown?(coordination.stream?.active===true?'Streaming now':coordination.stream?.active===false?'Not streaming':'Stream status unavailable'):'Scene and stream status unavailable';
    $('#guideActivity').textContent=!connected?'Activity unavailable':active.length?active.slice(0,2).map(p=>feature(p.name).label).join(' + ')+(active.length>2?` + ${active.length-2} more`:''):'Nothing playing in the Hub';
    $('#guideOwnership').textContent=!connected?'Reconnect to use live controls':coordinationKnown&&coordination.scenes?.temporary_owner?`${feature(coordination.scenes.temporary_owner).label} holds the screen`:coordinationKnown&&!coordination.scenes?.observing?'OBS ownership unavailable':`${projects.length} feature controls loaded · automatic reactions have their own enable switches`;
    root.querySelectorAll('[data-guide-status]').forEach(el=>{el.textContent=status(el.dataset.guideStatus);});
    renderSearch();
    const represented=new Set(IDEAS.flatMap(i=>[i.owner,...i.also||[]])),extra=projects.filter(p=>!represented.has(p.name));
    $('#guideExtra').innerHTML=extra.length?`<details class="guide-more"><summary>${extra.length} additional feature controls</summary>${extra.map(p=>`<a class="library-tile" href="${esc(feature(p.name).href)}">${esc(feature(p.name).label)} · ${esc(status(p.name))}</a>`).join('')}</details>`:'';
    controls.update();
  }
  function renderSearch(){
    const text=search.value.trim().toLowerCase(),host=$('#libraryResults');host.hidden=!text;$('#guideBrowse').hidden=!!text;
    if(!text)return;
    const matches=IDEAS.filter(i=>`${i.title} ${i.look} ${i.trigger} ${feature(i.owner).label}`.toLowerCase().includes(text));
    const ids=new Set(IDEAS.flatMap(i=>[i.owner,...i.also||[]]));
    const extras=state.get('projects').filter(p=>!ids.has(p.name)&&`${p.name} ${feature(p.name).label}`.toLowerCase().includes(text));
    const signature=text+'|'+matches.map(i=>i.id).join(',')+'|'+extras.map(p=>p.name).join(',');
    if(host.dataset.signature!==signature){host.dataset.signature=signature;host.innerHTML=`<h2>${matches.length+extras.length} ideas & controls found</h2><div class="guide-ideas">${matches.map(ideaTile).join('')}${extras.map(p=>`<a class="library-tile" href="${esc(feature(p.name).href)}"><h3>${esc(feature(p.name).label)}</h3><p>${esc(feature(p.name).description)}</p>Open controls ${icon('arrow')}</a>`).join('')}</div>${matches.length+extras.length?'':'<p class="desk-empty">Try the outcome you want, such as music, chat or a clip.</p>'}`;}
    host.querySelectorAll('[data-guide-status]').forEach(el=>el.textContent=status(el.dataset.guideStatus));
  }
  function showIdea(id,tour=false){
    const item=ideaById(id);if(!item)return;const token=++dialogToken,href=links(item);
    $('#guideTourStep').textContent=tour?`${tourIndex+1} of ${TOUR.length} · A few things you can try`:areaById(item.area).title;
    $('#guideIdeaBody').innerHTML=`${illustration(item.art,item.color)}<p class="guide-preview-label">Illustration of the idea · your saved presentation may differ</p><div class="guide-dialog-copy"><p class="desk-eyebrow">${item.automatic?'Automatic reaction':'Something you can choose'}</p><h2 id="guideIdeaTitle">${esc(item.title)}</h2><span class="guide-availability" data-guide-status="${esc(item.owner)}">${esc(status(item.owner))}</span><h3>What viewers get</h3><p>${esc(item.look)}</p><div class="guide-story"><div><span>Starts with</span><p>${esc(item.trigger)}</p></div>${icon('arrow')}<div><span>Your next step</span><p>${esc(item.next)}</p></div></div><p class="guide-live-note">Exploring this guide does not change your stream. Playback and scene controls below operate OBS when you choose an item.</p><div class="guide-idea-actions">${item.preview?`<a class="btn btn-secondary" href="${esc(item.preview)}" ${external(item.preview)}>${esc(item.previewLabel)} ${icon('arrow')}</a>`:''}${item.panel?`<button class="btn btn-primary" data-desk-panel="${item.panel}">${esc(item.verb)}</button>`:`<a class="btn btn-primary" href="${esc(href)}" ${external(href)}>Open ${esc(feature(item.owner).label)} controls ${icon('arrow')}</a>`}</div><div class="guide-deeper"><a href="${esc(behaviorHref(item))}">Understand what happens ${icon('arrow')}</a><a href="${esc(href)}" ${external(href)}>Full controls & setup ${icon('arrow')}</a></div>${['soundboard','specific_song','tik_tok','keyboard'].includes(item.owner)?'<button class="btn btn-quiet" data-guide-bindings>See my saved keys</button><div id="guideBindings" role="status"></div>':''}${tour?`<div class="guide-tour-controls">${tourIndex?'<button class="btn btn-secondary" data-tour-back>Previous idea</button>':''}<button class="btn btn-primary" data-tour-next>${tourIndex===TOUR.length-1?'Finish tour':'Next idea'} ${icon('arrow')}</button></div>`:''}</div>`;
    dialog.dataset.idea=id;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
    dialog.querySelector('[data-guide-close]').focus({preventScroll:true});
    api.getWorkflowMap().then(c=>{if(stopped||token!==dialogToken||!dialog.open)return;const f=c.flows.find(f=>f.id===item.flow);if(!f)return;const gates=f.steps.filter(s=>s.setting);if(gates.length){const el=document.createElement('p');el.className='guide-config-note';el.textContent='Configured conditions: '+gates.map(s=>`${s.label}: ${s.configured===null?'unavailable':String(s.configured)}`).join(' · ');dialog.querySelector('.guide-deeper').before(el);}if(f.verification==='review'){const el=document.createElement('p');el.className='guide-config-note';el.textContent='The detailed behavior map flags source changes that still need review.';dialog.querySelector('.guide-deeper').before(el);}}).catch(()=>{});
  }
  async function bindings(){
    const token=dialogToken,item=ideaById(dialog.dataset.idea),host=$('#guideBindings');if(!host)return;host.textContent='Reading saved keys…';
    try{const data=await api.getEditorProfiles();if(stopped||token!==dialogToken||!dialog.open)return;const projects=(data.projects||[]).filter(p=>item.owner==='keyboard'||p.key===item.owner);const rows=projects.flatMap(p=>(p.profiles||[]).filter(profile=>profile.live).flatMap(profile=>Object.entries(profile.hotkey_map||{}).map(([key,value])=>({project:p.name,key,value}))));host.innerHTML=rows.length?`<p>${rows.length} saved bindings in the reported live profiles. Showing up to six; the editor contains all bindings.</p><dl>${rows.slice(0,6).map(r=>`<div><dt><kbd>${esc(r.key)}</kbd></dt><dd>${esc(Array.isArray(r.value)?r.value.join(' / '):r.value)}<small>${esc(r.project)}</small></dd></div>`).join('')}</dl><a href="#profiles">Inspect all saved keys →</a>`:'<p>No bindings reported for a live profile. Check the editor or Profiles for saved setup.</p>';}catch(e){if(!stopped&&token===dialogToken)host.textContent=`Could not read keys: ${e.message}`;}
  }
  const click=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.guideIdea){opener=b;tourIndex=null;showIdea(b.dataset.guideIdea);}if(b.hasAttribute('data-guide-close'))dialog.close();if(b.hasAttribute('data-tour')){opener=b;tourIndex=0;showIdea(TOUR[0],true);}if(b.hasAttribute('data-tour-next')){if(tourIndex===TOUR.length-1)dialog.close();else showIdea(TOUR[++tourIndex],true);}if(b.hasAttribute('data-tour-back'))showIdea(TOUR[--tourIndex],true);if(b.hasAttribute('data-guide-bindings'))bindings();};root.addEventListener('click',click);
  dialog.addEventListener('close',()=>{dialogToken++;opener?.focus();});
  search.addEventListener('input',renderSearch);
  async function refresh(){if(stopped||inFlight)return;clearTimeout(timer);if(document.hidden){timer=setTimeout(refresh,4000);return;}inFlight=true;try{const d=await api.getCoordination();if(!stopped){coordination=d;coordinationKnown=true;}}catch{if(!stopped)coordinationKnown=false;}finally{inFlight=false;if(!stopped){update();timer=setTimeout(refresh,4000);}}}
  const watchers=[state.watch('projects',update),state.watch('connected',update)];update();refresh();
  if(initial)showIdea(initial.id);
  dispose=()=>{stopped=true;dialogToken++;clearTimeout(timer);watchers.forEach(fn=>fn());controls.dispose();root.removeEventListener('click',click);if(dialog.open)dialog.close();};
}
function ideaTile(item){return `<button class="guide-idea library-tile" data-guide-idea="${esc(item.id)}" style="--guide-color:${item.color||'#98d8c3'}">${illustration(item.art,item.color)}<span class="guide-idea-type">${item.automatic?'Automatic reaction':'Choose & try'}</span><h3>${esc(item.title)}</h3><p>${esc(item.look)}</p><span class="guide-tile-bottom"><span data-guide-status="${esc(item.owner)}"></span><span>Explore ${icon('arrow')}</span></span></button>`;}
