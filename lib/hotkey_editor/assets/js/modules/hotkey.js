import { state } from './state.js';
import { KEYBOARD_ORDER } from './constants.js';

// ── Key ordering ──────────────────────────────────────────────────────────────

export function compareHotkeysQwerty(a, b) {
  const ka = KEYBOARD_ORDER.get(a);
  const kb = KEYBOARD_ORDER.get(b);
  if (ka && kb) return ka.row - kb.row || ka.col - kb.col || ka.variant - kb.variant || ka.idx - kb.idx;
  if (ka) return -1;
  if (kb) return 1;
  return String(a).localeCompare(String(b));
}

// ── Hotkey data normalization ─────────────────────────────────────────────────

export function normalizeHotkeys(obj) {
  const normalized = {};
  const seenPerKey = new Map();

  for (const [rawKey, rawValue] of Object.entries(obj || {})) {
    const key = String(rawKey || '').trim();
    if (!key) continue;

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      const stem = typeof value === 'string' ? value.trim() : '';
      if (!stem) continue;

      if (!seenPerKey.has(key)) seenPerKey.set(key, new Set());
      const keySeen = seenPerKey.get(key);
      if (keySeen.has(stem)) continue;
      keySeen.add(stem);

      const cur = normalized[key];
      if (!cur) normalized[key] = stem;
      else if (Array.isArray(cur)) normalized[key] = [...cur, stem];
      else normalized[key] = [cur, stem];
    }
  }
  return normalized;
}

// ── Stem ↔ key lookups ────────────────────────────────────────────────────────

export function stemToKeys() {
  const map = {};
  for (const [k, v] of Object.entries(state.hotkeys)) {
    const stems = Array.isArray(v) ? v : v ? [v] : [];
    stems.forEach(stem => {
      if (!map[stem]) map[stem] = [];
      if (!map[stem].includes(k)) map[stem].push(k);
    });
  }
  for (const keys of Object.values(map)) keys.sort();
  return map;
}

export function stemPrimaryKey(stem) {
  return (stemToKeys()[stem] || [])[0] || null;
}

export function groupSize(key) {
  const v = state.hotkeys[key];
  return !v ? 0 : Array.isArray(v) ? v.length : 1;
}

export function groupStems(key) {
  const v = state.hotkeys[key];
  return !v ? [] : Array.isArray(v) ? [...v] : [v];
}

// ── Empty group management ────────────────────────────────────────────────────

export function addEmptyGroup(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return false;
  if (!state.emptyGroups.includes(normalized)) state.emptyGroups.push(normalized);
  return true;
}

export function removeEmptyGroup(key) {
  const normalized = String(key || '').trim();
  const next = state.emptyGroups.filter(v => v !== normalized);
  const changed = next.length !== state.emptyGroups.length;
  state.emptyGroups = next;
  return changed;
}

// ── All group keys (sorted by QWERTY layout) ─────────────────────────────────

export function allGroupKeys() {
  return [...new Set([
    ...Object.keys(state.hotkeys || {}),
    ...(state.emptyGroups || []),
    ...Object.keys(state.groupNames || {}),
  ])].sort(compareHotkeysQwerty);
}

// ── Unbound group ID generation ───────────────────────────────────────────────

export function generateUnboundId() {
  const existing = new Set(state.unboundGroups.map(g => g.id));
  let i = 0;
  while (existing.has(`u${i}`)) i++;
  return `u${i}`;
}

// ── Stem removal ──────────────────────────────────────────────────────────────

export function removeStemFromKey(key, stem) {
  const v = state.hotkeys[key];
  if (!v) return false;
  const stems = Array.isArray(v) ? v.filter(s => s !== stem) : (v === stem ? [] : [v]);
  const prev = JSON.stringify(Array.isArray(v) ? v : [v]);
  const next = JSON.stringify(stems);
  if (prev === next) return false;
  if (stems.length === 0) delete state.hotkeys[key];
  else if (stems.length === 1) state.hotkeys[key] = stems[0];
  else state.hotkeys[key] = stems;
  return true;
}

export function removeStem(stem) {
  let changed = false;
  for (const key of Object.keys(state.hotkeys)) {
    changed = removeStemFromKey(key, stem) || changed;
  }
  state.hotkeys = normalizeHotkeys(state.hotkeys);
  return changed;
}

export function removeStemFromUnboundGroups(stem, exceptId = null) {
  let changed = false;
  state.unboundGroups.forEach(group => {
    if (exceptId && group.id === exceptId) return;
    const next = group.stems.filter(s => s !== stem);
    if (next.length !== group.stems.length) {
      group.stems = next;
      changed = true;
    }
  });
  return changed;
}

// ── Stem assignment ───────────────────────────────────────────────────────────

export function assignStemToKey(char, stem) {
  state.hotkeys = normalizeHotkeys(state.hotkeys);
  const existingKeys = stemToKeys()[stem] || [];
  if (existingKeys.includes(char)) return false;
  const cur = state.hotkeys[char];
  if (Array.isArray(cur)) state.hotkeys[char] = [...cur, stem];
  else if (cur) state.hotkeys[char] = cur === stem ? cur : [cur, stem];
  else state.hotkeys[char] = stem;
  state.hotkeys = normalizeHotkeys(state.hotkeys);
  return true;
}

// ── Group key migration ───────────────────────────────────────────────────────

export function migrateGroupKey(fromKey, toKey) {
  fromKey = String(fromKey || '').trim();
  toKey   = String(toKey   || '').trim();
  if (!fromKey || !toKey || fromKey === toKey) return false;

  const stems = groupStems(fromKey);
  const hadGroup = stems.length > 0 || !!state.groupNames[fromKey] || state.emptyGroups.includes(fromKey);
  if (!hadGroup) return false;

  let changed = false;
  for (const stem of stems) changed = assignStemToKey(toKey, stem) || changed;

  if (stems.length) { delete state.hotkeys[fromKey]; changed = true; }

  if (state.groupNames[fromKey] && !state.groupNames[toKey]) {
    state.groupNames[toKey] = state.groupNames[fromKey];
    changed = true;
  }
  if (state.groupNames[fromKey]) delete state.groupNames[fromKey];

  if (state.emptyGroups.includes(fromKey)) {
    removeEmptyGroup(fromKey);
    addEmptyGroup(toKey);
    changed = true;
  } else if (!stems.length) {
    addEmptyGroup(toKey);
    changed = true;
  }

  if (groupStems(toKey).length) removeEmptyGroup(toKey);
  state.hotkeys = normalizeHotkeys(state.hotkeys);
  return changed;
}
