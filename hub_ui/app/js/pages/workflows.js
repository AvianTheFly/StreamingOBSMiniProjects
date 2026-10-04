import { api } from '../api.js';
import { esc } from '../utils.js';
import { icon, FEATURES, TOOLS } from '../catalog.js';
import { enrich, label, branches, wiring, liveModel } from '../workflow/model.js';
import { atlas, entry, pathTo, pathForFlow, areaOf, flowsFor, flowTitle, participantLabel } from '../workflow/atlas.js';
import { situation, RESOURCES, STATES, explainEffect, observedResource, relevantRecords } from '../workflow/behavior.js';
import { StreamMap } from '../workflow/map.js';
import { Graph } from '../workflow/graph.js';
import { recordList, recordKey, traceDetails, time } from '../workflow/timeline.js';

let active=null, generation=0;
export function unmount(){generation++;if(active){active.abort.abort();clearTimeout(active.timer);clearTimeout(active.searchTimer);active.graph?.dispose();active.map?.dispose();active.resize?.disconnect();active=null;}}
export async function mount(container){
  unmount();const run=generation;
  const view={container,abort:new AbortController(),mode:'explore',path:[],selection:null,catalog:null,live:null,records:[],next:null,frozen:false,filter:'',historyQuery:'',period:3600,historyRequest:0,resource:'all',example:'now',areaConnections:false,scopes:new Map()};active=view;
  container.innerHTML=`<section class="wf-page">
    <header class="wf-heading"><div><p class="wf-eyebrow">Understand your stream</p><h1>Stream map</h1></div><span class="wf-sync" role="status">Loading map…</span><div class="wf-review" hidden></div></header>
    <div class="wf-modebar"><div class="wf-modes" role="tablist" aria-label="Workflow view"><button role="tab" aria-selected="true" data-mode="explore">${icon('library')}Map</button><button role="tab" aria-selected="false" data-mode="live">${icon('play')}Live</button><button role="tab" aria-selected="false" data-mode="history">${icon('replay')}History</button></div><div class="wf-map-search"><label class="wf-search">${icon('search')}<input type="search" placeholder="Find something in your stream…" aria-label="Search stream map"></label><div class="wf-search-results" hidden></div></div><button class="btn btn-quiet wf-freeze" data-freeze hidden>Freeze view</button><span class="wf-recording"></span></div>
    <div class="wf-workspace wf-wide">
      <section class="wf-stage"><div class="wf-stagebar"><nav class="wf-location" aria-label="Map breadcrumbs"><button class="btn btn-quiet" data-back aria-label="Back one map level" hidden>←</button><button class="btn btn-quiet" data-overview>Whole stream</button><span class="wf-breadcrumbs"></span><span class="wf-location-title" hidden></span></nav><div class="wf-camera"><button title="Zoom out" aria-label="Zoom out" data-zoom="out">−</button><output class="wf-scale">100%</output><button title="Zoom in" aria-label="Zoom in" data-zoom="in">+</button><button data-fit>Fit</button><button data-details hidden>Exact steps</button></div></div>
        <div class="wf-map-caption"><div><h2></h2><p></p></div><span class="wf-map-depth"></span></div>
        <div class="wf-behavior-tools" hidden></div><div class="wf-map-canvas"></div><div class="wf-diagram" hidden></div><div class="wf-history" hidden><div class="wf-history-controls"><label>Show<select class="wf-period"><option value="900">Last 15 minutes</option><option value="3600" selected>Last hour</option><option value="86400">Last day</option><option value="1209600">Last 14 days</option></select></label><label class="wf-search">${icon('search')}<input class="wf-history-search" type="search" placeholder="Find event or module" aria-label="Search history"></label><button class="btn btn-secondary" data-refresh>Refresh</button></div><div class="wf-history-list"></div><button class="btn btn-secondary wf-more" data-more hidden>Load earlier</button></div>
        <div class="wf-legend"></div>
      </section><aside class="wf-inspector" hidden aria-label="Selected behavior"><button class="wf-close" data-close aria-label="Close details">×</button><div class="wf-detail"></div></aside>
    </div><section class="wf-recent" hidden><header><span>Recent observations</span><button class="btn btn-quiet" data-mode="history">Open history ${icon('arrow')}</button></header><div class="wf-recent-list"></div></section>
  </section>`;
  const $=selector=>container.querySelector(selector);view.$=$;
  view.graph=new Graph($('.wf-diagram'),node=>selectNode(view,node),scale=>{$('.wf-scale').textContent=`${Math.round(scale*100)}%`;});
  view.map=new StreamMap($('.wf-map-canvas'),node=>openMapNode(view,node),edge=>inspectConnection(view,edge),scale=>{$('.wf-scale').textContent=`${Math.round(scale*100)}%`;});
  view.mobile=container.clientWidth<600;
  view.resize=new ResizeObserver(()=>{const mobile=container.clientWidth<600;if(mobile!==view.mobile){view.mobile=mobile;draw(view);} });view.resize.observe(container);
  const options={signal:view.abort.signal};
  container.addEventListener('click',async e=>{
    if(!e.target.closest('.wf-map-search'))$('.wf-search-results').hidden=true;
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.resource){view.resource=b.dataset.resource;view.areaConnections=false;rememberScope(view);closeDetails(view);draw(view);$(`[data-resource="${view.resource}"]`)?.focus({preventScroll:true});return;}
    if(b.dataset.example){view.example=b.dataset.example;rememberScope(view);closeDetails(view);draw(view);$(`[data-example="${view.example}"]`)?.focus({preventScroll:true});return;}
    if(b.hasAttribute('data-area-connections')){view.areaConnections=!view.areaConnections;rememberScope(view);closeDetails(view);draw(view);$('[data-area-connections]')?.focus({preventScroll:true});return;}
    if(b.dataset.resourceHistory){view.mode='history';view.historyQuery=b.dataset.resourceHistory;$('.wf-history-search').value=view.historyQuery;closeDetails(view);renderMode(view);await loadHistory(view);return;}
    if(b.dataset.mode){if(view.mode==='explore')view.exploreSelection=view.selection;view.mode=b.dataset.mode;view.selection=view.mode==='explore'?view.exploreSelection||null:null;closeDetails(view);renderMode(view);if(view.mode==='history')await loadHistory(view);return;}
    if(b.hasAttribute('data-overview')){navigate(view,[]);return;}
    if(b.hasAttribute('data-back')){if(view.selection?.steps){view.selection.steps=false;renderMode(view);}else if(view.selection){navigate(view,view.path);}else navigate(view,view.path.slice(0,-1));return;}
    if(b.dataset.map){navigate(view,pathTo(b.dataset.map));return;}
    if(b.dataset.topic){const flow=view.catalog.flows.find(f=>f.topic===b.dataset.topic);if(flow)navigate(view,pathForFlow(view.catalog,flow));return;}
    if(b.dataset.module){const area=areaOf(b.dataset.module);navigate(view,area?[area.id]:[],{module:b.dataset.module});return;}
    if(b.dataset.event){view.mode='explore';view.selection={event:b.dataset.event};renderMode(view);closeDetails(view);return;}
    if(b.dataset.flow){const flow=view.catalog.flows.find(f=>f.id===b.dataset.flow);if(flow)navigate(view,pathForFlow(view.catalog,flow),{flow:flow.id});return;}
    if(b.dataset.zoom){camera(view).zoom(b.dataset.zoom==='in'?1.25:.8);return;}
    if(b.hasAttribute('data-fit')){camera(view).fit();return;}
    if(b.hasAttribute('data-details')){if(view.selection?.flow){view.selection.steps=!view.selection.steps;closeDetails(view);renderMode(view);}return;}
    if(b.hasAttribute('data-close')){closeDetails(view);return;}
    if(b.hasAttribute('data-freeze')){view.frozen=!view.frozen;b.textContent=view.frozen?'Resume view':'Freeze view';$('.wf-recording').textContent=view.frozen?'View frozen · recording continues':'';if(!view.frozen)poll(view);return;}
    if(b.hasAttribute('data-refresh')){await loadHistory(view);return;}
    if(b.hasAttribute('data-more')){await loadHistory(view,true);return;}
    if(b.dataset.record){const records=[...view.records,...(view.live?.recent||[])],record=records.find(r=>recordKey(r)===b.dataset.record);if(record){view.selectedRecord=record;showDetails(view,traceDetails(record,records,view.catalog));const matched=view.catalog.flows.filter(f=>f.trigger.event===record.event);if(matched.length)$('.wf-detail').insertAdjacentHTML('beforeend',`<h4>Related behavior</h4>${matched.map(f=>`<button class="wf-detail-link" data-flow="${esc(f.id)}">${esc(f.label)} ${icon('arrow')}</button>`).join('')}`);}return;}
    if(b.hasAttribute('data-snapshot')){view.selection={snapshot:view.selectedRecord};$('.wf-history').hidden=true;$('.wf-diagram').hidden=false;$('.wf-camera').hidden=false;$('.wf-location-title').hidden=false;$('.wf-location-title').textContent=`State at ${time(view.selectedRecord.time)}`;view.graph.render(liveModel(view.catalog,view.selectedRecord));closeDetails(view);return;}
    if(b.hasAttribute('data-review')){const flows=view.catalog.flows.filter(f=>f.verification==='review');showDetails(view,`<p class="wf-eyebrow">Source changed</p><h3>Explanations to review</h3><p class="wf-note">Wiring and current settings refresh automatically. These behavior descriptions need a code review before their badge becomes current again.</p>${flows.map(f=>`<button class="wf-detail-link" data-flow="${esc(f.id)}">${esc(f.label)}<small>${esc(label(view.catalog,f.owner))}</small></button>`).join('')}${view.catalog.issues.map(i=>`<p class="wf-note">${esc(i.path)}: ${esc(i.error)}</p>`).join('')}`);return;}
    if(b.dataset.proof!==undefined){const proof=view.selectedFlow?.proofs[Number(b.dataset.proof)];if(!proof)return;b.disabled=true;try{const data=await api.getWorkflowSource(proof.path,proof.symbol);if(active!==view)return;const pre=document.createElement('pre');pre.className='wf-source';pre.textContent=data.text || data.error || 'Source unavailable';b.replaceWith(pre);}catch(error){b.textContent=error.message;b.disabled=false;}return;}
  },options);
  $('.wf-map-search input').addEventListener('input',e=>{view.filter=e.target.value.toLowerCase();renderSearch(view);},options);
  $('.wf-period').addEventListener('change',e=>{view.period=Number(e.target.value);loadHistory(view);},options);
  $('.wf-history-search').addEventListener('input',e=>{view.historyQuery=e.target.value;clearTimeout(view.searchTimer);view.searchTimer=setTimeout(()=>loadHistory(view),300);},options);
  container.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('.wf-inspector').hidden){e.preventDefault();closeDetails(view);}$('.wf-search-results').hidden=true;}},options);
  try {const [catalog,live]=await Promise.all([api.getWorkflowMap(),api.getWorkflowLive()]);if(run!==generation)return;view.catalog=enrich(catalog);view.live=live;view.revision=catalog.revision;renderMode(view);renderStatus(view);}
  catch(error){if(active===view){$('.wf-sync').textContent='Map unavailable';$('.wf-map-canvas').innerHTML=`<div class="wf-empty">${esc(error.message)}. Refresh the page to retry.</div>`;}}
  if(active===view)view.timer=setTimeout(()=>poll(view),2000);
}
function camera(view){return view.mode==='explore'&&!view.selection?.steps&&!view.selection?.event?view.map.camera:view.graph.camera;}
function rememberScope(view){view.scopes.set(view.path.join('/'),{resource:view.resource,example:view.example,areaConnections:view.areaConnections});}
function navigate(view,path,selection=null){view.mode='explore';view.path=path;view.selection=selection;const scope=view.scopes.get(path.join('/'));view.resource=scope?.resource||'all';view.example=scope?.example||'now';view.areaConnections=scope?.areaConnections||false;view.$('.wf-search-results').hidden=true;view.$('.wf-map-search input').value='';view.filter='';closeDetails(view);renderMode(view);view.map.svg.focus({preventScroll:true});}
function renderSearch(view){
  if(!view.catalog)return;const {catalog,filter,$}=view,host=$('.wf-search-results');host.hidden=!filter.trim();if(host.hidden)return;
  const matches=catalog.flows.filter(f=>`${flowTitle(f)} ${f.label} ${f.topic} ${label(catalog,f.owner)} ${f.id}`.toLowerCase().includes(filter)).slice(0,8);
  host.innerHTML=matches.map(f=>`<button data-flow="${esc(f.id)}">${icon(catalog.modules.find(m=>m.id===f.owner)?.icon)}<span>${esc(flowTitle(f))}<small>${esc([...pathForFlow(catalog,f).map(id=>entry(id).title),label(catalog,f.owner)].join(' › '))}</small></span>${icon('arrow')}</button>`).join('')||'<p class="wf-note">No matches. Try a feature or event, such as replay or death.</p>';
}
function renderMode(view){
  if(!view.catalog)return;const {$,mode}=view;
  $('.wf-modes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===mode)));
  const mapped=mode==='explore'&&!view.selection?.steps&&!view.selection?.event;
  $('.wf-behavior-tools').hidden=true;
  $('.wf-map-canvas').hidden=!mapped;$('.wf-map-caption').hidden=!mapped;$('.wf-map-search').hidden=mode!=='explore';$('.wf-history').hidden=mode!=='history';$('.wf-diagram').hidden=mapped||mode==='history';$('.wf-camera').hidden=mode==='history';$('.wf-legend').hidden=mode==='history';$('.wf-freeze').hidden=mode!=='live';$('.wf-recent').hidden=mode!=='live';
  $('[data-details]').hidden=mode!=='explore'||!view.selection?.flow;$('[data-details]').textContent=view.selection?.steps?'Interaction map':'Exact steps';
  $('.wf-location-title').hidden=mode==='explore'&&!view.selection?.event;$('.wf-breadcrumbs').hidden=mode!=='explore'||!!view.selection?.event;$('[data-back]').hidden=mode!=='explore'||(!view.path.length&&!view.selection);
  if(mode==='history'){$('.wf-location-title').textContent='Recorded on this computer';}
  else draw(view);
  renderStatus(view);
}
function draw(view,fit=true){
  if(!view.catalog)return;const {catalog,selection,$}=view;let model,title='';
  if(view.mode==='live'){model=liveModel(catalog,view.live?.state||{});title='Observed now';}
  else if(selection?.event){model=wiring(catalog,selection.event,view.live?.subscriptions);title=selection.event;}
  else if(selection?.steps){const flows=catalog.flows.filter(f=>f.id===selection.flow);title=flowTitle(flows[0]);model=branches(catalog,flows,title);}
  else {
    const item=entry(view.path.at(-1)),collective=item&&!item.children.length&&!selection;
    if(collective){const flows=flowsFor(catalog,item);model=situation(catalog,item,flows,{resource:view.resource,state:view.example,mobile:view.mobile});view.situationFlows=flows;renderBehaviorTools(view,model);if(view.areaConnections)model=atlas(catalog,view.path,null,{mobile:view.mobile});}
    else {model=atlas(catalog,view.path,selection?.flow,{mobile:view.mobile,module:selection?.module});$('.wf-behavior-tools').hidden=true;}
    $('.wf-map-caption h2').textContent=model.title;$('.wf-map-caption p').textContent=model.description;
    $('.wf-map-depth').textContent=model.situation?'Behavior map':selection?.flow?'Interaction':view.path.length?`Level ${view.path.length+1}`:'Overview';
    $('.wf-breadcrumbs').innerHTML=view.path.map(id=>`<span>›</span><button data-map="${id}">${esc(entry(id).title)}</button>`).join('')+(selection?.flow?`<span>›</span><span class="wf-current-crumb">${esc(model.title)}</span>`:selection?.module?`<span>›</span><span class="wf-current-crumb">${esc(label(catalog,selection.module))}</span>`:'');
    $('.wf-legend').innerHTML=model.situation?'<span class="wf-map-help">Select a resource to inspect overlap</span><span>→ Intention / effect</span><span>┄ Timing influence or unclassified relationship</span><span>Color shows the assumed outcome, not measured execution</span>':model.flow?'<span class="wf-map-help">Select a participant or handoff</span><span>Exact steps reveals conditions & cleanup</span><span class="wf-gesture">Drag to pan · scroll to zoom</span>':model.root?'<span class="wf-map-help">Open an area to go deeper</span><span>━ Handoffs & signals</span><span>┄ Reactions to shared activity</span><span class="wf-gesture">Hover to follow connections · select a line to inspect</span>':'<span class="wf-map-help">Open a smaller map</span><span>┄ Contains these reactions</span><span>━ Connections beyond this area</span><span class="wf-gesture">Select a line to inspect · drag to pan</span>';
    view.map.render(model,fit);return;
  }
  $('.wf-legend').innerHTML='<span><i class="wf-key-action"></i>Action</span><span><i class="wf-key-gate"></i>Condition</span><span><i class="wf-key-wait"></i>Wait</span><span><i class="wf-key-output"></i>Output / release</span><span>→ Handoff / event</span><span>⇢ Control / observation</span>';
  $('.wf-location-title').textContent=title;view.graph.render(model,fit);
  if(selection?.steps)view.graph.details(true);
}
function renderBehaviorTools(view,model){
  const host=view.$('.wf-behavior-tools');host.hidden=false;
  const hasScene=model.resources.includes('scene');
  host.innerHTML=`<div class="wf-lenses" role="group" aria-label="Focus on an affected resource"><span>Focus</span><button data-resource="all" aria-pressed="${view.resource==='all'}">All effects</button>${model.resources.map(id=>`<button data-resource="${id}" aria-pressed="${view.resource===id}">${esc(RESOURCES[id].label)}</button>`).join('')}<button class="wf-area-toggle" data-area-connections aria-pressed="${view.areaConnections}">${view.areaConnections?'Behavior map':'Area connections'}</button></div>${hasScene&&!view.areaConnections?`<div class="wf-examples" role="group" aria-label="Illustrative state"><span>See when</span>${STATES.map(s=>`<button data-example="${s.id}" aria-pressed="${view.example===s.id}">${esc(s.label)}</button>`).join('')}</div><p class="wf-example-note">${view.example==='now'?'Possible reactions with observed ownership available on each resource. This is not a record of which branches ran.':'Policy example using current enable switches. Assumes enabled providers are running, fresh intent and other admission checks pass; it does not run anything.'}</p>`:'<p class="wf-example-note">Reviewed intentions have solid lines. Other relationships are grouped from described output owners and require deeper inspection.</p>'}`;
}
function renderStatus(view){
  const {$,catalog,live}=view;if(!catalog)return;
  const review=catalog.review_count+catalog.issues.length;
  $('.wf-sync').textContent=review?'Source checks need review':'Map follows code & settings';$('.wf-sync').hidden=!!review;
  $('.wf-review').hidden=!review;$('.wf-review').innerHTML=`<button data-review>${review} descriptions to review ${icon('arrow')}</button>`;
  $('.wf-recording').textContent=view.frozen?'View frozen · recording continues':live?.recording?`${live.storage==='local'?'Recording locally':'Recording in memory'} · up to ${live.retention_days} days${live.dropped?` · ${live.dropped} observations dropped`:''}`:'Recording stopped';
  if(view.mode==='live')$('.wf-recent-list').innerHTML=recordList((live?.recent||[]).slice(-6).reverse(),catalog,{compact:true});
}
function showDetails(view,html){view.focusBeforeDetail=document.activeElement;view.$('.wf-detail').innerHTML=html;view.$('.wf-inspector').hidden=false;view.$('.wf-close').focus({preventScroll:true});}
function closeDetails(view){if(!view.$('.wf-inspector').hidden&&view.focusBeforeDetail?.isConnected)view.focusBeforeDetail.focus({preventScroll:true});view.$('.wf-inspector').hidden=true;view.graph?.highlight(null);view.map?.highlight(null);}
function controlLink(catalog,owner){
  const href=FEATURES[owner]?.href||(FEATURES[owner]?`#projects/${owner}`:TOOLS.find(tool=>tool.id===owner)?.href)||({voice:'#voice',keyboard:'#profiles',hub:'#dashboard',coordination:'#rules',obs:'#mixer',settings_history:'#settings'})[owner];
  return href?`<a class="btn btn-secondary wf-open-controls" href="${esc(href)}">Open ${esc(label(catalog,owner))} controls ${icon('arrow')}</a>`:'';
}
function openMapNode(view,node){
  if(node.resource){inspectResource(view,node);return;}
  if(node.owner){selectNode(view,node);return;}
  if(node.flow&&!node.context){navigate(view,pathForFlow(view.catalog,node.flow),{flow:node.flow.id});return;}
  if(node.context){if(node.flow)selectNode(view,node);else showDetails(view,`<p class="wf-eyebrow">Inside this area</p><h3>${esc(node.label)}</h3><p>Open one of the connected maps to explore its reactions. Pale dotted lines show what this area contains. Select a solid connection to see the mapped handoff behind it.</p>`);return;}
  if(node.entry)navigate(view,pathTo(node.entry.id));
}
function inspectConnection(view,edge){
  if(edge.effect){inspectResource(view,view.map.model.nodes.find(n=>n.id===edge.to),edge.flow.id);return;}
  const distinct=[...new Map((edge.facts||[]).map(f=>[`${f.flow?.id||f.event}:${f.label}`,f])).values()];
  showDetails(view,`<p class="wf-eyebrow">Why these connect</p><h3>Signals & handoffs</h3><p class="wf-note">These are described connections, not a live execution order. Independent reactions can run at the same time.</p>${distinct.map(f=>f.flow?`<button class="wf-detail-link" data-flow="${esc(f.flow.id)}"><span>${esc(flowTitle(f.flow))}<small>${esc(participantLabel(view.catalog,f.from))} → ${esc(participantLabel(view.catalog,f.to))}<br>${f.kind==='scenario'?'Reacts to this activity · ':''}${esc(f.label)}</small></span>${icon('arrow')}</button>`:`<button class="wf-detail-link" data-event="${esc(f.event)}"><span>${esc(label(view.catalog,f.from))} → ${esc(label(view.catalog,f.to))}<small>${esc(f.event)} · source subscription</small></span>${icon('arrow')}</button>`).join('')}`);
}
function inspectResource(view,node,highlight){
  if(!node)return;const {catalog,live}=view,resource=RESOURCES[node.resource];
  const related=node.related||[],flows=related.map(x=>x.flow),records=relevantRecords(live,flows,node.resource);
  const policies=catalog.flows.flatMap(flow=>(flow.effects||[]).filter(e=>e.resource===node.resource&&flow.owner==='coordination').map(e=>({flow,effect:e})));
  const body=related.map(({flow,effects})=>{const effect=effects.find(e=>e.resource===node.resource),outcome=explainEffect(catalog,flow,effect,view.example),gates=flow.steps.filter(s=>s.kind==='gate'||s.kind==='wait');return `<article class="wf-intention ${flow.id===highlight?'selected':''}"><button class="wf-detail-link" data-flow="${esc(flow.id)}">${esc(flowTitle(flow))}<small>${esc(label(catalog,flow.owner))} · ${flow.trigger.kind==='event'?'Event delivery':'Independent '+flow.trigger.kind}</small></button><p><strong>Wants:</strong> ${esc(effect.intent)}</p>${effect.authored?`<p class="wf-outcome-copy wf-outcome-${outcome.status}">${esc(outcome.text)}</p><p><strong>Protection:</strong> ${esc(effect.protection||'No reviewed protection is described.')}</p>${effect.watch?`<p class="wf-watch"><strong>Watch for:</strong> ${esc(effect.watch)}</p>`:''}`:`<p class="wf-note">Grouped from output owners. Shared placement alone does not prove these writers compete for one physical source.</p>`}${gates.length?`<details><summary>Conditions & waits (${gates.length})</summary>${gates.map(s=>`<p>${esc(s.label)}${s.detail?` — ${esc(s.detail)}`:''}${s.setting?`<small>Configured: ${esc(s.configured===null?'Unavailable':String(s.configured))}</small>`:''}</p>`).join('')}</details>`:''}<small class="wf-review-note">${flow.verification==='review'?'Source changed · this explanation needs review':flow.verification==='configured'?'Current configuration':'Source matches reviewed description'}</small></article>`;}).join('');
  showDetails(view,`<p class="wf-eyebrow">Shared resource · ${view.example==='now'?'observations':'policy example'}</p><h3>${esc(resource.label)}</h3><p class="wf-note">${related.length} related intentions. Shared access may be protected, order-dependent, or independent; the conditions below explain which.</p><h4>Last sampled ownership</h4>${observedResource(catalog,live,node.resource)}${node.resource==='scene'?`<p class="wf-note">The director’s deferred destination excludes a client router’s own pending target.</p>`:''}${policies.map(({flow,effect})=>`<div class="wf-policy"><p><strong>Who decides:</strong> ${esc(effect.protection)}</p>${effect.watch?`<p class="wf-watch"><strong>Order matters:</strong> ${esc(effect.watch)}</p>`:''}<button class="wf-detail-link" data-flow="${esc(flow.id)}">Inspect the resource owner →</button><small>${flow.verification==='review'?'Source changed · review required':'Reviewed source matches'}</small></div>`).join('')}<h4>${view.example==='now'?'Possible reactions':'Under this assumed state'}</h4>${body}<h4>Recent observations</h4>${records.length?recordList(records,catalog,{compact:true}):'<p class="wf-note">No matching record in the recent window. This does not establish that nothing happened.</p>'}<button class="btn btn-secondary" data-resource-history="${esc(node.resource==='scene'?'scene.decision':flows[0]?.owner||'')}">Search recorded decisions</button><p class="wf-note">Receipts, decisions and completed playback are different observations. This map does not prove that all races are absent.</p>`);
}
function selectNode(view,node){
  view.graph.highlight(node.id);const {catalog,$}=view;
  if(node.idle){showDetails(view,`<p class="wf-eyebrow">Other owners</p><h3>${esc(node.label)}</h3><p class="wf-note">No active playback or pause claim in this snapshot. Shared service health is not inferred from an idle module.</p>${node.idle.map(m=>`<button class="wf-detail-link" data-module="${esc(m.id)}">${esc(m.label)} ${icon('arrow')}</button>`).join('')}`);return;}
  if(node.compact){view.graph.expand(node.flow.id);return;}
  if(node.module){const m=node.module,flows=catalog.flows.filter(f=>f.owner===m.id);
    let status='';if(node.data){const {project,ticket,claim}=node.data;status=`<dl class="wf-facts">${project?`<div><dt>Activity</dt><dd>${esc(project.current_activity || 'Idle')}</dd></div>`:''}${ticket?`<div><dt>Permission</dt><dd>${ticket.allowed?'Granted':'Waiting'}</dd></div>`:''}${claim?`<div><dt>Pause owners</dt><dd>${esc((claim.owners||[]).map(o=>label(catalog,o.owner)).join(', '))}</dd></div><div><dt>On release</dt><dd>${claim.resume_on_release?'Resume after all claims clear':'Stay paused'}</dd></div>`:''}</dl>`;}
    showDetails(view,`<p class="wf-eyebrow">${esc(m.group)}</p><h3>${esc(m.label)}</h3><p>${esc(m.description)}</p>${status}${m.separate?'<p class="wf-note">This runs separately. Its local activity is outside Hub history.</p>':''}${controlLink(catalog,m.id)}<button class="btn btn-primary" data-module="${esc(m.id)}">Explore ${flows.length} behaviors ${icon('arrow')}</button><h4>When…</h4>${[...new Set(flows.map(f=>f.topic))].map(topic=>`<button class="wf-detail-link" data-topic="${esc(topic)}">${esc(topic)} ${icon('arrow')}</button>`).join('')}`);return;}
  if(node.flow){const f=node.flow,s=node.step;view.selectedFlow=f;
    const steps=node.owner?f.steps.filter(step=>step.owner===node.owner):f.steps;
    showDetails(view,`<p class="wf-eyebrow">${esc(label(catalog,node.owner || s?.owner || f.owner))}</p><h3>${esc(s?.label || flowTitle(f))}</h3><span class="wf-verification wf-verification-${esc(f.verification)}">${f.verification==='review'?'Code changed · review needed':f.verification==='configured'?'Current configuration':'Source matches reviewed map'}</span>${s?.detail||f.detail?`<p>${esc(s?.detail || f.detail)}</p>`:''}${s?.setting?`<dl class="wf-facts"><div><dt>Configured now</dt><dd>${esc(s.configured===null?'Unavailable':String(s.configured))}</dd></div></dl>`:''}${controlLink(catalog,node.owner||s?.owner||f.owner)}<h4>${node.owner?'This participant’s part':'This behavior'}</h4><ol class="wf-step-list">${steps.map(step=>`<li class="${step.id===s?.id?'selected':''}"><i style="background:${step.kind==='wait'?'#d8a6b9':step.kind==='gate'?'#ddc28b':'#9bb9df'}"></i><span>${esc(step.label)}<small>${esc(label(catalog,step.owner))}</small></span></li>`).join('')}</ol><details class="wf-evidence"><summary>Code behind this behavior</summary>${f.proofs.map((p,i)=>`<div><small>${esc(p.path)}:${p.line || '?'} · ${esc(p.status)}</small><button class="wf-detail-link" data-proof="${i}">${esc(p.symbol)}</button></div>`).join('')}</details>`);return;}
  if(node.fact){showDetails(view,`<p class="wf-eyebrow">Source wiring</p><h3>${esc(node.label)}</h3><p>${esc(node.fact.handler)}</p><small>${esc(node.fact.path)}:${node.fact.line}</small><p class="wf-note">Discovered from the current source. Registration conditions may still gate this subscriber. Live subscriptions show which callbacks are registered now.</p>`);return;}
  if(node.data){showDetails(view,`<p class="wf-eyebrow">Scene ownership</p><h3>${esc(node.label)}</h3><dl class="wf-facts">${Object.entries(node.data).filter(([,v])=>v!==null).map(([k,v])=>`<div><dt>${esc(k.replaceAll('_',' '))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`);}
}
async function loadHistory(view,append=false){
  const request=++view.historyRequest;
  try{const data=await api.getWorkflowHistory({since:Date.now()/1000-view.period,q:view.historyQuery,before:append?view.next:null,limit:150});if(active!==view||request!==view.historyRequest)return;view.records=append?[...view.records,...data.records]:data.records;view.next=data.next;view.$('.wf-history-list').innerHTML=recordList(view.records,view.catalog);view.$('[data-more]').hidden=!view.next;}
  catch(error){if(active===view)view.$('.wf-history-list').innerHTML=`<div class="wf-empty">${esc(error.message)}</div>`;}
}
async function poll(view){
  if(active!==view)return;clearTimeout(view.timer);
  try {const live=await api.getWorkflowLive();if(active!==view)return;if(!view.frozen){view.live=live;if(view.mode==='live')draw(view,false);renderStatus(view);}
    if(!view.lastCatalog || Date.now()-view.lastCatalog>15000){const next=await api.getWorkflowMap();if(active!==view)return;view.lastCatalog=Date.now();view.catalog=enrich(next);if(next.revision!==view.revision&&view.mode==='explore'){view.revision=next.revision;draw(view,false);}if(!view.$('.wf-search-results').hidden)renderSearch(view);renderStatus(view);}
  }catch(error){if(active===view)view.$('.wf-sync').textContent='Connection lost · retrying';}
  if(active===view)view.timer=setTimeout(()=>poll(view),2000);
}
