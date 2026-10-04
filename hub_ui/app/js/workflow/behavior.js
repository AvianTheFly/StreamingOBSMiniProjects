// Read-only presentation of owner-authored intentions. Examples explain policy;
// they never execute a request or forecast unobserved runtime state.
import { label } from './model.js';
import { esc } from '../utils.js';
import { flowTitle } from './atlas.js';

export const RESOURCES={
  scene:{label:'Program scene',icon:'scene',color:'#d8bc89',description:'One screen, several intentions'},
  overlay:{label:'Game overlays',icon:'spark',color:'#d4afe0',description:'Artwork, alerts & visibility'},
  audio:{label:'Playback permission',icon:'audio',color:'#98d8c3',description:'Who plays and who pauses'},
  source:{label:'Physical sources',icon:'play',color:'#a8c9ef',description:'Replacement waits for cleanup'},
  clips:{label:'Saved moments',icon:'save',color:'#efb796',description:'Capture, mark & archive'},
  stats:{label:'Match records',icon:'chart',color:'#b6becd',description:'Observe, save & enrich'},
  voice:{label:'Microphone',icon:'voice',color:'#a8c9ef',description:'Listening and command matching'},
  jobs:{label:'Preparation budget',icon:'settings',color:'#b6becd',description:'Bounded background work'},
  events:{label:'Signals & controls',icon:'automation',color:'#98d8c3',description:'Commands and event delivery'},
  settings:{label:'Personal settings',icon:'settings',color:'#b6becd',description:'Profiles and saved configuration'},
};
export const STATES=[{id:'now',label:'Observed now'},{id:'normal',label:'No blockers'},{id:'result',label:'Result still showing'},{id:'temporary',label:'Temporary screen held'},{id:'manual',label:'Newer manual choice'}];
const STATE_LABELS={ready:'Can request',wait:'Waits',skip:'Stands down',check:'Check conditions',effect:'Runs independently',hold:'Holds the return'};
const inferredOwner={obs:'overlay',coordination:'audio',media_workers:'source',conversion:'jobs',preparation:'jobs',voice:'voice',keyboard:'events',hub:'events',league_stats:'stats',instant_replay:'clips',twitch_clips:'clips',settings_history:'settings'};
export function effectsFor(flow){
  if(Array.isArray(flow.effects)&&flow.effects.length)return flow.effects.filter(e=>RESOURCES[e.resource]).map(e=>({...e,authored:true}));
  const outputs=flow.steps.filter(s=>['output','end'].includes(s.kind));
  const resourceIds=[...new Set((outputs.length?outputs:flow.steps.slice(-1)).map(s=>inferredOwner[s.owner]||'events'))];
  return resourceIds.map(resource=>({resource,intent:outputs.map(s=>s.label).join(' · ')||flow.label,role:'related',authored:false}));
}
function configured(catalog,reference){return catalog.flows.find(f=>f.id===reference.flow)?.steps.find(s=>s.id===reference.step)?.configured;}
export function explainEffect(catalog,flow,effect,state='now'){
  // Configuration can suppress an intention before the illustrative state does.
  if(effect.enabled_step){const value=flow.steps.find(s=>s.id===effect.enabled_step)?.configured;if(value===false)return {status:'skip',text:'This automation is disabled in the current configuration.'};if(value!==true)return {status:'check',text:'The configured enable switch is unavailable. Open the behavior to inspect its conditions.'};}
  if(effect.stand_down_when){const value=configured(catalog,effect.stand_down_when);if(value===effect.stand_down_when.value)return {status:state==='now'?'check':'skip',text:effect.stand_down_when.text};if(value===undefined||value===null)return {status:'check',text:'The routing provider’s enable switch is unavailable. Its active registration also matters.'};}
  if(state==='now')return {status:'check',text:'Possible intention. Use the observed ownership and decisions below to see what actually happened.'};
  return effect.cases?.[state]||{status:'check',text:'This state has no reviewed outcome for this behavior. Its conditions still apply.'};
}
export function situation(catalog,item,flows,{resource='all',state='now',mobile=false}={}){
  const all=flows.map(flow=>({flow,effects:effectsFor(flow)}));
  const resources=[...new Set(all.flatMap(x=>x.effects.map(e=>e.resource)))];
  const visible=all.filter(x=>resource==='all'||x.effects.some(e=>e.resource===resource));
  // At the overview, emphasize shared destinations. Independent one-owner
  // effects stay on their reaction cards and can be isolated with a focus chip.
  const shared=resources.filter(id=>all.filter(x=>x.effects.some(e=>e.resource===id)).length>1);
  const shown=resource==='all'?(shared.length?shared:resources.slice(0,3)):[resource];
  const nodes=[],edges=[];
  nodes.push({id:'context',label:item.title,description:'Shared situation, independent reactions',icon:item.icon,color:'#98d8c3',x:25,y:30,w:650,h:90,context:true,compact:true,sub:''});
  visible.forEach(({flow,effects},i)=>{
    const effect=effects.find(e=>e.resource===resource)||effects[0],outcome=explainEffect(catalog,flow,effect,state);
    nodes.push({id:`flow:${flow.id}`,label:flow.map_label||flowTitle(flow),description:effect.intent,icon:catalog.modules.find(m=>m.id===flow.owner)?.icon||'spark',color:RESOURCES[effect.resource].color,x:25+i%2*335,y:175+Math.floor(i/2)*165,w:305,h:145,compact:true,flow,effects,outcome,sub:state==='now'?`${flow.trigger.kind==='event'?'Event':'Observation / control'} · ${label(catalog,flow.owner)}`:`${STATE_LABELS[outcome.status]} · ${label(catalog,flow.owner)}`});
    // The common situation is context, not an invented event delivery.
    edges.push({from:'context',to:`flow:${flow.id}`,containment:true});
    effects.filter(e=>shown.includes(e.resource)).forEach(e=>edges.push({from:`flow:${flow.id}`,to:`resource:${e.resource}`,effect:e,flow,facts:[{flow,label:e.intent,kind:'intention'}],dashed:e.role==='hold'||!e.authored,status:explainEffect(catalog,flow,e,state).status}));
  });
  shown.forEach((id,i)=>{const r=RESOURCES[id],related=all.filter(x=>x.effects.some(e=>e.resource===id));nodes.push({id:`resource:${id}`,label:r.label,description:r.description,icon:r.icon,color:r.color,x:790,y:175+i*195,w:300,h:165,resource:id,related,sub:related.length>1?`${related.length} related intentions · inspect overlap`:'Inspect ownership & conditions'});});
  const height=Math.max(480,...nodes.map(n=>n.y+n.h+50));
  const model={nodes,edges,width:1120,height,title:`${item.title}: what overlaps?`,description:'Follow each reaction to what it affects. Select a shared resource to understand its guards and timing.',situation:true,resources,
    headings:[{x:25,y:150,label:'WHAT REACTS — NO IMPLIED ORDER'},{x:790,y:150,label:'WHAT THEY AFFECT'}]};
  if(mobile){model.nodes=nodes.map((node,i)=>({...node,x:20+i%2*180,y:30+Math.floor(i/2)*210,w:160,h:185,compact:false}));model.width=380;model.height=Math.ceil(nodes.length/2)*210+40;model.headings=[];}
  return model;
}
export function relevantRecords(live,flows,resource){
  const owners=new Set(flows.map(f=>f.owner));if(owners.has('league_api'))owners.add('league_client');
  return (live?.recent||[]).filter(r=>resource==='scene'?r.event==='scene.decision':owners.has(r.owner)||flows.some(f=>f.trigger.event===r.event)).slice(-5).reverse();
}
export function observedResource(catalog,live,resource){
  const state=live?.state;if(!state)return '<p class="wf-note">No observed state available.</p>';
  const facts=[];
  if(resource==='scene'){const s=state.scene||{};facts.push(['Program scene',s.scene||'Not observed'],['Temporary owner',s.temporary_owner?label(catalog,s.temporary_owner):'No reservation observed'],['Deferred destination',s.pending_scene||'None in the director'],['OBS observation',s.observing?'Connected':'Disconnected / unavailable']);}
  if(resource==='audio'){for(const [id,claim] of Object.entries(state.pauses||{}))facts.push([label(catalog,id),`${claim.owners.map(o=>label(catalog,o.owner)).join(', ')} holds ${claim.claims} claim(s)`]);if(!facts.length)facts.push(['Pause claims','None observed']);}
  if(resource==='voice')facts.push(['Microphone',state.voice?.owner?`${state.voice.state} · ${label(catalog,state.voice.owner)}`:state.voice?.state||'Not observed']);
  if(resource==='jobs')facts.push(['Conversion slots',`${state.conversions?.used??'?'} / ${state.conversions?.capacity??'?'} used; ${state.conversions?.queued??'?'} queued`]);
  if(!facts.length)return '<p class="wf-note">This resource has no complete ownership snapshot. Decision records below show only instrumented activity.</p>';
  return `<dl class="wf-facts">${facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}
