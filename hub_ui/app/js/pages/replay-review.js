import { api } from '../api.js';
import { esc } from '../utils.js';
import { mountTrim } from './replay-trim.js';
import {displayTitle} from './replay-card-labels.js';

export const clipTitle = clip => clip?.title || clip?.name || 'Missing clip';
export const purposeLabel = purpose => ({highlight:'Replay ready', review_later:'Review later', replay_only:'Replay only'}[purpose] || 'Replay ready');

// One selected clip owns its player, draft and polling. It never starts OBS playback implicitly.
export function mountReview(host, clip, options) {
  let disposed = false, dirty = false, saving = false, timer, disposeTrim;
  let revision = options.revision;
  const $ = selector => host.querySelector(selector);
  host.innerHTML = `<div class="ir-review-layout"><div class="ir-review-main"><div class="ir-review-heading"><h2>${esc(displayTitle(clip))}</h2></div>
    <div id="irPreview" class="ir-review-player" role="region" aria-label="Local clip preview"><span>Preparing preview…</span></div>
    <p id="irPreviewHint" class="ir-muted">Private preview</p>
    <div class="ir-review-actions"><button id="irKeep" class="btn btn-secondary">✓ Keep &amp; next</button><button id="irReviewNext" class="btn btn-secondary">Next clip →</button><button id="irTrashClip" class="btn btn-secondary">${clip.trashed?'Restore':'Move to Trash'}</button></div>
    <p id="irDecision" class="ir-muted" role="status"></p>
    <details class="ir-review-fold"><summary>Name &amp; notes</summary><form id="irClipForm" class="ir-form"><label>Clip name<input id="irTitle" maxlength="160" value="${esc(clipTitle(clip))}" required></label><label>Notes<textarea id="irNotes" rows="2" maxlength="4000" placeholder="What made this moment interesting?">${esc(clip.notes || '')}</textarea></label><label class="ir-check"><input id="irFavorite" type="checkbox" ${clip.favorite ? 'checked' : ''}> Favorite</label><div class="ir-actions"><button id="irSaveDetails" class="btn btn-primary btn-sm" disabled>Save details</button><span id="irSaveState" class="ir-muted" role="status">Saved</span></div></form></details>
    <details class="ir-review-fold"><summary>More options</summary><div class="ir-use"><label for="irPurpose">Use for</label><select id="irPurpose"><option value="review_later">Review later</option><option value="highlight">Replay ready</option><option value="replay_only">Replay only</option></select><span id="irPurposeHint" class="ir-muted"></span></div><div class="ir-actions"><button id="irSetAside" class="btn btn-secondary">Set aside</button><select id="irClipMode" class="ir-preview-mode" aria-label="Clip presentation"><option value="showcase">Clip Showcase</option><option value="replay">Quick Replay</option></select><button id="irPlayClip" class="btn btn-secondary btn-sm">Play in OBS</button><button id="irClipCollect" class="btn btn-secondary btn-sm">＋ Montage</button></div><p class="ir-file-path">${esc(clip.path)}</p></details></div>
    <section id="irTrimPanel" class="ir-trim-panel" aria-label="Trim clip"><div id="irTrim"><h3>Trim clip</h3><p class="ir-muted">Your trim controls will be ready with the preview.</p></div></section></div>`;
  function canLeave() { return !saving && (!dirty || window.confirm('Discard your unsaved name or notes?')); }
  function labels() {
    $('.ir-review-heading h2').textContent = displayTitle(clip);
    $('#irPurpose').value = clip.purpose;
    $('#irPurposeHint').textContent = clip.purpose === 'review_later' ? 'Saved for you. Excluded from automatic replays.' : clip.purpose === 'replay_only' ? 'Can replay this moment. Excluded from highlight compilations.' : 'Eligible for automatic replays and highlights.';
    $('#irDecision').textContent = clip.trashed?'In Trash · restore anytime':clip.review_state==='kept'?'Kept':clip.review_state==='dismissed'?'Set aside':'';
    $('#irTrashClip').disabled=saving||!options.canTrash?.();$('#irTrashClip').textContent=clip.trashed?'Restore':'Move to Trash';
    $('#irKeep').hidden=!!clip.trashed;
    $('#irTrimPanel').hidden=!!clip.trashed;$('#irPurpose').disabled=saving||!!clip.trashed;$('#irSetAside').disabled=saving||!!clip.trashed;$('#irClipCollect').disabled=saving||!!clip.trashed;
    $('#irSetAside').textContent = clip.review_state === 'dismissed' ? 'Restore to review' : 'Set aside';
    $('#irKeep').textContent = clip.review_state === 'kept' ? '✓ Kept' : '✓ Keep & next';
    $('#irKeep').disabled = saving || clip.review_state === 'kept';
    $('#irPlayClip').disabled = !options.canPlay() || saving || clip.trashed;
  }
  async function mutate(payload) {
    if (!canLeave()) return null;
    saving = true; host.querySelectorAll('.ir-review-actions button, #irPurpose, #irClipForm input, #irClipForm textarea, #irClipForm button, #irPlayClip, #irClipCollect').forEach(e => e.disabled = true);
    const result = await options.mutate(payload, revision);
    if (disposed) return null;
    saving = false;
    if (result) {
      revision = result.revision; dirty = false;
      Object.assign(clip, options.findClip(clip.path));
      $('#irTitle').value = clipTitle(clip); $('#irNotes').value = clip.notes || ''; $('#irFavorite').checked = !!clip.favorite;
      $('#irSaveState').textContent = 'Saved'; $('#irSaveDetails').disabled = true;
    } else {
      $('#irSaveState').textContent = 'Could not save. Reload the saved version to resolve a library conflict.';
      if (!$('#irReloadSaved')) {
        const reload = document.createElement('button'); reload.id = 'irReloadSaved'; reload.className = 'btn btn-secondary btn-sm'; reload.textContent = 'Reload saved version';
        reload.onclick = async () => { if (canLeave()) { dirty = false; await options.reload(); if (!disposed) options.open(clip.path); } };
        host.append(reload);
      }
    }
    host.querySelectorAll('.ir-review-actions button, #irPurpose, #irClipForm input, #irClipForm textarea, #irClipForm button, #irPlayClip, #irClipCollect').forEach(e => e.disabled = false);
    $('#irSaveDetails').disabled = !dirty; labels(); return result;
  }
  $('#irKeep').onclick = async () => { if (await mutate({action:'review', paths:[clip.path], decision:'kept'})) options.next(clip.path); };
  $('#irTrashClip').onclick=()=>options.trash?.([clip.path],!!clip.trashed);
  $('#irSetAside').onclick = async () => { if (await mutate({action:'review', paths:[clip.path], decision:clip.review_state === 'dismissed' ? 'pending' : 'dismissed'})) options.next(clip.path); };
  $('#irReviewNext').onclick = () => { if (canLeave()) options.next(clip.path); };
  $('#irPurpose').onchange = async e => { const purpose = e.target.value; if (!await mutate({action:'purpose',paths:[clip.path],purpose})) labels(); };
  $('#irClipForm').oninput = () => { dirty = true; $('#irSaveDetails').disabled = false; $('#irSaveState').textContent = 'Unsaved changes'; };
  $('#irClipForm').onsubmit = async e => {
    e.preventDefault();
    // Saving the current draft is not a request to discard it.
    const wasDirty = dirty; dirty = false;
    if (!await mutate({action:'clip',path:clip.path,title:$('#irTitle').value,notes:$('#irNotes').value,favorite:$('#irFavorite').checked})) { dirty = wasDirty; $('#irSaveDetails').disabled = !dirty; }
  };
  $('#irPlayClip').onclick = () => { $('video')?.pause(); options.onPlay(() => api.playReplayClip(clip.path, $('#irClipMode').value)); };
  $('#irClipCollect').onclick = () => { if (canLeave()) options.collect([clip.path]); };
  async function preview() {
    try {
      const result = await api.replayPreview(clip.path);
      if (disposed) return;
      if (result.status === 'ready') {
        $('#irPreview').innerHTML = `<video controls preload="metadata" aria-label="Local clip preview" src="/api/projects/instant_replay/preview-media?path=${encodeURIComponent(clip.path)}"></video>`;
        $('#irPreviewHint').textContent = 'Private preview';
        disposeTrim = mountTrim($('#irTrim'), $('video'), {path:clip.path,title:displayTitle(clip)}, async (result, open) => {
          await options.reload();
          if (!disposed) open.onclick = () => { if (canLeave()) options.open(result.path, true); };
        }, result => { if (revision === result.previous_revision) revision = result.revision; });
      } else if (result.status === 'error') throw Error(result.error);
      else { $('#irPreview').textContent = result.status === 'busy' ? 'Another preview is preparing. Yours will follow…' : 'Preparing preview…'; timer = setTimeout(preview, 1500); }
    } catch (e) {
      if (!disposed) { $('#irPreview').textContent = e.message; const retry = document.createElement('button'); retry.className = 'btn btn-secondary btn-sm'; retry.textContent = 'Retry preview'; retry.onclick = preview; $('#irPreview').append(retry); }
    }
  }
  labels(); preview();
  return {canLeave, isDirty:()=>dirty, updateStatus:labels, advanceRevision(previous,next){if(revision===previous)revision=next;Object.assign(clip,options.findClip(clip.path));labels();}, pause:()=>$('video')?.pause(), dispose() { disposed = true; clearTimeout(timer); disposeTrim?.(); const video = $('video'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); } }};
}
