import { state } from './state.js';
import { CHIP_LABEL_MAX } from './constants.js';

// ── Display name helpers ──────────────────────────────────────────────────────

export function displayNameForStem(stem) {
  return String(state.displayNames?.[stem] || '').trim() || stem;
}

export function setDisplayNameForStem(stem, value) {
  const trimmed = String(value || '').trim();
  if (!state.displayNames || typeof state.displayNames !== 'object') state.displayNames = {};
  if (!trimmed || trimmed === stem) delete state.displayNames[stem];
  else state.displayNames[stem] = trimmed;
}

// ── Color hashing ─────────────────────────────────────────────────────────────

export function stemColorClass(stem) {
  let h = 0;
  for (let i = 0; i < stem.length; i++) h = Math.imul(31, h) + stem.charCodeAt(i) | 0;
  return `chip-c${Math.abs(h) % 6}`;
}

export function keyColorClass(key) {
  let h = 0;
  const source = String(key || '');
  for (let i = 0; i < source.length; i++) h = Math.imul(33, h) + source.charCodeAt(i) | 0;
  return `key-c${Math.abs(h) % 6}`;
}

// ── Label helpers ─────────────────────────────────────────────────────────────

export function truncateChipLabel(text, max = CHIP_LABEL_MAX) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max)}-` : value;
}

export function formatExtBadge(ext) {
  const clean = String(ext || '').replace(/^\./, '').toUpperCase();
  if (!clean) return 'FILE';
  return clean.length <= 4 ? clean : clean.slice(0, 4);
}

export function groupDisplayNameForKey(key) {
  const raw = String(state.groupNames[key] || '').trim();
  return raw || String(key || '').trim();
}

export function formatStemHotkeyLabel(stem, key) {
  const name = String(state.groupNames[key] || '').trim();
  return name ? `${truncateChipLabel(name)} - ${key}` : key;
}

export function primaryGroupTitleForSound(sound, assignedKeys) {
  if (assignedKeys.length) {
    const namedKeys = assignedKeys.filter(key => String(state.groupNames[key] || '').trim());
    const chosenKey = namedKeys[0] || assignedKeys[0];
    const base = groupDisplayNameForKey(chosenKey);
    return assignedKeys.length > 1 ? `${base} +${assignedKeys.length - 1}` : base;
  }
  const ug = state.unboundGroups.find(g => g.stems.includes(sound.stem));
  if (ug) return String(ug.name || 'Unbound group').trim();
  return sound.stem;
}

// ── Chip column layout ────────────────────────────────────────────────────────

export function computeGroupChipColumns(stems, availableWidth) {
  const count = stems.length || 1;
  const safeWidth = Math.max(140, Math.floor(availableWidth || 0));
  const wrapAfter = 4;
  const minReadableChipWidth = 42;
  const colsByWidth = Math.max(1, Math.floor(safeWidth / minReadableChipWidth));
  return Math.max(1, Math.min(count, wrapAfter, colsByWidth));
}

export function estimateGroupCardContentWidth(card, body) {
  const measured = body?.clientWidth || card.clientWidth;
  if (measured) return Math.max(140, measured - 18);

  const containerWidth =
    card.parentElement?.clientWidth ||
    document.getElementById('key-groups')?.clientWidth ||
    document.querySelector('.panel-right')?.clientWidth ||
    window.innerWidth || 0;
  const configuredWidth = Number(state.groupCardWidth) || 205;
  const gapTotal = 0.45 * 15 * 3;
  const expectedCardWidth = Math.min(configuredWidth, Math.max(170, (containerWidth - gapTotal) / 4));
  return Math.max(140, Math.floor(expectedCardWidth - 18));
}
