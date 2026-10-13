// Broadcast lifecycle controls remain separate from stage browsing.
import {api} from '../api.js';
import {runWithFeedback} from '../action-feedback.js';
export function mountDeskSession(root,refresh){
  const button=root.querySelector('#deskBroadcast'),dialog=document.createElement('dialog');dialog.className='desk-end-dialog';
  dialog.innerHTML='<h2>End your stream?</h2><div><button class="btn btn-secondary" data-cancel>Keep streaming</button><button class="btn btn-primary" data-confirm>End stream now</button></div>';root.append(dialog);
  let context={},disposed=false;
  const confirm=dialog.querySelector('[data-confirm]');
  async function run(target,action){const result=await runWithFeedback(target,()=>api.runHubAction(action),'Broadcast request sent');if(result&&!disposed){dialog.close();refresh();}}
  button.onclick=()=>{if(context.coordination?.stream?.active)dialog.showModal();else run(button,'start_stream');};
  dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();confirm.onclick=()=>run(confirm,'stop_stream');
  dialog.addEventListener('close',()=>{if(!disposed)button.focus();});
  return {update(next){context=next;const active=next.coordination?.stream?.active,ready=next.connected&&next.coordination?.scenes?.observing&&typeof active==='boolean';button.textContent=active?'End stream':'Go live';for(const b of [button,confirm]){b.dataset.available=String(!!ready);if(!b.hasAttribute('aria-busy'))b.disabled=!ready;}root.querySelector('#streamState').textContent=ready?(active?'● Live':'Not streaming'):'Connecting…';},dispose(){disposed=true;dialog.remove();}};
}
