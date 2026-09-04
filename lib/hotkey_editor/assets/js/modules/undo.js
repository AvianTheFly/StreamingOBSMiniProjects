import { state } from './state.js';
import { MAX_UNDO, MAX_FILE_UNDO, MAX_GROUP_UNDO } from './constants.js';
import {
  normalizeHotkeys, stemToKeys, groupStems,
  assignStemToKey, addEmptyGroup, removeEmptyGroup,
} from './hotkey.js';

// ── Snapshot helpers ──────────────────────────────────────────────────────────

export function currentStateSnapshot() {
  return JSON.stringify({
    hotkeys:       normalizeHotkeys(state.hotkeys),
    groupNames:    { ...state.groupNames },
    displayNames:  { ...state.displayNames },
    categories:    [...state.categories],
    soundCategories: { ...state.soundCategories },
    emptyGroups:   [...state.emptyGroups],
    unboundGroups: JSON.parse(JSON.stringify(state.unboundGroups)),
  });
}

export function currentFileSnapshot(stem) {
  return JSON.stringify(stemToKeys()[stem] || []);
}

export function currentGroupSnapshot(key) {
  return JSON.stringify({
    stems:   groupStems(key),
    name:    state.groupNames[key] || '',
    isEmpty: state.emptyGroups.includes(key),
  });
}

// ── Restore helpers ───────────────────────────────────────────────────────────

export function restoreStateSnapshot(snapshot) {
  try {
    const parsed = JSON.parse(snapshot);
    state.hotkeys       = normalizeHotkeys(parsed.hotkeys || {});
    state.groupNames    = parsed.groupNames && typeof parsed.groupNames === 'object' ? parsed.groupNames : {};
    state.displayNames  = parsed.displayNames && typeof parsed.displayNames === 'object' ? parsed.displayNames : {};
    state.categories    = Array.isArray(parsed.categories) ? parsed.categories : [];
    state.soundCategories = parsed.soundCategories && typeof parsed.soundCategories === 'object' ? parsed.soundCategories : {};
    state.emptyGroups   = Array.isArray(parsed.emptyGroups) ? parsed.emptyGroups : [];
    state.unboundGroups = Array.isArray(parsed.unboundGroups) ? parsed.unboundGroups : [];
  } catch {}
}

export function restoreFileSnapshot(stem, snapshot) {
  let keys = [];
  try {
    const parsed = JSON.parse(snapshot);
    if (Array.isArray(parsed)) {
      keys = [...new Set(parsed.map(v => String(v || '').trim()).filter(Boolean))].sort();
    }
  } catch {}
  // Remove stem from all keys first
  for (const key of Object.keys(state.hotkeys)) {
    const v = state.hotkeys[key];
    const stems = Array.isArray(v) ? v.filter(s => s !== stem) : (v === stem ? [] : [v]);
    if (stems.length === 0) delete state.hotkeys[key];
    else if (stems.length === 1) state.hotkeys[key] = stems[0];
    else state.hotkeys[key] = stems;
  }
  keys.forEach(key => assignStemToKey(key, stem));
  state.hotkeys = normalizeHotkeys(state.hotkeys);
}

// ── Global undo ───────────────────────────────────────────────────────────────

export function pushUndo() {
  state.undoStack.push(currentStateSnapshot());
  if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
  const btn = document.getElementById('undo-btn');
  if (btn) btn.disabled = false;
}

export function undo() {
  if (!state.undoStack.length) return;
  restoreStateSnapshot(state.undoStack.pop());
  const btn = document.getElementById('undo-btn');
  if (btn && !state.undoStack.length) btn.disabled = true;
}

// ── Per-file undo ─────────────────────────────────────────────────────────────

export function pushFileUndo(stem) {
  if (!stem) return;
  (state.fileUndoStacks[stem] ||= []).push(currentFileSnapshot(stem));
  if (state.fileUndoStacks[stem].length > MAX_FILE_UNDO) state.fileUndoStacks[stem].shift();
}

export function canUndoFile(stem) {
  return !!(stem && state.fileUndoStacks[stem] && state.fileUndoStacks[stem].length);
}

export function undoFile(stem) {
  if (!canUndoFile(stem)) return;
  const snapshot = state.fileUndoStacks[stem].pop();
  restoreFileSnapshot(stem, snapshot);
}

// ── Per-group undo ────────────────────────────────────────────────────────────

export function pushGroupUndo(key) {
  if (!key) return;
  (state.groupUndoStacks[key] ||= []).push(currentGroupSnapshot(key));
  if (state.groupUndoStacks[key].length > MAX_GROUP_UNDO) state.groupUndoStacks[key].shift();
}

export function canUndoGroup(key) {
  return !!(key && state.groupUndoStacks[key] && state.groupUndoStacks[key].length);
}

export function undoGroup(key) {
  if (!canUndoGroup(key)) return;
  const snapshot = state.groupUndoStacks[key].pop();
  try {
    const parsed = JSON.parse(snapshot);
    const currentStems = groupStems(key);
    currentStems.forEach(stem => removeStemFromKey(key, stem));
    const stems = Array.isArray(parsed.stems) ? parsed.stems : [];
    stems.forEach(stem => assignStemToKey(key, stem));
    if (parsed.name) state.groupNames[key] = parsed.name;
    else delete state.groupNames[key];
    if (parsed.isEmpty && groupStems(key).length === 0) addEmptyGroup(key);
    else removeEmptyGroup(key);
    state.hotkeys = normalizeHotkeys(state.hotkeys);
  } catch {}
}
