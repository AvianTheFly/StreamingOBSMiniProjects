import { state } from './state.js';
import { normalizeHotkeys, stemToKeys, allGroupKeys } from './hotkey.js';
import { displayNameForStem } from './card-utils.js';
import { categoriesForStem } from './categories.js';
import { isVideoSound, mediaTypeForSound, syncPreviewCardState } from './preview.js';
import { renderLayoutPanel } from './layout.js';
import { renderMoveAssetsPanel } from './move-assets.js';
import { renderPhrasesPanel } from './phrases.js';
import { renderCards, updateCard } from './render-library.js';
import { renderGroups, renderUnboundGroups } from './render-groups.js';
import { renderCategoryGroups, refreshCategoryControls } from './render-categories.js';

// ── Scroll preservation ───────────────────────────────────────────────────────

export function preserveScroll(fn) {
  const wrap = document.getElementById('sound-grid-wrap');
  const scrollTargets = [
    document.getElementById('key-groups'),
    document.getElementById('category-groups'),
    document.getElementById('phrases-panel'),
    document.getElementById('layout-panel'),
    document.getElementById('move-assets-panel'),
    document.querySelector('.panel-right'),
  ].filter(Boolean);
  const top  = wrap?.scrollTop || 0;
  const left = wrap?.scrollLeft || 0;
  const rightScroll = scrollTargets.map(el => [el, el.scrollTop, el.scrollLeft]);
  fn();
  requestAnimationFrame(() => {
    if (wrap) {
      wrap.scrollTop  = top;
      wrap.scrollLeft = left;
    }
    rightScroll.forEach(([el, scrollTop, scrollLeft]) => {
      el.scrollTop = scrollTop;
      el.scrollLeft = scrollLeft;
    });
  });
}

