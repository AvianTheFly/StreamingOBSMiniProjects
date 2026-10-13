// Global, manually triggered sound effects; independent of stage selection.
import {api} from '../api.js';
import {runWithFeedback} from '../action-feedback.js';
export function mountDeskSounds(root){
  const dialog=document.createElement('dialog');dialog.className='stage-sounds-dialog';dialog.setAttribute('aria-label','Sound effects');
  dialog.innerHTML='<header><h2>Sound effects</h2><button class="btn btn-secondary" data-close>Close</button></header><input type="search" placeholder="Find a sound" aria-label="Find a sound"><div class="stage-sound-list"></div><p role="status"></p>';root.append(dialog);
  let disposed=false,generation=0,items=[];
  const opener=root.querySelector('#deskSounds'),search=dialog.querySelector('input'),list=dialog.querySelector('.stage-sound-list'),message=dialog.querySelector('[role=status]');
  function paint(){list.replaceChildren(...items.filter(s=>s.toLowerCase().includes(search.value.toLowerCase())).map(source=>{const button=document.createElement('button');button.className='btn btn-secondary';button.textContent='▶ '+source;button.onclick=()=>runWithFeedback(button,()=>api.playSfx(source),'Sound requested');return button;}));}
  opener.onclick=async()=>{const token=++generation;dialog.showModal();search.value='';message.textContent='Loading sounds…';try{const rows=await api.getSfxLibrary();if(disposed||token!==generation)return;items=rows;paint();message.textContent=items.length?'':'No sound effects available';}catch(error){if(!disposed&&token===generation)message.textContent=error.message;}};
  search.oninput=paint;dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{generation++;if(!disposed)opener.focus();});
  return {dispose(){disposed=true;generation++;dialog.remove();}};
}
