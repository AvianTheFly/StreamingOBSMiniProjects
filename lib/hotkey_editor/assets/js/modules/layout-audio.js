function parseScopeValue(value) {
  const [scopeType, ...rest] = String(value || '').split('|');
  return {
    scopeType: scopeType || 'all',
    scopeKey: rest.join('|'),
  };
}

function sourceMatchesGroupKey(record, groupKey) {
  if (!groupKey) return false;
  if (groupKey.includes('::')) {
    const [dimension, category] = groupKey.split('::', 2);
    if (record.dimension_key !== dimension) return false;
    if (category === 'Uncategorized') return !(record.categories || []).length;
    return (record.categories || []).includes(category);
  }
  return record.dimension_key === groupKey;
}

function createAudioTag(text, tone = '') {
  const tag = document.createElement('span');
  tag.className = 'obs-audio-tag' + (tone ? ` ${tone}` : '');
  tag.textContent = text;
  return tag;
}

function createAudioStat(label, value, help, statKey = '') {
  const card = document.createElement('div');
  card.className = 'obs-audio-stat';
  const valueEl = document.createElement('strong');
  valueEl.textContent = value;
  if (statKey) valueEl.dataset.audioStat = statKey;
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const helpEl = document.createElement('small');
  helpEl.textContent = help;
  card.append(valueEl, labelEl, helpEl);
  return card;
}

function allAudioSourceRecords(ctx) {
  const keyMap = ctx.stemToKeys();
  return (Array.isArray(ctx.state.sounds) ? ctx.state.sounds : []).map(sound => ({
    ...sound,
    source: ctx.sourceNameForSound(ctx.state.layoutData, sound),
    categories: ctx.categoriesForStem(sound.stem),
    hotkeys: keyMap[sound.stem] || [],
  }));
}

function sourceScopeRecords(ctx, scopeType, scopeKey, scopeKeys = []) {
  const records = allAudioSourceRecords(ctx);
  if (scopeType === 'all') return records;
  if (scopeType === 'groups') {
    const wanted = new Set([scopeKey, ...(Array.isArray(scopeKeys) ? scopeKeys : [])].filter(Boolean));
    return records.filter(record => [...wanted].some(key => sourceMatchesGroupKey(record, key)));
  }
  if (scopeType === 'group') return records.filter(record => sourceMatchesGroupKey(record, scopeKey));
  if (scopeType === 'category') {
    if (!scopeKey || scopeKey === 'all') return records;
    if (scopeKey === 'Uncategorized') return records.filter(record => !(record.categories || []).length);
    return records.filter(record => (record.categories || []).includes(scopeKey));
  }
  if (scopeType === 'dimension') return records.filter(record => record.dimension_key === scopeKey);
  if (scopeType === 'source') return records.filter(record => record.stem === scopeKey || record.source === scopeKey);
  return records;
}

function sourceScopeOptionEntries(ctx, group) {
  const selectedSound = ctx.selectedAudioSound();
  const entries = [];
  if (selectedSound) {
    entries.push({
      value: `source|${selectedSound.stem}`,
      label: 'Selected File',
      help: ctx.displayNameForStem(selectedSound.stem),
    });
  }
  if (group) {
    entries.push({
      value: `group|${group.key}`,
      label: 'Current Group',
      help: `${group.dimension_key || group.key} / ${group.category || 'all categories'}`,
    });
  }
  if (group?.dimension_key) {
    entries.push({
      value: `dimension|${group.dimension_key}`,
      label: 'Dimension',
      help: `Every ${group.dimension_key} source`,
    });
  }
  if (group?.category) {
    entries.push({
      value: `category|${group.category}`,
      label: 'Category',
      help: group.category === 'Uncategorized' ? 'Sources without categories' : `All ${group.category} sources`,
    });
  }
  entries.push({
    value: 'all|all',
    label: 'Whole Profile',
    help: 'Every profile source with this OBS prefix',
  });
  return entries.map(entry => {
    const parsed = parseScopeValue(entry.value);
    return {
      ...entry,
      count: sourceScopeRecords(ctx, parsed.scopeType, parsed.scopeKey).length,
    };
  });
}

function sceneSourceRecordForStem(ctx, stem) {
  const source = ctx.sourceNameForSound(ctx.state.layoutData, { stem });
  return (ctx.state.layoutData?.sources || []).find(item => item.source === source || item.stem === stem) || null;
}

function syncStemVolumeLabels(ctx, stem) {
  if (!stem) return;
  const escaped = CSS.escape(stem);
  const offset = ctx.fileOffsetDb(stem);
  const effective = ctx.effectiveVolumeDb(stem);
  document.querySelectorAll(`[data-volume-offset="${escaped}"]`).forEach(node => {
    node.textContent = ctx.formatDb(offset, { sign: true });
  });
  document.querySelectorAll(`[data-volume-effective="${escaped}"]`).forEach(node => {
    node.textContent = ctx.formatDb(effective, { sign: true });
  });
  document.querySelectorAll(`[data-volume-row="${escaped}"]`).forEach(node => {
    node.style.setProperty('--volume-meter', `${ctx.volumeMeterPercent(effective)}%`);
    node.classList.toggle('custom', !!offset);
  });
  // Update effective-output sliders — only when not actively dragging that slider
  document.querySelectorAll(`[data-effective-slider="${escaped}"]`).forEach(node => {
    if (document.activeElement !== node) {
      node.value = String(Math.max(-60, Math.min(24, effective)));
    }
  });
}

function syncEffectiveVolumeLabels(ctx) {
  const stems = new Set();
  document.querySelectorAll('[data-volume-effective]').forEach(node => stems.add(node.dataset.volumeEffective));
  document.querySelectorAll('[data-volume-offset]').forEach(node => stems.add(node.dataset.volumeOffset));
  stems.forEach(stem => syncStemVolumeLabels(ctx, stem));
}

function syncAudioVolumeTelemetry(ctx, group) {
  const scopeSounds = ctx.volumeScopeSounds(group);
  const average = scopeSounds.length
    ? ctx.roundDb(scopeSounds.reduce((sum, sound) => sum + ctx.effectiveVolumeDb(sound.stem), 0) / scopeSounds.length, 0)
    : 0;
  const customCount = Object.keys(ctx.state.fileVolumeOffsets || {}).length;
  document.querySelectorAll('[data-audio-stat="project"]').forEach(node => { node.textContent = ctx.formatDb(ctx.state.projectVolumeDb, { sign: true }); });
  document.querySelectorAll('[data-audio-stat="profile"]').forEach(node => { node.textContent = ctx.formatDb(ctx.state.profileVolumeDb, { sign: true }); });
  document.querySelectorAll('[data-audio-stat="custom"]').forEach(node => { node.textContent = String(customCount); });
  document.querySelectorAll('[data-audio-stat="average"]').forEach(node => { node.textContent = ctx.formatDb(average, { sign: true }); });
  document.querySelectorAll('[data-audio-scope-count]').forEach(node => {
    node.textContent = `${scopeSounds.length} file${scopeSounds.length === 1 ? '' : 's'} in ${ctx.describeScopeLabel(ctx.state.layoutVolumeScope, group)}.`;
  });
  syncEffectiveVolumeLabels(ctx);
}