export function scrollGroupCardIntoView(key) {
  if (!key) return;
  requestAnimationFrame(() => {
    const card = document.querySelector(`.key-card[data-key="${CSS.escape(key)}"], .unbound-card[data-id="${CSS.escape(key)}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

// ── Visibility filter ─────────────────────────────────────────────────────────

export function applyVisibility(s2k) {
  const q = state.searchQuery.toLowerCase();
  let shown = 0;
  document.querySelectorAll('.sound-card').forEach(el => {
    const sound = state.sounds.find(item => item.stem === el.dataset.stem);
    const keyCount     = (s2k[el.dataset.stem] || []).length;
    const label        = displayNameForStem(el.dataset.stem).toLowerCase();
    const categories   = categoriesForStem(el.dataset.stem);
    const categoryText = categories.join(' ').toLowerCase();
    const matchQ = !q || el.dataset.stem.toLowerCase().includes(q) || label.includes(q) || categoryText.includes(q);
    const mediaType = sound ? mediaTypeForSound(sound) : 'audio';
    const typeFilter = state.mediaTypeFilter || 'all';
    const matchType = typeFilter === 'all' || mediaType === typeFilter;
    const activeCategory = state.activeCategoryFilter || 'all';
    const matchCategory =
      activeCategory === 'all'          ? true :
      activeCategory === 'uncategorized' ? !categories.length :
      categories.includes(activeCategory);
    const showMode = state.libraryShow || state.activeFilter || 'all';
    const matchF =
      showMode === 'all'               ? true :
      showMode === 'needs-work'        ? keyCount === 0 || categories.length === 0 :
      showMode === 'no-hotkey'         ? keyCount === 0 :
      showMode === 'has-hotkey'        ? keyCount > 0 :
      showMode === 'no-category'       ? categories.length === 0 :
      showMode === 'has-category'      ? categories.length > 0 :
      showMode === 'selected-category' ? matchCategory && activeCategory !== 'all' && activeCategory !== 'uncategorized' :
      true;
    const matchMediaMode = state.rightMode === 'layout'
      ? !!sound && isVideoSound(sound)
        && (!state.layoutFilterDimension || sound.dimension_key === state.layoutFilterDimension)
        && (
          !state.layoutFilterCategory
          || state.layoutFilterCategory === 'all'
          || (state.layoutFilterCategory === 'Uncategorized'
            ? categories.length === 0
            : categories.includes(state.layoutFilterCategory))
        )
      : true;
    const visible = matchMediaMode && matchQ && matchF && matchType && matchCategory;
    el.classList.toggle('hidden-item', !visible);
    if (visible) shown += 1;
  });
  const count = document.getElementById('library-count-pill');
  if (count) count.textContent = `${shown} shown`;
}

// ── Selection refresh ─────────────────────────────────────────────────────────

export function refreshCard(stem) {
  const s2k   = stemToKeys();
  const sound = state.sounds.find(s => s.stem === stem);
  const card  = document.querySelector(`.sound-card[data-stem="${CSS.escape(stem)}"]`);
  if (card && sound) updateCard(card, sound, s2k);
}

export function refreshGroupHighlights() {
  const s2k     = stemToKeys();
  const selKeys = state.selected ? (s2k[state.selected] || []) : [];
  document.querySelectorAll('.key-card').forEach(c =>
    c.classList.toggle('highlighted', selKeys.includes(c.dataset.key))
  );
}

// ── Right panel mode switching ────────────────────────────────────────────────

export function setRightMode(mode) {
  const validModes = ['hotkeys', 'categories', 'phrases', 'layout', 'move-assets'];
  state.rightMode = validModes.includes(mode) ? mode : 'hotkeys';
  const isCategories = state.rightMode === 'categories';
  const isPhrases    = state.rightMode === 'phrases';
  const isLayout     = state.rightMode === 'layout';
  const isMoveAssets = state.rightMode === 'move-assets';
  document.getElementById('key-groups')?.toggleAttribute('hidden', isCategories || isPhrases || isLayout || isMoveAssets);
  document.getElementById('category-groups')?.toggleAttribute('hidden', !isCategories);
  document.getElementById('phrases-panel')?.toggleAttribute('hidden', !isPhrases);
  document.getElementById('layout-panel')?.toggleAttribute('hidden', !isLayout);
  document.getElementById('move-assets-panel')?.toggleAttribute('hidden', !isMoveAssets);
  document.getElementById('unbound-section')?.toggleAttribute('hidden', isCategories || isPhrases || isLayout || isMoveAssets);
  const addGroupBtn = document.getElementById('add-group-btn');
  if (addGroupBtn) addGroupBtn.style.display = isCategories || isPhrases || isLayout || isMoveAssets ? 'none' : '';
  const categoryTools = document.getElementById('category-panel-tools');
  if (categoryTools) categoryTools.hidden = !isCategories;
  const label = document.getElementById('right-header-label');
  if (label) label.textContent =
    isLayout     ? 'OBS' :
    isCategories ? 'Categories' :
    isPhrases    ? 'Voice Phrases' :
    isMoveAssets ? 'Move Assets' :
    'Key Assignments';
  document.querySelectorAll('.right-mode').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.mode === state.rightMode)
  );
  if (!isMoveAssets) applyVisibility(stemToKeys());
}

// ── Main render ───────────────────────────────────────────────────────────────

export function render() {
  preserveScroll(() => {
    state.hotkeys = normalizeHotkeys(state.hotkeys);
    const s2k = stemToKeys();

    document.getElementById('stat-count').textContent    = state.sounds.length;
    document.getElementById('stat-assigned').textContent = state.sounds.filter(s => (s2k[s.stem] || []).length).length;

    renderCards(s2k);
    renderGroups(allGroupKeys());
    renderCategoryGroups();
    renderPhrasesPanel();
    renderLayoutPanel();
    renderMoveAssetsPanel();
    renderUnboundGroups();
    refreshCategoryControls();
    setRightMode(state.rightMode);
    syncPreviewCardState();
  });
}
