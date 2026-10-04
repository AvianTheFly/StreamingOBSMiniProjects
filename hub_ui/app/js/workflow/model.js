// Visual models only. Runtime owners and the read-only catalog supply all policy.
const GROUPS = ['Inputs', 'Game', 'Media', 'Community', 'Shared resources', 'Output', 'Separate app'];
export const COLORS = { event:'#a4d8cb', control:'#a4d8cb', action:'#9bb9df', gate:'#ddc28b', wait:'#d8a6b9', output:'#a4d8cb', end:'#a4d8cb', module:'#9bb9df' };
export function label(catalog, id) { return catalog.modules.find(m => m.id === id)?.label || String(id || 'Hub').replaceAll('_', ' '); }
export function enrich(catalog) {
  const flows = [...catalog.flows];
  for (const [index, rule] of (catalog.rules || []).entries()) {
    if (!rule?.requester || !Array.isArray(rule.pause)) continue;
    const steps = [{id:'request',owner:rule.requester,label:'Request playback',kind:'action'},
      ...rule.pause.map((owner,i) => ({id:`pause${i}`,owner,label:`Pause ${label(catalog,owner)}`,kind:'wait',detail:'A scoped claim stays in force until this playback ticket finishes.'})),
      {id:'finish',owner:'coordination',label:rule.resume_on_finish ? 'Release & resume if clear' : 'Release without resuming',kind:'end',detail:'Other pause claims continue to hold their targets.'}];
    flows.push({id:`rules.${index}`,owner:rule.requester,label:label(catalog,rule.requester),topic:'Pause & resume rules',
      trigger:{kind:'control',event:'coordinator.request',label:`${label(catalog,rule.requester)} plays`},steps,
      edges:steps.slice(1).map((s,i)=>({from:steps[i].id,to:s.id})),proofs:[],verification:'configured',detail:'Read from the current coordinator rules.',
      effects:[{resource:'audio',role:'hold',intent:rule.pause.length?`Pause ${rule.pause.map(id=>label(catalog,id)).join(', ')} while ${label(catalog,rule.requester)} plays`:'No pause targets in this rule',
        protection:rule.resume_on_finish?'Completion releases this playback ticket. Resume needs all claims cleared and the original interface still present.':'This rule suppresses automatic resume when the claim releases.',
        watch:'Other rules may affect the same target. Inspect observed pause owners and the coordinator’s admission policy before changing a rule.'}]});
  }
  for (const [index, workflow] of (Array.isArray(catalog.saved_workflows) ? catalog.saved_workflows : []).entries()) {
    if (!workflow || !Array.isArray(workflow.steps)) continue;
    const steps = workflow.steps.map((s,i) => ({id:String(i),owner:s.project || 'hub',kind:'action',
      label:s.action || s.action_id || 'Unrecognized step',detail:s.kind === 'project' ? label(catalog,s.project) : 'Hub action'}));
    if (!steps.length) continue;
    flows.push({id:`saved.${index}`,owner:'hub',label:workflow.name || workflow.label || workflow.id || 'Saved sequence',topic:'Your saved sequences',
      trigger:{kind:'control',event:'hub.workflow',label:workflow.name || workflow.id || 'Run saved sequence'},steps,
      edges:steps.slice(1).map((s,i)=>({from:steps[i].id,to:s.id})),proofs:[],verification:'configured',detail:'Current saved steps, in their configured order. The Hub continues after an individual step fails.'});
  }
  return {...catalog,flows};
}
export function branches(catalog, flows, title) {
  const nodes=[],groups=[],edges=[];
  const common=flows.length>1;
  let y=70;
  for (const flow of flows) {
    const indeg=new Map(flow.steps.map(s=>[s.id,0]));
    for (const e of flow.edges || []) indeg.set(e.to,(indeg.get(e.to)||0)+1);
    const levels=new Map(), queue=flow.steps.filter(s=>!indeg.get(s.id)).map(s=>s.id);
    queue.forEach(id=>levels.set(id,0));
    while (queue.length) {
      const id=queue.shift();
      for (const e of (flow.edges || []).filter(e=>e.from===id)) {
        levels.set(e.to,Math.max(levels.get(e.to)||0,(levels.get(id)||0)+1));
        indeg.set(e.to,indeg.get(e.to)-1);if (!indeg.get(e.to)) queue.push(e.to);
      }
    }
    const columns=new Map();
    flow.steps.forEach(s=>{const level=levels.get(s.id)||0;if(!columns.has(level))columns.set(level,[]);columns.get(level).push(s);});
    const maxRows=Math.max(1,...[...columns.values()].map(a=>a.length)), h=54+maxRows*92;
    groups.push({x:300,y:y-34,w:Math.max(440,(Math.max(...levels.values(),0)+1)*204+26),h,label:label(catalog,flow.owner),flow});
    const compactId=`${flow.id}:summary`;
    nodes.push({id:compactId,x:318,y:y+8,w:354,h:66,label:flow.label,kind:'module',sub:`${flow.steps.length} steps · ${flow.steps.filter(s=>s.kind==='wait').length} waits`,flow,compact:true});
    for (const [level,items] of columns) items.forEach((s,row)=>nodes.push({...s,id:`${flow.id}:${s.id}`,step:s,flow,
      x:318+level*204,y:y+row*92,w:184,h:72,sub:label(catalog,s.owner),granular:true}));
    for (const e of flow.edges || []) edges.push({...e,from:`${flow.id}:${e.from}`,to:`${flow.id}:${e.to}`,granular:true});
    const roots=flow.steps.filter(s=>!(flow.edges || []).some(e=>e.to===s.id));
    const dashed=flow.trigger.kind!=='event';
    roots.forEach(s=>edges.push({from:'trigger',to:`${flow.id}:${s.id}`,dashed,granular:true}));
    edges.push({from:'trigger',to:compactId,dashed,compact:true});
    y+=h+28;
  }
  nodes.unshift({id:'trigger',x:20,y:Math.max(70,(y-140)/2),w:230,h:90,label:title,kind:'event',
    sub:common?`${flows.length} behavior branches`:flows[0]?.trigger.label || '',trigger:true});
  return {nodes,groups,edges,width:Math.max(800,...nodes.filter(n=>n.granular).map(n=>n.x+n.w+40)),height:y+15};
}
export function wiring(catalog,event,subscriptions={}) {
  const facts=catalog.wiring.filter(f=>f.event===event), emitters=[...new Set(facts.filter(f=>f.kind==='emit').map(f=>f.owner))];
  const listeners=facts.filter(f=>f.kind==='listen');
  const nodes=[{id:'event',x:340,y:110,w:240,h:82,label:event,kind:'event',sub:'Source wiring'}],edges=[];
  emitters.forEach((owner,i)=>{nodes.push({id:`emit${i}`,x:30,y:40+i*110,w:230,h:72,label:label(catalog,owner),sub:'Emits',kind:'module',owner});edges.push({from:`emit${i}`,to:'event'});});
  listeners.forEach((f,i)=>{nodes.push({id:`listen${i}`,x:670,y:40+i*110,w:290,h:82,label:label(catalog,f.owner),sub:f.handler,kind:'module',fact:f});edges.push({from:'event',to:`listen${i}`});});
  if(!listeners.length) (subscriptions[event]||[]).forEach((listener,i)=>{nodes.push({id:`runtime${i}`,x:670,y:40+i*110,w:290,h:82,label:listener.split('.').slice(0,-1).join('.'),sub:'Registered now',kind:'module'});edges.push({from:'event',to:`runtime${i}`});});
  return {nodes,edges,groups:[],width:990,height:Math.max(340,Math.max(emitters.length,listeners.length,(subscriptions[event]||[]).length)*110+75)};
}
export function liveModel(catalog,state) {
  const nodes=[],edges=[],groups=[];
  const scene=state.scene||{}, playback=state.playback||{}, pauses=state.pauses||{};
  nodes.push({id:'scene',x:430,y:30,w:350,h:96,label:scene.scene || 'Waiting for OBS',sub:scene.temporary_owner?`Held by ${label(catalog,scene.temporary_owner)}`:'Program scene',kind:'output',data:scene});
  if(scene.pending_scene) nodes.push({id:'pending',x:830,y:40,w:280,h:76,label:`Waiting: ${scene.pending_scene}`,sub:'Deferred scene intent',kind:'wait',data:scene});
  const cols=[30,430,830], ys=[180,180,180];
  groups.push(...['Playing / ready','Paused by an owner','Shared resources'].map((label,i)=>({x:cols[i],y:148,w:350,h:35,label,headerOnly:true})));
  const idle=[];
  for(const m of catalog.modules.filter(m=>!m.separate)) {
    const p=(state.projects||[]).find(p=>p.name===m.id),ticket=playback[m.id],claim=pauses[m.id];
    const col=claim?1:(p?.is_active || ticket?0:2);
    if(col===2&&!['voice','conversion'].includes(m.id)){idle.push(m);continue;}
    let sub=claim?`Held by ${(claim.owners||[]).map(o=>label(catalog,o.owner)).join(', ')}`:ticket&&!ticket.allowed?'Waiting for permission':p?.current_activity || (p?'Idle':'Shared service');
    if(m.id==='voice')sub=state.voice?.owner?`${state.voice.state} · ${label(catalog,state.voice.owner)}`:'Microphone idle';
    if(m.id==='conversion')sub=`${state.conversions?.used || 0}/${state.conversions?.capacity || '–'} slots · ${state.conversions?.queued || 0} queued`;
    if(m.id==='league_api'&&p?.workflow?.phase)sub=`${p.workflow.phase} · ${p.workflow.status || ''}`;
    nodes.push({id:m.id,x:cols[col],y:ys[col],w:350,h:70,label:m.label,sub,kind:claim||ticket&&!ticket.allowed?'wait':col===0?'output':'module',module:m,data:{project:p,ticket,claim}});ys[col]+=84;
  }
  const bottom=Math.max(...ys)+50;let index=0;
  groups.push({x:30,y:bottom-34,w:1150,h:35,label:'Other owners · select a group to inspect',headerOnly:true});
  for(const group of GROUPS){const modules=idle.filter(m=>m.group===group);if(!modules.length)continue;
    nodes.push({id:`idle:${group}`,x:cols[index%3],y:bottom+Math.floor(index/3)*84,w:350,h:70,label:`${group} · ${modules.length}`,sub:modules.slice(0,3).map(m=>m.label).join(' · '),kind:'module',idle:modules});index++;
  }
  if(ys[0]===180)nodes.push({id:'quiet',x:cols[0],y:180,w:350,h:70,label:'No active playback',sub:'The next request will appear here',kind:'module'});
  if(ys[1]===180)nodes.push({id:'unclaimed',x:cols[1],y:180,w:350,h:70,label:'No pause claims',sub:'Modules have no shared pause owner',kind:'module'});
  const ids=new Set(nodes.map(n=>n.id));
  for(const [target,claim] of Object.entries(pauses))for(const owner of claim.owners || []){
    if(ids.has(owner.owner)&&ids.has(target))edges.push({from:owner.owner,to:target,label:'Pause claim'});
  }
  if(ids.has(scene.temporary_owner))edges.push({from:scene.temporary_owner,to:'scene',label:'Owns the screen'});
  if(scene.pending_scene)edges.push({from:'scene',to:'pending',label:'Deferred',dashed:true});
  return {nodes,edges,groups,width:1210,height:bottom+Math.ceil(index/3)*84+20,overview:true};
}
export function eventTitle(record) {
  const named={'runtime.state':'State changed','hub.started':'Hub started','scene.decision':'Scene decision','source.request':'Playback requested','source.playback':'Source playback','source.cleanup':'Source cleanup','voice.session':'Voice session','league_client.phase':'League client phase','league_production.show':'League production show','celebration.playback':'Celebration playback','conversion.job':'Conversion slot','replay.capture':'Replay capture'};
  return named[record.event] || String(record.event || 'Event').replace(/^league_api:/,'League · ').replace(/^league:/,'League · ').replaceAll('_',' ').replaceAll('.',' · ');
}
