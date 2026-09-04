import { state } from './state.js';
import { KEYBOARD_ROWS } from './constants.js';
import {
  normalizeHotkeys, stemToKeys, groupStems, allGroupKeys,
  addEmptyGroup, removeEmptyGroup, removeStemFromKey, assignStemToKey,
} from './hotkey.js';
import { pushUndo, pushGroupUndo, undoGroup, canUndoGroup } from './undo.js';
import {
  displayNameForStem, stemColorClass,
  computeGroupChipColumns, estimateGroupCardContentWidth,
} from './card-utils.js';
import { previewSound } from './preview.js';
import { attachChipRevealHover } from './hover.js';
import { categoriesForStem } from './categories.js';
import { markDirty, updateFooterStatus } from './ui.js';
import { bindUndoButton } from './undo-buttons.js';
import * as actions from './actions.js';
import { render } from './render.js';
import { handleStemMultiSelect } from './render-library.js';

function draggedStems() {
  const stems = Array.isArray(state.dragStems) && state.dragStems.length
    ? state.dragStems
    : state.dragStem ? [state.dragStem] : [];
  return [...new Set(stems)].filter(Boolean);
}

// ── Unbound groups (stub — now rendered inline via renderGroups) ───────────────

export function renderUnboundGroups() {
  const section = document.getElementById('unbound-section');
  if (section) section.style.display = 'none';
}

// ── Main group panel renderer ─────────────────────────────────────────────────

