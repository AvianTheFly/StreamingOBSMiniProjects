import { state } from './state.js';
import { API } from './constants.js';

// ── Right panel: destination project cards ────────────────────────────────────
//
// Files are dragged from the regular left-panel library (existing sound cards).
// buildCard() in render.js sets window.__hkMoveXxx globals on dragstart when
// state.rightMode === 'move-assets'. Those globals are read here on drop.

export function renderMoveAssetsPanel() {
  const panel = document.getElementById('move-assets-panel');
  if (!panel) return;
  if (state.rightMode !== 'move-assets') { panel.hidden = true; return; }
  panel.hidden = false;
  panel.innerHTML = '';

  panel.appendChild(_buildHeader());

  const statusEl = document.createElement('div');
  statusEl.className  = 'move-assets-status-msg';
  statusEl.id         = 'move-assets-status-msg';
  statusEl.textContent = state.moveAssetsStatus || '';
  panel.appendChild(statusEl);

  const hint = document.createElement('p');
  hint.className   = 'move-assets-hint';
  hint.textContent = 'Drag files from the library on the left into a project card below.';
  panel.appendChild(hint);

  const cards = document.createElement('div');
  cards.className = 'move-assets-cards';
  (state.projects || []).forEach(proj => cards.appendChild(_buildDestCard(proj)));
  panel.appendChild(cards);
}

// ── Header with action buttons ────────────────────────────────────────────────

function _buildHeader() {
  const header = document.createElement('div');
  header.className = 'move-assets-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'move-assets-title-wrap';

  const title = document.createElement('span');
  title.className   = 'move-assets-title';
  title.textContent = 'Move Assets';

  const pill = document.createElement('span');
  pill.className   = 'move-assets-pending-pill';
  const count      = state.moveAssetsPending.length;
  pill.textContent = count ? `${count} pending` : '';
  pill.hidden      = !count;

  titleWrap.appendChild(title);
  titleWrap.appendChild(pill);

  const actions = document.createElement('div');
  actions.className = 'move-assets-actions';

  const saveBtn = _btn('Save Plan', 'btn-move-action', !count,
    'Write pending_moves.json without moving files yet');
  saveBtn.addEventListener('click', _savePendingMoves);

  const commitBtn = _btn(
    `Commit ${count} Move${count !== 1 ? 's' : ''}`,
    'btn-move-action accent', !count,
    'Actually move the files to their destination directories'
  );
  commitBtn.addEventListener('click', _commitPendingMoves);

  const clearBtn = _btn('Clear All', 'btn-move-action danger', !count, 'Remove all pending moves');
  clearBtn.addEventListener('click', () => {
    state.moveAssetsPending = [];
    renderMoveAssetsPanel();
  });

  actions.appendChild(saveBtn);
  actions.appendChild(commitBtn);
  actions.appendChild(clearBtn);
  header.appendChild(titleWrap);
  header.appendChild(actions);
  return header;
}

// ── Destination project card ──────────────────────────────────────────────────

function _buildDestCard(proj) {
  const isSelf = proj.active || proj.key === state.currentProjectKey;

  const card = document.createElement('div');
  card.className          = 'move-assets-project-card';
  card.dataset.projectKey = proj.key;
  if (isSelf) card.classList.add('move-assets-card-self');

  // Head
  const head = document.createElement('div');
  head.className = 'move-assets-card-head';

  const nameEl = document.createElement('div');
  nameEl.className   = 'move-assets-card-name';
  nameEl.textContent = proj.name;

  if (isSelf) {
    const badge = document.createElement('span');
    badge.className   = 'move-assets-card-badge current';
    badge.textContent = 'current';
    nameEl.appendChild(badge);
  }

  const pendingForProj = state.moveAssetsPending.filter(m => m.toProject === proj.key);
  const countEl = document.createElement('span');
  countEl.className   = 'move-assets-card-count';
  countEl.textContent = pendingForProj.length ? `${pendingForProj.length} queued` : '';

  head.appendChild(nameEl);
  head.appendChild(countEl);

  // Body
  const body = document.createElement('div');
  body.className = 'move-assets-card-body';

  if (isSelf) {
    const msg = document.createElement('div');
    msg.className   = 'move-assets-card-empty';
    msg.textContent = 'Cannot move to the same project';
    body.appendChild(msg);
  } else if (!pendingForProj.length) {
    const empty = document.createElement('div');
    empty.className   = 'move-assets-card-empty';
    empty.textContent = 'Drop files here';
    body.appendChild(empty);
  } else {
    pendingForProj.forEach(move => body.appendChild(_buildChip(move)));
  }

  card.appendChild(head);
  card.appendChild(body);

  if (!isSelf) {
    card.addEventListener('dragenter', e => {
      if (!window.__hkMoveStem) return;
      e.preventDefault();
      card.classList.add('drop-target');
    });
    card.addEventListener('dragover', e => {
      if (!window.__hkMoveStem) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      card.classList.add('drop-target');
    });
    card.addEventListener('dragleave', e => {
      if (!card.contains(e.relatedTarget)) card.classList.remove('drop-target');
    });
    card.addEventListener('drop', e => {
      if (!window.__hkMoveStem) return;
      e.preventDefault();
      card.classList.remove('drop-target');
      _onDrop(proj.key);
    });
  }

  return card;
}

