// The Lobby display and queue theme consume desk snapshots; no extra polling owner.
import {api} from '../api.js';
import {runWithFeedback} from '../action-feedback.js';
const themes=[['bear','Bear · thunder'],['turtle','Turtle · shield'],['ram','Ram · resolve'],['phoenix','Phoenix · storm'],['rotate','Shuffle spirits · 45s']];
const displays=[['none','Scenery only'],['udyr','Udyr animation'],['client','League client'],['desktop','Desktop'],['chrome','Google Chrome']];
export function mountQueueControls(root,refresh){
  const host=root.querySelector('#deskQueueControls');let disposed=false,context={},shown='starting',selected=null,busy=false;
  host.innerHTML=`<div class="lobby-screen-choice"><div><strong>Lobby screen</strong><small>Choose what fills the display inside your lobby.</small></div><div class="lobby-display-buttons">${displays.map(([id,label])=>`<button class="btn btn-secondary" data-lobby-content="${id}">${label}</button>`).join('')}</div></div><div class="queue-theme-choice"><div><strong>Queue timer</strong><small id="deskQueueTimer">Queue → ready check → bans · picks switch to the draft scene</small></div><div class="queue-theme-buttons">${themes.map(([id,label])=>`<button class="btn btn-secondary" data-queue-theme="${id}">${label}</button>`).join('')}</div><details id="deskQueuePreview"><summary>Preview timer · off stream</summary><iframe title="Queue timer preview" loading="lazy"></iframe></details></div><span id="deskQueueMessage" role="status"></span>`;
  const preview=host.querySelector('details'),frame=host.querySelector('iframe');
  function paint(){
    if(disposed)return;host.hidden=shown!=='lobby';
    const league=context.projects?.find(p=>p.name==='league_api')?.workflow||{},display=context.lobbyData?.display;
    selected=league.queue_theme||'bear';
    host.querySelectorAll('[data-lobby-content]').forEach(b=>{b.setAttribute('aria-pressed',String(display?.selected===b.dataset.lobbyContent));b.dataset.available=String(!busy&&context.connected&&!!display?.options?.some(o=>o.id===b.dataset.lobbyContent&&o.available));if(!b.hasAttribute('aria-busy'))b.disabled=b.dataset.available==='false';});
    host.querySelectorAll('[data-queue-theme]').forEach(b=>{b.setAttribute('aria-pressed',String(selected===b.dataset.queueTheme));b.dataset.available=String(!busy&&context.connected&&context.projects?.some(p=>p.name==='league_api'));if(!b.hasAttribute('aria-busy'))b.disabled=b.dataset.available==='false';});
    const queue=league.stage?.queue_timer;
    host.querySelector('#deskQueueTimer').textContent=queue?.active?`${queue.status.toLowerCase()} · ${Math.floor(queue.seconds/60)}:${String(Math.floor(queue.seconds)%60).padStart(2,'0')} · timer continues through bans`:'Queue → ready check → bans · picks switch to the draft scene';
    if(preview.open&&!host.hidden){const url=`http://127.0.0.1:7431/stage/queue?demo=1&theme=${selected}`;if(frame.getAttribute('src')!==url)frame.src=url;}else frame.removeAttribute('src');
  }
  host.onclick=async e=>{
    const b=e.target.closest('[data-lobby-content],[data-queue-theme]');if(!b||b.disabled||busy)return;
    const content=b.dataset.lobbyContent,theme=b.dataset.queueTheme;
    busy=true;const pending=runWithFeedback(b,()=>content?api.setLobbyContent(content):api.setQueueTheme(theme),content?'Lobby display updated':'Queue theme saved');paint();
    const result=await pending;busy=false;
    if(disposed)return;if(!result){paint();return;}
    if(content)context={...context,lobbyData:{...context.lobbyData,display:result}};
    else{const project=context.projects?.find(p=>p.name==='league_api');if(project)context={...context,projects:context.projects.map(p=>p===project?{...p,workflow:{...p.workflow,queue_theme:theme}}:p)};}
    host.querySelector('#deskQueueMessage').textContent=content?(content==='none'?'Scenery revealed; the media screen is hidden.':'Showing '+displays.find(d=>d[0]===content)[1]+' in the lobby display.'):'Theme saved. Browsing the preview stays off stream.';paint();refresh();
  };
  preview.addEventListener('toggle',paint);
  return {update(next,stage){context=next;shown=stage;paint();},dispose(){disposed=true;frame.removeAttribute('src');host.onclick=null;}};
}
