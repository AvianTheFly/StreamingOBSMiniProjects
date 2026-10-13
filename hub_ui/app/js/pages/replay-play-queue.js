// Queue presentation and draft preparation; the feature worker owns continuation.
import {api} from '../api.js';
import {esc} from '../utils.js';
import {toast} from '../toast.js';
import {displayTitle} from './replay-card-labels.js';
import {mountPosters} from './replay-posters.js';

export function mountPlayQueue(host,{findClip,canStart,onStart,refresh,onChange}){
  let disposed=false,pending=false,live=null,draft=[],serial=0,rendered='';
  host.innerHTML=`<aside class="replay-queue" aria-label="Playback queue"><header><h3>Up next <span id="replayQueueCount"></span></h3><button id="replayClearQueue" class="desk-text-link">Clear</button></header><div id="replayQueueRows" class="replay-queue-rows"></div><footer><button id="replayStartQueue" class="btn btn-primary">▶ Play queue</button><span id="replayQueueMode"></span></footer><p id="replayQueueHint">Drag clips here, or use + on a card.</p></aside>`;
  const $=s=>host.querySelector(s),posters=mountPosters($('#replayQueueRows'));
  const active=()=>!!live?.active;
  const entries=()=>active()?live.upcoming||[]:draft;
  function paint(){
    if(disposed)return;
    const rows=entries();$('#replayQueueCount').textContent=rows.length?rows.length:'';
    $('#replayQueueMode').textContent=active()&&live.random?'Random · keeps playing':'';
    $('#replayStartQueue').hidden=active();$('#replayStartQueue').disabled=pending||!canStart()||!rows.length;
    $('#replayClearQueue').disabled=pending||!rows.length;
    $('#replayQueueHint').textContent=active()?'Drag to reorder · drop back in the library to remove':'Drag clips here, or use + on a card.';
    const html=rows.map((entry,i)=>`<div class="replay-queue-row" data-entry="${esc(entry.id)}" data-path="${esc(entry.path)}" draggable="true"><div class="replay-queue-thumb"><img alt=""><span data-duration hidden></span></div><span class="replay-queue-title">${esc(displayTitle(findClip(entry.path)))}</span><div class="replay-queue-row-actions"><button data-up aria-label="Move clip ${i+1} up" ${i===0?'disabled':''}>↑</button><button data-down aria-label="Move clip ${i+1} down" ${i===rows.length-1?'disabled':''}>↓</button><button data-remove aria-label="Remove clip ${i+1} from queue">×</button></div></div>`).join('')||'<div class="replay-queue-empty"><span aria-hidden="true">＋</span>Drop clips here</div>';
    if(html!==rendered){
      const focused=document.activeElement?.closest('[data-entry]')?.dataset.entry,action=document.activeElement?.dataset;
      rendered=html;$('#replayQueueRows').innerHTML=html;
      $('#replayQueueRows').querySelectorAll('[data-entry]').forEach((row,i)=>{
        row.ondragstart=e=>{e.dataTransfer.setData('application/x-replay-queue',row.dataset.entry);e.dataTransfer.effectAllowed='move';};
        row.querySelector('[data-remove]').onclick=()=>edit({action:'remove',id:row.dataset.entry});
        row.querySelector('[data-up]').onclick=()=>edit({action:'move',id:row.dataset.entry,before:rows[i-1]?.id});
        row.querySelector('[data-down]').onclick=()=>edit({action:'move',id:row.dataset.entry,before:rows[i+2]?.id});
        if(row.dataset.entry===focused)row.querySelector(action&&'up' in action?'[data-up]':action&&'down' in action?'[data-down]':'[data-remove]').focus();
      });posters.scan();
    }
    $('#replayQueueRows').querySelectorAll('button').forEach(b=>{if(pending)b.disabled=true;});
    host.classList.toggle('is-pending',pending);onChange?.();
  }
  async function edit(body){
    if(disposed||pending)return;
    if(active()){
      pending=true;paint();
      try{const result=await api.editReplayQueue({...body,session:live.session,revision:live.revision});if(!disposed)live=result;}
      catch(e){if(!disposed){toast.error(e.message);try{live=await api.getReplayQueue();}catch{}}}
      finally{if(!disposed){pending=false;rendered='';paint();refresh();}}
    }else{
      if(body.action==='add'){
        if(draft.length+body.paths.length>200){toast.error('The queue holds up to 200 clips.');return;}
        const index=body.before?draft.findIndex(e=>e.id===body.before):draft.length;
        draft.splice(index<0?draft.length:index,0,...body.paths.map(path=>({id:`draft-${++serial}`,path})));
      }else if(body.action==='clear')draft=[];
      else{const index=draft.findIndex(e=>e.id===body.id);if(index<0)return;const [entry]=draft.splice(index,1);if(body.action==='move'){const target=draft.findIndex(e=>e.id===body.before);draft.splice(target<0?draft.length:target,0,entry);}}
      paint();
    }
  }
  $('#replayQueueRows').ondragover=e=>{if([...e.dataTransfer.types].some(t=>['application/x-replay-queue','application/x-replay-clips'].includes(t))){e.preventDefault();e.dataTransfer.dropEffect=e.dataTransfer.types.includes('application/x-replay-queue')?'move':'copy';}};
  $('#replayQueueRows').ondrop=e=>{e.preventDefault();const before=e.target.closest('[data-entry]')?.dataset.entry,id=e.dataTransfer.getData('application/x-replay-queue');if(id){if(id!==before)edit({action:'move',id,before});}else try{const paths=JSON.parse(e.dataTransfer.getData('application/x-replay-clips'));if(Array.isArray(paths))add(paths,before);}catch{}};
  $('#replayClearQueue').onclick=()=>edit({action:'clear'});
  $('#replayStartQueue').onclick=async()=>{if(!canStart()||pending||!draft.length)return;const paths=draft.map(e=>e.path);const result=await onStart($('#replayStartQueue'),()=>api.playReplayPaths(paths));if(result&&!disposed){draft=[];try{live=await api.getReplayQueue();}catch{}paint();}};
  function add(paths,before){const valid=paths.filter(path=>findClip(path));if(valid.length)edit({action:'add',paths:valid,before});}
  paint();
  return {add,remove:id=>edit({action:'remove',id}),update(snapshot){if(disposed)return;if(!pending&&snapshot?.supported&&(!live||snapshot.session!==live.session||snapshot.revision>=live.revision))live=snapshot;paint();},dispose(){disposed=true;posters.dispose();}};
}
