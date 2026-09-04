import { state } from './state.js';
import { normalizeHotkeys, removeStemFromKey, stemToKeys } from './hotkey.js';
import { pushUndo, pushFileUndo, undoFile, canUndoFile } from './undo.js';
import {
  displayNameForStem, setDisplayNameForStem, stemColorClass, keyColorClass,
  truncateChipLabel, formatStemHotkeyLabel,
} from './card-utils.js';
import { categoriesForStem, removeStemFromCategory } from './categories.js';
import { previewSound, mediaTypeForSound, fileExt } from './preview.js';
import { attachGroupRevealHover } from './hover.js';
import { markDirty } from './ui.js';
import { bindUndoButton } from './undo-buttons.js';
import * as actions from './actions.js';
// render/applyVisibility imported inside function bodies to avoid circular init
import { render, applyVisibility } from './render.js';

function visibleCardStems() {
  return [...document.querySelectorAll('.sound-card:not(.hidden-item)')]
    .map(card => card.dataset.stem)
    .filter(Boolean);
}

function syncMultiSelectToolbar() {
  const countEl = document.getElementById('library-multi-count');
  const helpEl = document.getElementById('library-multi-help');
  const clearBtn = document.getElementById('library-clear-selection');
  const count = state.multiSelectedStems?.size || 0;
  if (countEl) countEl.textContent = count ? `${count} file${count === 1 ? '' : 's'} selected` : 'No files selected';
  if (helpEl) {
    helpEl.textContent = count
      ? 'Drag the selected files into a hotkey group or category, or keep adding with Ctrl/Cmd-click.'
      : 'Ctrl/Cmd-click to add files. Shift-click selects a range. Drag the selected files into a hotkey group or category.';
  }
  if (clearBtn) clearBtn.disabled = !count;
}

export function setMultiSelected(next, anchor = null) {
  state.multiSelectedStems = new Set(next);
  if (anchor) state.multiSelectAnchorStem = anchor;
  document.querySelectorAll('.sound-card').forEach(card => {
    const selected = state.multiSelectedStems.has(card.dataset.stem);
    card.classList.toggle('multi-selected', selected);
    const count = card.querySelector('.multi-select-count');
    if (count) {
      count.hidden = !selected || state.multiSelectedStems.size <= 1;
      count.textContent = String(state.multiSelectedStems.size);
    }
  });
  syncMultiSelectToolbar();
}

export function clearMultiSelection() {
  setMultiSelected(new Set());
}

export function selectVisibleCards() {
  const stems = visibleCardStems();
  setMultiSelected(new Set(stems), stems[0] || null);
}

export function handleStemMultiSelect(event, stem) {
  if ((event.button ?? 0) !== 0) return false;
  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;
  if (!ctrl && !shift) {
    if (state.multiSelectedStems?.size) clearMultiSelection();
    state.multiSelectAnchorStem = stem;
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  const next = new Set(ctrl ? state.multiSelectedStems : []);
  if (shift) {
    const stems = visibleCardStems();
    const anchor = state.multiSelectAnchorStem || stem;
    const start = stems.indexOf(anchor);
    const end = stems.indexOf(stem);
    if (start >= 0 && end >= 0) {
      const [from, to] = start <= end ? [start, end] : [end, start];
      stems.slice(from, to + 1).forEach(item => next.add(item));
    } else {
      next.add(stem);
    }
  } else if (next.has(stem)) {
    next.delete(stem);
  } else {
    next.add(stem);
  }

  setMultiSelected(next, stem);
  return true;
}

function handleCardMultiSelect(event, stem) {
  return handleStemMultiSelect(event, stem);
}

function shouldIgnorePreviewTarget(target) {
  return !!target?.closest(
    '.card-action-btn, .card-volume-control, .card-name-input, .category-chip, .category-chip-empty'
  );
}

// ── Card name sizing ──────────────────────────────────────────────────────────

function cardNameSizeClass(label) {
  const length = String(label || '').length;
  if (length > 34) return 'name-xxlong';
  if (length > 24) return 'name-xlong';
  if (length > 16) return 'name-long';
  return 'name-normal';
}

// ── Inline rename ─────────────────────────────────────────────────────────────

function startCardRename(card, stem) {
  const nameEl = card.querySelector('.card-name');
  if (!nameEl || card.querySelector('.card-name-input')) return;

  const input = document.createElement('input');
  input.className = 'card-name-input';
  input.type = 'text';
  input.maxLength = 80;
  input.value = displayNameForStem(stem);
  input.setAttribute('aria-label', `Rename ${stem} in the UI`);

  const finish = (commit) => {
    if (!input.isConnected) return;
    if (commit) {
      const before = state.displayNames?.[stem] || '';
      const next = input.value.trim();
      const normalizedNext = next && next !== stem ? next : '';
      if (before !== normalizedNext) {
        setDisplayNameForStem(stem, next);
        markDirty();
        render();
        return;
      }
    }
    const restored = document.createElement('div');
    restored.className = 'card-name';
    restored.addEventListener('click', e => e.stopPropagation());
    restored.addEventListener('dblclick', e => {
      e.stopPropagation();
      startCardRename(card, stem);
    });
    input.replaceWith(restored);
    const sound = state.sounds.find(s => s.stem === stem);
    if (sound) updateCard(card, sound, stemToKeys());
  };

  input.addEventListener('click', e => e.stopPropagation());
  input.addEventListener('dblclick', e => e.stopPropagation());
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));

  nameEl.replaceWith(input);
  input.focus();
  input.select();
}

