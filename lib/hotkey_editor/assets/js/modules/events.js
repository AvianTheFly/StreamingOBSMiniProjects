import { state } from './state.js';
import { stemToKeys, allGroupKeys, assignStemToKey, generateUnboundId } from './hotkey.js';
import { pushUndo, pushGroupUndo, undo } from './undo.js';
import { applyVisibility, render, scrollGroupCardIntoView } from './render.js';
import { renderGroups } from './render-groups.js';
import { renderCategoryGroups, refreshCategoryControls } from './render-categories.js';
import { save } from './api.js';
import { stopPreview, openPreviewTrimEditor } from './preview.js';
import {
  switchProfile, duplicateProfile, deleteProfile, renameProfile, setLiveProfile,
  switchProject, setMediaProfileCreateOpen, createMediaProfile,
} from './profiles.js';
import {
  toggleSelect, deselect, cancelGroupRebind,
  finishGroupRebind, finishEmptyGroupCreate, bindUnboundGroup,
} from './actions.js';
import { markDirty } from './ui.js';
import { saveProjectSettings, setProjectSettingsOpen } from './settings.js';
import { loadLayoutData } from './layout.js';
import { clearMultiSelection, selectVisibleCards } from './render-library.js';

const DRAG_SCROLL_EDGE_PX = 72;
const DRAG_SCROLL_STEP_PX = 28;

function parseSequences(raw) {
  return String(raw || '').split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.includes(' ')
      ? part.split(' ').map(item => item.trim()).filter(Boolean)
      : [...part]);
}

function keyToken(event) {
  if (event.key.length === 1) return event.key;
  return event.key.replace(/^Arrow/, '').replace(/^arrow/, '');
}

function isDragActive() {
  return Boolean(state.dragStem || (Array.isArray(state.dragStems) && state.dragStems.length));
}

function findScrollableAncestor(node) {
  let current = node instanceof Element ? node : null;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY || style.overflow;
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 4) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function autoScrollDuringDrag(event) {
  if (!isDragActive()) return;

  const pointerTarget = document.elementFromPoint(event.clientX, event.clientY);
  const scrollEl = findScrollableAncestor(pointerTarget) || document.scrollingElement || document.documentElement;
  const rect = scrollEl === document.scrollingElement || scrollEl === document.documentElement
    ? { top: 0, bottom: window.innerHeight }
    : scrollEl.getBoundingClientRect();

  let deltaY = 0;
  if (event.clientY < rect.top + DRAG_SCROLL_EDGE_PX) {
    const distance = Math.max(0, event.clientY - rect.top);
    deltaY = -Math.max(8, Math.round(((DRAG_SCROLL_EDGE_PX - distance) / DRAG_SCROLL_EDGE_PX) * DRAG_SCROLL_STEP_PX));
  } else if (event.clientY > rect.bottom - DRAG_SCROLL_EDGE_PX) {
    const distance = Math.max(0, rect.bottom - event.clientY);
    deltaY = Math.max(8, Math.round(((DRAG_SCROLL_EDGE_PX - distance) / DRAG_SCROLL_EDGE_PX) * DRAG_SCROLL_STEP_PX));
  }

  if (deltaY) {
    if (scrollEl === document.scrollingElement || scrollEl === document.documentElement) {
      window.scrollBy(0, deltaY);
    } else {
      scrollEl.scrollTop += deltaY;
    }
  }
}

function updateHotkeyTesterReadout(text = null) {
  const readout = document.getElementById('hotkey-tester-readout');
  const toggle = document.getElementById('hotkey-tester-toggle');
  if (toggle) toggle.classList.toggle('active', !!state.hotkeyTesterEnabled);
  if (!readout) return;
  readout.textContent = text || (state.hotkeyTesterEnabled
    ? `Listening: ${state.hotkeyTesterBuffer || 'press keys'}`
    : 'Off');
}

function handleHotkeyTester(event) {
  if (!state.hotkeyTesterEnabled) return;
  if (event.target.closest('input, textarea, select')) return;
  const token = keyToken(event);
  if (!token) return;
  state.hotkeyTesterBuffer = `${state.hotkeyTesterBuffer}${token}`.slice(-12);
  const spaced = state.hotkeyTesterBuffer.split('').join(' ');
  const seqs = parseSequences(state.profileTriggerSequences);
  const triggerHit = seqs.some(seq => state.hotkeyTesterBuffer.endsWith(seq.join('')));
  const direct = state.hotkeys?.[token];
  const message = triggerHit
    ? `Matched profile trigger: ${spaced}`
    : direct
      ? `Direct key ${token} -> ${Array.isArray(direct) ? direct.join(', ') : direct}`
      : `Listening: ${spaced}`;
  updateHotkeyTesterReadout(message);
}

