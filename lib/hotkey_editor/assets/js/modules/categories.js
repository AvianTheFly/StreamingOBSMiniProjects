import { state } from './state.js';

// ── Category data helpers ─────────────────────────────────────────────────────
// Single source of truth for reading/writing sound→category relationships.

export function sortedCategories() {
  return [...new Set((state.categories || []).map(v => String(v || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

export function categoriesForStem(stem) {
  const raw = state.soundCategories?.[stem];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))]
    .filter(name => state.categories.includes(name))
    .sort((a, b) => a.localeCompare(b));
}

export function setCategoriesForStem(stem, categories) {
  if (!state.soundCategories || typeof state.soundCategories !== 'object') state.soundCategories = {};
  const next = [...new Set((categories || []).map(v => String(v || '').trim()).filter(Boolean))]
    .filter(name => state.categories.includes(name));
  if (next.length) state.soundCategories[stem] = next;
  else delete state.soundCategories[stem];
}

export function addStemToCategory(stem, category) {
  const normalized = String(category || '').trim();
  if (!stem || !normalized || !state.categories.includes(normalized)) return false;
  const next = categoriesForStem(stem);
  if (next.includes(normalized)) return false;
  next.push(normalized);
  setCategoriesForStem(stem, next);
  return true;
}

export function removeStemFromCategory(stem, category) {
  const before = categoriesForStem(stem);
  const next = before.filter(name => name !== category);
  if (next.length === before.length) return false;
  setCategoriesForStem(stem, next);
  return true;
}
