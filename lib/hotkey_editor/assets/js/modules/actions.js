import { state } from './state.js';
import {
  normalizeHotkeys, stemToKeys, groupStems, allGroupKeys, generateUnboundId,
  addEmptyGroup, removeEmptyGroup, removeStemFromKey, removeStemFromUnboundGroups,
  assignStemToKey, migrateGroupKey,
} from './hotkey.js';
import { pushUndo, pushFileUndo, pushGroupUndo } from './undo.js';
import { markDirty, updateFooterStatus } from './ui.js';
import { render, refreshCard, refreshGroupHighlights, scrollGroupCardIntoView } from './render.js';

// ── Selection ─────────────────────────────────────────────────────────────────

export function toggleSelect(stem) {
  if (state.selected === stem) { deselect(); return; }
  const prev    = state.selected;
  state.selected = stem;
  updateFooterStatus();
  if (prev) refreshCard(prev);
  refreshCard(stem);
  refreshGroupHighlights();
}

export function deselect() {
  const prev     = state.selected;
  state.selected = null;
  updateFooterStatus();
  if (prev) refreshCard(prev);
  refreshGroupHighlights();
}

// ── Pending key-capture modes ─────────────────────────────────────────────────

export function beginGroupRebind(key) {
  const normalized = String(key || '').trim();
  if (!normalized || !allGroupKeys().includes(normalized)) return;
  state.pendingEmptyGroupCreate = false;
  state.pendingGroupRebindKey   = normalized;
  deselect();
  updateFooterStatus();
}

export function beginEmptyGroupCreate() {
  state.pendingGroupRebindKey   = null;
  state.pendingEmptyGroupCreate = true;
  deselect();
  updateFooterStatus();
}

export function finishEmptyGroupCreate(nextKey) {
  state.pendingEmptyGroupCreate = false;
  const normalized = String(nextKey || '').trim();
  if (!normalized) { updateFooterStatus(); return; }
  if (allGroupKeys().includes(normalized)) { beginGroupRebind(normalized); return; }
  pushUndo();
  addEmptyGroup(normalized);
  markDirty();
  render();
  updateFooterStatus();
}

export function finishGroupRebind(nextKey) {
  const fromKey    = state.pendingGroupRebindKey;
  state.pendingGroupRebindKey = null;
  const normalized = String(nextKey || '').trim();
  if (!fromKey || !normalized || normalized === fromKey) {
    render();
    updateFooterStatus();
    scrollGroupCardIntoView(fromKey || normalized);
    return;
  }
  pushUndo();
  if (migrateGroupKey(fromKey, normalized)) markDirty();
  render();
  updateFooterStatus();
  scrollGroupCardIntoView(normalized);
}

export function cancelGroupRebind() {
  if (!state.pendingGroupRebindKey && !state.pendingEmptyGroupCreate && !state.pendingUnboundBind) return false;
  state.pendingGroupRebindKey   = null;
  state.pendingEmptyGroupCreate = false;
  state.pendingUnboundBind      = null;
  updateFooterStatus();
  render();
  return true;
}

// ── Bind / unbind key groups ──────────────────────────────────────────────────

export function unbindKeyGroup(key) {
  const stems = groupStems(key);
  const name  = state.groupNames[key] || '';
  const id    = generateUnboundId();
  pushUndo();
  pushGroupUndo(key);
  state.unboundGroups.push({ id, name, stems });
  delete state.hotkeys[key];
  delete state.groupNames[key];
  removeEmptyGroup(key);
  markDirty();
  render();
}

export function bindUnboundGroup(id, key) {
  const group = state.unboundGroups.find(g => g.id === id);
  if (!group) return;
  pushUndo();
  group.stems.forEach(stem => assignStemToKey(key, stem));
  if (group.name) state.groupNames[key] = group.name;
  removeEmptyGroup(key);
  state.unboundGroups = state.unboundGroups.filter(g => g.id !== id);
  state.hotkeys = normalizeHotkeys(state.hotkeys);
  markDirty();
  render();
  scrollGroupCardIntoView(key);
}

export function deleteUnboundGroup(id) {
  state.unboundGroups = state.unboundGroups.filter(g => g.id !== id);
  markDirty();
  render();
}

// ── Drag-and-drop assignment ──────────────────────────────────────────────────

export function assignByDrop(stem, key, sourceKey = null) {
  if (!stem || !key) return;
  state.hotkeys = normalizeHotkeys(state.hotkeys);
  const currentKeys = stemToKeys()[stem] || [];
  if (currentKeys.includes(key) && (!sourceKey || sourceKey === key)) return;

  pushUndo();
  pushGroupUndo(key);
  if (sourceKey && sourceKey !== key) pushGroupUndo(sourceKey);
  pushFileUndo(stem);

  let changed = false;
  if (sourceKey && sourceKey !== key) {
    changed = removeStemFromKey(sourceKey, stem) || changed;
    if (groupStems(sourceKey).length === 0) addEmptyGroup(sourceKey);
  }
  changed = removeStemFromUnboundGroups(stem) || changed;
  changed = assignStemToKey(key, stem) || changed;
  removeEmptyGroup(key);

  if (changed) {
    state.hotkeys = normalizeHotkeys(state.hotkeys);
    markDirty();
    deselect();
    refreshCard(stem);
    render();
  }
}

