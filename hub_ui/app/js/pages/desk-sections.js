// Contextual controls follow observed scenes; browsing and selection remain read-only.
import {api} from '../api.js';
import {esc} from '../utils.js';
import {runWithFeedback} from '../action-feedback.js';

export function mountDeskSections(root,refresh,onStage=()=>{}){
  const get=id=>root.querySelector('#'+id),stages=['starting','lobby','draft','game','ending','other'];
  const labels={starting:'Starting soon',lobby:'Lobby',draft:'Queue / champ select',game:'Game',ending:'Ending',other:'current scene'};
  let disposed=false,context={},catalog=null,starting=null,selectedArt='',artDraft=false,worldKey='',effectKey='',current=null,shown='starting',browsed=false,requesting=false,afterparty=[];
  const menu=get('deskStageMenu');
  const dialog=document.createElement('dialog');dialog.className='desk-art-dialog';dialog.setAttribute('aria-labelledby','deskArtTitle');
  dialog.innerHTML='<header><h2 id="deskArtTitle">Choose image</h2><button class="btn btn-secondary" id="deskArtClose">Close</button></header><div id="deskStartingGallery" class="desk-art-grid" hidden></div><div id="deskGallery-lobby" class="desk-art-grid" hidden></div><div id="deskGallery-ending" class="desk-art-grid" hidden></div>';
  root.append(dialog);let opener=null;
  get('deskArtClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(!disposed)opener?.focus();});
  function openGallery(section,button){
    opener=button;get('deskArtTitle').textContent=section==='starting'?'Choose image':'Choose lobby';
    for(const id of ['starting','lobby','ending'])get(id==='starting'?'deskStartingGallery':'deskGallery-'+id).hidden=id!==section;
    dialog.showModal();
  }
  function open(stage,automatic=false){
    if(!automatic)browsed=true;
    shown=stage;for(const id of stages){get('deskSection-'+id).hidden=id!==stage;get('deskTab-'+id)?.setAttribute('aria-selected',String(id===stage));}
    menu.open=false;updateBack();onStage(stage);if(stage==='starting')loadStarting();
  }
  function updateBack(){const b=get('deskBackToCurrent');b.hidden=!current||current===shown;b.textContent=current?'Back to '+labels[current]:'';}
  root.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>open(b.dataset.section));
  root.querySelector('[data-desk-panel="scenes"]').addEventListener('click',()=>{menu.open=false;});
  get('deskBackToCurrent').onclick=()=>open(current);
  get('deskChooseArt').onclick=e=>openGallery('starting',e.currentTarget);
  root.querySelectorAll('[data-gallery]').forEach(b=>b.onclick=()=>openGallery(b.dataset.gallery,b));
  async function perform(button,fn,message){const result=await runWithFeedback(button,fn,message);if(!disposed){update(context);refresh();}return result;}
  get('deskPlayIntro').onclick=()=>perform(get('deskPlayIntro'),()=>api.startingScreenAction('intro'),'Opening requested');
  get('deskSkipIntro').onclick=()=>perform(get('deskSkipIntro'),()=>api.startingScreenAction('skip-intro'),'Going to lobby');
  get('deskStartLobby').onclick=()=>perform(get('deskStartLobby'),()=>api.selectStreamStage('lobby'),'Lobby selected');
  get('deskDraftGame').onclick=()=>perform(get('deskDraftGame'),()=>api.selectStreamStage('game'),'Game selected');
  get('deskOtherGame').onclick=()=>perform(get('deskOtherGame'),()=>api.selectStreamStage('game'),'Game selected');
  get('deskOtherLobby').onclick=()=>perform(get('deskOtherLobby'),()=>api.selectStreamStage('lobby'),'Lobby selected');
  get('deskNextLobby').onclick=()=>perform(get('deskNextLobby'),()=>api.nextLobby(),'Next lobby selected');
  get('deskNextArt').onclick=()=>{artDraft=false;return perform(get('deskNextArt'),()=>api.startingScreenAction('next-art'),'Next image');};
  async function applyArt(){
    const fresh=await api.getStartingScreen();
    if(selectedArt&&!fresh.artwork.includes(selectedArt))await api.saveStartingScreen({artwork:[...fresh.artwork,selectedArt],revision:fresh.revision});
    return selectedArt?api.startingScreenAction('set-art',{file:selectedArt}):{ok:true};
  }
  get('deskApplyArt').onclick=()=>perform(get('deskApplyArt'),async()=>{const result=await applyArt();if(result?.ok!==false&&!result?.error)artDraft=false;return result;},'Image selected');
  get('deskRotateArt').onchange=async()=>{
    const input=get('deskRotateArt'),value=input.checked;input.disabled=true;
    await perform(get('deskChooseArt'),async()=>{const result=await api.saveStartingScreen({rotate_artwork:value,revision:starting.revision});if(!disposed)starting={...starting,...result};return result;},'Image rotation saved');
    if(!disposed)paintStarting();
  };
  get('startingAction').onclick=()=>perform(get('startingAction'),async()=>{
    const result=await applyArt();if(result?.ok===false||result?.error)return result;artDraft=false;
    return api.startingScreenAction('start');
  },'Starting screen selected');
  async function setMode(mode){
    return perform(get(mode==='shuffle'?'deskShuffleLobbies':'deskKeepLobby'),async()=>{
      const source=mode==='fixed'?(context.lobbyData?.current_lobby||get('deskLobbyChoice').value):null;
      const result=await api.setLobbySelection(mode,source);
      if(!disposed){catalog={...catalog,selection:result.selection};if(context.lobbyData)context.lobbyData.selection=result.selection;}
      return result;
    },'Lobby rotation saved');
  }
  get('deskShuffleLobbies').onclick=()=>setMode('shuffle');get('deskKeepLobby').onclick=()=>setMode('fixed');
  function artButton(label,url,choice,click){const b=document.createElement('button');b.className='desk-art-choice';b.dataset.choice=choice;b.innerHTML=`<img src="${esc(url)}" alt="" loading="lazy"><span>${esc(label)}</span>`;b.onclick=click;return b;}
  function paintStarting(){
    get('deskStartingName').textContent=starting?.artwork_catalog?.find(a=>a.file===selectedArt)?.title||'Choose an image';
    get('deskRotateArt').checked=!!starting?.rotate_artwork;
    get('deskStartingGallery').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.choice===selectedArt)));
  }
  async function loadStarting(){
    if(disposed||requesting)return;requesting=true;
    try{const data=await api.getStartingScreen();if(disposed)return;starting=data;
      if(!data.artwork_catalog?.some(a=>a.file===selectedArt))selectedArt=data.artwork?.[(data.artwork_index||0)%data.artwork.length]||'';
      get('deskStartingGallery').replaceChildren(...(data.artwork_catalog||[]).map(a=>artButton(a.title,'/starting-soon/art/'+encodeURIComponent(a.file),a.file,()=>{selectedArt=a.file;artDraft=true;paintStarting();dialog.close();update(context);})));
      paintStarting();update(context);
    }catch{if(!disposed)get('deskStartingName').textContent='Images unavailable';}finally{requesting=false;}
  }
  function observed(next){
    const scenes=next.coordination?.scenes;if(!next.sceneKnown)return null;
    const scene=scenes?.scene,league=next.projects?.find(p=>p.name==='league_api')?.workflow,phase=league?.connected?league.phase:null;
    const session=next.projects?.find(p=>p.name==='scene_voice_switcher')?.workflow?.session;
    if(scenes.temporary_owner==='starting_soon'||scene==='Starting Soon')return 'starting';
    if(scenes.temporary_owner==='instant_replay')return current||'game';
    if(scene===next.lobbyData?.game_scene)return 'game';
    if(league?.champion_scene&&scene===league.champion_scene)return 'draft';
    if(scene==='Lobbies'||next.lobbyData?.lobbies?.includes(scene)){
      if(session?.held&&session.stage==='ending'&&session.lobby===next.lobbyData?.current_lobby)return 'ending';
      if(['Matchmaking','ReadyCheck','ChampSelect'].includes(phase))return 'draft';
      return 'lobby';
    }
    if(next.lobbyData?.other_scenes?.some(item=>item.scene===scene))return 'other';
    return null;
  }
  function paintEffects(worlds,ready){
    const source=context.lobbyData?.current_lobby;
    const authored=catalog?.locations?.find(w=>w.source===source)||worlds.find(w=>w.source===source);
    const actions=source==='Spirit Afterparty'?afterparty:authored?.effects?.actions||[];
    const key=JSON.stringify([source,actions]);
    if(key!==effectKey){effectKey=key;get('deskLobbyEffects').replaceChildren();get('deskLobbyOtherEffects').replaceChildren();
      actions.forEach((a,i)=>{const b=document.createElement('button');b.className='btn btn-secondary';b.textContent=a.label;b.dataset.lobbyEffect=a.id;
        b.onclick=()=>perform(b,()=>source==='Spirit Afterparty'?api.afterpartyAction(a.id):api.lobbyEffect(source,a.id),'Effect sent');
        get(i<3?'deskLobbyEffects':'deskLobbyOtherEffects').append(b);
      });get('deskMoreEffects').hidden=actions.length<=3;
    }
    const isLobby=context.coordination?.scenes?.scene==='Lobbies'||context.lobbyData?.lobbies?.includes(context.coordination?.scenes?.scene);
    get('deskEffectsStatus').textContent=!source?'Enter a lobby to use its effects':!actions.length?'No effects in this lobby':'';
    root.querySelectorAll('[data-lobby-effect]').forEach(b=>available(b,ready&&isLobby));
  }
  function available(button,enabled){button.dataset.available=String(!!enabled);if(!button.hasAttribute('aria-busy'))button.disabled=!enabled;button.title=enabled?'':!context.sceneKnown?'Open OBS to use this control':'';}
  function update(next){
    if(disposed)return;context=next;const ready=next.connected&&next.sceneKnown;
    const stage=observed(next);if(stage&&stage!==current){const first=!current;current=stage;if(!first||!browsed)open(stage,true);}updateBack();
    const awaiting=!browsed&&(!next.coordination||(next.sceneKnown&&!next.lobbyData));
    for(const id of stages)get('deskSection-'+id).hidden=awaiting||id!==shown;
    const start=next.projects?.find(p=>p.name==='starting_soon'),opening=start?.workflow?.opening??starting?.opening;
    if(!artDraft&&start?.workflow?.artwork_file){selectedArt=start.workflow.artwork_file;paintStarting();}
    get('deskSection-starting').querySelector('h2').textContent=opening?'Opening':'Starting soon';
    get('deskSection-starting').querySelector('.desk-small-controls').hidden=!!opening;
    get('startingAction').hidden=!!opening||next.coordination?.scenes?.scene==='Starting Soon';
    get('gameAction').hidden=ready&&next.coordination?.scenes?.scene===next.lobbyData?.game_scene;
    available(get('startingAction'),ready&&start?.actions?.some(a=>a.key==='start'));
    available(get('deskPlayIntro'),ready&&start?.actions?.some(a=>a.key==='intro')&&starting?.opening_catalog?.available&&!opening);
    get('deskPlayIntro').hidden=!!opening;get('deskSkipIntro').hidden=!opening;available(get('deskSkipIntro'),ready&&opening);
    available(get('deskStartLobby'),ready&&!!next.lobbyData);get('deskStartLobby').hidden=!!opening;
    get('deskIntroStatus').textContent=start?.workflow?.error||(opening?'Opening · Sanctuary':starting?.opening_catalog?.available?'Sanctuary · 40s':'');
    available(get('deskDraftGame'),ready&&!!next.lobbyData?.game_scene);available(get('deskNextLobby'),ready&&!!next.lobbyData);
    get('deskOtherTitle').textContent=next.lobbyData?.other_scenes?.find(item=>item.scene===next.coordination?.scenes?.scene)?.label||'Scene';
    available(get('deskOtherGame'),ready&&!!next.lobbyData?.game_scene);available(get('deskOtherLobby'),ready&&!!next.lobbyData);
    available(get('deskNextArt'),ready&&start?.is_active&&!opening);get('deskRotateArt').disabled=!next.connected||!starting;
    get('deskApplyArt').hidden=!artDraft||current!=='starting';available(get('deskApplyArt'),ready&&artDraft&&!opening);
    const currentSource=next.lobbyData?.current_lobby,worlds=next.lobbyData?.locations?.length?next.lobbyData.locations:catalog?.locations||[];
    const world=worlds.find(w=>w.source===currentSource);get('deskLobbyNow').textContent=currentSource?(world?.label||currentSource):'No lobby on screen';
    const choice=next.lobbyData?.selection||catalog?.selection;
    available(get('deskShuffleLobbies'),ready&&!!next.lobbyData);available(get('deskKeepLobby'),ready&&!!currentSource);
    get('deskShuffleLobbies').setAttribute('aria-pressed',String(choice?.mode!=='fixed'));get('deskKeepLobby').setAttribute('aria-pressed',String(choice?.mode==='fixed'&&choice.source===currentSource));
    const key=JSON.stringify(worlds.map(w=>[w.source,w.label,w.art_url]));if(key!==worldKey){worldKey=key;
      for(const section of ['lobby','ending']){
        const select=get(section==='lobby'?'deskLobbyChoice':'deskEndingChoice'),prior=select.value;
        select.replaceChildren(new Option(section==='lobby'?'From rotation':'Choose a lobby',''),...worlds.map(w=>new Option(w.label||w.source,w.source)));
        select.value=worlds.some(w=>w.source===prior)?prior:section==='ending'&&worlds.some(w=>w.source==='Spirit Afterparty')?'Spirit Afterparty':'';
        get('deskGallery-'+section).replaceChildren(...worlds.map(w=>artButton(w.label||w.source,w.art_url||'',w.source,()=>{select.value=w.source;select.dispatchEvent(new Event('change'));dialog.close();update(context);})));
      }
    }
    paintEffects(worlds,ready);
  }
  api.getLobbyCatalog().then(data=>{if(!disposed){catalog=data;update(context);}}).catch(()=>{});
  api.getAfterpartyActions().then(data=>{if(!disposed){afterparty=data.actions||[];update(context);}}).catch(()=>{});
  loadStarting();
  return {update,dispose(){disposed=true;dialog.remove();}};
}