function renderSelectedSoundInspector(ctx, group) {
  const section = document.createElement('section');
  section.className = 'layout-source-controls obs-audio-panel obs-audio-inspector';

  const header = document.createElement('div');
  header.className = 'obs-audio-panel-head';
  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'layout-section-title';
  title.textContent = 'Selected File';
  const sub = document.createElement('div');
  sub.className = 'layout-status';
  sub.textContent = 'Click a mixer row to tune one file with precision.';
  titleWrap.append(title, sub);
  header.append(titleWrap);
  section.appendChild(header);

  const sound = ctx.selectedAudioSound();
  if (!sound) {
    const empty = document.createElement('div');
    empty.className = 'obs-audio-empty';
    empty.textContent = 'No file is focused yet. Pick a row in the mixer or preview a clip to inspect it here.';
    section.appendChild(empty);
    return section;
  }

  const sceneSource = sceneSourceRecordForStem(ctx, sound.stem);
  const summary = document.createElement('div');
  summary.className = 'obs-audio-focus-card';
  const name = document.createElement('strong');
  name.textContent = ctx.displayNameForStem(sound.stem);
  const stem = document.createElement('span');
  stem.textContent = `${sound.stem}${sound.ext || ''}`;
  summary.append(name, stem);

  const tags = document.createElement('div');
  tags.className = 'obs-audio-tags';
  tags.append(
    createAudioTag(sound.dimension_key || 'unknown'),
    createAudioTag(sceneSource ? 'In Scene' : 'Not In Scene', sceneSource ? 'good' : 'warn'),
  );
  const hotkeys = (ctx.stemToKeys()[sound.stem] || []).map(key => createAudioTag(`Hotkey ${key}`));
  const categories = (ctx.categoriesForStem(sound.stem) || []).map(category => createAudioTag(category));
  [...hotkeys, ...categories].slice(0, 6).forEach(tag => tags.appendChild(tag));

  const stats = document.createElement('div');
  stats.className = 'obs-audio-mini-stats';
  stats.append(
    createAudioStat('Project', ctx.formatDb(ctx.state.projectVolumeDb, { sign: true }), 'Whole project layer'),
    createAudioStat('Profile', ctx.formatDb(ctx.state.profileVolumeDb, { sign: true }), 'Current profile layer'),
    createAudioStat('File Offset', ctx.formatDb(ctx.fileOffsetDb(sound.stem), { sign: true }), 'This file only'),
    createAudioStat('Effective', ctx.formatDb(ctx.effectiveVolumeDb(sound.stem), { sign: true }), sceneSource ? sceneSource.source : ctx.sourceNameForSound(ctx.state.layoutData, sound)),
  );
  stats.querySelectorAll('strong')[2].dataset.volumeOffset = sound.stem;
  stats.querySelectorAll('strong')[3].dataset.volumeEffective = sound.stem;

  const control = document.createElement('div');
  control.className = 'obs-audio-slider-field';
  const controlHead = document.createElement('div');
  controlHead.className = 'obs-audio-slider-head';
  const controlLabel = document.createElement('strong');
  controlLabel.textContent = 'Fine tune this file';
  const controlValue = document.createElement('span');
  controlValue.dataset.volumeOffset = sound.stem;
  controlValue.textContent = ctx.formatDb(ctx.fileOffsetDb(sound.stem), { sign: true });
  controlHead.append(controlLabel, controlValue);

  const controlRow = document.createElement('div');
  controlRow.className = 'obs-audio-slider-row';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '-60';
  slider.max = '24';
  slider.step = '0.5';
  slider.value = String(ctx.fileOffsetDb(sound.stem));
  const numberInput = document.createElement('input');
  numberInput.type = 'number';
  numberInput.min = '-60';
  numberInput.max = '24';
  numberInput.step = '0.5';
  numberInput.value = String(ctx.fileOffsetDb(sound.stem));
  const applyOffset = nextRaw => {
    const next = ctx.roundDb(nextRaw, 0);
    ctx.setFileOffsetDb(sound.stem, next);
    slider.value = String(next);
    numberInput.value = String(next);
    ctx.markDirty();
    syncStemVolumeLabels(ctx, sound.stem);
    syncAudioVolumeTelemetry(ctx, group);
  };
  slider.addEventListener('input', () => applyOffset(slider.value));
  numberInput.addEventListener('input', () => applyOffset(numberInput.value));
  controlRow.append(slider, numberInput);
  control.append(controlHead, controlRow);

  const quick = document.createElement('div');
  quick.className = 'obs-audio-action-row';
  [
    ['-6 dB', () => applyOffset(ctx.fileOffsetDb(sound.stem) - 6)],
    ['-3 dB', () => applyOffset(ctx.fileOffsetDb(sound.stem) - 3)],
    ['Reset', () => applyOffset(0)],
    ['+3 dB', () => applyOffset(ctx.fileOffsetDb(sound.stem) + 3)],
    ['+6 dB', () => applyOffset(ctx.fileOffsetDb(sound.stem) + 6)],
  ].forEach(([label, handler]) => quick.appendChild(ctx.button(label, 'layout-btn', handler)));

  const targets = document.createElement('div');
  targets.className = 'obs-audio-action-row';
  [
    [-12, 'Target -12 dB'],
    [-18, 'Target -18 dB'],
  ].forEach(([targetDb, label]) => {
    targets.appendChild(ctx.button(label, 'layout-btn', () => {
      // base = project + profile + category (everything before the file offset)
      const cats = ctx.categoriesForStem(sound.stem);
      const catDb = cats.length ? (ctx.state.categoryVolumeDb?.[cats[0]] ?? 0) : 0;
      const base = ctx.roundDb((ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0) + catDb, 0);
      applyOffset(targetDb - base);
    }));
  });

  section.append(summary, tags, stats, control, quick, targets);
  return section;
}