export function assignManyByDrop(stems, key, sourceKey = null) {
  const unique = [...new Set((stems || []).map(stem => String(stem || '').trim()).filter(Boolean))];
  if (!unique.length || !key) return;

  state.hotkeys = normalizeHotkeys(state.hotkeys);
  pushUndo();
  pushGroupUndo(key);
  if (sourceKey && sourceKey !== key) pushGroupUndo(sourceKey);
  unique.forEach(stem => pushFileUndo(stem));

  let changed = false;
  unique.forEach(stem => {
    const currentKeys = stemToKeys()[stem] || [];
    if (currentKeys.includes(key) && (!sourceKey || sourceKey === key)) return;
    if (sourceKey && sourceKey !== key) changed = removeStemFromKey(sourceKey, stem) || changed;
    changed = removeStemFromUnboundGroups(stem) || changed;
    changed = assignStemToKey(key, stem) || changed;
  });

  if (sourceKey && sourceKey !== key && groupStems(sourceKey).length === 0) addEmptyGroup(sourceKey);
  removeEmptyGroup(key);

  if (changed) {
    state.hotkeys = normalizeHotkeys(state.hotkeys);
    markDirty();
    deselect();
    unique.forEach(stem => refreshCard(stem));
    render();
  }
}

export function assignToUnboundGroup(stem, id, sourceKey = null, sourceUnboundId = null) {
  if (!stem || !id) return;
  const target = state.unboundGroups.find(group => group.id === id);
  if (!target) return;

  state.hotkeys = normalizeHotkeys(state.hotkeys);
  const currentKeys   = stemToKeys()[stem] || [];
  const alreadyInTarget = target.stems.includes(stem);
  if (alreadyInTarget && (!sourceKey || sourceUnboundId === id)) return;

  pushUndo();
  pushFileUndo(stem);
  if (sourceKey) pushGroupUndo(sourceKey);

  let changed = false;

  if (sourceKey) {
    changed = removeStemFromKey(sourceKey, stem) || changed;
    if (groupStems(sourceKey).length === 0) addEmptyGroup(sourceKey);
  } else if (!sourceUnboundId) {
    currentKeys.forEach(key => {
      pushGroupUndo(key);
      changed = removeStemFromKey(key, stem) || changed;
      if (groupStems(key).length === 0) addEmptyGroup(key);
    });
  }

  changed = removeStemFromUnboundGroups(stem, id) || changed;

  if (!target.stems.includes(stem)) { target.stems.push(stem); changed = true; }

  if (changed) {
    state.hotkeys = normalizeHotkeys(state.hotkeys);
    markDirty();
    deselect();
    refreshCard(stem);
    render();
  }
}

export function assignManyToUnboundGroup(stems, id, sourceKey = null, sourceUnboundId = null) {
  const unique = [...new Set((stems || []).map(stem => String(stem || '').trim()).filter(Boolean))];
  if (!unique.length || !id) return;
  const target = state.unboundGroups.find(group => group.id === id);
  if (!target) return;

  state.hotkeys = normalizeHotkeys(state.hotkeys);
  pushUndo();
  if (sourceKey) pushGroupUndo(sourceKey);
  unique.forEach(stem => pushFileUndo(stem));

  let changed = false;
  unique.forEach(stem => {
    const currentKeys = stemToKeys()[stem] || [];
    const alreadyInTarget = target.stems.includes(stem);
    if (alreadyInTarget && (!sourceKey || sourceUnboundId === id)) return;

    if (sourceKey) {
      changed = removeStemFromKey(sourceKey, stem) || changed;
    } else if (!sourceUnboundId) {
      currentKeys.forEach(key => {
        pushGroupUndo(key);
        changed = removeStemFromKey(key, stem) || changed;
        if (groupStems(key).length === 0) addEmptyGroup(key);
      });
    }

    changed = removeStemFromUnboundGroups(stem, id) || changed;
    if (!target.stems.includes(stem)) {
      target.stems.push(stem);
      changed = true;
    }
  });

  if (sourceKey && groupStems(sourceKey).length === 0) addEmptyGroup(sourceKey);

  if (changed) {
    state.hotkeys = normalizeHotkeys(state.hotkeys);
    markDirty();
    deselect();
    unique.forEach(stem => refreshCard(stem));
    render();
  }
}
