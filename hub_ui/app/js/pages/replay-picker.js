// Read-only catalogue presentation; explicit cards call the replay owner's API.
import {api} from '../api.js';
import {esc} from '../utils.js';
import {runWithFeedback} from '../action-feedback.js';
import {displayTitle} from './replay-card-labels.js';
import {mountPosters} from './replay-posters.js';
import {mountPlayQueue} from './replay-play-queue.js';

const PAGE_SIZE=18;
export function mountReplayPicker(host,refreshStatus){
  let disposed=false,loading=false,pending=false,loaded=false,ready=false,readAt=0,context={},clips=[],groups=[],kind='clips',query='',page=0,rendered='';
  const $=selector=>host.querySelector(selector);
  host.innerHTML=`<div class="replay-picker">
    <header class="replay-picker-heading"><h2>Clips &amp; montages</h2><a class="desk-text-link" href="#projects/instant_replay">Manage clips ↗</a></header>
    <div class="replay-picker-toolbar"><div class="replay-picker-tabs" role="group" aria-label="Media type"><button data-replay-kind="clips" aria-pressed="true">Clips</button><button data-replay-kind="montages" aria-pressed="false">Montages</button></div><button id="replayRandom" class="btn btn-secondary" title="Voice: press |, then say play random">⤨ Play random</button><input id="replayFind" type="search" aria-label="Find clips or montages" placeholder="Search…"></div>
    <div class="replay-picker-status"><span id="replayPickerStatus" role="status"></span><button id="replayPickerRetry" class="desk-text-link" hidden>Retry</button></div>
    <div id="replayPlaying" class="replay-playing" hidden><div><small id="replayPlayingState"></small><strong id="replayPlayingTitle"></strong></div><div class="replay-playing-controls"><button id="replayPause" class="btn btn-secondary">Pause</button><button id="replayResume" class="btn btn-secondary" hidden>Resume</button><button id="replayNext" class="btn btn-secondary">Next</button><button id="replayStop" class="btn btn-primary">Back to live</button></div></div>
    <div class="replay-play-layout"><div><div id="replayPickerGrid" class="replay-picker-grid" aria-label="Clips to play"></div>
    <div id="replayPickerPages" class="replay-picker-pages" hidden><button id="replayPrevious" class="btn btn-secondary" aria-label="Previous page">←</button><span id="replayPage"></span><button id="replayMore" class="btn btn-secondary" aria-label="Next page">→</button></div>
    </div><div id="replayQueueHost"></div></div></div>`;
  const posters=mountPosters($('#replayPickerGrid'));
  function playback(){
    const project=context.projects?.find(p=>p.name==='instant_replay'),stage=context.replayStage||{};
    return {stage,project,busy:!!stage.active||!!stage.pending||!!project?.is_active||project?.current_activity==='saving for replay',paused:!!stage.paused||!!project?.current_activity?.includes('paused')};
  }
  const canPlay=()=>loaded&&ready&&!!context.connected&&!pending&&!playback().busy;
  const queue=mountPlayQueue($('#replayQueueHost'),{findClip:path=>clips.find(c=>c.path===path),canStart:()=>canPlay(),onStart:start,refresh:refreshStatus});
  function items(){
    const byPath=new Map(clips.map(c=>[c.path,c]));
    return (kind==='clips'?clips.map(c=>({id:c.id||c.path,title:displayTitle(c),path:c.path,clip:c,available:true})):groups.map(g=>({id:g.id,title:g.name,path:g.paths?.find(p=>byPath.has(p)),group:g,available:!!g.paths?.length&&g.paths.every(p=>byPath.has(p))})))
      .filter(item=>`${item.title} ${item.clip?.name||''} ${item.clip?.notes||''} ${item.clip?.tag||''}`.toLowerCase().includes(query));
  }
  function paint(){
    if(disposed)return;
    const matches=items();page=Math.max(0,Math.min(page,Math.ceil(matches.length/PAGE_SIZE)-1));
    const visible=matches.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
    const html=visible.map(item=>`<article class="replay-card-wrap" draggable="${item.available}" data-item="${esc(item.id)}"><button class="replay-play-card" data-replay-id="${esc(item.id)}" ${item.path?`data-path="${esc(item.path)}"`:''} aria-label="Play ${esc(item.title)} on stream" title="${item.available?'Play on stream':'This montage has missing clips'}"><div class="replay-play-image"><img alt="" loading="lazy"><span class="replay-play-symbol" aria-hidden="true">▶</span><span class="replay-play-badge" ${item.group?'':'data-duration'}>${item.group?`${item.group.paths.length} clips`:'—'}</span>${item.group?'<span data-duration hidden></span>':''}</div><strong>${esc(item.title)}</strong></button><button class="replay-card-add" aria-label="Add ${esc(item.title)} to queue" ${item.available?'':'disabled'}>＋</button></article>`).join('')||`<div class="replay-picker-empty">${query?'No matches.':kind==='montages'?'No montages yet. Create one in Manage clips.':'No saved clips yet.'}</div>`;
    if(loaded&&html!==rendered){
      const focused=$('#replayPickerGrid').querySelector(':focus')?.dataset.replayId;
      rendered=html;$('#replayPickerGrid').innerHTML=html;
      $('#replayPickerGrid').querySelectorAll('[data-replay-id]').forEach((card,i)=>{
        const item=visible[i],paths=item.group?item.group.paths:[item.path],wrap=card.parentElement;
        card.onclick=()=>play(card,item);wrap.querySelector('.replay-card-add').onclick=()=>queue.add(paths);
        wrap.ondragstart=e=>{if(!item.available){e.preventDefault();return;}e.dataTransfer.setData('application/x-replay-clips',JSON.stringify(paths));e.dataTransfer.effectAllowed='copy';};
        if(card.dataset.replayId===focused)card.focus();
      });
      posters.scan();
    }
    for(const card of $('#replayPickerGrid').querySelectorAll('[data-replay-id]'))card.disabled=!canPlay()||!visible.find(item=>String(item.id)===card.dataset.replayId)?.available;
    host.querySelectorAll('[data-replay-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.replayKind===kind)));
    $('#replayPickerGrid').setAttribute('aria-label',kind==='clips'?'Clips to play':'Montages to play');
    $('#replayPickerPages').hidden=matches.length<=PAGE_SIZE;$('#replayPrevious').disabled=page===0;$('#replayMore').disabled=(page+1)*PAGE_SIZE>=matches.length;
    $('#replayPage').textContent=`${page+1} / ${Math.max(1,Math.ceil(matches.length/PAGE_SIZE))}`;
    const {stage,project,busy,paused}=playback();
    $('#replayPlaying').hidden=!busy;
    $('#replayPlayingTitle').textContent=stage.title||project?.current_activity||'Preparing clip…';
    $('#replayPlayingState').textContent=paused?'Paused':stage.pending?'Preparing…':'Playing on stream';
    $('#replayPause').hidden=paused;$('#replayResume').hidden=!paused;
    for(const id of ['replayPause','replayResume','replayNext','replayStop'])$('#'+id).disabled=!context.connected||pending||!busy||(id!=='replayStop'&&!!stage.pending);
    $('#replayRandom').disabled=!canPlay()||!clips.some(c=>c.highlight_candidate??(c.purpose==='highlight'&&c.review_state!=='dismissed'));
    queue.update(context.replayQueue);
    if($('#replayPickerRetry').hidden)$('#replayPickerStatus').textContent=!loaded?'Loading clips…':!ready||!context.connected?'Playback offline':pending?'Starting…':busy?'':'Click a card to play on stream';
  }
  async function play(button,item){
    if(!canPlay()||!item.available)return;
    await start(button,()=>item.group?api.playReplayGroup(item.id):api.playReplayClip(item.path,'showcase'));
  }
  async function start(button,action){
    if(!canPlay())return null;
    pending=true;
    const request=runWithFeedback(button,action,'Playback requested');
    paint();const result=await request;
    if(disposed)return;
    // Re-read playback state before allowing another request.
    try{const stage=await api.getReplayStage();if(!disposed)context={...context,replayStage:stage};}catch{ready=false;}
    try{const snapshot=await api.getReplayQueue();if(!disposed)context={...context,replayQueue:snapshot};}catch{}
    if(disposed)return;pending=false;paint();refreshStatus();return result;
  }
  async function control(button,action){
    if(pending)return;pending=true;const request=runWithFeedback(button,action);paint();await request;
    if(disposed)return;pending=false;paint();refreshStatus();
  }
  async function load(){
    if(disposed||loading||document.hidden)return;loading=true;readAt=Date.now();
    try{const data=await api.getReplayClips();if(disposed)return;clips=data.clips||[];groups=data.groups||[];ready=!!data.ready;loaded=true;$('#replayPickerRetry').hidden=true;paint();}
    catch{if(!disposed){ready=false;$('#replayPickerStatus').textContent='Could not load clips';$('#replayPickerRetry').hidden=false;$('#replayPickerGrid').querySelectorAll('button').forEach(b=>b.disabled=true);}}
    finally{loading=false;}
  }
  host.querySelectorAll('[data-replay-kind]').forEach(button=>button.onclick=()=>{kind=button.dataset.replayKind;page=0;paint();});
  $('#replayFind').oninput=e=>{query=e.target.value.trim().toLowerCase();page=0;paint();};
  $('#replayPrevious').onclick=()=>{page--;paint();};$('#replayMore').onclick=()=>{page++;paint();};$('#replayPickerRetry').onclick=load;
  $('#replayRandom').onclick=()=>start($('#replayRandom'),()=>api.playReplayRandom());
  $('#replayPickerGrid').ondragover=e=>{if(e.dataTransfer.types.includes('application/x-replay-queue')){e.preventDefault();e.dataTransfer.dropEffect='move';}};
  $('#replayPickerGrid').ondrop=e=>{const id=e.dataTransfer.getData('application/x-replay-queue');if(id){e.preventDefault();queue.remove(id);}};
  for(const [id,action] of [['replayPause',()=>api.pauseProject('instant_replay')],['replayResume',()=>api.resumeProject('instant_replay')],['replayNext',()=>api.skipReplayClip()],['replayStop',()=>api.revertProject('instant_replay')]])$('#'+id).onclick=e=>control(e.currentTarget,action);
  return {update(next){context=next;paint();if(Date.now()-readAt>10000)load();},dispose(){disposed=true;posters.dispose();queue.dispose();host.replaceChildren();}};
}