// ── Badge / media icon / assignment chips ─────────────────────────────────────

function renderCardBadge(badge, sound, keys, isSel) {
  badge.className  = 'card-key card-action-btn assign ' + (isSel ? 'listening' : (keys.length ? 'assigned' : 'unassigned'));
  badge.textContent = isSel ? '?' : '\u2328';
  badge.title = isSel ? 'Press a key to assign this file' : (keys.length ? 'Add another hotkey' : 'Assign hotkey');
}

function renderCardMediaIcon(icon, sound) {
  if (!icon) return;
  const mediaType = mediaTypeForSound(sound);
  const label = mediaType[0].toUpperCase() + mediaType.slice(1);
  icon.className  = `card-media-icon ${mediaType}`;
  icon.textContent = mediaType === 'video' ? '\u25b6' : mediaType === 'image' ? '\u25a3' : '\u266b';
  icon.title = `${label} file`;
}

function renderCardAssignments(body, sound, assignedKeys) {
  body.innerHTML = '';
  if (!assignedKeys.length) {
    const ug = state.unboundGroups.find(g => g.stems.includes(sound.stem));
    if (ug) {
      const tag = document.createElement('div');
      tag.className = 'chip card-state-chip card-unbound-tag';
      tag.innerHTML = `<span class="chip-label">${ug.name || 'Unbound group'}</span>`;
      tag.title = 'In an unbound group (no key assigned)';
      body.appendChild(tag);
      return;
    }
    const empty = document.createElement('div');
    empty.className = 'chip card-state-chip card-empty';
    empty.innerHTML = '<span class="chip-label">No keys</span>';
    body.appendChild(empty);
    return;
  }

  assignedKeys.forEach(key => {
    const chip = document.createElement('div');
    chip.className = `chip ${keyColorClass(key)}`;
    chip.title = `Reveal group ${key}`;
    attachGroupRevealHover(chip, key);

    const lbl = document.createElement('span');
    lbl.className   = 'chip-label chip-group-name';
    lbl.textContent = formatStemHotkeyLabel(sound.stem, key);

    const xBtn = document.createElement('button');
    xBtn.className   = 'chip-x';
    xBtn.type        = 'button';
    xBtn.title       = `Remove key ${key} from ${sound.stem}`;
    xBtn.textContent = '×';
    xBtn.addEventListener('click', e => {
      e.stopPropagation();
      pushUndo();
      pushFileUndo(sound.stem);
      const changed = removeStemFromKey(key, sound.stem);
      if (changed) { markDirty(); render(); }
    });

    chip.appendChild(lbl);
    chip.appendChild(xBtn);
    body.appendChild(chip);
  });
}

