import { state } from './state.js';

// ── HTML escaping ─────────────────────────────────────────────────────────────

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Save status ───────────────────────────────────────────────────────────────

export function setSaveStatus(msg, cls) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.className  = 'save-status' + (cls ? ' ' + cls : '');
  el.textContent = msg;
}

export function markDirty() {
  state.dirty = true;
  setSaveStatus('Unsaved changes', 'dirty');
}

function displayNameForStem(stem) {
  return String(state.displayNames?.[stem] || '').trim() || stem;
}

// ── Footer status bar ─────────────────────────────────────────────────────────

export function updateFooterStatus() {
  const status = document.getElementById('assign-status');
  const text   = document.getElementById('assign-text');
  if (!status || !text) return;

  if (state.pendingGroupRebindKey) {
    status.classList.add('active');
    text.innerHTML = `Press a new key for group <span class="a-name">${esc(state.pendingGroupRebindKey)}</span> <span style="color:var(--text-dim)">(Esc to cancel)</span>`;
    return;
  }
  if (state.pendingEmptyGroupCreate) {
    status.classList.add('active');
    text.innerHTML = `Press a key to create an empty group <span style="color:var(--text-dim)">(Esc to cancel)</span>`;
    return;
  }
  if (state.pendingUnboundBind) {
    const g    = state.unboundGroups.find(g => g.id === state.pendingUnboundBind);
    const name = g ? (g.name || g.id) : state.pendingUnboundBind;
    status.classList.add('active');
    text.innerHTML = `Press a key to bind <span class="a-name">${esc(name)}</span> <span style="color:var(--text-dim)">(Esc to cancel)</span>`;
    return;
  }
  if (!state.selected) {
    status.classList.remove('active');
    text.textContent = 'Click the keyboard button on a file to start assigning';
    return;
  }
  status.classList.add('active');
  text.innerHTML = `Press any key to assign <span class="a-name">${esc(displayNameForStem(state.selected))}</span> <span style="color:var(--text-dim)">(Esc to cancel)</span>`;
}