export function renderGroups(allKeys) {
  const container = document.getElementById('key-groups');
  const emptyEl   = document.getElementById('groups-empty');
  const width = Math.max(170, Math.min(360, Number(state.groupCardWidth) || 205));
  state.groupCardWidth = width;
  container.style.setProperty('--group-card-width', `${width}px`);
  container.classList.toggle('drop-armed', !!state.dragStem);

  const hasUnbound = state.unboundGroups.length > 0;

  if (allKeys.length === 0 && !hasUnbound) {
    container.querySelectorAll('.key-row, .key-card, .unbound-inline-section, .new-group-section').forEach(el => el.remove());
    if (emptyEl) {
      emptyEl.style.display = 'none';
      emptyEl.querySelector('.empty-sub').innerHTML = state.dragStem
        ? 'Drop a file here, then press a key to create its assignment.'
        : 'Click + Empty Group, or click the keyboard button on a file,<br>then press any key to assign it.';
    }
    _appendNewGroupCard(container);
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const s2k     = stemToKeys();
  const selKeys = state.selected ? (s2k[state.selected] || []) : [];
  const existing = {};
  container.querySelectorAll('.key-card').forEach(el => { existing[el.dataset.key] = el; });
  container.querySelectorAll('.group-size-section').forEach(el => el.remove());
  container.querySelectorAll('.key-row').forEach(el => el.remove());
  container.querySelectorAll('.unbound-inline-section').forEach(el => el.remove());
  container.querySelectorAll('.new-group-section').forEach(el => el.remove());

  _appendGroupSizeControl(container);

  const placedKeys = new Set();

  KEYBOARD_ROWS.forEach((rowKeys, rowIndex) => {
    const rowEl = document.createElement('div');
    rowEl.className   = 'key-row';
    rowEl.dataset.row = String(rowIndex + 1);

    rowKeys.forEach(pair => {
      const pairKeys = pair.filter(key => allKeys.includes(key));
      if (!pairKeys.length) return;

      const stack = document.createElement('div');
      stack.className = 'key-pair-stack' + (pairKeys.length > 1 ? ' paired' : ' single');
      stack.dataset.pair = pair.join(' ');

      pairKeys.forEach(key => {
        if (!allKeys.includes(key)) return;
        let card = existing[key];
        if (!card) card = buildGroupCard(key);
        updateGroupCard(card, key, selKeys);
        stack.appendChild(card);
        delete existing[key];
        placedKeys.add(key);
      });

      rowEl.appendChild(stack);
    });

    if (rowEl.childElementCount) container.appendChild(rowEl);
  });

  const leftovers = allKeys.filter(key => !placedKeys.has(key));
  if (leftovers.length) {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row key-row-extra';
    leftovers.forEach(key => {
      const stack = document.createElement('div');
      stack.className = 'key-pair-stack single';
      stack.dataset.pair = key;
      let card = existing[key];
      if (!card) card = buildGroupCard(key);
      updateGroupCard(card, key, selKeys);
      stack.appendChild(card);
      rowEl.appendChild(stack);
      delete existing[key];
    });
    container.appendChild(rowEl);
  }

  for (const el of Object.values(existing)) el.remove();

  if (hasUnbound) {
    const section = document.createElement('div');
    section.className = 'unbound-inline-section';

    const divider = document.createElement('div');
    divider.className = 'unbound-inline-divider';
    divider.innerHTML = `<span>Unbound Groups</span><span class="unbound-inline-badge">${state.unboundGroups.length}</span>`;
    section.appendChild(divider);

    const wrap = document.createElement('div');
    wrap.className = 'unbound-inline-wrap';

    const sorted = [...state.unboundGroups].sort((a, b) =>
      (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
    );
    sorted.forEach(group => wrap.appendChild(buildUnboundCard(group)));
    section.appendChild(wrap);
    container.appendChild(section);
  }

  _appendNewGroupCard(container);
}

// ── New group creation card ───────────────────────────────────────────────────

function _appendGroupSizeControl(container) {
  const section = document.createElement('div');
  section.className = 'group-size-section';

  const label = document.createElement('label');
  label.className = 'group-size-control';
  const text = document.createElement('span');
  text.textContent = 'Card width';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '170';
  input.max = '360';
  input.step = '5';
  input.value = String(state.groupCardWidth);
  const value = document.createElement('b');
  value.textContent = `${state.groupCardWidth}px`;

  input.addEventListener('input', () => {
    const next = Math.max(170, Math.min(360, Number(input.value) || 205));
    state.groupCardWidth = next;
    localStorage.setItem('hk-group-card-width', String(next));
    container.style.setProperty('--group-card-width', `${next}px`);
    value.textContent = `${next}px`;
    requestAnimationFrame(() => {
      container.querySelectorAll('.key-card').forEach(card => {
        const body = card.querySelector('.key-card-body');
        if (!body) return;
        const stems = groupStems(card.dataset.key || '');
        body.style.setProperty('--chip-cols', computeGroupChipColumns(stems, estimateGroupCardContentWidth(card, body)));
      });
    });
  });

  label.append(text, input, value);
  section.appendChild(label);
  container.appendChild(section);
}

function _appendNewGroupCard(container) {
  const section = document.createElement('div');
  section.className = 'new-group-section';

  const label = document.createElement('div');
  label.className = 'new-group-label';
  label.textContent = 'New Group';

  const card = document.createElement('div');
  card.className = 'new-group-card';

  const top = document.createElement('div');
  top.className = 'new-group-top';

  const keyInput = document.createElement('input');
  keyInput.className = 'new-group-key';
  keyInput.type = 'text';
  keyInput.maxLength = 1;
  keyInput.placeholder = '+';
  keyInput.setAttribute('aria-label', 'New group key');

  const nameInput = document.createElement('input');
  nameInput.className = 'new-group-name';
  nameInput.type = 'text';
  nameInput.maxLength = 60;
  nameInput.placeholder = 'Optional group name';
  nameInput.setAttribute('aria-label', 'New group name');

  const hint = document.createElement('div');
  hint.className = 'new-group-hint';
  hint.textContent = 'Type a key, then press Enter.';

  const createGroup = () => {
    const key  = keyInput.value.trim();
    const name = nameInput.value.trim();
    if (!key) return;
    pushUndo();
    if (groupStems(key).length) removeEmptyGroup(key);
    else addEmptyGroup(key);
    if (name) state.groupNames[key] = name;
    markDirty();
    render();
  };

  keyInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); createGroup(); }
  });
  nameInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); createGroup(); }
  });
  keyInput.addEventListener('input', () => {
    if (keyInput.value.length >= 1 && !nameInput.value.trim()) {
      hint.textContent = 'Press Enter to create, or name it first.';
    }
  });

  top.appendChild(keyInput);
  top.appendChild(nameInput);
  card.appendChild(top);
  card.appendChild(hint);
  section.appendChild(label);
  section.appendChild(card);
  container.appendChild(section);
}

// ── Key group card ────────────────────────────────────────────────────────────