function renderSourceControlPanel(ctx, group) {
  const section = document.createElement('section');
  section.className = 'layout-source-controls obs-audio-panel obs-audio-routing' + (ctx.state.layoutSourceControlsOpen ? '' : ' collapsed');

  const header = document.createElement('div');
  header.className = 'obs-audio-panel-head';
  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'layout-section-title';
  title.textContent = 'OBS Routing + Source Defaults';
  const sub = document.createElement('div');
  sub.className = 'layout-status';
  sub.textContent = 'Apply monitor mode, track routing, media behavior, and source volume to a meaningful scope.';
  titleWrap.append(title, sub);
  const toggle = ctx.button(ctx.state.layoutSourceControlsOpen ? 'Hide' : 'Show', 'layout-btn', () => {
    ctx.state.layoutSourceControlsOpen = !ctx.state.layoutSourceControlsOpen;
    localStorage.setItem('hk-layout-source-controls-open', ctx.state.layoutSourceControlsOpen ? '1' : '0');
    ctx.renderLayoutPanel();
  });
  header.append(titleWrap, toggle);
  section.appendChild(header);

  const scopeOptions = sourceScopeOptionEntries(ctx, group);
  if (!scopeOptions.length) {
    const empty = document.createElement('div');
    empty.className = 'obs-audio-empty';
    empty.textContent = 'Load OBS source data before applying routing controls.';
    section.appendChild(empty);
    return section;
  }

  const preferredScope = scopeOptions.find(item => item.value === ctx.state.layoutPropertyScope)
    || (group && scopeOptions.find(item => item.value === `group|${group.key}`))
    || scopeOptions[0];
  ctx.state.layoutPropertyScope = preferredScope.value;

  if (!ctx.state.layoutSourceControlsOpen) {
    const collapsed = document.createElement('div');
    collapsed.className = 'layout-status';
    collapsed.textContent = `Ready to update ${preferredScope.count} source${preferredScope.count === 1 ? '' : 's'} in ${preferredScope.label.toLowerCase()}.`;
    section.appendChild(collapsed);
    return section;
  }

  let currentScopeValue = ctx.state.layoutPropertyScope;
  let currentMonitorValue = '';

  const scopeGrid = document.createElement('div');
  scopeGrid.className = 'obs-audio-scope-grid';
  const scopeSummary = document.createElement('div');
  scopeSummary.className = 'layout-status';
  const targetPreview = document.createElement('div');
  targetPreview.className = 'obs-audio-target-preview';

  const multiWrap = document.createElement('div');
  multiWrap.className = 'layout-multi-groups obs-audio-multi';
  const multiTitle = document.createElement('div');
  multiTitle.className = 'layout-subtitle';
  multiTitle.textContent = 'Include extra groups';
  const multiHint = document.createElement('div');
  multiHint.className = 'layout-status';
  multiHint.textContent = 'Only used when the current scope is Current Group.';
  const multiGrid = document.createElement('div');
  multiGrid.className = 'layout-multi-grid';
  const selectedExtras = new Set(Array.isArray(ctx.state.layoutPropertyGroups) ? ctx.state.layoutPropertyGroups : []);
  ctx.groups.forEach(item => {
    const label = document.createElement('label');
    label.className = 'layout-check layout-multi-item';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = item.key;
    input.checked = selectedExtras.has(item.key);
    input.disabled = item.key === group?.key;
    input.addEventListener('change', () => {
      const next = new Set(Array.isArray(ctx.state.layoutPropertyGroups) ? ctx.state.layoutPropertyGroups : []);
      if (input.checked) next.add(item.key);
      else next.delete(item.key);
      ctx.state.layoutPropertyGroups = [...next];
      syncScopeSummary();
    });
    label.append(input, document.createTextNode(`${item.dimension_key || item.key} / ${item.category || 'All'}`));
    multiGrid.appendChild(label);
  });
  multiWrap.append(multiTitle, multiHint, multiGrid);

  const monitorSection = document.createElement('div');
  monitorSection.className = 'obs-audio-form-section';
  const monitorTitle = document.createElement('div');
  monitorTitle.className = 'layout-subtitle';
  monitorTitle.textContent = 'Audio Monitor Mode';
  const monitorChoices = document.createElement('div');
  monitorChoices.className = 'obs-audio-pill-row';
  [
    ['', 'Keep current'],
    ['OBS_MONITORING_TYPE_MONITOR_ONLY', 'Monitor only'],
    ['OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT', 'Monitor + output'],
    ['OBS_MONITORING_TYPE_NONE', 'No monitor'],
  ].forEach(([value, label]) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'obs-audio-pill' + (currentMonitorValue === value ? ' active' : '');
    pill.textContent = label;
    pill.addEventListener('click', () => {
      currentMonitorValue = value;
      monitorChoices.querySelectorAll('.obs-audio-pill').forEach(node => {
        node.classList.toggle('active', node === pill);
      });
    });
    monitorChoices.appendChild(pill);
  });
  monitorSection.append(monitorTitle, monitorChoices);

  const checks = document.createElement('div');
  checks.className = 'layout-check-grid obs-audio-check-grid';
  checks.append(
    ctx.propCheckbox('Restart when activated', 'restart_on_activate', false),
    ctx.propCheckbox('Hardware decode', 'hw_decode', true),
    ctx.propCheckbox('Clear after media ends', 'clear_on_media_end', true),
    ctx.propCheckbox('Close when inactive', 'close_when_inactive', true),
    ctx.propCheckbox('Loop media', 'looping', false),
  );

  const trackWrap = document.createElement('div');
  trackWrap.className = 'layout-track-wrap';
  const trackTitle = document.createElement('label');
  trackTitle.className = 'layout-check layout-track-enable';
  const trackEnable = document.createElement('input');
  trackEnable.type = 'checkbox';
  trackTitle.append(trackEnable, document.createTextNode('Set output tracks'));
  const tracks = document.createElement('div');
  tracks.className = 'layout-track-grid';
  for (let i = 1; i <= 6; i += 1) {
    const label = document.createElement('label');
    label.className = 'layout-track';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = String(i);
    input.checked = i !== 1;
    label.append(input, document.createTextNode(String(i)));
    tracks.appendChild(label);
  }
  trackWrap.append(trackTitle, tracks);

  const speedField = document.createElement('label');
  speedField.className = 'layout-field layout-speed-field';
  const speedLabel = document.createElement('span');
  speedLabel.textContent = 'Playback speed %';
  const speedInput = document.createElement('input');
  speedInput.type = 'number';
  speedInput.min = '1';
  speedInput.step = '1';
  speedInput.value = '100';
  speedField.append(speedLabel, speedInput);

  const volumeWrap = document.createElement('div');
  volumeWrap.className = 'obs-audio-volume-apply';
  const volumeTitle = document.createElement('label');
  volumeTitle.className = 'layout-check layout-track-enable';
  const volumeEnable = document.createElement('input');
  volumeEnable.type = 'checkbox';
  const volumeValue = document.createElement('span');
  volumeValue.className = 'layout-volume-value';
  volumeValue.textContent = ctx.state.layoutVolumeDb != null ? ctx.formatDb(ctx.state.layoutVolumeDb, { sign: true }) : 'No source volume';
  volumeTitle.append(volumeEnable, document.createTextNode('Set OBS source volume'));

  const volumeRow = document.createElement('div');
  volumeRow.className = 'layout-volume-row';
  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '-60';
  volumeSlider.max = '0';
  volumeSlider.step = '0.5';
  volumeSlider.value = String(ctx.state.layoutVolumeDb ?? -10);
  volumeSlider.addEventListener('input', () => {
    ctx.state.layoutVolumeDb = ctx.roundDb(volumeSlider.value, -10);
    volumeValue.textContent = ctx.formatDb(ctx.state.layoutVolumeDb, { sign: true });
  });
  const readVolumeBtn = ctx.button('Read OBS', 'layout-btn', async () => {
    const payload = getScopePayload();
    try {
      const res = await fetch(`${ctx.API}/api/layout/volume?scope_type=${encodeURIComponent(payload.scope_type)}&scope_key=${encodeURIComponent(payload.scope_key || '')}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Could not read source volume');
      if (data.db != null) {
        ctx.state.layoutVolumeDb = ctx.roundDb(data.db, 0);
        volumeSlider.value = String(ctx.state.layoutVolumeDb);
        volumeValue.textContent = ctx.formatDb(ctx.state.layoutVolumeDb, { sign: true });
        volumeEnable.checked = true;
      } else {
        ctx.state.layoutPropertyStatus = 'OBS did not return a source volume for this scope.';
        ctx.renderLayoutPanel();
      }
    } catch (err) {
      ctx.state.layoutPropertyStatus = err.message || 'Could not read source volume';
      ctx.renderLayoutPanel();
    }
  });
  volumeRow.append(volumeSlider, volumeValue, readVolumeBtn);
  volumeWrap.append(volumeTitle, volumeRow);

  function getScopePayload() {
    const { scopeType, scopeKey } = parseScopeValue(currentScopeValue);
    const extraGroups = (Array.isArray(ctx.state.layoutPropertyGroups) ? ctx.state.layoutPropertyGroups : [])
      .filter(key => key && key !== scopeKey);
    const useGroups = scopeType === 'group' && extraGroups.length > 0;
    return {
      scope_type: useGroups ? 'groups' : scopeType,
      scope_key: scopeKey,
      scope_keys: useGroups ? [scopeKey, ...extraGroups] : undefined,
    };
  }

  function currentScopeRecords() {
    const payload = getScopePayload();
    return sourceScopeRecords(ctx, payload.scope_type, payload.scope_key, payload.scope_keys || []);
  }

  function syncScopeSummary() {
    ctx.state.layoutPropertyScope = currentScopeValue;
    scopeGrid.querySelectorAll('.obs-audio-scope-card').forEach(card => {
      card.classList.toggle('active', card.dataset.scopeValue === currentScopeValue);
    });
    const active = scopeOptions.find(item => item.value === currentScopeValue) || scopeOptions[0];
    const count = currentScopeRecords().length;
    const extraEnabled = currentScopeValue.startsWith('group|');
    multiWrap.classList.toggle('disabled', !extraEnabled);
    multiGrid.querySelectorAll('input').forEach(input => {
      input.disabled = !extraEnabled || input.value === group?.key;
    });
    scopeSummary.textContent = `${count} source${count === 1 ? '' : 's'} will be updated from ${active.label.toLowerCase()}.`;
    const previewNames = currentScopeRecords().slice(0, 4).map(item => item.source);
    targetPreview.textContent = previewNames.length
      ? previewNames.join(' • ') + (count > previewNames.length ? ` • +${count - previewNames.length} more` : '')
      : 'No OBS sources matched this scope.';
  }

  scopeOptions.forEach(item => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'obs-audio-scope-card';
    card.dataset.scopeValue = item.value;
    const name = document.createElement('strong');
    name.textContent = item.label;
    const help = document.createElement('span');
    help.textContent = item.help;
    const count = document.createElement('small');
    count.textContent = `${item.count} source${item.count === 1 ? '' : 's'}`;
    card.append(name, help, count);
    card.addEventListener('click', () => {
      currentScopeValue = item.value;
      syncScopeSummary();
    });
    scopeGrid.appendChild(card);
  });
  syncScopeSummary();

  const applyBtn = ctx.button('Apply OBS Source Controls', 'layout-btn primary', () => {
    const payload = getScopePayload();
    const mediaProperties = {};
    checks.querySelectorAll('[data-media-prop]').forEach(input => {
      mediaProperties[input.dataset.mediaProp] = input.checked;
    });
    mediaProperties.speed_percent = Number(speedInput.value) || 100;
    const enabledTracks = [...tracks.querySelectorAll('input:checked')].map(input => input.value);
    ctx.applyLayoutSourceProperties({
      ...payload,
      monitor: currentMonitorValue,
      audio_tracks: trackEnable.checked ? enabledTracks : null,
      media_properties: mediaProperties,
      volume_db: volumeEnable.checked && ctx.state.layoutVolumeDb != null ? ctx.state.layoutVolumeDb : null,
    });
  });

  const status = document.createElement('div');
  status.className = 'layout-status';
  status.textContent = ctx.state.layoutPropertyStatus || 'Routing changes affect OBS sources directly. Use them when you need monitoring, track, or media defaults to change together.';

  section.append(scopeGrid, scopeSummary, targetPreview, multiWrap, monitorSection, checks, trackWrap, speedField, volumeWrap, applyBtn, status);
  return section;
}

function renderVolumeWorkspace(ctx, group) {
  const section = document.createElement('section');
  section.className = 'layout-volume-workspace obs-audio-panel';

  if (!ctx.selectedVolumeStem() && ctx.state.sounds[0]) ctx.state.activeVolumeStem = ctx.state.sounds[0].stem;

  const head = document.createElement('div');
  head.className = 'obs-audio-panel-head';
  const headCopy = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'layout-section-title';
  title.textContent = 'Mixer Workspace';
  const sub = document.createElement('div');
  sub.className = 'layout-status';
  sub.textContent = 'Set the two base layers, then batch-shift or ride individual files like a real mini mixer.';
  headCopy.append(title, sub);
  head.appendChild(headCopy);

  const shell = document.createElement('div');
  shell.className = 'obs-audio-volume-shell';

  const foundation = document.createElement('div');
  foundation.className = 'obs-audio-stack-card';
  const foundationTitle = document.createElement('div');
  foundationTitle.className = 'layout-subtitle';
  foundationTitle.textContent = 'Foundation Levels';

  function baseField({ labelText, helpText, value, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'obs-audio-slider-field';
    const head = document.createElement('div');
    head.className = 'obs-audio-slider-head';
    const label = document.createElement('strong');
    label.textContent = labelText;
    const valueEl = document.createElement('span');
    valueEl.textContent = ctx.formatDb(value, { sign: true });
    head.append(label, valueEl);

    const row = document.createElement('div');
    row.className = 'obs-audio-slider-row';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '-60';
    slider.max = '24';
    slider.step = '0.5';
    slider.value = String(ctx.roundDb(value, 0));
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '-60';
    input.max = '24';
    input.step = '0.5';
    input.value = String(ctx.roundDb(value, 0));
    const sync = nextRaw => {
      const next = ctx.roundDb(nextRaw, 0);
      slider.value = String(next);
      input.value = String(next);
      valueEl.textContent = ctx.formatDb(next, { sign: true });
      onChange(next);
      syncAudioVolumeTelemetry(ctx, group);
    };
    slider.addEventListener('input', () => sync(slider.value));
    input.addEventListener('input', () => sync(input.value));
    row.append(slider, input);

    const help = document.createElement('small');
    help.className = 'layout-volume-help';
    help.textContent = helpText;
    wrap.append(head, row, help);
    return wrap;
  }

  foundation.append(
    foundationTitle,
    baseField({
      labelText: 'Mini Project Layer',
      helpText: 'Moves every file in this mini project together.',
      value: ctx.state.projectVolumeDb,
      onChange: next => {
        ctx.state.projectVolumeDb = next;
        ctx.syncGlobalVolumeInputs();
        ctx.markDirty();
        syncEffectiveVolumeLabels(ctx);
      },
    }),
    baseField({
      labelText: 'Active Profile Layer',
      helpText: 'Fine-tunes only the currently edited profile.',
      value: ctx.state.profileVolumeDb,
      onChange: next => {
        ctx.state.profileVolumeDb = next;
        ctx.syncGlobalVolumeInputs();
        ctx.markDirty();
        syncEffectiveVolumeLabels(ctx);
      },
    }),
  );

  const batch = document.createElement('div');
  batch.className = 'obs-audio-stack-card';
  const batchTitle = document.createElement('div');
  batchTitle.className = 'layout-subtitle';
  batchTitle.textContent = 'Scope + Quick Moves';
  const scopePills = document.createElement('div');
  scopePills.className = 'obs-audio-pill-row';

  const scopeSelect = document.createElement('select');
  scopeSelect.className = 'layout-filter-select';
  const modeSelect = document.createElement('select');
  modeSelect.className = 'layout-filter-select';
  const categorySelect = document.createElement('select');
  categorySelect.className = 'layout-filter-select';
  const hotkeySelect = document.createElement('select');
  hotkeySelect.className = 'layout-filter-select';
  const valueInput = document.createElement('input');
  valueInput.type = 'number';
  valueInput.min = '-60';
  valueInput.max = '24';
  valueInput.step = '0.5';
  valueInput.className = 'layout-filter-select';

  [
    ['selected', 'Selected file', !ctx.selectedVolumeStem()],
    ['group', 'Current group', !group],
    ['category', 'Category', false],
    ['hotkey', 'Hotkey', false],
    ['custom', 'Custom offsets', false],
    ['all', 'All files', false],
  ].forEach(([value, label, disabled]) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'obs-audio-pill';
    pill.textContent = label;
    pill.disabled = !!disabled;
    pill.dataset.scope = value;
    pill.addEventListener('click', () => {
      scopeSelect.value = value;
      syncBatchUi();
    });
    scopePills.appendChild(pill);
  });

  scopeSelect.append(
    ctx.option('selected', 'Selected file'),
    ctx.option('group', 'Current group'),
    ctx.option('category', 'Category'),
    ctx.option('hotkey', 'Hotkey'),
    ctx.option('custom', 'Custom offsets'),
    ctx.option('all', 'All files'),
  );
  scopeSelect.value = ctx.state.layoutVolumeScope || 'group';
  if (!group && scopeSelect.value === 'group') scopeSelect.value = 'all';
  if (!ctx.selectedVolumeStem() && scopeSelect.value === 'selected') scopeSelect.value = group ? 'group' : 'all';

  modeSelect.append(
    ctx.option('add-offset', 'Add dB to offsets'),
    ctx.option('set-offset', 'Set offsets to dB'),
    ctx.option('set-effective', 'Set total level to dB'),
    ctx.option('clear-offset', 'Clear offsets'),
  );
  modeSelect.value = ctx.state.layoutVolumeMode || 'add-offset';

  categorySelect.append(ctx.option('all', 'All categories'), ctx.option('Uncategorized', 'Uncategorized'));
  ctx.sortedCategories().forEach(name => categorySelect.append(ctx.option(name, name)));
  categorySelect.value = ctx.state.layoutVolumeCategory || 'all';

  hotkeySelect.append(ctx.option('', 'Choose a hotkey'));
  ctx.allGroupKeys().forEach(key => hotkeySelect.append(ctx.option(key, key)));
  hotkeySelect.value = ctx.state.layoutVolumeHotkey || '';
  valueInput.value = String(ctx.roundDb(ctx.state.layoutVolumeValue, 0));

  const batchGrid = document.createElement('div');
  batchGrid.className = 'obs-audio-batch-grid';
  [
    ['Action', modeSelect],
    ['Category', categorySelect],
    ['Hotkey', hotkeySelect],
    ['dB', valueInput],
  ].forEach(([labelText, input]) => {
    const fieldWrap = document.createElement('label');
    fieldWrap.className = 'layout-field';
    const label = document.createElement('span');
    label.textContent = labelText;
    fieldWrap.append(label, input);
    batchGrid.appendChild(fieldWrap);
  });

  const scopeSummary = document.createElement('div');
  scopeSummary.className = 'layout-status';
  scopeSummary.dataset.audioScopeCount = '1';

  const runBatch = () => {
    ctx.state.layoutVolumeScope = scopeSelect.value;
    ctx.state.layoutVolumeMode = modeSelect.value;
    ctx.state.layoutVolumeCategory = categorySelect.value;
    ctx.state.layoutVolumeHotkey = hotkeySelect.value;
    ctx.state.layoutVolumeValue = ctx.roundDb(valueInput.value, 0);
    ctx.applyBulkVolumeChange(group);
  };

  const quickMoves = document.createElement('div');
  quickMoves.className = 'obs-audio-action-row';
  [
    ['-3 dB', { mode: 'add-offset', value: -3 }],
    ['+3 dB', { mode: 'add-offset', value: 3 }],
    ['Target -12', { mode: 'set-effective', value: -12 }],
    ['Clear offsets', { mode: 'clear-offset', value: 0 }],
  ].forEach(([label, preset]) => {
    quickMoves.appendChild(ctx.button(label, 'layout-btn', () => {
      modeSelect.value = preset.mode;
      valueInput.value = String(preset.value);
      syncBatchUi();
      runBatch();
    }));
  });

  const batchActions = document.createElement('div');
  batchActions.className = 'obs-audio-batch-actions';
  const applyBtn = ctx.button('Apply Batch Change', 'layout-btn primary', runBatch);
  batchActions.append(scopeSummary, applyBtn);

  function syncBatchUi() {
    ctx.state.layoutVolumeScope = scopeSelect.value;
    ctx.state.layoutVolumeMode = modeSelect.value;
    ctx.state.layoutVolumeCategory = categorySelect.value;
    ctx.state.layoutVolumeHotkey = hotkeySelect.value;
    ctx.state.layoutVolumeValue = ctx.roundDb(valueInput.value, 0);
    scopePills.querySelectorAll('.obs-audio-pill').forEach(node => {
      node.classList.toggle('active', node.dataset.scope === scopeSelect.value);
    });
    categorySelect.parentElement.hidden = scopeSelect.value !== 'category';
    hotkeySelect.parentElement.hidden = scopeSelect.value !== 'hotkey';
    valueInput.parentElement.hidden = modeSelect.value === 'clear-offset';
    syncAudioVolumeTelemetry(ctx, group);
  }
  [scopeSelect, modeSelect, categorySelect, hotkeySelect, valueInput].forEach(input => input.addEventListener('input', syncBatchUi));
  syncBatchUi();
  batch.append(batchTitle, scopePills, batchGrid, quickMoves, batchActions);

  const mixer = document.createElement('div');
  mixer.className = 'obs-audio-stack-card obs-audio-mixer';
  const mixerHead = document.createElement('div');
  mixerHead.className = 'obs-audio-mixer-head';
  const mixerTitleWrap = document.createElement('div');
  const mixerTitle = document.createElement('div');
  mixerTitle.className = 'layout-subtitle';
  mixerTitle.textContent = 'Per-File Mixer';
  const mixerSub = document.createElement('div');
  mixerSub.className = 'layout-status';
  mixerSub.textContent = 'Search, sort, focus one file, and trim offsets without leaving the panel.';
  mixerTitleWrap.append(mixerTitle, mixerSub);
  const mixerTools = document.createElement('div');
  mixerTools.className = 'obs-audio-mixer-tools';
  const search = document.createElement('input');
  search.className = 'layout-volume-search';
  search.type = 'search';
  search.placeholder = 'Search current scope';
  search.value = ctx.state.layoutVolumeSearch || '';
  const sortSelect = document.createElement('select');
  sortSelect.className = 'layout-filter-select';
  sortSelect.append(
    ctx.option('effective-desc', 'Loudest first'),
    ctx.option('effective-asc', 'Quietest first'),
    ctx.option('custom-first', 'Custom first'),
    ctx.option('name', 'Name'),
    ctx.option('hotkey', 'Most hotkeys'),
  );
  sortSelect.value = ctx.state.layoutMixerSort || 'effective-desc';
  mixerTools.append(search, sortSelect);
  mixerHead.append(mixerTitleWrap, mixerTools);

  const rows = document.createElement('div');
  rows.className = 'obs-audio-mixer-list';
  const empty = document.createElement('div');
  empty.className = 'obs-audio-empty';
  empty.textContent = 'No files matched this mixer view.';

  function sortRows(list) {
    const items = [...list];
    const keyMap = ctx.stemToKeys();
    if (sortSelect.value === 'name') {
      items.sort((left, right) => ctx.displayNameForStem(left.stem).localeCompare(ctx.displayNameForStem(right.stem)));
    } else if (sortSelect.value === 'effective-asc') {
      items.sort((left, right) => ctx.effectiveVolumeDb(left.stem) - ctx.effectiveVolumeDb(right.stem));
    } else if (sortSelect.value === 'custom-first') {
      items.sort((left, right) => {
        const customDelta = Number(!!ctx.fileOffsetDb(right.stem)) - Number(!!ctx.fileOffsetDb(left.stem));
        if (customDelta) return customDelta;
        return ctx.displayNameForStem(left.stem).localeCompare(ctx.displayNameForStem(right.stem));
      });
    } else if (sortSelect.value === 'hotkey') {
      items.sort((left, right) => (keyMap[right.stem] || []).length - (keyMap[left.stem] || []).length);
    } else {
      items.sort((left, right) => ctx.effectiveVolumeDb(right.stem) - ctx.effectiveVolumeDb(left.stem));
    }
    return items;
  }

  function buildSoundRow(sound) {
    const row = document.createElement('div');
    row.className = 'obs-audio-mixer-row' + (ctx.selectedVolumeStem() === sound.stem ? ' active' : '');
    row.dataset.volumeRow = sound.stem;
    row.style.setProperty('--volume-meter', `${ctx.volumeMeterPercent(ctx.effectiveVolumeDb(sound.stem))}%`);
    row.addEventListener('click', event => {
      if (event.target.closest('input,button')) return;
      ctx.setActiveVolumeStem(sound.stem);
    });

    const meta = document.createElement('div');
    meta.className = 'obs-audio-mixer-meta';
    const name = document.createElement('strong');
    name.textContent = ctx.displayNameForStem(sound.stem);
    const details = document.createElement('small');
    const hotkeys = (ctx.stemToKeys()[sound.stem] || []).join(' ');
    details.textContent = [sound.stem, hotkeys || 'no hotkey'].filter(Boolean).join(' • ');
    meta.append(name, details);

    const controls = document.createElement('div');
    controls.className = 'obs-audio-mixer-controls';

    // Main slider: shows EFFECTIVE output dB (project + profile + file offset)
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '-60';
    slider.max = '24';
    slider.step = '0.5';
    slider.value = String(ctx.effectiveVolumeDb(sound.stem));
    slider.dataset.effectiveSlider = sound.stem;
    slider.title = 'Effective output — drag to set final dB level';

    // Number input: shows FILE OFFSET for precise adjustment
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = '-60';
    numberInput.max = '24';
    numberInput.step = '0.5';
    numberInput.value = String(ctx.fileOffsetDb(sound.stem));
    numberInput.title = 'File offset — ±dB relative to project+profile base';

    const badges = document.createElement('div');
    badges.className = 'obs-audio-row-badges';
    const offsetBadge = createAudioTag(ctx.formatDb(ctx.fileOffsetDb(sound.stem), { sign: true }));
    offsetBadge.dataset.volumeOffset = sound.stem;
    const effectiveBadge = createAudioTag(ctx.formatDb(ctx.effectiveVolumeDb(sound.stem), { sign: true }), 'good');
    effectiveBadge.dataset.volumeEffective = sound.stem;

    const resetBtn = ctx.button('0', 'layout-btn', event => {
      event.stopPropagation();
      const cats = ctx.categoriesForStem(sound.stem);
      const catDb = cats.length ? (ctx.state.categoryVolumeDb?.[cats[0]] ?? 0) : 0;
      const base = (ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0) + catDb;
      ctx.setFileOffsetDb(sound.stem, 0);
      slider.value = String(base);
      numberInput.value = '0';
      ctx.markDirty();
      ctx.state.layoutVolumeStatus = `Reset ${ctx.displayNameForStem(sound.stem)} to category baseline.`;
      syncStemVolumeLabels(ctx, sound.stem);
      syncAudioVolumeTelemetry(ctx, group);
    });

    // Slider changed: compute new offset from effective value
    slider.addEventListener('input', () => {
      const effDb = parseFloat(slider.value);
      const cats = ctx.categoriesForStem(sound.stem);
      const catDb = cats.length ? (ctx.state.categoryVolumeDb?.[cats[0]] ?? 0) : 0;
      const base = (ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0) + catDb;
      const newOffset = ctx.roundDb(effDb - base, 0);
      ctx.setFileOffsetDb(sound.stem, newOffset);
      numberInput.value = String(newOffset);
      ctx.markDirty();
      syncStemVolumeLabels(ctx, sound.stem);
      syncAudioVolumeTelemetry(ctx, group);
    });

    // Number input changed: offset given directly, update effective slider
    numberInput.addEventListener('input', () => {
      const newOffset = ctx.roundDb(numberInput.value, 0);
      ctx.setFileOffsetDb(sound.stem, newOffset);
      const cats = ctx.categoriesForStem(sound.stem);
      const catDb = cats.length ? (ctx.state.categoryVolumeDb?.[cats[0]] ?? 0) : 0;
      const base = (ctx.state.projectVolumeDb || 0) + (ctx.state.profileVolumeDb || 0) + catDb;
      slider.value = String(Math.max(-60, Math.min(24, base + newOffset)));
      ctx.markDirty();
      syncStemVolumeLabels(ctx, sound.stem);
      syncAudioVolumeTelemetry(ctx, group);
    });

    badges.append(offsetBadge, effectiveBadge);
    controls.append(slider, numberInput, badges, resetBtn);
    row.append(meta, controls);
    syncStemVolumeLabels(ctx, sound.stem);
    return row;
  }

  function renderMixerRows() {
    rows.innerHTML = '';
    const query = (search.value || '').trim().toLowerCase();
    const filtered = sortRows(ctx.volumeScopeSounds(group))
      .filter(sound => {
        if (!query) return true;
        const label = ctx.displayNameForStem(sound.stem).toLowerCase();
        const cats = ctx.categoriesForStem(sound.stem).join(' ').toLowerCase();
        const hkeys = (ctx.stemToKeys()[sound.stem] || []).join(' ').toLowerCase();
        return sound.stem.toLowerCase().includes(query) || label.includes(query) || cats.includes(query) || hkeys.includes(query);
      });

    if (!filtered.length) {
      rows.appendChild(empty);
      return;
    }

    // Group by category
    const categoryMap = {};
    const uncategorized = [];
    filtered.forEach(sound => {
      const cats = ctx.categoriesForStem(sound.stem);
      if (!cats.length) {
        uncategorized.push(sound);
      } else {
        cats.forEach(cat => {
          (categoryMap[cat] = categoryMap[cat] || []).push(sound);
        });
      }
    });

    const orderedCats = (ctx.sortedCategories ? ctx.sortedCategories() : Object.keys(categoryMap).sort())
      .filter(cat => categoryMap[cat]);

    const renderCategoryGroup = (catName, sounds) => {
      const storageKey = `hk-mixer-cat-${catName}`;
      const isOpen = localStorage.getItem(storageKey) !== 'closed';

      const catGroup = document.createElement('div');
      catGroup.className = 'obs-audio-category-group';

      const catHead = document.createElement('div');
      catHead.className = 'obs-audio-category-head';
      const catArrow = document.createElement('span');
      catArrow.className = 'obs-audio-cat-arrow';
      catArrow.textContent = isOpen ? '▾' : '▸';
      const catLabel = document.createElement('span');
      catLabel.className = 'obs-audio-cat-label';
      catLabel.textContent = catName;
      const catCount = document.createElement('span');
      catCount.className = 'obs-audio-cat-count';
      catCount.textContent = String(sounds.length);
      catHead.append(catArrow, catLabel, catCount);

      const catBody = document.createElement('div');
      catBody.className = 'obs-audio-category-body';
      catBody.hidden = !isOpen;
      sounds.forEach(sound => catBody.appendChild(buildSoundRow(sound)));

      catHead.addEventListener('click', () => {
        const open = catBody.hidden;
        catBody.hidden = !open;
        catArrow.textContent = open ? '▾' : '▸';
        localStorage.setItem(storageKey, open ? 'open' : 'closed');
      });

      catGroup.append(catHead, catBody);
      rows.appendChild(catGroup);
    };

    orderedCats.forEach(cat => renderCategoryGroup(cat, categoryMap[cat]));
    if (uncategorized.length) renderCategoryGroup('Uncategorized', uncategorized);
  }

  search.addEventListener('input', () => {
    ctx.state.layoutVolumeSearch = search.value;
    renderMixerRows();
  });
  sortSelect.addEventListener('input', () => {
    ctx.state.layoutMixerSort = sortSelect.value;
    localStorage.setItem('hk-layout-mixer-sort', ctx.state.layoutMixerSort);
    renderMixerRows();
  });
  renderMixerRows();

  const status = document.createElement('div');
  status.className = 'layout-status';
  status.textContent = ctx.state.layoutVolumeStatus || 'Mixer changes are saved with the profile and combine with your base layers.';

  mixer.append(mixerHead, rows, status);
  shell.append(foundation, batch, mixer);
  section.append(head, shell);
  return section;
}

function renderVisibilityPanel(ctx) {
  const section = document.createElement('section');
  section.className = 'layout-source-controls obs-audio-panel obs-audio-visibility';

  const sceneName = ctx.state.layoutData?.scene || 'Scene';
  const sources = Array.isArray(ctx.state.layoutData?.sources) ? [...ctx.state.layoutData.sources] : [];
  const header = document.createElement('div');
  header.className = 'obs-audio-panel-head';
  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'layout-section-title';
  title.textContent = `Scene Visibility - ${sceneName}`;
  const sub = document.createElement('div');
  sub.className = 'layout-status';
  sub.textContent = 'Search the active scene and toggle sources without leaving the hotkey editor.';
  titleWrap.append(title, sub);
  const tools = document.createElement('div');
  tools.className = 'obs-audio-mixer-tools';
  const search = document.createElement('input');
  search.className = 'layout-volume-search';
  search.type = 'search';
  search.placeholder = 'Search scene sources';
  search.value = ctx.state.layoutSceneSearch || '';
  tools.appendChild(search);
  header.append(titleWrap, tools);

  const filters = document.createElement('div');
  filters.className = 'obs-audio-pill-row';
  [
    ['all', 'All'],
    ['profile', 'Profile sources'],
    ['scene-only', 'Scene-only extras'],
  ].forEach(([value, label]) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'obs-audio-pill' + ((ctx.state.layoutSceneFilter || 'all') === value ? ' active' : '');
    pill.textContent = label;
    pill.dataset.sceneFilter = value;
    pill.addEventListener('click', () => {
      ctx.state.layoutSceneFilter = value;
      filters.querySelectorAll('.obs-audio-pill').forEach(node => node.classList.toggle('active', node === pill));
      filterRows();
    });
    filters.appendChild(pill);
  });

  const list = document.createElement('div');
  list.className = 'obs-audio-visibility-list';
  const empty = document.createElement('div');
  empty.className = 'obs-audio-empty';
  empty.textContent = sources.length ? 'No scene sources matched the current filters.' : 'No scene sources were returned by OBS.';

  sources
    .sort((left, right) => {
      const profileDelta = Number(!!right.profile_source) - Number(!!left.profile_source);
      if (profileDelta) return profileDelta;
      return String(left.source || '').localeCompare(String(right.source || ''));
    })
    .forEach(item => {
      const row = document.createElement('label');
      row.className = 'obs-audio-visibility-row' + (item.profile_source ? ' profile-source' : '');
      row.dataset.sceneSearch = [
        item.source,
        item.stem,
        item.dimension_key,
        ...(item.categories || []),
      ].join(' ').toLowerCase();
      row.dataset.sceneKind = item.profile_source ? 'profile' : 'scene-only';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!item.visible;
      checkbox.addEventListener('change', () => ctx.setSourceVisibility(item.source, checkbox.checked));
      const meta = document.createElement('div');
      meta.className = 'obs-audio-visibility-meta';
      const name = document.createElement('strong');
      name.textContent = item.source;
      const details = document.createElement('small');
      details.textContent = [
        item.profile_source ? 'profile source' : 'scene source',
        item.dimension_key,
        ...(item.categories || []),
      ].filter(Boolean).join(' • ');
      meta.append(name, details);
      row.append(checkbox, meta);
      list.appendChild(row);
    });

  const status = document.createElement('div');
  status.className = 'layout-status';

  function filterRows() {
    const query = (search.value || '').trim().toLowerCase();
    ctx.state.layoutSceneSearch = search.value;
    let visible = 0;
    list.querySelectorAll('.obs-audio-visibility-row').forEach(row => {
      const matchesQuery = !query || row.dataset.sceneSearch.includes(query);
      const filter = ctx.state.layoutSceneFilter || 'all';
      const matchesKind = filter === 'all' || row.dataset.sceneKind === filter;
      row.hidden = !(matchesQuery && matchesKind);
      if (!row.hidden) visible += 1;
    });
    empty.hidden = visible > 0;
    status.textContent = ctx.state.layoutVisibilityStatus || `${visible} source${visible === 1 ? '' : 's'} shown in ${sceneName}.`;
  }

  search.addEventListener('input', filterRows);
  list.appendChild(empty);
  filterRows();

  section.append(header, filters, list, status);
  return section;
}

export function renderAudioWorkspaceUI(ctx) {
  const main = document.createElement('div');
  main.className = 'layout-main obs-audio-workspace';

  const hero = document.createElement('div');
  hero.className = 'layout-hero obs-audio-hero';
  const heroText = document.createElement('div');
  heroText.className = 'layout-hero-copy';
  const heroTitle = document.createElement('strong');
  heroTitle.textContent = 'OBS Audio Control Room';
  const heroSub = document.createElement('span');
  heroSub.textContent = ctx.group
    ? `Built around ${ctx.group.dimension_key || ctx.group.key} / ${ctx.group.category || 'all categories'}. Mix file loudness, apply source rules, and manage scene visibility from one place.`
    : 'Mix file loudness, apply source rules, and manage scene visibility from one place.';
  heroText.append(heroTitle, heroSub);
  const heroActions = document.createElement('div');
  heroActions.className = 'obs-audio-action-row';
  const refreshBtn = ctx.button('Refresh OBS', 'layout-btn', () => ctx.loadLayoutData({ force: true, preserveRules: true }));
  heroActions.appendChild(refreshBtn);
  hero.append(heroText, heroActions);

  const dashboard = document.createElement('div');
  dashboard.className = 'obs-audio-dashboard';
  const scopeSounds = ctx.volumeScopeSounds(ctx.group);
  const average = scopeSounds.length
    ? ctx.roundDb(scopeSounds.reduce((sum, sound) => sum + ctx.effectiveVolumeDb(sound.stem), 0) / scopeSounds.length, 0)
    : 0;
  dashboard.append(
    createAudioStat('Project Layer', ctx.formatDb(ctx.state.projectVolumeDb, { sign: true }), 'Whole mini project baseline', 'project'),
    createAudioStat('Profile Layer', ctx.formatDb(ctx.state.profileVolumeDb, { sign: true }), 'Current live profile baseline', 'profile'),
    createAudioStat('Custom Offsets', String(Object.keys(ctx.state.fileVolumeOffsets || {}).length), 'Files with individual tuning', 'custom'),
    createAudioStat('Scope Average', ctx.formatDb(average, { sign: true }), `${scopeSounds.length} file${scopeSounds.length === 1 ? '' : 's'} in focus`, 'average'),
  );

  const shell = document.createElement('div');
  shell.className = 'obs-audio-shell';
  const mainCol = document.createElement('div');
  mainCol.className = 'obs-audio-column';
  const sideCol = document.createElement('div');
  sideCol.className = 'obs-audio-column obs-audio-column-side';

  mainCol.append(
    renderVolumeWorkspace(ctx, ctx.group),
    renderVisibilityPanel(ctx),
  );
  sideCol.append(
    renderSelectedSoundInspector(ctx, ctx.group),
    renderSourceControlPanel(ctx, ctx.group),
  );
  shell.append(mainCol, sideCol);

  main.append(hero, dashboard, shell);
  queueMicrotask(() => syncAudioVolumeTelemetry(ctx, ctx.group));
  return main;
}