function buildFileVolumeControl(stem) {
  const value = Number(state.fileVolumeOffsets?.[stem] ?? 0);
  const open = state.activeVolumeStem === stem;
  const wrap = document.createElement('div');
  wrap.className = 'card-volume-control' + (value ? ' changed' : '') + (open ? ' open' : '');
  wrap.title = 'Per-file volume offset. Effective dB = mini project + profile + this file.';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'card-volume-toggle';
  toggle.textContent = value ? `${value > 0 ? '+' : ''}${value} dB` : '\u266a';
  toggle.title = value ? `File volume offset: ${value} dB` : 'Set file volume offset';
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    state.activeVolumeStem = open ? null : stem;
    render();
  });

  const pop = document.createElement('div');
  pop.className = 'card-volume-popover';
  const input = document.createElement('input');
  input.type = 'range';
  input.step = '0.5';
  input.min = '-60';
  input.max = '24';
  input.value = String(value);
  const numberInput = document.createElement('input');
  numberInput.type = 'number';
  numberInput.step = '0.5';
  numberInput.min = '-60';
  numberInput.max = '24';
  numberInput.value = String(value);
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'card-volume-clear';
  clear.textContent = 'Reset';

  const commitValue = (raw) => {
    const nextValue = Number(raw);
    if (!state.fileVolumeOffsets || typeof state.fileVolumeOffsets !== 'object') state.fileVolumeOffsets = {};
    if (!Number.isFinite(nextValue) || nextValue === 0) {
      delete state.fileVolumeOffsets[stem];
      input.value = '0';
      numberInput.value = '0';
    } else {
      state.fileVolumeOffsets[stem] = nextValue;
      input.value = String(nextValue);
      numberInput.value = String(nextValue);
    }
    markDirty();
  };

  input.addEventListener('click', e => e.stopPropagation());
  input.addEventListener('keydown', e => e.stopPropagation());
  input.addEventListener('input', e => {
    e.stopPropagation();
    commitValue(input.value);
  });
  numberInput.addEventListener('click', e => e.stopPropagation());
  numberInput.addEventListener('keydown', e => e.stopPropagation());
  numberInput.addEventListener('change', e => {
    e.stopPropagation();
    commitValue(numberInput.value);
    render();
  });
  clear.addEventListener('click', e => {
    e.stopPropagation();
    commitValue(0);
    state.activeVolumeStem = null;
    render();
  });
  pop.append(input, numberInput, clear);
  wrap.append(toggle, pop);
  return wrap;
}

// ── Build (create DOM once) ───────────────────────────────────────────────────