export function buildGroupCard(key) {
  const card = document.createElement('div');
  card.className  = 'key-card';
  card.dataset.key = key;

  const head = document.createElement('div');
  head.className = 'key-card-head';

  const kk = document.createElement('button');
  kk.className = 'kk kk-btn';
  kk.type      = 'button';
  kk.title     = 'Change this key for the whole group';
  kk.addEventListener('click', e => {
    e.stopPropagation();
    actions.beginGroupRebind(card.dataset.key || key);
    kk.blur();
  });

  const meta = document.createElement('div');
  meta.className = 'key-card-meta';

  const titleInput = document.createElement('input');
  titleInput.className   = 'kcm-title-input';
  titleInput.type        = 'text';
  titleInput.maxLength   = 60;
  titleInput.placeholder = 'Name this group';
  titleInput.addEventListener('click', e => e.stopPropagation());
  titleInput.addEventListener('keydown', e => e.stopPropagation());
  titleInput.addEventListener('input', e => {
    const currentKey = card.dataset.key || key;
    pushGroupUndo(currentKey);
    const value = e.target.value.trim();
    if (value) state.groupNames[currentKey] = value;
    else delete state.groupNames[currentKey];
    markDirty();
    const groupUndoBtn = card.querySelector('.btn-group-undo');
    if (groupUndoBtn) groupUndoBtn.disabled = !canUndoGroup(currentKey);
  });

  const sub = document.createElement('div');
  sub.className = 'kcm-sub';

  const unbindBtn = document.createElement('button');
  unbindBtn.className   = 'card-action-btn unbind';
  unbindBtn.type        = 'button';
  unbindBtn.title       = 'Unassign key — keep files in an unbound group';
  unbindBtn.textContent = '⛓';
  unbindBtn.addEventListener('click', e => {
    e.stopPropagation();
    const k = card.dataset.key || key;
    if (groupStems(k).length === 0 && !state.emptyGroups.includes(k)) return;
    pushUndo();
    actions.unbindKeyGroup(k);
  });

  const groupUndoBtn = document.createElement('button');
  groupUndoBtn.className   = 'btn-group-undo';
  groupUndoBtn.type        = 'button';
  groupUndoBtn.title       = 'Undo last change to this group';
  groupUndoBtn.textContent = '↩';
  groupUndoBtn.disabled    = true;

  const randomBtn = document.createElement('button');
  randomBtn.className = 'btn-group-random';
  randomBtn.type = 'button';
  randomBtn.title = 'This group randomly chooses from multiple files';
  randomBtn.textContent = 'âŸ³';
  randomBtn.hidden = true;
  randomBtn.disabled = true;

  const actionStack = document.createElement('div');
  actionStack.className = 'key-card-action-stack';
  actionStack.append(groupUndoBtn, randomBtn, unbindBtn);

  meta.appendChild(titleInput);
  meta.appendChild(sub);
  head.appendChild(kk);
  head.appendChild(meta);
  head.appendChild(actionStack);

  const body = document.createElement('div');
  body.className = 'key-card-body';

  card.appendChild(head);
  card.appendChild(body);

  card.addEventListener('dragenter', e => {
    if (!state.dragStem) return;
    e.preventDefault();
    card.classList.add('drop-target');
  });
  card.addEventListener('dragover', e => {
    if (!state.dragStem) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    card.classList.add('drop-target');
  });
  card.addEventListener('dragleave', e => {
    if (!card.contains(e.relatedTarget)) card.classList.remove('drop-target');
  });
  card.addEventListener('drop', e => {
    const stems = draggedStems();
    if (!stems.length) return;
    e.preventDefault();
    e.stopPropagation();
    card.classList.remove('drop-target');
    actions.assignManyByDrop(stems, card.dataset.key || key, window.__hkDragSourceKey || null);
    state.dragStem = null;
    state.dragStems = [];
    window.__hkDragSourceKey = null;
    window.__hkDragSourceUnboundId = null;
  });

  return card;
}

function categoryBucketsForStems(stems) {
  const buckets = new Map();
  stems.forEach(stem => {
    const names = categoriesForStem(stem);
    (names.length ? names : ['No category']).forEach(name => {
      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name).push(stem);
    });
  });
  return [...buckets.entries()].sort(([a], [b]) => {
    if (a === 'No category') return 1;
    if (b === 'No category') return -1;
    return a.localeCompare(b);
  });
}

function filterLibraryByCategory(category) {
  const value = category === 'No category' ? 'uncategorized' : category;
  state.activeCategoryFilter = value;
  const select = document.getElementById('category-filter');
  if (select) select.value = value;
  document.querySelectorAll('.category-filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.category === value);
  });
  import('./render.js').then(({ applyVisibility }) => {
    applyVisibility(stemToKeys());
  });
}

function shouldPreviewChip(event) {
  if ((event.button ?? 0) !== 0) return false;
  if (event.defaultPrevented) return false;
  return !event.target.closest('.chip-x');
}

