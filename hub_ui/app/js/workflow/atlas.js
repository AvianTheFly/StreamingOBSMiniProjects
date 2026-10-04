// Human-scale navigation. These groups describe the map, never runtime policy.
import { label } from './model.js';

const group=(id,title,description,icon,children=[],topics=[])=>({id,title,description,icon,children,topics});
export const AREAS=[
  {...group('you','Your controls','Keys, voice & saved sequences','keyboard',[
    group('shortcuts','Keyboard & Hub','How a control reaches a feature','keyboard',[],['Shortcuts']),
    group('voice','Voice commands','From microphone to a matching command','voice',[],['Voice']),
    group('sequences','Saved sequences','The steps you have configured','automation',[],['Saved workflows','Your saved sequences']),
  ]),color:'#a8c9ef',owners:['keyboard','voice','hub'],x:50,y:65},
  {...group('game','Your game','Before, during & after a match','automation',[
    group('before','Before a match','Queue, bans & champion picks','automation',[
      group('queue','Queue & bans','Client privacy and lobby choices','scene',[],['Queue & bans']),
      group('picks','Champion picks','Pick reactions and presentations','spark',[],['Champion picks']),
    ]),
    group('during','During a match','Kills, respawns & game reactions','play',[
      group('start','Match begins','The game view and match tracking','scene',[],['Game starts']),
      group('kills','Your kills','Alerts, stats & replay anchors','spark',[],['Your kill']),
      group('death','Death & respawn','Death cues and return to play','replay',[],['Death & respawn']),
      group('objectives','Objectives & changes','Map events and player progress','chart',[],['Objectives','Player changes']),
    ]),
    group('after','After a match','Results, lobby return & saved moments','chart',[],['Game ends']),
  ]),color:'#d8bc89',owners:['league','league_api','league_stats'],x:50,y:275},
  {...group('viewers','Your viewers','Chat, rewards & celebrations','chat',[
    group('chat','Chat & stats','Messages, stickers and stat requests','chat',[],['Chat & stats']),
    group('rewards','Channel rewards','A redemption becomes a presentation','spark',[],['Channel rewards']),
    group('celebrations','Celebrations','Raids, subscriptions, cheers & follows','spark',[],['Twitch events']),
  ]),color:'#d4afe0',owners:['chat','chat_transport','twitch_commands','rewards','twitch_celebrations'],x:50,y:485},
  {...group('media','Sound & video','Sounds, music & on-screen shows','music',[
    group('sounds','Sounds & effects','Soundboard, video cues and sequences','soundboard',[],['Sound & video']),
    group('music','Music','Song playback and Spotify visuals','music',[],['Music']),
    group('waiting','Waiting room','Starting soon and its clip playlist','play',[],['Waiting room']),
  ]),color:'#98d8c3',owners:['soundboard','sound_effects','tik_tok','love_me','specific_song','spotify','starting_soon','browser_effects'],x:470,y:160},
  {...group('clips','Clips & replays','Capture, show & keep your moments','replay',[
    group('capture','Save a moment','Local replays and companion Twitch clips','save',[],['Save a replay']),
    group('playback','Show a replay','A temporary presentation, then return','play',[],['Replay playback']),
    group('review','Keep & review','Archived cuts and the separate Footage Desk','library',[],['Footage review']),
  ]),color:'#efb796',owners:['instant_replay','twitch_clips','footage_desk'],x:470,y:440},
  {...group('screen','Screen & resources','Who plays, who waits & what OBS shows','scene',[
    group('permission','Who gets to play?','Pause claims, handoffs and your rules','audio',[],['Shared audio','Pause & resume rules']),
    group('scenes','Who owns the screen?','Scene requests, lobbies and transitions','scene',[],['Scene ownership','Scene choice']),
    group('services','Behind the scenes','Startup, preparation and safe cleanup','settings',[
      group('startup','Getting ready','Hub startup and OBS observation','desk',[],['Startup']),
      group('background','Background work','Preparation, conversion & settings history','settings',[],['Background work']),
      group('cleanup','Source handoffs','Finish cleanup before the source is reused','play',[],['Source cleanup']),
    ]),
  ]),color:'#b6becd',owners:['coordination','scene_voice_switcher','transitions','obs','media_workers','conversion','preparation','settings_history'],x:890,y:290},
];
const walk=(items)=>items.flatMap(item=>[item,...walk(item.children)]);
const ALL=walk(AREAS);
export function entry(id){return ALL.find(item=>item.id===id);}
export function areaOf(owner){return AREAS.find(area=>area.owners.includes(owner));}
export function flowsFor(catalog,item){
  const topics=new Set([item,...walk(item.children)].flatMap(child=>child.topics));
  return catalog.flows.filter(flow=>topics.has(flow.topic));
}
export function pathTo(id){
  function find(items,path){for(const item of items){if(item.id===id)return [...path,item.id];const found=find(item.children,[...path,item.id]);if(found)return found;}return null;}
  return find(AREAS,[])||[];
}
export function pathForFlow(catalog,flow){
  return pathTo(ALL.find(item=>!item.children.length&&item.topics.includes(flow.topic))?.id);
}
const FLOW_NAMES={'instant_replay.archive':'Archive your clips','league.end':'Clear game overlays','league_stats.disconnect':'Save match stats','scene_voice_switcher.end':'Return to a lobby','league_api.idle':'Choose the idle view'};
export function flowTitle(flow){return FLOW_NAMES[flow.id]||flow.label;}
export function participantLabel(catalog,id){return id?.startsWith('area:')?entry(id.slice(5))?.title||id:label(catalog,id);}

