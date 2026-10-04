'use strict';
// Presentation of the review → saved clips → clear space workflow.
// All persistence, playback, export and disposal actions stay with app.js.
const FootageWorkflow = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function exportCurrent(video, range) {
    if (!range.exported || !range.export_signature) return false;
    try {
      const saved = JSON.parse(range.export_signature);
      const current = [video.path, video.size, video.mtime_ns, range.start, range.end];
      return saved.length === current.length && saved.every((value, i) => value === current[i]);
    } catch { return false; }
  }
  function progress(video) {
    const ranges = video.ranges || [], keep = ranges.filter(r => r.decision === 'keep');
    const pending = keep.filter(r => !exportCurrent(video, r));
    const unresolved = ranges.filter(r => ['maybe','rereview'].includes(r.decision));
    let reason = '';
    if (!['keep_clips','delete'].includes(video.status)) reason = 'Choose what to keep from this recording.';
    else if (unresolved.length) reason = `Resolve ${unresolved.length} later / re-review moment${unresolved.length === 1 ? '' : 's'}.`;
    else if (pending.length) reason = `Extract ${pending.length} remaining keeper${pending.length === 1 ? '' : 's'} first.`;
    else if (video.status === 'keep_clips' && !keep.length) reason = 'No keepers yet. Choose “Nothing to keep” if you are finished.';
    else if (video.availability !== 'online' && video.availability !== 'trash') reason = 'Original is unavailable.';
    return {keep, pending, unresolved, reason, ready: !reason};
  }
  function mount(controls) {
    const $ = id => document.getElementById(id);
    let busy = false, lastRender = '';
    const run = async fn => {
      if (busy) return;
      busy = true;
      $('workflow-panel').setAttribute('aria-busy', 'true');
      try { await controls.action(fn); }
      finally { busy = false; $('workflow-panel').setAttribute('aria-busy', 'false'); render(); }
    };
    function cards(snapshot) {
      const {catalogue, view} = snapshot;
      if (view === 'moments' || view === 'rereview') {
        const rows = catalogue.videos.flatMap(v => (v.ranges || []).filter(r =>
          (view === 'rereview' ? ['maybe','rereview'].includes(r.decision) : r.decision === 'keep') && controls.matches(v,r)
        ).map(r => ({v,r})));
        const pending = rows.filter(({v,r}) => v.availability === 'online' && r.decision === 'keep' && !exportCurrent(v,r));
        $('workflow-title').textContent = view === 'moments' ? 'Your saved clips' : 'Give these another look';
        $('workflow-description').textContent = view === 'moments' ? 'Keep a moment while reviewing, then extract it here. Your source timestamps and every audio track travel with the clip.' : 'Resolve these moments before clearing their original recordings.';
        $('workflow-batch').hidden = view !== 'moments';
        $('workflow-batch').textContent = `Extract ${pending.length} remaining clip${pending.length === 1 ? '' : 's'}`;
        $('workflow-batch').disabled = !pending.length || busy;
      $('workflow-grid').innerHTML = rows.map(({v,r}) => `<article class="clip-tile"><div class="tile-preview"><span>▶</span><small>${controls.time(r.end-r.start)}</small></div><div class="tile-body"><span class="eyebrow">${exportCurrent(v,r) ? 'EXTRACTED' : r.exported ? 'CUT CHANGED · EXTRACT AGAIN' : r.decision === 'keep' ? 'READY TO EXTRACT' : esc(r.decision.toUpperCase())}</span><h2>${esc(r.title || 'Untitled clip')}</h2><p class="muted">${esc(v.title || v.name)}</p><p class="clip-time">${controls.time(r.start)} → ${controls.time(r.end)}</p><div class="actions"><button data-review="${v.id}" data-range="${r.id}">Review / edit</button>${r.exported ? `<button data-watch="${v.id}" data-range="${r.id}">Play extracted</button>` : ''}${r.decision === 'keep' && v.availability === 'online' ? `<button class="${exportCurrent(v,r) ? '' : 'primary'}" data-export="${r.id}" ${snapshot.extracting ? 'disabled' : ''}>${exportCurrent(v,r) ? 'Extract again' : 'Extract clip'}</button>` : ''}${r.exported ? `<button data-reveal-clip="${r.id}">Show file</button>` : ''}</div></div></article>`).join('') || `<div class="workflow-empty"><span class="empty-icon">${view === 'moments' ? '✦' : '◷'}</span><h2>${view === 'moments' ? 'Your best moments land here.' : 'Nothing waiting for another look.'}</h2><p>Open a recording or a detected game, choose a voice spike, and keep the part you like.</p><button class="primary" data-go="library">Review recordings</button><button data-find-games>Browse detected games</button></div>`;
      if (view === 'rereview') {
        const sources = catalogue.videos.filter(v => ['later','rereview'].includes(v.status) && controls.matches(v));
        if (sources.length) $('workflow-grid').innerHTML += sources.map(v => `<article class="cleanup-tile"><div class="tile-body"><span class="eyebrow">RECORDING TO REVISIT</span><h2>${esc(v.title || v.name)}</h2><p class="muted">${controls.time(v.duration)} · ${controls.size(v.size)}</p><button data-review="${v.id}">Review recording</button></div></article>`).join('');
      }
      } else {
        const trash = view === 'trash';
        const videos = catalogue.videos.filter(v => controls.matches(v) && (trash ? ['trash','deleted'].includes(v.availability) : v.availability === 'online' && ['keep_clips','delete'].includes(v.status))).sort((a,b) => b.size-a.size);
        const bytes = videos.filter(v => trash ? v.availability === 'trash' : progress(v).ready).reduce((n,v) => n+v.size,0);
        $('workflow-title').textContent = trash ? 'Trash & history' : 'Make room for what’s next';
        $('workflow-description').textContent = trash ? `${controls.size(bytes)} in trash. Restore a recording or permanently delete it to reclaim space.` : `${controls.size(bytes)} of reviewed originals ready for a final check. Extract keepers, then move the original to trash.`;
        $('workflow-batch').hidden = true;
        $('workflow-grid').innerHTML = videos.map(v => {
          const p = progress(v), deleted = v.availability === 'deleted';
          return `<article class="cleanup-tile"><div class="cleanup-size">${controls.size(v.size)}<small>${deleted ? 'removed' : trash ? 'still on disk' : 'original size'}</small></div><div class="tile-body"><span class="eyebrow">${deleted ? 'PERMANENTLY DELETED' : trash ? 'RESTORABLE' : p.ready ? 'READY FOR FINAL CHECK' : 'ONE MORE STEP'}</span><h2>${esc(v.title || v.name)}</h2><p class="muted">${controls.time(v.duration)} · ${p.keep.length} keeper${p.keep.length === 1 ? '' : 's'} · ${p.keep.length-p.pending.length} extracted</p><p>${esc(deleted ? 'Your catalogue and retained clips remain available.' : trash ? 'Trash does not free space until you delete permanently.' : p.reason || 'Exports are checked again before the original is moved.')}</p><div class="actions">${!deleted ? `<button data-review="${v.id}">Review recording</button>` : ''}${!trash && p.pending.length ? `<button class="primary" data-export-source="${v.id}">Extract remaining keepers</button>` : ''}${!trash ? `<button class="danger" data-trash="${v.id}" ${p.ready ? '' : 'disabled'}>Check & move to trash…</button>` : !deleted ? `<button data-restore="${v.id}">Restore original</button><button class="danger" data-purge="${v.id}">Delete permanently…</button>` : ''}</div></div></article>`;
        }).join('') || `<div class="workflow-empty"><span class="empty-icon">${trash ? '↶' : '⌫'}</span><h2>${trash ? 'Trash is empty.' : 'Finish reviewing a recording first.'}</h2><p>${trash ? 'Originals you move to trash appear here until you restore or delete them.' : 'Choose “Keep only clips” or “Nothing to keep” in the review desk. We’ll show the next step here.'}</p><button class="primary" data-go="library">Review recordings</button></div>`;
      }
    }
    function render() {
      const snapshot = controls.snapshot(), {catalogue, selected, view} = snapshot;
      const online = catalogue.videos.filter(v => v.availability === 'online');
      const keepers = catalogue.videos.flatMap(v => (v.ranges || []).filter(r => r.decision === 'keep').map(r => ({v,r})));
      $('review-total').textContent = online.filter(v => ['unreviewed','reviewing'].includes(v.status) && v.duration >= 600).length;
      $('clips-total').textContent = keepers.length;
      $('cleanup-total').textContent = controls.size(online.filter(v => progress(v).ready).reduce((n,v) => n+v.size,0));
      document.body?.classList.toggle('review-mode',view==='library'&&!!selected&&$('analysis-panel').hidden);
      const panelView = ['moments','rereview','deletion','trash'].includes(view);
      // Extraction options live in the settings dialog, away from the review flow.
      $('workflow-panel').hidden = !panelView || !$('analysis-panel').hidden;
      if (panelView) $('workspace').hidden = true;
      else if ($('analysis-panel').hidden) $('workspace').hidden = !selected;
      $('empty').hidden = !!selected || panelView || !$('analysis-panel').hidden;
      const signature = JSON.stringify([view,catalogue.videos,controls.filters(),busy,snapshot.extracting]);
      if (panelView && signature !== lastRender) { cards(snapshot); lastRender = signature; }
      if (view === 'moments' && snapshot.extracting) { $('workflow-batch').disabled = true; $('workflow-batch').textContent = 'Extraction in progress…'; }
      if (!selected) return;
      const p = progress(selected);
      $('flow-keepers').textContent = `${p.keep.length} kept · ${p.keep.length-p.pending.length} extracted`;
      $('flow-next').textContent = p.reason || 'Ready to check & move to trash';
      $('flow-extract').textContent = p.pending.length ? `Extract all ${p.pending.length} remaining clip${p.pending.length === 1 ? '' : 's'}` : p.keep.length ? 'All kept clips extracted' : 'Keep a clip first';
      $('flow-extract').disabled = !p.pending.length || selected.availability !== 'online' || busy || snapshot.extracting;
      if (snapshot.extracting) $('flow-extract').textContent = 'Extraction in progress…';
      $('flow-status').textContent = controls.label(selected.status);
      $('flow-summary').textContent = `${controls.size(selected.size)} original · ${p.unresolved.length ? p.unresolved.length + ' moments waiting for a decision' : 'You choose when this recording is finished'}`;
      $('flow-no-keepers').disabled = p.keep.length > 0 || selected.availability !== 'online';
      $('flow-only-clips').disabled = !p.keep.length || selected.availability !== 'online';
      $('flow-full').disabled = selected.availability !== 'online';
      document.querySelectorAll('[data-recording-status]').forEach(b => b.classList.toggle('chosen', b.dataset.recordingStatus === selected.status));
      $('trash').disabled = !p.ready || selected.availability !== 'online';
      $('disposal-next').textContent = p.reason || 'Keepers will be checked before moving this original to trash.';
    }
    $('workflow-grid').onclick = e => run(async () => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const snapshot = controls.snapshot();
      if (b.dataset.go) controls.navigate(b.dataset.go);
      if (b.hasAttribute('data-find-games')) controls.findGames();
      if (b.dataset.review) await controls.review(Number(b.dataset.review), Number(b.dataset.range) || undefined);
      if (b.dataset.watch) await controls.watch(Number(b.dataset.watch), Number(b.dataset.range));
      if (b.dataset.export) await controls.extract([Number(b.dataset.export)]);
      if (b.dataset.revealClip) await controls.reveal(Number(b.dataset.revealClip));
      if (b.dataset.exportSource) { const v = snapshot.catalogue.videos.find(v => v.id === Number(b.dataset.exportSource)); await controls.extract(progress(v).pending.map(r => r.id)); }
      if (b.dataset.trash) await controls.trash(Number(b.dataset.trash));
      if (b.dataset.restore) await controls.restore(Number(b.dataset.restore));
      if (b.dataset.purge) await controls.purge(Number(b.dataset.purge));
    });
    $('workflow-batch').onclick = () => run(async () => {
      const ids = controls.snapshot().catalogue.videos.filter(v => v.availability === 'online').flatMap(v => progress(v).pending.filter(r => controls.matches(v,r)).map(r => r.id));
      if (ids.length) await controls.extract(ids);
    });
    $('flow-extract').onclick = () => run(() => controls.extract(progress(controls.snapshot().selected).pending.map(r => r.id)));
    $('quick-keep').onclick = () => run(controls.quickKeep);
    document.querySelectorAll('[data-recording-status]').forEach(b => b.onclick = () => run(() => controls.decide(b.dataset.recordingStatus)));
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => controls.navigate(b.dataset.go));
    document.querySelectorAll('[data-scroll]').forEach(b => b.onclick = () => {const target=$(b.dataset.scroll);for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});});
    document.querySelectorAll('[data-cue-tab]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-cue-tab]').forEach(x => x.classList.toggle('active',x === b));
      $('review-cues').classList.toggle('show-between',b.dataset.cueTab === 'between');
    });
    return {render};
  }
  return {mount, exportCurrent, progress};
})();
if (typeof module !== 'undefined') module.exports = FootageWorkflow;