function buildGroupChip(stem, { key = null, group = null, removeTitle, onRemove } = {}) {
  const label = displayNameForStem(stem);
  const chip = document.createElement('button');
  chip.className = `chip ${stemColorClass(stem)}`;
  chip.type = 'button';
  chip.draggable = true;
  chip.tabIndex  = 0;
  chip.title     = label === stem
    ? `Preview ${stem} or drag to another group`
    : `Preview ${label} (${stem}) or drag to another group`;

  chip.addEventListener('click', e => {
    e.stopPropagation();
    if (!shouldPreviewChip(e)) {
      onRemove?.(stem);
      return;
    }
    if (handleStemMultiSelect(e, stem)) {
      render();
      return;
    }
    previewSound(stem);
  });
  chip.addEventListener('keydown', e => {
    if (e.target.closest('.chip-x')) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); previewSound(stem); }
  });
  chip.addEventListener('dragstart', e => {
    const selected = state.multiSelectedStems || new Set();
    const stems = selected.has(stem) && selected.size > 1 ? [...selected] : [stem];
    state.dragStem = stem;
    state.dragStems = stems;
    window.__hkDragSourceKey       = key;
    window.__hkDragSourceUnboundId = group?.id || null;
    e.dataTransfer?.setData('text/plain', stems.join('\n'));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });
  chip.addEventListener('dragend', () => {
    state.dragStem = null;
    state.dragStems = [];
    window.__hkDragSourceKey       = null;
    window.__hkDragSourceUnboundId = null;
    document.querySelectorAll('.key-card.drop-target, .unbound-card.drop-target').forEach(el => el.classList.remove('drop-target'));
    document.getElementById('key-groups')?.classList.remove('drop-armed', 'drop-waiting');
  });

  const lbl = document.createElement('span');
  lbl.className   = 'chip-label';
  lbl.title       = label === stem ? stem : `${label} (${stem})`;
  lbl.textContent = label;

  attachChipRevealHover(chip, stem);

  const xBtn = document.createElement('span');
  xBtn.className   = 'chip-x';
  xBtn.title       = removeTitle || `Remove ${stem} from group`;
  xBtn.textContent = '×';
  chip.appendChild(lbl);
  chip.appendChild(xBtn);
  xBtn.addEventListener('click', e => {
    e.stopPropagation();
    onRemove?.(stem);
  });
  chip.classList.toggle('multi-selected', state.multiSelectedStems?.has(stem));
  return chip;
}

function renderCategorizedGroupChips(body, stems, chipFactory) {
  body.innerHTML = '';
  categoryBucketsForStems(stems).forEach(([category, bucketStems]) => {
    const section = document.createElement('div');
    section.className = 'group-chip-category';

    const title = document.createElement('button');
    title.className = 'group-chip-category-title';
    title.type = 'button';
    title.title = `Filter library by ${category}`;
    title.addEventListener('click', () => filterLibraryByCategory(category));
    const titleText = document.createElement('span');
    titleText.textContent = category;
    const titleCount = document.createElement('b');
    titleCount.textContent = String(bucketStems.length);
    title.appendChild(titleText);
    title.appendChild(titleCount);

    const grid = document.createElement('div');
    grid.className = 'group-chip-category-grid';
    bucketStems.forEach(stem => grid.appendChild(chipFactory(stem)));

    section.appendChild(title);
    section.appendChild(grid);
    body.appendChild(section);
  });
}