export function initEventListeners() {
  // ── Keyboard global handler ───────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    handleHotkeyTester(e);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault(); save(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault(); undo();
      state.dirty = true; // undo creates new dirty state
      render(); return;
    }
    if (e.key === 'Escape' && state.multiSelectedStems?.size) {
      e.preventDefault();
      state.multiSelectedStems = new Set();
      state.multiSelectAnchorStem = null;
      render();
      return;
    }

    if (state.pendingGroupRebindKey || state.pendingEmptyGroupCreate || state.pendingUnboundBind) {
      if (e.key === 'Escape') { e.preventDefault(); cancelGroupRebind(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      e.preventDefault();
      if (state.pendingGroupRebindKey)   { finishGroupRebind(e.key); }
      else if (state.pendingEmptyGroupCreate) { finishEmptyGroupCreate(e.key); }
      else if (state.pendingUnboundBind) {
        const id = state.pendingUnboundBind;
        state.pendingUnboundBind = null;
        bindUnboundGroup(id, e.key);
      }
      return;
    }

    if (!state.selected) return;
    if (e.key === 'Escape') { e.preventDefault(); deselect(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1) return;

    e.preventDefault();
    const key = e.key;
    const existingKeys = stemToKeys()[state.selected] || [];
    if (existingKeys.includes(key)) { deselect(); return; }

    pushUndo();
    pushGroupUndo(key);
    const changed = assignStemToKey(key, state.selected);
    if (changed) markDirty();
    deselect();
    render();
    scrollGroupCardIntoView(key);
  });

  document.addEventListener('dragover', e => {
    autoScrollDuringDrag(e);
  });

  // ── Library controls ──────────────────────────────────────────────────────
  document.getElementById('search')?.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    applyVisibility(stemToKeys());
  });

  document.getElementById('library-show')?.addEventListener('change', e => {
    state.libraryShow = e.target.value;
    document.querySelectorAll('.quick-filter').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.show === state.libraryShow)
    );
    applyVisibility(stemToKeys());
  });

  document.getElementById('library-quick-filters')?.addEventListener('click', e => {
    const btn = e.target.closest('.quick-filter');
    if (!btn) return;
    state.libraryShow = btn.dataset.show || 'all';
    const showSel = document.getElementById('library-show');
    if (showSel) showSel.value = state.libraryShow;
    document.querySelectorAll('.quick-filter').forEach(item =>
      item.classList.toggle('active', item === btn)
    );
    applyVisibility(stemToKeys());
  });

  document.getElementById('library-category-strip')?.addEventListener('click', e => {
    const chip = e.target.closest('.category-filter-chip');
    if (!chip) return;
    state.activeCategoryFilter = chip.dataset.category || 'all';
    const select = document.getElementById('category-filter');
    if (select) select.value = state.activeCategoryFilter;
    document.querySelectorAll('.category-filter-chip').forEach(item =>
      item.classList.toggle('active', item === chip)
    );
    applyVisibility(stemToKeys());
  });

  document.getElementById('sort-sel').addEventListener('change', e => {
    state.sortMode = e.target.value;
    localStorage.setItem('hk-sort', state.sortMode);
    render();
  });

  document.getElementById('category-filter')?.addEventListener('change', e => {
    state.activeCategoryFilter = e.target.value;
    document.querySelectorAll('.category-filter-chip').forEach(chip =>
      chip.classList.toggle('active', chip.dataset.category === state.activeCategoryFilter)
    );
    applyVisibility(stemToKeys());
  });

  document.getElementById('media-type-filter')?.addEventListener('change', e => {
    state.mediaTypeFilter = e.target.value || 'all';
    applyVisibility(stemToKeys());
  });

  document.getElementById('library-select-visible')?.addEventListener('click', () => {
    selectVisibleCards();
  });
  document.getElementById('library-clear-selection')?.addEventListener('click', () => {
    clearMultiSelection();
  });

  const addCategory = () => {
    const input = document.getElementById('category-name');
    const name = String(input?.value || '').trim();
    if (!name) return;
    if (!state.categories.includes(name)) {
      pushUndo();
      state.categories.push(name);
      state.categories.sort((a, b) => a.localeCompare(b));
      markDirty();
    }
    if (input) input.value = '';
    state.activeCategoryFilter = name;
    refreshCategoryControls();
    render();
  };

  document.getElementById('category-add')?.addEventListener('click', addCategory);
  document.getElementById('category-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCategory();
    }
  });

  document.getElementById('right-mode-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.right-mode');
    if (!btn) return;
    const validModes = ['hotkeys', 'categories', 'phrases', 'layout', 'move-assets'];
    const mode = validModes.includes(btn.dataset.mode) ? btn.dataset.mode : 'hotkeys';
    state.rightMode = mode;
    render();
    if (mode === 'layout') loadLayoutData();
  });

  document.getElementById('category-panel-search')?.addEventListener('input', e => {
    state.categoryPanelQuery = e.target.value;
    renderCategoryGroups();
  });

  // ── Header actions ────────────────────────────────────────────────────────
  document.getElementById('save-btn').addEventListener('click', save);
  document.getElementById('undo-btn').addEventListener('click', () => {
    undo();
    markDirty();
    render();
  });

  // ── Preview close ─────────────────────────────────────────────────────────
  document.getElementById('preview-close').addEventListener('click', () =>
    stopPreview({ keepSelection: false })
  );
  document.getElementById('preview-trim')?.addEventListener('click', openPreviewTrimEditor);

  // ── Add group button ──────────────────────────────────────────────────────
  document.getElementById('add-group-btn')?.addEventListener('click', () => {
    pushUndo();
    const id = generateUnboundId();
    state.unboundGroups.push({ id, name: '', stems: [] });
    markDirty();
    render();
    requestAnimationFrame(() => {
      const card = document.querySelector(`.unbound-card[data-id="${CSS.escape(id)}"]`);
      card?.querySelector('.unbound-name-input')?.focus({ preventScroll: true });
    });
  });

  // ── Profile bar ───────────────────────────────────────────────────────────
  document.getElementById('profile-sel')?.addEventListener('change', e => switchProfile(e.target.value));
  document.getElementById('pb-duplicate')?.addEventListener('click', duplicateProfile);
  document.getElementById('pb-rename')?.addEventListener('click', renameProfile);
  document.getElementById('pb-delete')?.addEventListener('click', deleteProfile);
  document.getElementById('pb-set-live')?.addEventListener('click', setLiveProfile);
  document.getElementById('profile-trigger-sequences')?.addEventListener('input', e => {
    state.profileTriggerSequences = e.target.value;
    markDirty();
  });
  document.getElementById('profile-project-volume-db')?.addEventListener('input', e => {
    const value = Number(e.target.value);
    state.projectVolumeDb = Number.isFinite(value) ? value : 0;
    markDirty();
  });
  document.getElementById('profile-volume-db')?.addEventListener('input', e => {
    const value = Number(e.target.value);
    state.profileVolumeDb = Number.isFinite(value) ? value : 0;
    markDirty();
  });
  document.getElementById('project-settings-toggle')?.addEventListener('click', () => setProjectSettingsOpen(!state.settingsOpen));
  document.getElementById('project-settings-close')?.addEventListener('click', () => setProjectSettingsOpen(false));
  document.getElementById('project-settings-save')?.addEventListener('click', saveProjectSettings);
  document.getElementById('hotkey-tester-toggle')?.addEventListener('click', () => {
    state.hotkeyTesterEnabled = !state.hotkeyTesterEnabled;
    state.hotkeyTesterBuffer = '';
    updateHotkeyTesterReadout();
  });
  document.getElementById('media-profile-create-toggle')?.addEventListener('click', () => setMediaProfileCreateOpen(!state.mediaProfileCreateOpen));
  document.getElementById('media-profile-create-close')?.addEventListener('click', () => setMediaProfileCreateOpen(false));
  document.getElementById('media-profile-create-save')?.addEventListener('click', createMediaProfile);

  // ── Project switcher ──────────────────────────────────────────────────────
  document.getElementById('project-sel')?.addEventListener('change', e => switchProject(e.target.value));

  // ── Legacy collapsible unbound section ───────────────────────────────────
  document.getElementById('unbound-header')?.addEventListener('click', () => {
    document.getElementById('unbound-section').classList.toggle('open');
  });

  // ── Drag/drop on key-groups container ────────────────────────────────────
  const keyGroupsEl = document.getElementById('key-groups');
  keyGroupsEl.addEventListener('dragenter', e => {
    if (!state.dragStem) return;
    e.preventDefault();
    keyGroupsEl.classList.add('drop-armed', 'drop-waiting');
  });
  keyGroupsEl.addEventListener('dragover', e => {
    if (!state.dragStem) return;
    e.preventDefault();
    keyGroupsEl.classList.add('drop-armed', 'drop-waiting');
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  });
  keyGroupsEl.addEventListener('dragleave', e => {
    if (keyGroupsEl.contains(e.relatedTarget)) return;
    keyGroupsEl.classList.remove('drop-waiting');
  });
  keyGroupsEl.addEventListener('drop', e => {
    if (!state.dragStem && !(Array.isArray(state.dragStems) && state.dragStems.length)) return;
    e.preventDefault();
    keyGroupsEl.classList.remove('drop-waiting');
    const hasCardTarget = !!e.target.closest('.key-card, .unbound-card');
    if (!hasCardTarget) toggleSelect(state.dragStem);
    state.dragStem = null;
    state.dragStems = [];
    window.__hkDragSourceKey = null;
    window.__hkDragSourceUnboundId = null;
    if (!hasCardTarget) renderGroups(allGroupKeys());
  });

  document.getElementById('category-groups')?.addEventListener('dragover', e => {
    if (!state.dragStem) return;
    e.preventDefault();
  });

  // ── Dirty guard on page unload ────────────────────────────────────────────
  window.addEventListener('beforeunload', e => {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
}
