import { state } from './state.js';
import { CHIP_HOVER_SCROLL_DELAY_MS } from './constants.js';

// ── Timer cleanup helpers ─────────────────────────────────────────────────────

export function clearChipHoverTimer() {
  if (!state.chipHoverTimer) return;
  clearTimeout(state.chipHoverTimer);
  state.chipHoverTimer = null;
}

export function clearGroupHoverTimer() {
  if (!state.groupHoverTimer) return;
  clearTimeout(state.groupHoverTimer);
  state.groupHoverTimer = null;
}

export function clearHoverLinkedCard() {
  if (state.hoverLinkedClearTimer) {
    clearTimeout(state.hoverLinkedClearTimer);
    state.hoverLinkedClearTimer = null;
  }
  if (!state.hoverLinkedStem) return;
  const prev = document.querySelector(`.sound-card[data-stem="${CSS.escape(state.hoverLinkedStem)}"]`);
  prev?.classList.remove('hover-linked');
  state.hoverLinkedStem = null;
}

export function clearHoverLinkedGroup() {
  if (state.hoverLinkedGroupClearTimer) {
    clearTimeout(state.hoverLinkedGroupClearTimer);
    state.hoverLinkedGroupClearTimer = null;
  }
  if (!state.hoverLinkedKey) return;
  const prev = document.querySelector(`.key-card[data-key="${CSS.escape(state.hoverLinkedKey)}"]`);
  prev?.classList.remove('hover-linked');
  state.hoverLinkedKey = null;
}

// ── Cross-panel highlight ─────────────────────────────────────────────────────

export function revealKeyGroup(key) {
  const card = document.querySelector(`.key-card[data-key="${CSS.escape(key)}"]`);
  if (!card) return;

  clearHoverLinkedGroup();
  state.hoverLinkedKey = key;
  card.classList.add('hover-linked');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

  state.hoverLinkedGroupClearTimer = setTimeout(() => {
    card.classList.remove('hover-linked');
    if (state.hoverLinkedKey === key) state.hoverLinkedKey = null;
    state.hoverLinkedGroupClearTimer = null;
  }, 1800);
}

export function revealStemInLibrary(stem) {
  const input   = document.getElementById('search');

  if (state.searchQuery || state.activeFilter !== 'all') {
    state.searchQuery  = '';
    state.activeFilter = 'all';
    if (input) input.value = '';
    document.querySelectorAll('.pill').forEach(p =>
      p.classList.toggle('active', p.dataset.filter === 'all')
    );
  }

  const card = document.querySelector(`.sound-card[data-stem="${CSS.escape(stem)}"]`);
  if (!card) return;

  clearHoverLinkedCard();
  state.hoverLinkedStem = stem;
  card.classList.add('hover-linked');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

  state.hoverLinkedClearTimer = setTimeout(() => {
    card.classList.remove('hover-linked');
    if (state.hoverLinkedStem === stem) state.hoverLinkedStem = null;
    state.hoverLinkedClearTimer = null;
  }, 1800);
}

// ── Hover attach helpers ──────────────────────────────────────────────────────

export function attachGroupRevealHover(chip, key) {
  chip.addEventListener('mouseenter', () => {
    clearGroupHoverTimer();
    state.groupHoverTimer = setTimeout(() => {
      revealKeyGroup(key);
      state.groupHoverTimer = null;
    }, CHIP_HOVER_SCROLL_DELAY_MS);
  });
  chip.addEventListener('mouseleave', clearGroupHoverTimer);
  chip.addEventListener('mousedown', clearGroupHoverTimer);
  chip.addEventListener('dragstart', clearGroupHoverTimer);
}

export function attachChipRevealHover(chip, stem) {
  chip.addEventListener('mouseenter', () => {
    clearChipHoverTimer();
    state.chipHoverTimer = setTimeout(() => {
      revealStemInLibrary(stem);
      state.chipHoverTimer = null;
    }, CHIP_HOVER_SCROLL_DELAY_MS);
  });
  chip.addEventListener('mouseleave', clearChipHoverTimer);
  chip.addEventListener('mousedown', clearChipHoverTimer);
  chip.addEventListener('dragstart', clearChipHoverTimer);
}
