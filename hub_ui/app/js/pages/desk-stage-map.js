// Pure mapping from observed feature snapshots to visual stage expectations.
import {esc} from '../utils.js';
export const STAGES=[['starting','Starting soon','◌'],['cinematics','Cinematics','▶'],['lobby','Lobby / queue','⌂'],['replay','Replay & clips','↶'],['draft','Bans & picks','◇'],['loading','Loading','✧'],['game','In game','⚔'],['ending','Ending','☾']];
export function stageStrip(){return `<nav class="desk-stage-strip" aria-label="Stage previews">${STAGES.map(([id,label,symbol])=>`<button class="stage-tile" data-stage-tile="${id}" aria-label="Browse ${label}"><span class="stage-symbol">${symbol}</span><span>${label}</span><i></i></button>`).join('')}</nav>`;}
export function stageRoutes(stage,workflow){
  if(stage==='cinematics')return [['Cinematic finishes','lobby']];
  if(stage==='starting')return [['Intro finishes','lobby']];
  if(stage==='lobby')return [['Bans finish','draft']];
  if(stage==='draft')return [['Picks finish','loading'],['Draft dodged','lobby']];
  if(stage==='loading')return [['Game clock starts','game'],['Back to client','lobby']];
  if(stage==='game')return [['Match ends','lobby']];
  return [];
}
export function observedStage(context,previous){
  if(!context.connected||!context.coordination?.scenes?.observing)return null;
  const scenes=context.coordination.scenes,scene=scenes.scene,league=context.projects?.find(p=>p.name==='league_api')?.workflow;
  const session=context.projects?.find(p=>p.name==='scene_voice_switcher')?.workflow?.session;
  if(context.projects?.find(p=>p.name==='starting_soon')?.workflow?.cinematic&&scenes.temporary_owner==='starting_soon')return 'cinematics';
  if(scenes.temporary_owner==='starting_soon'||scene==='Starting Soon')return 'starting';
  if(scenes.temporary_owner==='instant_replay')return previous||'game';
  if(league?.loading_scene&&scene===league.loading_scene)return 'loading';
  if(scene===context.lobbyData?.game_scene)return 'game';
  if(league?.champion_scene&&scene===league.champion_scene)return 'draft';
  if(scene==='Lobbies'||context.lobbyData?.lobbies?.includes(scene)){
    if(session?.held&&session.stage==='ending'&&session.lobby===context.lobbyData?.current_lobby)return 'ending';
    return 'lobby';
  }
  return null;
}
export function paintStageMap(root,{shown,current,context,pictures,names}){
  const league=context.projects?.find(p=>p.name==='league_api')?.workflow;
  for(const [id] of STAGES){const b=root.querySelector(`[data-stage-tile="${id}"]`);b.setAttribute('aria-pressed',String(shown===id));b.classList.toggle('is-current',context.connected&&current===id);b.style.backgroundImage=pictures[id]?`linear-gradient(0deg,#071516f0,#07151644),url("${pictures[id]}")`:'';}
  root.querySelector('#deskStageArtwork').style.backgroundImage=pictures[shown]?`url("${pictures[shown]}")`:'';
  root.querySelector('#deskPictureTitle').textContent=STAGES.find(s=>s[0]===shown)?.[1]||'Scene';
  root.querySelector('#deskArtName').textContent=names[shown]||'';
  root.querySelector('#deskGamePlaceholder').hidden=shown!=='game';
  root.querySelector('#deskPictureMode').textContent=!context.connected?'OFFLINE PREVIEW':shown===current?'ON STREAM · ART PREVIEW':'ART PREVIEW';
  const held=!!context.coordination?.scenes?.automatic_holds?.length;
  const routes=stageRoutes(shown,league),host=root.querySelector('#deskNextRoutes');
  const ready=context.connected&&context.coordination?.scenes?.observing;
  const html=routes.map(([condition,id])=>{const picture=pictures[id],label=STAGES.find(s=>s[0]===id)?.[1]||id,available=ready&&(id==='loading'?!!league?.loading_scene:id==='draft'?!!league?.champion_scene:!!context.lobbyData);return `<div class="stage-route"><span>${esc(condition)} <b>→</b></span><button class="stage-route-art" data-next-stage="${id}" data-available="${available}" ${available?'':'disabled'} aria-label="Show ${esc(label)} now" title="Show this scene now" style="${picture?`background-image:url('${esc(picture)}')`:''}"><strong>${esc(label)}</strong></button></div>`;}).join('')||'<p class="stage-route-empty">Your closing scene</p>';
  if(!host.querySelector('[aria-busy="true"]')&&host.innerHTML!==html)host.innerHTML=html;
  root.querySelector('#deskAuto').textContent=held?'View held · Resume auto':'Auto scenes · Hold view';
  root.querySelector('#deskAuto').setAttribute('aria-pressed',String(!held));
  const session=context.projects?.find(p=>p.name==='scene_voice_switcher')?.workflow?.session;
  const temporary=context.coordination?.scenes?.temporary_owner;
  root.querySelector('#deskAutoNote').textContent=held?(session?.stage==='ending'?'Ending holds automatic scenes · Resume auto to follow game events':'Automatic scenes paused · Resume auto to follow game events'):temporary?(temporary==='instant_replay'?'Replay is showing · automatic scene waits':'Temporary presentation is showing · automatic scene waits'):league?.connected&&league.scene_automation?'Events show their scene from any view · or click to show now':'Click to show now · League client unavailable';
}