// Every connection carries the evidence that produced it. Mere co-membership is
// never treated as an event delivery or a runtime dependency.
export function connections(catalog){
  const result=[];
  for(const flow of catalog.flows){
    const steps=new Map(flow.steps.map(step=>[step.id,step]));
    for(const edge of flow.edges||[]){const a=steps.get(edge.from),b=steps.get(edge.to);if(a&&b&&a.owner!==b.owner)result.push({from:a.owner,to:b.owner,flow,label:`${a.label} → ${b.label}`,kind:'handoff'});}
  }
  const events=new Map();
  for(const fact of catalog.wiring){if(!events.has(fact.event))events.set(fact.event,[]);events.get(fact.event).push(fact);}
  for(const [event,facts] of events)for(const a of facts.filter(f=>f.kind==='emit'))for(const b of facts.filter(f=>f.kind==='listen')){
    if(a.owner!==b.owner)result.push({from:a.owner,to:b.owner,event,label:event,kind:'event'});
  }
  return result;
}
function scenarioConnections(catalog){
  // Polling observers share game evidence without calling one another. The map
  // placement provides that context; never manufacture an event subscription.
  return catalog.flows.flatMap(flow=>{
    const area=entry(pathForFlow(catalog,flow)[0]),target=areaOf(flow.owner);
    return area&&target&&area!==target?[{from:`area:${area.id}`,to:flow.owner,flow,kind:'scenario',label:`${flow.trigger.label} · ${flow.steps[0]?.label||flow.label}`}]:[];
  });
}
function aggregate(facts,resolve,undirected=false){
  const result=new Map();
  for(const fact of facts){const from=resolve(fact.from),to=resolve(fact.to);if(!from||!to||from===to)continue;const key=undirected?[from,to].sort().join(':'):`${from}:${to}`;
    if(!result.has(key))result.set(key,{from,to,facts:[]});result.get(key).facts.push(fact);
  }
  return [...result.values()];
}
function card(item,x,y,color,extra={}){return {id:item.id,label:item.title,description:item.description,icon:item.icon,color,x,y,w:300,h:174,entry:item,...extra};}
export function atlas(catalog,path=[],flowId=null,{mobile=false,owner=null,module=null}={}){
  const facts=connections(catalog),area=entry(path[0]),current=entry(path.at(-1));
  if(flowId){const flow=catalog.flows.find(f=>f.id===flowId);return flow?behavior(catalog,flow,area?.color||'#98d8c3',mobile,owner):atlas(catalog);}
  if(!current){
    const nodes=AREAS.map(item=>card(item,item.x,item.y,item.color,{sub:'Open area',count:flowsFor(catalog,item).length}));
    const edges=aggregate([...facts,...scenarioConnections(catalog)],id=>id.startsWith('area:')?id.slice(5):areaOf(id)?.id,true);
    edges.forEach(edge=>{edge.dashed=edge.facts.every(f=>f.kind==='scenario');});
    return responsive({nodes,edges,width:1240,height:700,title:'Your stream, connected',description:'Start with an area. Follow its connections. Open it to see what happens inside.',root:true,
      headings:[{x:50,y:30,label:'WHERE THINGS BEGIN'},{x:470,y:110,label:'WHAT THEY DO'},{x:890,y:245,label:'WHAT THEY SHARE'}]},mobile);
  }
  const flows=module?catalog.flows.filter(f=>f.owner===module):flowsFor(catalog,current),children=!module&&current.children.length?current.children:null;
  const items=children||flows.map(flow=>({id:`flow:${flow.id}`,title:flowTitle(flow),description:label(catalog,flow.owner),icon:catalog.modules.find(m=>m.id===flow.owner)?.icon||'spark',flow}));
  const nodes=items.map((item,i)=>card(item,350+(items.length>3?i%2:0)*340,85+Math.floor(i/(items.length>3?2:1))*205,area.color,
    item.flow?{flow:item.flow,sub:'Open interaction',count:item.flow.steps.length}:{sub:'Open map',count:flowsFor(catalog,item).length}));
  const input={id:'context',label:module?label(catalog,module):current.title,description:'You are looking inside',icon:current.icon,color:area.color,x:25,y:165,w:235,h:150,context:true};
  nodes.unshift(input);
  // Pale exploration lines show containment only; arrowed lines below describe
  // actual cross-owner handoffs or discovered event subscriptions.
  const edges=items.map(item=>({from:'context',to:item.id,containment:true}));
  const related=[...facts,...scenarioConnections(catalog)].filter(f=>flows.some(flow=>flow===f.flow || flow.trigger.event===f.event));
  const outside=[...new Set(related.flatMap(f=>[f.from,f.to]).map(id=>areaOf(id)?.id).filter(id=>id&&id!==area.id))];
  const bottom=Math.max(...nodes.map(n=>n.y+n.h))+75;
  outside.forEach((id,i)=>{const target=entry(id);nodes.push({...card(target,350+i*260,bottom,target.color),id:`outside:${id}`,w:240,h:150,external:true,description:'Connected area · open map',sub:''});});
  for(const item of items){const subset=item.flow?[item.flow]:flowsFor(catalog,item),matching=related.filter(f=>subset.some(flow=>flow===f.flow||flow.trigger.event===f.event));
    for(const id of outside){const evidence=matching.filter(f=>[f.from,f.to].some(owner=>areaOf(owner)?.id===id));if(evidence.length)edges.push({from:item.id,to:`outside:${id}`,facts:evidence,boundary:true});}
  }
  return responsive({nodes,edges,width:Math.max(1060,350+outside.length*260),height:bottom+(outside.length?180:0),title:module?label(catalog,module):current.title,description:current.description,
    headings:[{x:350,y:45,label:children?'OPEN A SMALLER MAP':'INDEPENDENT REACTIONS'},{x:350,y:bottom-25,label:outside.length?'CONNECTIONS BEYOND THIS AREA':''}]},mobile);
}
function behavior(catalog,flow,color,mobile,owner){
  const owners=[...new Set(flow.steps.map(s=>s.owner))];
  const nodes=owners.map((id,i)=>{
    const module=catalog.modules.find(m=>m.id===id),steps=flow.steps.filter(s=>s.owner===id),waits=steps.filter(s=>s.kind==='wait');
    return {id,label:label(catalog,id),description:steps[0].label,icon:module?.icon||'spark',color:areaOf(id)?.color||color,x:315+i*315,y:140,w:280,h:210,flow,owner:id,
      sub:waits.length?`Waits: ${waits[0].label}`:`Then: ${steps.at(-1).label}`,selected:id===owner};
  });
  nodes.unshift({id:'trigger',label:flow.trigger.label,description:flow.trigger.kind==='event'?'Event signal':'Control / observation',icon:'automation',color,x:25,y:170,w:220,h:150,context:true,flow});
  const steps=new Map(flow.steps.map(s=>[s.id,s]));
  const edges=aggregate((flow.edges||[]).map(e=>({from:steps.get(e.from)?.owner,to:steps.get(e.to)?.owner,flow,label:`${steps.get(e.from)?.label} → ${steps.get(e.to)?.label}`,kind:'handoff'})),id=>id);
  const roots=flow.steps.filter(s=>!(flow.edges||[]).some(e=>e.to===s.id));
  for(const id of new Set(roots.map(s=>s.owner)))edges.unshift({from:'trigger',to:id,dashed:flow.trigger.kind!=='event',facts:[{flow,label:flow.trigger.label,kind:flow.trigger.kind}]});
  return responsive({nodes,edges,width:315+owners.length*315,height:480,title:flowTitle(flow),description:'Select a participant to see what it wants, what it waits for, and its part in this behavior.',flow,
    headings:[{x:315,y:90,label:'PARTICIPANTS & HANDOFFS'}]},mobile);
}
function responsive(model,mobile){
  if(!mobile)return model;
  // Recompose into two readable columns rather than shrink desktop lettering.
  const nodes=model.nodes.map((node,i)=>({...node,x:20+i%2*180,y:30+Math.floor(i/2)*210,w:160,h:185}));
  return {...model,nodes,width:380,height:Math.ceil(nodes.length/2)*210+40,headings:[]};
}