export function buildCard(sound) {
  const card = document.createElement('div');
  card.className  = 'sound-card';
  card.dataset.stem = sound.stem;
  card.tabIndex   = 0;
  card.draggable  = true;

  card.addEventListener('dragstart', e => {
    const selected = state.multiSelectedStems || new Set();
    const stems = selected.has(sound.stem) && selected.size > 1
      ? [...selected]
      : [sound.stem];
    state.dragStem = sound.stem;
    state.dragStems = stems;
    e.dataTransfer?.setData('text/plain', stems.join('\n'));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    if (state.rightMode === 'move-assets') {
      window.__hkMoveStem          = sound.stem;
      window.__hkMoveFilename      = sound.filename;
      window.__hkMoveSourceProject = state.currentProjectKey;
      window.__hkMoveSourceDir     = state.currentAssetDir;
    }
  });
  card.addEventListener('dragend', () => {
    state.dragStem = null;
    state.dragStems = [];
    window.__hkDragSourceKey       = null;
    window.__hkDragSourceUnboundId = null;
    window.__hkMoveStem            = null;
    window.__hkMoveFilename        = null;
    window.__hkMoveSourceProject   = null;
    window.__hkMoveSourceDir       = null;
    document.querySelectorAll('.key-card.drop-target, .unbound-card.drop-target, .move-assets-project-card.drop-target')
      .forEach(el => el.classList.remove('drop-target'));
    document.getElementById('key-groups')?.classList.remove('drop-armed', 'drop-waiting');
  });

  const head = document.createElement('div');
  head.className = 'sound-card-head';

  const key = document.createElement('button');
  key.className = 'card-key card-action-btn assign unassigned';
  key.type      = 'button';
  key.title     = 'Assign hotkey';
  key.addEventListener('click', e => {
    e.stopPropagation();
    actions.toggleSelect(sound.stem);
  });

  const meta = document.createElement('div');
  meta.className = 'sound-card-meta';

  const name = document.createElement('div');
  name.className = 'card-name';
  name.addEventListener('dblclick', e => {
    e.stopPropagation();
    startCardRename(card, sound.stem);
  });

  const subtext = document.createElement('span');
  subtext.className = 'card-subtext';

  const categoryChips = document.createElement('div');
  categoryChips.className = 'card-category-chips';

  const actionsEl = document.createElement('div');
  actionsEl.className = 'card-actions';

  const undoBtn = document.createElement('button');
  undoBtn.className   = 'card-action-btn file-undo';
  undoBtn.type        = 'button';
  undoBtn.title       = 'Undo changes for this file';
  undoBtn.textContent = '↩';
  undoBtn.disabled    = true;

  const rm = document.createElement('button');
  rm.className   = 'card-action-btn reset';
  rm.type        = 'button';
  rm.title       = 'Remove hotkeys';
  rm.textContent = '↺';
  rm.disabled    = true;
  rm.addEventListener('click', e => {
    e.stopPropagation();
    pushUndo();
    pushFileUndo(sound.stem);
    let changed = false;
    for (const k of Object.keys(state.hotkeys)) {
      changed = removeStemFromKey(k, sound.stem) || changed;
    }
    state.hotkeys = normalizeHotkeys(state.hotkeys);
    if (changed) { markDirty(); render(); }
  });

  actionsEl.appendChild(undoBtn);
  actionsEl.appendChild(rm);
  meta.appendChild(name);
  meta.appendChild(subtext);
  head.appendChild(key);
  head.appendChild(meta);

  const mediaIcon = document.createElement('div');
  mediaIcon.className = 'card-media-icon';
  head.appendChild(mediaIcon);

  const body = document.createElement('div');
  body.className = 'card-body';
  body.appendChild(actionsEl);

  const ext = document.createElement('div');
  ext.className = 'card-ext';

  const listenBanner = document.createElement('div');
  listenBanner.className = 'card-listen-banner';
  listenBanner.textContent = 'Press a key to assign';

  const multiCount = document.createElement('div');
  multiCount.className = 'multi-select-count';
  multiCount.hidden = true;

  card.appendChild(head);
  card.appendChild(categoryChips);
  card.appendChild(body);
  card.appendChild(ext);
  card.appendChild(listenBanner);
  card.appendChild(multiCount);

  card.addEventListener('click', e => {
    if (shouldIgnorePreviewTarget(e.target)) return;
    if (handleCardMultiSelect(e, sound.stem)) return;
    previewSound(sound.stem);
  });
  card.addEventListener('keydown', e => {
    if (shouldIgnorePreviewTarget(e.target)) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); previewSound(sound.stem); }
  });

  return card;
}

// ── Update (patch existing DOM) ───────────────────────────────────────────────

