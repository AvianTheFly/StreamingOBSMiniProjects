import {pollVisible} from '/shared/visible-poll.js';
const $=id=>document.getElementById(id);
let state=null, selected=null, signature='', gamesSignature='', busy=false, shown=true, request=null;
const timestamp=value=>new Date(value*1000).toLocaleString();
const time=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function button(text,fn){const el=node('button',text);el.disabled=busy;el.onclick=fn;return el;}
async function action(url,data={}){
  if(busy)return;busy=true;render();request=new AbortController();
  const deadline=setTimeout(()=>request?.abort(),10000);
  try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:request.signal});
    const result=await response.json();if(!response.ok||result.ok===false)throw Error(result.error||'Action failed');
    if(shown)$('feedback').textContent=result.message||'Saved';
  }catch(error){if(shown)$('feedback').textContent=error.message;}
  finally{clearTimeout(deadline);request=null;busy=false;if(shown){render();poll.refresh();}}
}
function select(row){
  selected=row.id;signature='';$('selected-title').textContent=row.path.split(/[\\/]/).pop();
  $('path').textContent=row.path;$('video').src=`/recordings/media?id=${encodeURIComponent(row.id)}`;
  renderMarkers(row);
}
function renderMarkers(row){
  const marks=row?.markers||[], next=JSON.stringify([row?.id,marks]);if(next===signature)return;signature=next;
  $('markers').replaceChildren(node('h3',`${marks.length} marked moments`));
  if(!marks.length)$('markers').append(node('p','No moments marked in this recording.'));
  for(const marker of marks){
    const extra=marker.source==='instant_replay'?(marker.clip_path?' · replay saved':' · replay requested'):'';
    const el=button(`${time(marker.offset_seconds)} · ${marker.label}${extra}`,()=>{
      $('video').currentTime=marker.offset_seconds;$('video').focus();
    });el.className='marker';$('markers').append(el);
    if(marker.clip_path)$('markers').append(node('p',marker.clip_path));
  }
}
function render(){
  if(!state)return;
  $('status').textContent=state.status+(state.stop_in!=null?` (${Math.ceil(state.stop_in)}s remaining)`:'');
  $('error').textContent=state.error||'';$('cleanup').textContent=state.cleanup||'';$('audio').textContent=state.audio;
  document.querySelectorAll('[data-current]').forEach(el=>el.disabled=busy||(!state.active&&!state.latest));
  $('mark').disabled=busy||!state.owned;
  const nextGames=JSON.stringify([state.recordings,state.active,busy]);
  if(nextGames===gamesSignature)return;gamesSignature=nextGames;
  $('games').replaceChildren();
  if(state.active)$('games').append(node('p',`Current game: ${state.active.decision==='kept'?'protected':state.active.decision==='deleted'?'delete after finish':'unreviewed'} · ${state.active.markers.length} markers`));
  const rows=[...state.recordings].reverse();
  if(!rows.length)$('games').append(node('p','Finished automatic games will appear here.'));
  for(const row of rows){
    const card=node('article','');card.className='game';
    card.append(node('strong',row.path.split(/[\\/]/).pop()));
    const available=['pending','kept'].includes(row.decision);
    card.append(node('p',`${row.decision==='kept'?'Kept permanently':row.decision==='pending'?`Expires ${row.expires_at?timestamp(row.expires_at):'after migration (3 days)'}`:row.decision} · ${(row.markers||[]).length} markers`));
    if(available){
      card.append(button('Review markers',()=>select(row)));
      if(row.decision!=='kept')card.append(button('Keep',()=>action('/recordings/decision',{id:row.id,decision:'kept'})));
      card.append(button('Delete permanently',()=>action('/recordings/decision',{id:row.id,decision:'deleted'})));
    }
    $('games').append(card);
    if(selected===row.id){
      if(available)renderMarkers(row);
      else{$('video').removeAttribute('src');$('video').load();$('markers').replaceChildren(node('p','This recording has been removed.'));selected=null;}
    }
  }
}
document.querySelectorAll('[data-current]').forEach(el=>el.onclick=()=>action('/recordings/decision',{decision:el.dataset.current}));
$('mark').onclick=()=>action('/recordings/mark');
const poll=pollVisible({url:'/recordings/state',interval:2000,onData:data=>{state=data;render();},onError:()=>{$('error').textContent='Recording service unavailable. Reconnecting…';}});
window.addEventListener('pagehide',()=>{shown=false;request?.abort();$('video').pause();});
window.addEventListener('pageshow',()=>{shown=true;poll.refresh();});
