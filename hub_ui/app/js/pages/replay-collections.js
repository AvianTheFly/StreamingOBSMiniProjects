import { api } from '../api.js';
import { esc } from '../utils.js';
import { clipTitle } from './replay-review.js';
import {displayTitle} from './replay-card-labels.js';
import {mountPosters} from './replay-posters.js';

export function mountCollections(host, options, paths = []) {
  let disposed = false, saving = false, dirty = !!paths.length;
  let revision = options.snapshot().revision;
  const fresh = () => ({id:null,name:'',paths:[]});
  let draft = paths.length ? {...fresh(),paths:[...paths]} : structuredClone(options.startNew?fresh():options.snapshot().groups.find(g=>g.id===options.groupId)||options.snapshot().groups[0]||fresh());
  const posters=mountPosters(host);
  const $ = selector => host.querySelector(selector);
  const canLeave = () => !saving && (!dirty || window.confirm('Discard unsaved compilation changes?'));
  function render() {
    const groups = options.snapshot().groups;
    host.innerHTML = `<div class="ir-heading"><h2>Montage</h2><button id="irNewGroup" class="btn btn-secondary btn-sm">+ New</button></div>
      <label class="ir-form">Choose a compilation<select id="irGroupPicker"><option value="">New compilation…</option>${groups.map(g=>`<option value="${esc(g.id)}">${esc(g.name)} (${g.paths.length})</option>`).join('')}</select></label>
      <label class="ir-form">Name<input id="irGroupName" maxlength="100" placeholder="e.g. Stream intro" value="${esc(draft.name)}"></label>
      <div class="ir-heading"><strong>Playback order</strong><button id="irAddSelected" class="btn btn-secondary btn-sm">Add selected clips</button></div><div id="irSequence" class="ir-sequence" aria-label="Compilation playback order"></div>
      <details class="ir-montage-add" ${draft.paths.length?'':'open'}><summary>＋ Add clips</summary><input id="irMontageSearch" type="search" placeholder="Find a clip…" aria-label="Find montage clips"><div id="irMontageAvailable" class="ir-montage-available"></div><div id="irMontagePages" class="ir-montage-pages"><button id="irMontagePrevious" class="btn btn-secondary btn-sm" aria-label="Previous montage clip page">←</button><span id="irMontagePage"></span><button id="irMontageNext" class="btn btn-secondary btn-sm" aria-label="Next montage clip page">→</button></div></details>
      <div class="ir-actions"><button id="irSaveGroup" class="btn btn-primary btn-sm">Save compilation</button><button id="irCancelGroup" class="btn btn-secondary btn-sm">Cancel edits</button><span id="irGroupState" class="ir-muted" role="status"></span></div>
      <div class="ir-group-play"><button id="irPlayGroup" class="btn btn-secondary btn-sm">Play compilation in OBS</button><p id="irGroupVoice" class="ir-muted"></p></div>
      <details class="ir-review-fold"><summary>Manage this compilation</summary><div class="ir-actions"><button id="irDuplicate" class="btn btn-secondary btn-sm">Duplicate</button><button id="irDeleteGroup" class="btn btn-secondary btn-sm">Delete compilation</button></div><p class="ir-muted">Deleting a compilation keeps all recordings.</p></details>`;
    $('#irGroupPicker').value = draft.id || '';
    $('#irNewGroup').onclick = () => { if (canLeave()) { draft = fresh(); dirty = false; revision = options.snapshot().revision; render(); $('#irGroupName').focus(); } };
    $('#irGroupPicker').onchange = e => { if (!canLeave()) { e.target.value = draft.id || ''; return; } draft = structuredClone(groups.find(g=>g.id===e.target.value) || fresh()); dirty = false; revision = options.snapshot().revision; render(); };
    $('#irGroupName').oninput = e => { draft.name = e.target.value; dirty = true; status(); };
    $('#irAddSelected').onclick = () => add(options.selected());
    $('#irCancelGroup').onclick = () => { draft = structuredClone(options.snapshot().groups.find(g=>g.id===draft.id) || fresh()); dirty = false; revision = options.snapshot().revision; render(); };
    $('#irSaveGroup').onclick = () => save({action:'group',...draft});
    $('#irPlayGroup').onclick = () => options.onPlay(()=>api.playReplayGroup(draft.id));
    $('#irDuplicate').onclick = () => { if (canLeave()) { draft = {...structuredClone(draft),id:null,name:`${draft.name} copy`}; dirty = true; render(); } };
    $('#irDeleteGroup').onclick = () => { if (draft.id && window.confirm(`Delete “${draft.name}”? Recordings remain.`)) save({action:'delete_group',id:draft.id}); };
    let availablePage=0;
    function available(){
      const needle=$('#irMontageSearch').value.toLowerCase();
      const matches=options.snapshot().clips.filter(c=>!c.trashed&&`${displayTitle(c)} ${c.name}`.toLowerCase().includes(needle));
      availablePage=Math.max(0,Math.min(availablePage,Math.ceil(matches.length/24)-1));
      $('#irMontagePages').hidden=matches.length<=24;$('#irMontagePrevious').disabled=availablePage===0;$('#irMontageNext').disabled=(availablePage+1)*24>=matches.length;$('#irMontagePage').textContent=`${availablePage+1} / ${Math.max(1,Math.ceil(matches.length/24))}`;
      $('#irMontageAvailable').innerHTML=matches.slice(availablePage*24,(availablePage+1)*24).map(c=>`<button class="ir-montage-choice" data-path="${esc(c.path)}" draggable="true" aria-label="Add ${esc(displayTitle(c))} to montage"><img alt=""><span data-duration hidden></span><span>${esc(displayTitle(c))}</span><b>＋</b></button>`).join('');
      $('#irMontageAvailable').querySelectorAll('[data-path]').forEach(card=>{card.onclick=()=>add([card.dataset.path]);card.ondragstart=e=>e.dataTransfer.setData('application/x-replay-clips',JSON.stringify([card.dataset.path]));});posters.scan();
    }
    $('#irMontageSearch').oninput=()=>{availablePage=0;available();};$('#irMontagePrevious').onclick=()=>{availablePage--;available();};$('#irMontageNext').onclick=()=>{availablePage++;available();};available();
    sequence();
  }
  function status() {
    $('#irSaveGroup').disabled = saving || !dirty || !draft.name.trim();
    $('#irCancelGroup').disabled = saving || !dirty;
    $('#irPlayGroup').disabled = !options.canPlay() || saving || dirty || !draft.id || !draft.paths.length || draft.paths.some(p=>!options.findClip(p)||options.findClip(p).trashed);
    $('#irDeleteGroup').disabled = saving || !draft.id; $('#irDuplicate').disabled = saving || !draft.id;
    $('#irAddSelected').disabled = saving || !options.selected().length;
    $('#irGroupState').textContent = saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved';
    $('#irGroupVoice').textContent = draft.id && !dirty ? `Voice: press |, then say “play intro ${draft.name}”` : 'Name your compilation and add clips to begin.';
  }
  function add(paths) { if (!saving) { draft.paths.push(...paths.filter(p=>options.findClip(p))); dirty = true; sequence(); } }
  function move(from,to) { if (saving || from === to || to < 0 || to >= draft.paths.length) return; const [p] = draft.paths.splice(from,1); draft.paths.splice(to,0,p); dirty = true; sequence(); }
  function sequence() {
    const target = $('#irSequence');
    target.innerHTML = draft.paths.map((path,i)=>`<div class="ir-sequence-row" draggable="true" data-index="${i}" ${options.findClip(path)?`data-path="${esc(path)}"`:''}><span class="ir-muted">${i+1}</span><div class="replay-queue-thumb"><img alt=""><span data-duration hidden></span></div><span class="ir-sequence-name">${esc(displayTitle(options.findClip(path)))}${options.findClip(path)&&!options.findClip(path).trashed?'':`<small>Missing or in Trash</small>`}</span><button data-move="-1" class="btn btn-secondary btn-sm" aria-label="Move clip ${i+1} up" ${i===0?'disabled':''}>↑</button><button data-move="1" class="btn btn-secondary btn-sm" aria-label="Move clip ${i+1} down" ${i===draft.paths.length-1?'disabled':''}>↓</button><button data-remove class="btn btn-secondary btn-sm" aria-label="Remove clip ${i+1}">×</button></div>`).join('') || '<div class="ir-empty">Drop clips here in playback order.</div>';
    target.querySelectorAll('[data-index]').forEach(row=> {
      const i = Number(row.dataset.index);
      row.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>move(i,i+Number(b.dataset.move)));
      row.querySelector('[data-remove]').onclick=()=>{if(!saving){draft.paths.splice(i,1);dirty=true;sequence();}};
      row.ondragstart=e=>{e.dataTransfer.setData('application/x-replay-order',String(i));};
    });
    target.ondragover=e=>{if([...e.dataTransfer.types].some(t=>t.startsWith('application/x-replay-')))e.preventDefault();};
    target.ondrop=e=>{e.preventDefault();if(saving)return;const order=e.dataTransfer.getData('application/x-replay-order');if(order!=='')move(Number(order),Number(e.target.closest('[data-index]')?.dataset.index ?? draft.paths.length-1));else try{const p=JSON.parse(e.dataTransfer.getData('application/x-replay-clips'));if(Array.isArray(p))add(p);}catch{}};
    status();
    posters.scan();
  }
  async function save(payload) {
    if (saving) return; saving = true; host.querySelectorAll('input,select,button').forEach(e=>e.disabled=true);
    const result = await options.mutate(payload,revision);
    if (disposed) return;
    saving = false;
    if(result) { dirty = false; revision = result.revision; draft = structuredClone(result.groups.find(g=>g.name===draft.name.trim()) || result.groups[0] || fresh()); }
    render();
    if(!result)$('#irGroupState').textContent='Could not save. Cancel edits to load the current version.';
  }
  render();
  return {canLeave,isDirty:()=>dirty,updateStatus:status,add,dispose(){disposed=true;posters.dispose();}};
}