export function updateCard(card, sound, s2k) {
  const assignedKeys = s2k[sound.stem] || [];
  const isSel        = state.selected === sound.stem;
  const isMultiSel   = state.multiSelectedStems?.has(sound.stem);
  const isPreviewing = state.previewStem === sound.stem;

  card.classList.toggle('selected',   isSel);
  card.classList.toggle('multi-selected', !!isMultiSel);
  card.classList.toggle('previewing', isPreviewing);
  card.classList.toggle('layout-override', !!state.layoutOverrides?.[sound.stem]);
  card.classList.toggle('move-queued',
    state.moveAssetsPending.some(m => m.stem === sound.stem && m.fromProject === state.currentProjectKey)
  );

  const badge      = card.querySelector('.card-key');
  const mediaIcon  = card.querySelector('.card-media-icon');
  const name       = card.querySelector('.card-name');
  const body       = card.querySelector('.card-body');
  const rm         = card.querySelector('.card-action-btn.reset');
  const undoBtn    = card.querySelector('.card-action-btn.file-undo');
  const actionsEl  = card.querySelector('.card-actions');
  const subtext    = card.querySelector('.card-subtext');
  const banner     = card.querySelector('.card-listen-banner');
  const multiCount = card.querySelector('.multi-select-count');
  const catChips   = card.querySelector('.card-category-chips');
  const displayName = displayNameForStem(sound.stem);
  const customName  = displayName !== sound.stem;

  renderCardBadge(badge, sound, assignedKeys, isSel);
  renderCardMediaIcon(mediaIcon, sound);
  renderCardAssignments(body, sound, assignedKeys);
  body.appendChild(buildFileVolumeControl(sound.stem));

  if (actionsEl) {
    const thirdSlot = body.children[2] || null;
    body.insertBefore(actionsEl, thirdSlot);
  }

  card.dataset.keys = assignedKeys.join(',');
  if (name && !name.classList.contains('card-name-input')) {
    name.textContent = displayName;
    name.title = 'Double-click to rename this card label';
    name.className = `card-name ${cardNameSizeClass(displayName)}`;
  }
  if (subtext) {
    subtext.textContent = customName ? sound.stem : '';
    subtext.title       = customName ? `Filename: ${sound.stem}` : '';
    subtext.style.display = customName ? 'block' : 'none';
  }
  if (banner) {
    banner.hidden = !isSel;
    banner.textContent = `Press a key for ${displayName}`;
  }
  if (multiCount) {
    multiCount.hidden = !isMultiSel || state.multiSelectedStems.size <= 1;
    multiCount.textContent = String(state.multiSelectedStems.size);
  }
  if (catChips) {
    catChips.innerHTML = '';
    const currentCategories = categoriesForStem(sound.stem);
    if (!currentCategories.length) {
      const empty = document.createElement('span');
      empty.className = 'category-chip category-chip-empty';
      empty.textContent = 'No categories';
      catChips.appendChild(empty);
    }
    currentCategories.forEach(category => {
      const chip = document.createElement('button');
      chip.className = 'category-chip';
      chip.type = 'button';
      chip.title = `Remove ${category}`;
      const label = document.createElement('span');
      label.textContent = category;
      const x = document.createElement('span');
      x.className = 'category-chip-x';
      x.textContent = 'x';
      chip.appendChild(label);
      chip.appendChild(x);
      chip.addEventListener('click', e => {
        e.stopPropagation();
        pushUndo();
        if (removeStemFromCategory(sound.stem, category)) {
          markDirty();
          render();
        }
      });
      catChips.appendChild(chip);
    });
  }

  badge.title = isSel ? 'Cancel (Esc)' : (assignedKeys.length ? 'Add another hotkey' : 'Assign hotkey');
  bindUndoButton(undoBtn, {
    canUndo: () => canUndoFile(sound.stem),
    undo: () => {
      undoFile(sound.stem);
      if (state.selected === sound.stem) actions.deselect();
    },
    render,
    titleReady: `Undo last file change for ${displayName}`,
    titleEmpty: `No file undo for ${displayName}`,
  });
  rm.disabled = !assignedKeys.length;
  rm.title    = assignedKeys.length ? `Clear all keys (${assignedKeys.join(', ')})` : 'Remove hotkeys';
}

// ── Render all library cards ──────────────────────────────────────────────────

export function renderCards(s2k) {
  const grid = document.getElementById('sound-grid');
  if (state.sounds.length === 0) {
    grid.innerHTML = `<div class="grid-empty">No files found.</div>`;
    return;
  }

  const sorted = [...state.sounds].sort((a, b) => {
    const ak = (s2k[a.stem] || []).length, bk = (s2k[b.stem] || []).length;
    const an = displayNameForStem(a.stem);
    const bn = displayNameForStem(b.stem);
    switch (state.sortMode) {
      case 'name-desc':        return bn.localeCompare(an);
      case 'recent-first':     return ((b.mtime || b.ctime || 0) - (a.mtime || a.ctime || 0)) || an.localeCompare(bn);
      case 'assigned-first':   return ((ak ? 0 : 1) - (bk ? 0 : 1)) || an.localeCompare(bn);
      case 'unassigned-first': return ((ak ? 1 : 0) - (bk ? 1 : 0)) || an.localeCompare(bn);
      case 'category': {
        const ac = categoriesForStem(a.stem)[0] || '';
        const bc = categoriesForStem(b.stem)[0] || '';
        return ac.localeCompare(bc) || an.localeCompare(bn);
      }
      default: return an.localeCompare(bn);
    }
  });

  grid.querySelector('.grid-empty')?.remove();
  const existing = {};
  grid.querySelectorAll('.sound-card').forEach(el => { existing[el.dataset.stem] = el; });

  sorted.forEach(sound => {
    let card = existing[sound.stem];
    if (!card) card = buildCard(sound);
    updateCard(card, sound, s2k);
    grid.appendChild(card);
    delete existing[sound.stem];
  });

  for (const el of Object.values(existing)) el.remove();
  applyVisibility(s2k);
  syncMultiSelectToolbar();
}
