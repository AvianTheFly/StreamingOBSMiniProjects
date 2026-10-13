import { api } from '../api.js';
import { esc } from '../utils.js';
import { toast } from '../toast.js';
import { mountReview, clipTitle, purposeLabel } from './replay-review.js';
import { mountPosters } from './replay-posters.js';
import { mountCollections } from './replay-collections.js';
import {displayTitle} from './replay-card-labels.js';

const PAGE_SIZE = 18;
const normalize = clip => ({...clip, purpose:['highlight','review_later','replay_only'].includes(clip.purpose)?clip.purpose:'highlight',review_state:clip.review_state || (clip.kept?'kept':'pending')});

export function mountClipDesk(host, options) {
  let disposed = false, loading = false, saving = false, timer, editor, view = 'review';
  let clips = [], groups = [], revision = 0, current = '', queue = 'all', purpose = 'all', query = '', page = 0, rendered = '', mode='clips',trashSupported=false;
  const selected = new Set(), $ = selector => host.querySelector(selector);
  host.innerHTML = `<div class="ir-manage-top"><div class="replay-picker-tabs"><button id="irClipsTab" aria-pressed="true">Clips</button><button id="irCollections" aria-pressed="false">Montages</button></div><button id="irNewMontage" class="btn btn-secondary">＋ New montage</button></div>
    <div class="ir-workspace"><section class="card ir-library" aria-label="Clip library"><div class="ir-library-filters"><label class="ir-sr" for="irSearch">Search clips</label><input id="irSearch" type="search" placeholder="Search…"><button id="irRefresh" class="btn btn-secondary btn-sm" aria-label="Refresh clips">↻</button></div>
    <div id="irClipFilters"><div class="ir-queue-tabs" role="tablist" aria-label="Clip views"><button data-queue="all" role="tab">All clips <span></span></button><button data-queue="favorite" role="tab">★ Favorites <span></span></button><button data-queue="trash" role="tab">Trash <span></span></button><details class="ir-manage-filters"><summary>Filters</summary><div><button data-queue="pending" role="tab">To review <span></span></button><button data-queue="kept" role="tab">Kept <span></span></button><button data-queue="dismissed" role="tab">Set aside <span></span></button><label class="ir-sr" for="irScope">Save type</label><select id="irScope"><option value="all">All types</option><option value="review_later">Review later</option><option value="highlight">Replay ready</option><option value="replay_only">Replay only</option></select></div></details></div>
    <div class="ir-selection"><label><input id="irSelectPage" type="checkbox">Select all</label><span id="irCount" class="ir-muted"></span><div id="irBulkActions" class="ir-bulk-actions" hidden><span id="irSelected"></span><button id="irBulkKeep" class="btn btn-secondary btn-sm">Keep</button><button id="irAdd" class="btn btn-secondary btn-sm">＋ Montage</button><button id="irBulkTrash" class="btn btn-secondary btn-sm">Delete</button><button id="irBulkRestore" class="btn btn-secondary btn-sm">Restore</button><button id="irClear" class="btn btn-secondary btn-sm">Clear</button></div></div></div>
    <div id="irClips" class="ir-card-grid">Loading your clips…</div><div id="irMontageGrid" class="ir-card-grid" hidden></div><div class="ir-pagination"><button id="irPrev" class="btn btn-secondary btn-sm">← Previous</button><span id="irPage"></span><button id="irNext" class="btn btn-secondary btn-sm">Next →</button></div></section></div>
    <dialog id="irEditorDialog" class="ir-editor-dialog" aria-label="Edit clip or montage"><header><span>Edit</span><button id="irCloseEditor" class="btn btn-secondary btn-sm" aria-label="Close editor">×</button></header><section id="irEditor" class="ir-editor" aria-label="Clip review"></section></dialog>`;
  const posters = mountPosters($('#irClips'));
  const montagePosters=mountPosters($('#irMontageGrid'));
  const snapshot = () => ({clips,groups,revision});
  const findClip = path => clips.find(c=>c.path===path);
  function inQueue(c,key){return key==='trash'?c.trashed:!c.trashed&&(key==='all'||key==='favorite'&&c.favorite||c.review_state===key&&(key!=='pending'||c.purpose!=='replay_only'));}
  function filtered() { return clips.filter(c=>inQueue(c,queue) && (purpose==='all' || c.purpose===purpose) && `${clipTitle(c)} ${c.notes||''} ${c.tag||''} ${c.game||''} ${c.name} ${new Date(c.saved_at*1000).toLocaleString()}`.toLowerCase().includes(query)); }
  function render() {
    if (disposed) return;
    for (const tab of host.querySelectorAll('[data-queue]')) {
      const key = tab.dataset.queue; tab.setAttribute('aria-selected',String(queue===key));
      tab.querySelector('span').textContent = clips.filter(c=>inQueue(c,key)).length;
    }
    const matches = filtered(); page = Math.max(0,Math.min(page,Math.ceil(matches.length/PAGE_SIZE)-1));
    const visible = matches.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
    $('#irCount').textContent = `${matches.length} moment${matches.length===1?'':'s'}`;
    $('#irSelected').textContent = `${selected.size} selected`; $('#irBulkActions').hidden = !selected.size;
    $('#irBulkTrash').hidden=queue==='trash';$('#irBulkRestore').hidden=queue!=='trash';$('#irBulkTrash').disabled=!trashSupported;$('#irBulkRestore').disabled=!trashSupported;
    $('#irBulkKeep').hidden=queue==='trash';$('#irAdd').hidden=queue==='trash';
    $('#irClipsTab').setAttribute('aria-pressed',String(mode==='clips'));$('#irCollections').setAttribute('aria-pressed',String(mode==='montages'));
    $('#irClipFilters').hidden=mode!=='clips';$('#irClips').hidden=mode!=='clips';$('#irMontageGrid').hidden=mode!=='montages';$('.ir-pagination').hidden=mode!=='clips';
    $('#irSelectPage').checked = !!visible.length && visible.every(c=>selected.has(c.path));
    $('#irSelectPage').indeterminate = visible.some(c=>selected.has(c.path)) && !$('#irSelectPage').checked;
    $('#irPrev').disabled = page===0; $('#irNext').disabled = (page+1)*PAGE_SIZE>=matches.length;
    $('#irPage').textContent = matches.length ? `${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,matches.length)} of ${matches.length}` : '';
    const html = visible.map(c=>`<article class="ir-clip-card ${current===c.path?'is-selected':''}" data-id="${esc(c.id)}" data-path="${esc(c.path)}" draggable="${!c.trashed}"><label class="ir-card-check"><input type="checkbox" aria-label="Select ${esc(displayTitle(c))}" ${selected.has(c.path)?'checked':''}></label><button class="ir-clip-open" aria-label="Review ${esc(displayTitle(c))}"><div class="ir-card-image"><span class="ir-card-play" aria-hidden="true">▷</span><img alt="" loading="lazy"><span class="ir-card-duration" data-duration>—</span></div><div class="ir-card-copy"><strong>${c.favorite?'★ ':''}${esc(displayTitle(c))}</strong></div></button>${c.trashed?'<button class="ir-card-restore">Restore</button>':''}</article>`).join('') || `<div class="ir-empty">${queue==='trash'?'Trash is empty.':query?'No matching clips.':'No clips here yet.'}</div>`;
    if (html!==rendered) {
      rendered = html; $('#irClips').innerHTML = html;
      $('#irClips').querySelectorAll('[data-id]').forEach(row=>{
        const c = findClip(row.dataset.path);
        row.querySelector('.ir-clip-open').onclick = ()=>open(c.path);
        row.querySelector('input').onchange = e=>{e.target.checked?selected.add(c.path):selected.delete(c.path);render();editor?.updateStatus();};
        row.querySelector('.ir-card-restore')?.addEventListener('click',()=>trash([c.path],true));
        row.ondragstart = e=>{e.dataTransfer.setData('application/x-replay-clips',JSON.stringify(selected.has(c.path)?[...selected]:[c.path]));e.dataTransfer.effectAllowed='copy';};
      });
      posters.scan();
    }
    if(mode==='montages'){
      $('#irMontageGrid').innerHTML=groups.filter(g=>g.name.toLowerCase().includes(query)).map(g=>{const first=g.paths.find(p=>findClip(p));return `<article class="ir-clip-card" ${first?`data-path="${esc(first)}"`:''}><button class="ir-clip-open" data-montage="${esc(g.id)}" aria-label="Edit ${esc(g.name)}"><div class="ir-card-image"><img alt=""><span class="ir-card-play">▤</span><span class="ir-card-duration">${g.paths.length} clips</span><span data-duration hidden></span></div><div class="ir-card-copy"><strong>${esc(g.name)}</strong></div></button></article>`;}).join('')||'<div class="ir-empty">Create your first montage with ＋ New montage.</div>';
      $('#irMontageGrid').querySelectorAll('[data-montage]').forEach(button=>button.onclick=()=>collect([],button.dataset.montage));montagePosters.scan();
    }
    editor?.updateStatus();
  }
  function open(path, reveal=false) {
    if (disposed || !findClip(path) || !beforeLeave()) return;
    editor?.dispose(); current = path; view = 'review';
    if(reveal) {queue='all';purpose='all';query='';page=Math.floor(clips.findIndex(c=>c.path===path)/PAGE_SIZE);$('#irSearch').value='';$('#irScope').value='all';}
    editor = mountReview($('#irEditor'),{...findClip(path)},{revision,mutate,findClip,reload:()=>refresh(true),open,next,collect,trash,canTrash:()=>trashSupported,canPlay:options.canPlay,onPlay:options.onPlay});
    if(!$('#irEditorDialog').open)$('#irEditorDialog').showModal();
    render();
  }
  function next(path) {
    const matches = filtered(), index = matches.findIndex(c=>c.path===path);
    const nextClip = matches[index>=0?index+1:0] || matches.find(c=>c.path!==path);
    if(nextClip)open(nextClip.path); else {editor?.dispose();editor=null;current='';$('#irEditor').innerHTML='<div class="ir-empty ir-review-done"><span>✓</span><h2>Queue reviewed</h2><p>Your kept moments and clips set aside are one tab away.</p></div>';render();}
  }
  function collect(paths=[],groupId=undefined) {
    if (view==='collections' && editor) {editor.add(paths);return;}
    if (disposed || !beforeLeave()) return;
    editor?.dispose(); view='collections';
    editor=mountCollections($('#irEditor'),{snapshot,findClip,mutate,groupId,startNew:groupId===null,selected:()=>[...selected],canPlay:options.canPlay,onPlay:options.onPlay},paths);
    if(!$('#irEditorDialog').open)$('#irEditorDialog').showModal();
  }
  async function mutate(payload, expected = revision) {
    if(disposed || saving)return null; saving=true;
    try {
      const result=await api.saveReplayLibrary({...payload,revision:expected});
      if(disposed)return null;
      const previous=revision;revision=result.revision;groups=result.groups;
      clips=clips.map(c=>normalize({...c,...result.clips[c.id]}));
      editor?.advanceRevision?.(previous,revision);
      render();toast.success(payload.action==='review'?'Review saved':'Saved');return result;
    } catch(e){if(!disposed)toast.error(e.message);return null;} finally{saving=false;}
  }
  async function refresh(force=false) {
    if(disposed || loading || saving)return;loading=true;
    try {
      const data=await api.getReplayClips();if(disposed)return;
      clips=[...(data.clips||[]),...(data.trash||[])].map(normalize);groups=data.groups||[];revision=data.revision;trashSupported=!!data.capabilities?.trash;
      options.onCatalog(data);
      for(const path of selected)if(!findClip(path))selected.delete(path);
      render();
    }catch(e){if(!disposed && force)toast.error(e.message);if(!disposed&&!clips.length)$('#irClips').textContent=`Could not load clips: ${e.message}`;}finally{loading=false;}
  }
  function beforeLeave(){return !saving && (!editor || editor.canLeave());}
  $('#irSearch').oninput=e=>{query=e.target.value.toLowerCase();page=0;render();};
  $('#irScope').onchange=e=>{purpose=e.target.value;page=0;render();};
  host.querySelectorAll('[data-queue]').forEach(b=>b.onclick=()=>{queue=b.dataset.queue;page=0;selected.clear();render();});
  $('#irRefresh').onclick=()=>refresh(true);
  $('#irPrev').onclick=()=>{page--;render();};$('#irNext').onclick=()=>{page++;render();};
  $('#irSelectPage').onchange=e=>{filtered().slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).forEach(c=>e.target.checked?selected.add(c.path):selected.delete(c.path));render();};
  $('#irClear').onclick=()=>{selected.clear();render();};$('#irAdd').onclick=()=>collect([...selected]);
  $('#irBulkKeep').onclick=async()=>{const paths=[...selected];if(paths.length && await mutate({action:'review',paths,decision:'kept'})){selected.clear();render();}};
  $('#irClipsTab').onclick=()=>{mode='clips';render();};$('#irCollections').onclick=()=>{mode='montages';render();};
  $('#irNewMontage').onclick=()=>collect([...selected],null);
  function closeEditor(force=false){if(force!==true&&!beforeLeave())return false;editor?.dispose();editor=null;current='';view='review';$('#irEditorDialog').close();$('#irEditor').replaceChildren();render();return true;}
  $('#irCloseEditor').onclick=closeEditor;$('#irEditorDialog').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
  async function trash(paths,restore=false){
    if(!paths.length||!trashSupported||!beforeLeave())return null;
    if(!restore&&!window.confirm(`Move ${paths.length===1?'this clip':paths.length+' clips'} to Trash? You can restore them later.`))return null;
    const result=await mutate({action:restore?'restore':'trash',paths});
    if(result){selected.clear();if(paths.includes(current))closeEditor(true);render();toast.success(restore?'Restored':'Moved to Trash');}return result;
  }
  $('#irBulkTrash').onclick=()=>trash([...selected]);$('#irBulkRestore').onclick=()=>trash([...selected],true);
  const unload=e=>{if(editor?.isDirty()){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',unload);refresh();timer=setInterval(()=>refresh(),10000);
  return {refresh,beforeLeave,pausePreview:()=>editor?.pause?.(),updateStatus:()=>editor?.updateStatus(),dispose(){disposed=true;clearInterval(timer);posters.dispose();montagePosters.dispose();editor?.dispose();$('#irEditorDialog').close();window.removeEventListener('beforeunload',unload);}};
}
