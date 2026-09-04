import { state } from './state.js';
import { pushUndo } from './undo.js';
import { displayNameForStem, stemColorClass, truncateChipLabel } from './card-utils.js';
import {
  sortedCategories, categoriesForStem, addStemToCategory, removeStemFromCategory,
} from './categories.js';
import { previewSound } from './preview.js';
import { markDirty } from './ui.js';
import { render } from './render.js';
import { handleStemMultiSelect } from './render-library.js';

function draggedStems() {
  const stems = Array.isArray(state.dragStems) && state.dragStems.length
    ? state.dragStems
    : state.dragStem ? [state.dragStem] : [];
  return [...new Set(stems)].filter(Boolean);
}

// ── Library filter controls ───────────────────────────────────────────────────

export function refreshCategoryControls() {
  const filter = document.getElementById('category-filter');
  const strip  = document.getElementById('library-category-strip');
  if (!filter && !strip) return;

  const previous = state.activeCategoryFilter || filter?.value || 'all';
  const options  = [
    ['all', 'Any category'],
    ['uncategorized', 'Uncategorized'],
    ...sortedCategories().map(name => [name, name]),
  ];

  if (filter) {
    filter.innerHTML = '';
    options.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      filter.appendChild(opt);
    });
    filter.value = [...filter.options].some(opt => opt.value === previous) ? previous : 'all';
    state.activeCategoryFilter = filter.value;
  }

  if (strip) {
    strip.innerHTML = '';
    options.forEach(([value, label]) => {
      const btn = document.createElement('button');
      btn.className = 'category-filter-chip';
      btn.type = 'button';
      btn.dataset.category = value;
      btn.textContent = label;
      btn.classList.toggle('active', value === state.activeCategoryFilter);
      strip.appendChild(btn);
    });
  }
}

// ── Category panel renderer ───────────────────────────────────────────────────

export function renderCategoryGroups() {
  const container = document.getElementById('category-groups');
  if (!container) return;
  container.innerHTML = '';

  const categories = sortedCategories();
  if (!categories.length) {
    container.innerHTML = `
      <div class="groups-empty">
        <div class="empty-title">No categories yet</div>
        <div class="empty-sub">Type a category name above, then drag files here.</div>
      </div>`;
    return;
  }

  const query = (state.categoryPanelQuery || '').toLowerCase();
  categories
    .filter(category => !query || category.toLowerCase().includes(query))
    .forEach(category => _buildCategoryCard(container, category));
}

// ── Individual category card ──────────────────────────────────────────────────

function _buildCategoryCard(container, category) {
  const card = document.createElement('div');
  card.className = 'category-card';
  card.dataset.category = category;

  card.addEventListener('dragenter', e => {
    if (!draggedStems().length) return;
    e.preventDefault();
    card.classList.add('drop-target');
  });
  card.addEventListener('dragover', e => {
    if (!draggedStems().length) return;
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
    card.classList.remove('drop-target');
    pushUndo();
    let changed = false;
    stems.forEach(stem => {
      changed = addStemToCategory(stem, category) || changed;
    });
    if (changed) {
      markDirty();
      render();
    }
    state.dragStem = null;
    state.dragStems = [];
  });

  card.appendChild(_buildCardHead(category));
  card.appendChild(_buildCardBody(category));
  container.appendChild(card);
}

function _buildCardHead(category) {
  const head = document.createElement('div');
  head.className = 'category-card-head';

  const title = document.createElement('input');
  title.className = 'category-card-title category-card-title-input';
  title.value = category;
  title.maxLength = 40;
  title.title = 'Rename category';
  title.addEventListener('click', e => e.stopPropagation());
  title.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') title.blur();
    if (e.key === 'Escape') { title.value = category; title.blur(); }
  });
  title.addEventListener('blur', () => _renameCategory(title, category));

  const stems = _stemsForCategory(category);
  const count = document.createElement('div');
  count.className = 'category-card-count';
  count.textContent = stems.length;

  const del = document.createElement('button');
  del.className = 'category-card-delete';
  del.type = 'button';
  del.title = `Delete ${category}`;
  del.textContent = 'x';
  del.addEventListener('click', e => {
    e.stopPropagation();
    pushUndo();
    state.categories = state.categories.filter(name => name !== category);
    Object.keys(state.soundCategories || {}).forEach(stem => {
      state.soundCategories[stem] = categoriesForStem(stem).filter(name => name !== category);
      if (!state.soundCategories[stem].length) delete state.soundCategories[stem];
    });
    if (state.activeCategoryFilter === category) state.activeCategoryFilter = 'all';
    markDirty();
    render();
  });

  head.appendChild(title);
  head.appendChild(count);
  head.appendChild(del);
  return head;
}

function _buildCardBody(category) {
  const body = document.createElement('div');
  body.className = 'category-card-body';

  const stems = _stemsForCategory(category);

  if (!stems.length) {
    const empty = document.createElement('div');
    empty.className = 'category-empty';
    empty.textContent = 'Drop files here';
    body.appendChild(empty);
    return body;
  }

  stems.forEach(stem => {
    const chip = document.createElement('button');
    chip.className = `chip category-member ${stemColorClass(stem)}`;
    chip.type = 'button';
    chip.title = `Preview ${displayNameForStem(stem)}`;
    chip.innerHTML = `<span class="chip-label">${truncateChipLabel(displayNameForStem(stem), 16)}</span><span class="chip-x">x</span>`;
    chip.addEventListener('click', e => {
      e.stopPropagation();
      if (e.target.closest('.chip-x')) {
        pushUndo();
        if (removeStemFromCategory(stem, category)) {
          markDirty();
          render();
        }
        return;
      }
      if (handleStemMultiSelect(e, stem)) {
        render();
        return;
      }
      previewSound(stem);
    });
    chip.addEventListener('dragstart', e => {
      const selected = state.multiSelectedStems || new Set();
      const stemsToDrag = selected.has(stem) && selected.size > 1 ? [...selected] : [stem];
      state.dragStem = stem;
      state.dragStems = stemsToDrag;
      e.dataTransfer?.setData('text/plain', stemsToDrag.join('\n'));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      state.dragStem = null;
      state.dragStems = [];
      document.querySelectorAll('.category-card.drop-target').forEach(el => el.classList.remove('drop-target'));
    });
    chip.draggable = true;
    chip.classList.toggle('multi-selected', state.multiSelectedStems?.has(stem));
    body.appendChild(chip);
  });

  return body;
}

function _stemsForCategory(category) {
  return state.sounds
    .map(sound => sound.stem)
    .filter(stem => categoriesForStem(stem).includes(category))
    .sort((a, b) => displayNameForStem(a).localeCompare(displayNameForStem(b)));
}

function _renameCategory(titleEl, oldName) {
  const next = titleEl.value.trim();
  if (!next || next === oldName) { titleEl.value = oldName; return; }
  if (state.categories.includes(next)) { titleEl.value = oldName; return; }
  pushUndo();
  state.categories = state.categories.map(name => name === oldName ? next : name);
  Object.entries(state.soundCategories || {}).forEach(([stem, values]) => {
    const list = Array.isArray(values) ? values : [];
    if (list.includes(oldName)) {
      state.soundCategories[stem] = list.map(name => name === oldName ? next : name);
    }
  });
  if (state.activeCategoryFilter === oldName) state.activeCategoryFilter = next;
  markDirty();
  render();
}
