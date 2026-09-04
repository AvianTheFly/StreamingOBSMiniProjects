// layout-levels.js — Priority Levels tab for the OBS canvas panel.
//
// Shows the full audio priority stack: project → profile → category → file.
// Every displayed value is the FINAL output dB (sum of all layers above it),
// not an offset. Changing a higher layer ripples through all displayed finals
// below it in real-time.

function roundDb(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(24, Math.max(-60, Math.round(n * 2) / 2));
}

function formatDb(value, { sign = false } = {}) {
  const v = roundDb(value, 0);
  return `${sign && v > 0 ? '+' : ''}${v} dB`;
}

function meterPct(db) {
  return Math.max(4, Math.min(100, ((roundDb(db, -60) + 60) / 84) * 100));
}

// ── Shared stack-level slider component ──────────────────────────────────────

function makeStackSlider({ labelText, helpText, value, min = -60, max = 24, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'lv-stack-field';

  const head = document.createElement('div');
  head.className = 'lv-field-head';
  const label = document.createElement('strong');
  label.textContent = labelText;
  const valueEl = document.createElement('span');
  valueEl.className = 'lv-field-value';
  valueEl.textContent = formatDb(value, { sign: true });
  head.append(label, valueEl);

  const row = document.createElement('div');
  row.className = 'lv-field-row';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = '0.5';
  slider.value = String(roundDb(value, 0));
  const numInput = document.createElement('input');
  numInput.type = 'number';
  numInput.min = String(min);
  numInput.max = String(max);
  numInput.step = '0.5';
  numInput.value = String(roundDb(value, 0));
  row.append(slider, numInput);

  const help = document.createElement('small');
  help.className = 'lv-field-help';
  help.textContent = helpText;

  const sync = (raw) => {
    const next = roundDb(raw, 0);
    slider.value = String(next);
    numInput.value = String(next);
    valueEl.textContent = formatDb(next, { sign: true });
    onChange(next);
  };
  slider.addEventListener('input', () => sync(slider.value));
  numInput.addEventListener('input', () => sync(numInput.value));

  wrap.append(head, row, help);
  return { el: wrap, sync };
}

// ── Foundation section (project + profile) ───────────────────────────────────

function renderFoundation(ctx) {
  const section = document.createElement('section');
  section.className = 'lv-section';

  const title = document.createElement('div');
  title.className = 'lv-section-title';
  title.textContent = 'Foundation';

  const subtitle = document.createElement('div');
  subtitle.className = 'lv-section-sub';
  subtitle.textContent = 'Base layers that shift every file together.';

  const stackEl = document.createElement('div');
  stackEl.className = 'lv-stack';

  const projectField = makeStackSlider({
    labelText: 'Mini Project',
    helpText: 'Moves every file in this mini project. Saved globally.',
    value: ctx.state.projectVolumeDb,
    onChange: (next) => {
      ctx.state.projectVolumeDb = next;
      ctx.syncGlobalVolumeInputs();
      ctx.markDirty();
      refreshAll();
    },
  });

  const profileField = makeStackSlider({
    labelText: 'Profile',
    helpText: `Fine-tunes only profile "${ctx.state.activeProfile}".`,
    value: ctx.state.profileVolumeDb,
    onChange: (next) => {
      ctx.state.profileVolumeDb = next;
      ctx.syncGlobalVolumeInputs();
      ctx.markDirty();
      refreshAll();
    },
  });

  const sumRow = document.createElement('div');
  sumRow.className = 'lv-sum-row';
  const sumLabel = document.createElement('span');
  sumLabel.textContent = 'Foundation total';
  const sumValue = document.createElement('strong');
  sumValue.className = 'lv-sum-value';
  sumValue.dataset.lvFoundationTotal = '1';
  sumValue.textContent = formatDb((ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0));
  sumRow.append(sumLabel, sumValue);

  stackEl.append(projectField.el, profileField.el, sumRow);
  section.append(title, subtitle, stackEl);

  function refreshAll() {
    sumValue.textContent = formatDb((ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0));
    document.querySelectorAll('[data-lv-cat-total]').forEach(el => {
      const cat = el.dataset.lvCatTotal;
      const catDb = ctx.state.categoryVolumeDb?.[cat] ?? 0;
      el.textContent = formatDb((ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0) + catDb);
    });
    document.querySelectorAll('[data-lv-file-final]').forEach(el => {
      el.textContent = formatDb(ctx.effectiveVolumeDb(el.dataset.lvFileFinal));
    });
    document.querySelectorAll('[data-lv-file-meter]').forEach(el => {
      el.style.setProperty('--lv-meter', `${meterPct(ctx.effectiveVolumeDb(el.dataset.lvFileMeter))}%`);
    });
  }

  return section;
}

// ── Category section ─────────────────────────────────────────────────────────

function renderCategories(ctx) {
  const section = document.createElement('section');
  section.className = 'lv-section';

  const title = document.createElement('div');
  title.className = 'lv-section-title';
  title.textContent = 'Category Defaults';

  const subtitle = document.createElement('div');
  subtitle.className = 'lv-section-sub';
  subtitle.textContent = 'Volume default for each category. Stacks on top of the foundation. Files in multiple categories use their first (primary) one.';

  section.append(title, subtitle);

  const sounds = Array.isArray(ctx.state.sounds) ? ctx.state.sounds : [];

  // Gather all categories + Uncategorized bucket
  const catCounts = {};
  sounds.forEach(sound => {
    const cats = ctx.categoriesForStem(sound.stem);
    if (!cats.length) {
      catCounts['Uncategorized'] = (catCounts['Uncategorized'] || 0) + 1;
    } else {
      cats.forEach(cat => { catCounts[cat] = (catCounts[cat] || 0) + 1; });
    }
  });

  const allCats = [
    ...ctx.sortedCategories().filter(c => catCounts[c]),
    ...(catCounts['Uncategorized'] ? ['Uncategorized'] : []),
  ];

  if (!allCats.length) {
    const empty = document.createElement('div');
    empty.className = 'lv-empty';
    empty.textContent = 'No categories yet. Add category tags in the main editor to use this layer.';
    section.appendChild(empty);
    return section;
  }

  const grid = document.createElement('div');
  grid.className = 'lv-cat-grid';

  allCats.forEach(cat => {
    const foundation = (ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0);
    const catDb = ctx.state.categoryVolumeDb?.[cat] ?? 0;
    const total = foundation + catDb;
    const count = catCounts[cat] || 0;

    const card = document.createElement('div');
    card.className = 'lv-cat-card';

    const cardHead = document.createElement('div');
    cardHead.className = 'lv-cat-head';
    const catName = document.createElement('strong');
    catName.textContent = cat;
    const catCount = document.createElement('span');
    catCount.className = 'lv-cat-count';
    catCount.textContent = `${count} file${count === 1 ? '' : 's'}`;
    cardHead.append(catName, catCount);

    const totalRow = document.createElement('div');
    totalRow.className = 'lv-cat-total-row';
    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Output';
    const totalValue = document.createElement('strong');
    totalValue.className = 'lv-cat-total';
    totalValue.dataset.lvCatTotal = cat;
    totalValue.textContent = formatDb(total);
    totalRow.append(totalLabel, totalValue);

    const { el: sliderEl } = makeStackSlider({
      labelText: 'Offset from foundation',
      helpText: `Foundation (${formatDb(foundation)}) + this offset → ${formatDb(total)}`,
      value: catDb,
      onChange: (next) => {
        if (!ctx.state.categoryVolumeDb || typeof ctx.state.categoryVolumeDb !== 'object') {
          ctx.state.categoryVolumeDb = {};
        }
        if (!next) delete ctx.state.categoryVolumeDb[cat];
        else ctx.state.categoryVolumeDb[cat] = next;
        ctx.markDirty();
        // Update this card's total
        const newTotal = (ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0) + next;
        totalValue.textContent = formatDb(newTotal);
        // Update all file finals for this category
        document.querySelectorAll('[data-lv-file-final]').forEach(el => {
          el.textContent = formatDb(ctx.effectiveVolumeDb(el.dataset.lvFileFinal));
        });
        document.querySelectorAll('[data-lv-file-meter]').forEach(el => {
          el.style.setProperty('--lv-meter', `${meterPct(ctx.effectiveVolumeDb(el.dataset.lvFileMeter))}%`);
        });
      },
    });

    card.append(cardHead, totalRow, sliderEl);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

// ── Per-file mixer ────────────────────────────────────────────────────────────

function renderFileMixer(ctx) {
  const section = document.createElement('section');
  section.className = 'lv-section';

  const title = document.createElement('div');
  title.className = 'lv-section-title';
  title.textContent = 'Per-File Finals';

  const subtitle = document.createElement('div');
  subtitle.className = 'lv-section-sub';
  subtitle.textContent = 'Final output dB for each file. The main slider moves the final level directly; the number input edits the file-specific offset. Changing project, profile, or category sliders above updates all values here instantly.';

  const tools = document.createElement('div');
  tools.className = 'lv-mixer-tools';
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'layout-volume-search';
  search.placeholder = 'Search files…';
  search.value = ctx.state.layoutVolumeSearch || '';
  const sortSel = document.createElement('select');
  sortSel.className = 'layout-filter-select';
  [
    ['effective-desc', 'Loudest first'],
    ['effective-asc', 'Quietest first'],
    ['name', 'Name A–Z'],
    ['custom-first', 'Customised first'],
  ].forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = l;
    sortSel.appendChild(o);
  });
  sortSel.value = ctx.state.layoutMixerSort || 'effective-desc';
  tools.append(search, sortSel);

  section.append(title, subtitle, tools);

  const list = document.createElement('div');
  list.className = 'lv-file-list';

  const sounds = Array.isArray(ctx.state.sounds) ? [...ctx.state.sounds] : [];

  function sorted(items) {
    switch (sortSel.value) {
      case 'effective-asc': return [...items].sort((a, b) => ctx.effectiveVolumeDb(a.stem) - ctx.effectiveVolumeDb(b.stem));
      case 'name': return [...items].sort((a, b) => ctx.displayNameForStem(a.stem).localeCompare(ctx.displayNameForStem(b.stem)));
      case 'custom-first': return [...items].sort((a, b) => {
        const d = Number(!!ctx.state.fileVolumeOffsets?.[b.stem]) - Number(!!ctx.state.fileVolumeOffsets?.[a.stem]);
        return d || ctx.displayNameForStem(a.stem).localeCompare(ctx.displayNameForStem(b.stem));
      });
      default: return [...items].sort((a, b) => ctx.effectiveVolumeDb(b.stem) - ctx.effectiveVolumeDb(a.stem));
    }
  }

  function buildRow(sound) {
    const cats = ctx.categoriesForStem(sound.stem);
    const catDb = cats.length ? (ctx.state.categoryVolumeDb?.[cats[0]] ?? 0) : 0;
    const base = (ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0) + catDb;
    const fileOffset = ctx.state.fileVolumeOffsets?.[sound.stem] ?? 0;
    const effective = ctx.effectiveVolumeDb(sound.stem);

    const row = document.createElement('div');
    row.className = 'lv-file-row';
    row.dataset.lvFileMeter = sound.stem;
    row.style.setProperty('--lv-meter', `${meterPct(effective)}%`);
    row.dataset.lvSearch = [
      sound.stem,
      ctx.displayNameForStem(sound.stem),
      ...cats,
    ].join(' ').toLowerCase();

    const meta = document.createElement('div');
    meta.className = 'lv-file-meta';
    const name = document.createElement('strong');
    name.textContent = ctx.displayNameForStem(sound.stem);
    const details = document.createElement('small');
    details.textContent = [cats.join(', ') || 'Uncategorized', sound.stem].join(' • ');
    meta.append(name, details);

    const controls = document.createElement('div');
    controls.className = 'lv-file-controls';

    // Main slider: shows and sets the FINAL (effective) dB
    const effSlider = document.createElement('input');
    effSlider.type = 'range';
    effSlider.min = '-60';
    effSlider.max = '24';
    effSlider.step = '0.5';
    effSlider.value = String(effective);
    effSlider.title = 'Final output dB — drag to set the absolute output level';
    effSlider.dataset.effectiveSlider = sound.stem;

    // Number input: shows and sets the FILE OFFSET
    const offsetInput = document.createElement('input');
    offsetInput.type = 'number';
    offsetInput.min = '-60';
    offsetInput.max = '24';
    offsetInput.step = '0.5';
    offsetInput.value = String(roundDb(fileOffset, 0));
    offsetInput.title = 'File offset — ±dB relative to category baseline';

    const finalBadge = document.createElement('span');
    finalBadge.className = 'lv-final-badge';
    finalBadge.dataset.lvFileFinal = sound.stem;
    finalBadge.textContent = formatDb(effective);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'layout-btn';
    resetBtn.textContent = '0';
    resetBtn.title = 'Clear file offset (reset to category baseline)';

    const applyOffset = (newOffset) => {
      const clamped = roundDb(newOffset, 0);
      if (!clamped) delete ctx.state.fileVolumeOffsets[sound.stem];
      else {
        if (!ctx.state.fileVolumeOffsets) ctx.state.fileVolumeOffsets = {};
        ctx.state.fileVolumeOffsets[sound.stem] = clamped;
      }
      offsetInput.value = String(clamped);
      const newEff = ctx.effectiveVolumeDb(sound.stem);
      if (document.activeElement !== effSlider) effSlider.value = String(Math.max(-60, Math.min(24, newEff)));
      finalBadge.textContent = formatDb(newEff);
      row.style.setProperty('--lv-meter', `${meterPct(newEff)}%`);
      ctx.markDirty();
    };

    effSlider.addEventListener('input', () => {
      // Convert effective → file offset
      const newOffset = roundDb(parseFloat(effSlider.value) - base, 0);
      applyOffset(newOffset);
    });

    offsetInput.addEventListener('input', () => applyOffset(parseFloat(offsetInput.value)));

    resetBtn.addEventListener('click', () => applyOffset(0));

    controls.append(effSlider, offsetInput, finalBadge, resetBtn);
    row.append(meta, controls);
    return row;
  }

  function renderRows() {
    list.innerHTML = '';
    const query = (search.value || '').trim().toLowerCase();
    // Build rows paired with their sound for grouping
    const pairs = sorted(sounds)
      .map(sound => ({ sound, row: buildRow(sound) }))
      .filter(({ row }) => !query || row.dataset.lvSearch.includes(query));

    if (!pairs.length) {
      const empty = document.createElement('div');
      empty.className = 'lv-empty';
      empty.textContent = 'No files matched the search.';
      list.appendChild(empty);
      return;
    }

    // Group by primary category
    const groups = {};
    const uncategorized = [];
    pairs.forEach(({ sound, row }) => {
      const cats = ctx.categoriesForStem(sound.stem);
      const primary = cats[0] || null;
      if (!primary) uncategorized.push(row);
      else (groups[primary] = groups[primary] || []).push(row);
    });

    const orderedCats = ctx.sortedCategories().filter(c => groups[c]);
    [...orderedCats, ...(uncategorized.length ? ['__uncategorized__'] : [])].forEach(cat => {
      const rows = cat === '__uncategorized__' ? uncategorized : groups[cat];
      if (!rows) return;
      const storageKey = `hk-lv-cat-${cat}`;
      const isOpen = localStorage.getItem(storageKey) !== 'closed';

      const group = document.createElement('div');
      group.className = 'lv-file-group';

      const groupHead = document.createElement('div');
      groupHead.className = 'lv-file-group-head';
      const arrow = document.createElement('span');
      arrow.className = 'lv-group-arrow';
      arrow.textContent = isOpen ? '▾' : '▸';
      const catLabel = document.createElement('span');
      catLabel.textContent = cat === '__uncategorized__' ? 'Uncategorized' : cat;
      const catDb = cat !== '__uncategorized__' ? (ctx.state.categoryVolumeDb?.[cat] ?? 0) : 0;
      const foundation = (ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0);
      const catTotal = document.createElement('span');
      catTotal.className = 'lv-group-total';
      catTotal.textContent = `base ${formatDb(foundation + catDb)}`;
      const rowCount = document.createElement('span');
      rowCount.className = 'obs-audio-cat-count';
      rowCount.textContent = String(rows.length);
      groupHead.append(arrow, catLabel, catTotal, rowCount);

      const body = document.createElement('div');
      body.className = 'lv-file-group-body';
      body.hidden = !isOpen;
      rows.forEach(r => body.appendChild(r));

      groupHead.addEventListener('click', () => {
        const open = body.hidden;
        body.hidden = !open;
        arrow.textContent = open ? '▾' : '▸';
        localStorage.setItem(storageKey, open ? 'open' : 'closed');
      });

      group.append(groupHead, body);
      list.appendChild(group);
    });
  }

  search.addEventListener('input', () => { ctx.state.layoutVolumeSearch = search.value; renderRows(); });
  sortSel.addEventListener('input', () => { ctx.state.layoutMixerSort = sortSel.value; localStorage.setItem('hk-layout-mixer-sort', sortSel.value); renderRows(); });
  renderRows();

  section.appendChild(list);
  return section;
}

// ── Public render entry point ─────────────────────────────────────────────────

export function renderLevelsWorkspace(ctx) {
  const main = document.createElement('div');
  main.className = 'layout-main lv-workspace';

  const hero = document.createElement('div');
  hero.className = 'layout-hero';
  const heroText = document.createElement('div');
  heroText.className = 'layout-hero-copy';
  const heroTitle = document.createElement('strong');
  heroTitle.textContent = 'Audio Priority Levels';
  const heroSub = document.createElement('span');
  heroSub.textContent = 'Every displayed number is the final output dB — the sum of all layers above it. Change a higher layer and every level below updates instantly.';
  heroText.append(heroTitle, heroSub);
  hero.appendChild(heroText);

  const shell = document.createElement('div');
  shell.className = 'lv-shell';

  shell.append(
    renderFoundation(ctx),
    renderCategories(ctx),
    renderFileMixer(ctx),
  );

  const saveRow = document.createElement('div');
  saveRow.className = 'lv-save-row';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'layout-btn primary';
  saveBtn.textContent = 'Save Levels';
  saveBtn.addEventListener('click', () => ctx.triggerSave());
  saveRow.appendChild(saveBtn);

  main.append(hero, shell, saveRow);
  return main;
}