function _buildChip(move) {
  const chip = document.createElement('div');
  chip.className = 'pending-move-chip';
  chip.title     = `${move.fromProject} → ${move.toProject}`;

  const label = document.createElement('span');
  label.className   = 'pending-move-chip-label';
  label.textContent = move.stem;

  const x = document.createElement('button');
  x.className   = 'pending-move-chip-x';
  x.type        = 'button';
  x.textContent = '×';
  x.title       = 'Remove this queued move';
  x.addEventListener('click', e => {
    e.stopPropagation();
    const idx = state.moveAssetsPending.findIndex(
      m => m.stem === move.stem && m.fromProject === move.fromProject && m.toProject === move.toProject
    );
    if (idx >= 0) state.moveAssetsPending.splice(idx, 1);
    renderMoveAssetsPanel();
  });

  chip.appendChild(label);
  chip.appendChild(x);
  return chip;
}

// ── Drop handler ──────────────────────────────────────────────────────────────

function _onDrop(toProjectKey) {
  const stem        = window.__hkMoveStem;
  const filename    = window.__hkMoveFilename;
  const fromProject = window.__hkMoveSourceProject;
  const fromDir     = window.__hkMoveSourceDir;

  if (!stem || !fromProject || !filename) return;

  if (fromProject === toProjectKey) {
    _showStatus('Source and destination are the same project.', 2500);
    return;
  }

  if (state.moveAssetsPending.some(m => m.stem === stem && m.fromProject === fromProject)) {
    _showStatus(`"${stem}" is already queued for a move.`, 2500);
    return;
  }

  state.moveAssetsPending.push({ stem, filename, fromProject, fromDir, toProject: toProjectKey });
  renderMoveAssetsPanel();
}

// ── Save / Commit ─────────────────────────────────────────────────────────────

async function _savePendingMoves() {
  _showStatus('Saving…');
  try {
    const res  = await fetch(`${API}/api/pending-moves/save`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ moves: state.moveAssetsPending }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed');
    _showStatus(`✓ Saved ${state.moveAssetsPending.length} move(s) to pending_moves.json`, 4000);
  } catch (err) {
    _showStatus(`✗ ${err.message}`, 5000);
  }
}

async function _commitPendingMoves() {
  const count = state.moveAssetsPending.length;
  if (!count) return;
  if (!confirm(`Move ${count} file(s) to their destination directories?\nThis cannot be undone.`)) return;

  _showStatus('Moving files…');
  try {
    const res  = await fetch(`${API}/api/pending-moves/commit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ moves: state.moveAssetsPending }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed');

    const applied     = data.applied || [];
    const failed      = data.failed  || [];
    const appliedKeys = new Set(applied.map(m => `${m.stem}|${m.fromProject}`));
    state.moveAssetsPending = state.moveAssetsPending.filter(
      m => !appliedKeys.has(`${m.stem}|${m.fromProject}`)
    );

    let msg = `✓ Moved ${applied.length} file(s).`;
    if (failed.length) msg += `  ✗ ${failed.length} failed: ${failed.map(f => f.error).join('; ')}`;
    _showStatus(msg, 6000);
    renderMoveAssetsPanel();
  } catch (err) {
    _showStatus(`✗ ${err.message}`, 5000);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _showStatus(msg, clearAfterMs = 0) {
  state.moveAssetsStatus = msg;
  const el = document.getElementById('move-assets-status-msg');
  if (el) el.textContent = msg;
  if (clearAfterMs > 0) {
    setTimeout(() => {
      if (state.moveAssetsStatus === msg) {
        state.moveAssetsStatus = '';
        const el2 = document.getElementById('move-assets-status-msg');
        if (el2) el2.textContent = '';
      }
    }, clearAfterMs);
  }
}

function _btn(text, cls, disabled, title) {
  const b = document.createElement('button');
  b.type        = 'button';
  b.className   = cls;
  b.textContent = text;
  b.disabled    = disabled;
  b.title       = title;
  return b;
}