export function updateGroupCard(card, key, selKeys) {
  card.dataset.key = key;
  const stems = groupStems(key);
  const size  = stems.length;

  card.classList.toggle('highlighted', selKeys.includes(key));

  const kk = card.querySelector('.kk');
  kk.textContent = state.pendingGroupRebindKey === key ? '?' : key;
  kk.className   = 'kk kk-btn'
    + (size >= 5 ? ' kk-lg' : size >= 3 ? ' kk-md' : '')
    + (state.pendingGroupRebindKey === key ? ' listening' : '');

  const titleInput = card.querySelector('.kcm-title-input');
  if (document.activeElement !== titleInput) {
    titleInput.value = state.groupNames[key] || '';
  }
  titleInput.setAttribute('aria-label', `Group name for key ${key}`);

  const sub = card.querySelector('.kcm-sub');
  sub.textContent = size ? '' : 'Empty group';
  sub.hidden = size > 0;
  const randomBtn = card.querySelector('.btn-group-random');
  if (randomBtn) randomBtn.hidden = size <= 1;

  const groupUndoBtn = card.querySelector('.btn-group-undo');
  bindUndoButton(groupUndoBtn, {
    canUndo: () => canUndoGroup(card.dataset.key || key),
    undo: () => undoGroup(card.dataset.key || key),
    render,
    titleReady: `Undo last change to group ${key}`,
    titleEmpty: `No group undo for ${key}`,
  });

  const body = card.querySelector('.key-card-body');
  const availableWidth = estimateGroupCardContentWidth(card, body);
  const chipCols = computeGroupChipColumns(stems, availableWidth);
  body.style.setProperty('--chip-cols', chipCols);
  renderCategorizedGroupChips(body, stems, stem => buildGroupChip(stem, {
    key,
    removeTitle: `Remove "${stem}" from key ${key}`,
    onRemove: () => {
      pushUndo();
      pushGroupUndo(key);
      const changed = removeStemFromKey(key, stem);
      if (changed) {
        state.hotkeys = normalizeHotkeys(state.hotkeys);
        if (groupStems(key).length === 0) addEmptyGroup(key);
        markDirty();
        render();
      }
    },
  }));
}

// ── Unbound group card ────────────────────────────────────────────────────────

export function buildUnboundCard(group) {
  const card = document.createElement('div');
  card.className  = 'unbound-card';
  card.dataset.id = group.id;

  card.addEventListener('dragenter', e => {
    if (!state.dragStem) return;
    e.preventDefault();
    card.classList.add('drop-target');
  });
  card.addEventListener('dragover', e => {
    if (!state.dragStem) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    card.classList.add('drop-target');
  });
  card.addEventListener('dragleave', e => {
    if (!card.contains(e.relatedTarget)) card.classList.remove('drop-target');
  });
  card.addEventListener('drop', e => {
    const stems = draggedStems();
    if (!stems.length) return;
    e.preventDefault();
    e.stopPropagation();
    card.classList.remove('drop-target');
    actions.assignManyToUnboundGroup(
      stems,
      card.dataset.id || group.id,
      window.__hkDragSourceKey || null,
      window.__hkDragSourceUnboundId || null
    );
    state.dragStem = null;
    state.dragStems = [];
    window.__hkDragSourceKey = null;
    window.__hkDragSourceUnboundId = null;
  });

  const head = document.createElement('div');
  head.className = 'unbound-card-head';

  const badge = document.createElement('div');
  badge.className  = 'unbound-badge' + (state.pendingUnboundBind === group.id ? ' listening' : '');
  badge.textContent = state.pendingUnboundBind === group.id ? '?' : '—';
  badge.title      = 'Click then press a key to bind this group';
  badge.addEventListener('click', e => {
    e.stopPropagation();
    if (state.pendingUnboundBind === group.id) {
      state.pendingUnboundBind = null;
    } else {
      state.pendingUnboundBind      = group.id;
      state.selected                = null;
      state.pendingGroupRebindKey   = null;
      state.pendingEmptyGroupCreate = false;
    }
    updateFooterStatus();
    render();
  });

  const nameInput = document.createElement('input');
  nameInput.className   = 'unbound-name-input';
  nameInput.type        = 'text';
  nameInput.maxLength   = 60;
  nameInput.placeholder = 'Group name…';
  nameInput.value       = group.name || '';
  nameInput.addEventListener('click', e => e.stopPropagation());
  nameInput.addEventListener('keydown', e => e.stopPropagation());
  nameInput.addEventListener('input', e => {
    group.name = e.target.value;
    markDirty();
  });

  const delBtn = document.createElement('button');
  delBtn.className   = 'btn-unbound-del';
  delBtn.type        = 'button';
  delBtn.title       = 'Delete this unbound group';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (state.pendingUnboundBind === group.id) state.pendingUnboundBind = null;
    actions.deleteUnboundGroup(group.id);
  });

  head.appendChild(badge);
  head.appendChild(nameInput);
  head.appendChild(delBtn);

  const body = document.createElement('div');
  body.className = 'unbound-card-body';

  renderCategorizedGroupChips(body, group.stems, stem => buildGroupChip(stem, {
    group,
    removeTitle: `Remove ${stem} from group`,
    onRemove: () => {
      group.stems = group.stems.filter(s => s !== stem);
      markDirty();
      render();
    },
  }));

  card.appendChild(head);
  card.appendChild(body);
  return card;
}
