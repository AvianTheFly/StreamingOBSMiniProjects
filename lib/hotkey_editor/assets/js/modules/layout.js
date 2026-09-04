import { state } from './state.js';
import { API } from './constants.js';
import { markDirty, setSaveStatus } from './ui.js';
import { stemToKeys, allGroupKeys } from './hotkey.js';
import { displayNameForStem } from './card-utils.js';
import {
  canvasSize,
  defaultLayoutRuleForGroup,
  layoutGroups,
  normalizeLayoutRule,
  number,
  round,
  ruleFromObsTransform,
  sourceNameForSound,
  layoutRulesEqual,
} from './obs-canvas/model.js';
import {
  clearObsCanvasPreview,
  renderObsCanvasOverlay,
  showObsCanvasPreview,
  syncObsCanvasOverlay,
} from './obs-canvas/overlay.js';
import { categoriesForStem, sortedCategories } from './categories.js';
import { renderAudioWorkspaceUI } from './layout-audio.js';
import { renderLevelsWorkspace } from './layout-levels.js';

function rerenderEditor() {
  import('./render.js').then(({ render }) => render());
}

function roundDb(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed * 2) / 2;
  return Math.min(24, Math.max(-60, rounded));
}

function fileOffsetDb(stem) {
  return roundDb(state.fileVolumeOffsets?.[stem] ?? 0, 0);
}

function categoryOffsetDb(stem) {
  const cats = categoriesForStem(stem);
  if (!cats.length) return 0;
  return roundDb(state.categoryVolumeDb?.[cats[0]] ?? 0, 0);
}

function effectiveVolumeDb(stem) {
  return roundDb(
    (state.projectVolumeDb || 0) + (state.profileVolumeDb || 0) + categoryOffsetDb(stem) + fileOffsetDb(stem), 0
  );
}

function setFileOffsetDb(stem, nextValue) {
  if (!state.fileVolumeOffsets || typeof state.fileVolumeOffsets !== 'object') state.fileVolumeOffsets = {};
  const value = roundDb(nextValue, 0);
  if (!value) delete state.fileVolumeOffsets[stem];
  else state.fileVolumeOffsets[stem] = value;
}

function syncGlobalVolumeInputs() {
  const projectInput = document.getElementById('profile-project-volume-db');
  if (projectInput) projectInput.value = String(roundDb(state.projectVolumeDb, 0));
  const profileInput = document.getElementById('profile-volume-db');
  if (profileInput) profileInput.value = String(roundDb(state.profileVolumeDb, 0));
}

function selectedVolumeStem() {
  const candidates = [state.activeVolumeStem, state.previewStem];
  return candidates.find(stem => stem && state.sounds.some(item => item.stem === stem)) || null;
}

function selectedAudioSound() {
  const stem = selectedVolumeStem();
  return stem ? state.sounds.find(item => item.stem === stem) || null : null;
}

function formatDb(value, { sign = false } = {}) {
  const rounded = roundDb(value, 0);
  return `${sign && rounded > 0 ? '+' : ''}${rounded} dB`;
}

function volumeMeterPercent(value) {
  const db = roundDb(value, -60);
  return Math.max(5, Math.min(100, ((db + 60) / 84) * 100));
}

function describeScopeLabel(scope, group) {
  if (scope === 'all') return 'all files';
  if (scope === 'custom') return 'files with custom offsets';
  if (scope === 'selected') return selectedVolumeStem() ? displayNameForStem(selectedVolumeStem()) : 'selected file';
  if (scope === 'category') return state.layoutVolumeCategory === 'Uncategorized' ? 'uncategorized files' : `category ${state.layoutVolumeCategory || 'all'}`;
  if (scope === 'hotkey') return state.layoutVolumeHotkey ? `hotkey ${state.layoutVolumeHotkey}` : 'hotkey group';
  return group ? `${group.dimension_key || group.key} / ${group.category || 'all'}` : 'current layout group';
}

function volumeScopeSounds(group) {
  const scope = state.layoutVolumeScope || 'group';
  const selectedStem = selectedVolumeStem();
  const keyMap = stemToKeys();
  const sounds = Array.isArray(state.sounds) ? [...state.sounds] : [];
  return sounds.filter(sound => {
    if (scope === 'all') return true;
    if (scope === 'custom') return !!state.fileVolumeOffsets?.[sound.stem];
    if (scope === 'selected') return sound.stem === selectedStem;
    if (scope === 'category') {
      const category = state.layoutVolumeCategory || 'all';
      const categories = categoriesForStem(sound.stem);
      if (category === 'all') return true;
      if (category === 'Uncategorized') return categories.length === 0;
      return categories.includes(category);
    }
    if (scope === 'hotkey') {
      const hotkey = state.layoutVolumeHotkey;
      if (!hotkey) return false;
      return (keyMap[sound.stem] || []).includes(hotkey);
    }
    if (!group) return true;
    return soundMatchesGroup(sound, group);
  });
}

function applyBulkVolumeChange(group) {
  const scopeSounds = volumeScopeSounds(group);
  if (!scopeSounds.length) {
    state.layoutVolumeStatus = 'No files matched that volume scope.';
    renderLayoutPanel();
    return;
  }

  const mode = state.layoutVolumeMode || 'add-offset';
  const amount = roundDb(state.layoutVolumeValue, 0);
  let changed = 0;

  scopeSounds.forEach(sound => {
    const current = fileOffsetDb(sound.stem);
    // base = everything that comes before the file offset (project + profile + category)
    const base = roundDb((state.projectVolumeDb || 0) + (state.profileVolumeDb || 0) + categoryOffsetDb(sound.stem), 0);
    let next = current;
    if (mode === 'clear-offset') next = 0;
    else if (mode === 'set-offset') next = amount;
    else if (mode === 'set-effective') next = amount - base;
    else next = current + amount;
    next = roundDb(next, 0);
    if (next !== current) {
      setFileOffsetDb(sound.stem, next);
      changed += 1;
    }
  });

  if (!changed) {
    state.layoutVolumeStatus = `No volume changes were needed for ${describeScopeLabel(state.layoutVolumeScope, group)}.`;
    renderLayoutPanel();
    return;
  }

  markDirty();
  state.layoutVolumeStatus = `Updated ${changed} file${changed === 1 ? '' : 's'} in ${describeScopeLabel(state.layoutVolumeScope, group)}.`;
  rerenderEditor();
}

function groups() {
  return layoutGroups(state.layoutData);
}

function groupForKey(key = state.layoutSelectedGroup) {
  return groups().find(item => item.key === key) || null;
}

function selectedSound() {
  return state.sounds.find(item => item.stem === state.previewStem) || null;
}

function activePreviewSound() {
  const sound = selectedSound();
  const group = selectedLayoutGroup();
  if (!sound || !soundMatchesGroup(sound, group)) return null;
  return sound;
}

function canEditFileOverride() {
  const sound = selectedSound();
  return !!sound && soundMatchesGroup(sound, selectedLayoutGroup());
}

function soundMatchesGroup(sound, group) {
  if (!sound || !group) return false;
  const dimension = group.dimension_key || group.key;
  if (sound.dimension_key !== dimension) return false;
  const category = group.category || 'all';
  if (!category || category === 'all') return true;
  const categories = categoriesForStem(sound.stem);
  return category === 'Uncategorized' ? categories.length === 0 : categories.includes(category);
}

function activeRuleTarget() {
  if (state.layoutEditingStem && canEditFileOverride()) {
    return { type: 'file', key: state.layoutEditingStem };
  }
  return { type: 'group', key: state.layoutSelectedGroup };
}

export function selectedLayoutGroup() {
  const allGroups = groups();
  if (!allGroups.length) return null;
  const selected = groupForKey() || allGroups[0];
  state.layoutSelectedGroup = selected.key;
  return selected;
}

export function defaultRuleForGroup(group, options = {}) {
  return defaultLayoutRuleForGroup(group, state.layoutData, options);
}

export function ensureLayoutRule(key = state.layoutSelectedGroup) {
  const group = groupForKey(key);
  if (!group) return null;
  if (!state.layoutRules || typeof state.layoutRules !== 'object') state.layoutRules = {};
  if (!state.layoutRules[key]) state.layoutRules[key] = defaultRuleForGroup(group);
  state.layoutRules[key] = normalizeLayoutRule(state.layoutRules[key], group);
  return state.layoutRules[key];
}

function ensureActiveRule() {
  const target = activeRuleTarget();
  if (target.type === 'file') {
    const sound = selectedSound();
    const group = selectedLayoutGroup();
    if (!sound || !group) return null;
    if (!state.layoutOverrides || typeof state.layoutOverrides !== 'object') state.layoutOverrides = {};
    if (!state.layoutOverrides[target.key]) state.layoutOverrides[target.key] = { ...ensureLayoutRule(group.key) };
    state.layoutOverrides[target.key] = normalizeLayoutRule(state.layoutOverrides[target.key], group);
    return state.layoutOverrides[target.key];
  }
  return ensureLayoutRule(target.key);
}

function setSelectedRule(patch) {
  const target = activeRuleTarget();
  const group = selectedLayoutGroup();
  const rule = ensureActiveRule();
  if (!rule || !group) return;
  const next = normalizeLayoutRule({ ...rule, ...patch }, group);
  if (layoutRulesEqual(rule, next)) return;
  if (target.type === 'file') state.layoutOverrides[target.key] = next;
  else state.layoutRules[target.key] = next;
  state.layoutDirty = true;
  state.layoutStatus = 'UI rule edited. Save to keep it, or push it to OBS now.';
}

function selectedRuleIsOverride() {
  const target = activeRuleTarget();
  return target.type === 'file' && !!state.layoutOverrides?.[target.key];
}

function setLayoutZoom(next) {
  state.layoutZoom = Math.max(0.6, Math.min(3, number(next, 1)));
  syncZoomDom();
}

function syncLayoutOverrideCards() {
  document.querySelectorAll('.sound-card').forEach(card => {
    card.classList.toggle('layout-override', !!state.layoutOverrides?.[card.dataset.stem]);
  });
}

function syncZoomDom() {
  const stage = document.querySelector('.obs-canvas-stage');
  const label = document.getElementById('layout-zoom-label');
  if (stage) {
    stage.style.width = `${Math.round(state.layoutZoom * 100)}%`;
    stage.style.maxWidth = state.layoutZoom > 1 ? 'none' : '100%';
  }
  if (label) label.textContent = `${Math.round(state.layoutZoom * 100)}%`;
}

function syncRuleDom(panel = document.getElementById('layout-panel')) {
  if (!panel) return;
  const group = selectedLayoutGroup();
  const rule = ensureActiveRule();
  if (!group || !rule) return;
  syncObsCanvasOverlay({ panel, canvas: canvasSize(state.layoutData), group, rule });
  panel.querySelectorAll('[data-layout-field]').forEach(input => {
    const field = input.dataset.layoutField;
    if (!field || document.activeElement === input) return;
    input.value = String(round(rule[field]));
  });
}

export function selectLayoutGroup(key) {
  state.layoutSelectedGroup = key;
  const group = groupForKey(key);
  state.layoutFilterDimension = group?.dimension_key || key;
  state.layoutFilterCategory = group?.category || 'all';
  const previewSound = state.sounds.find(item => item.stem === state.previewStem);
  if (previewSound && !soundMatchesGroup(previewSound, group)) {
    state.previewEl?.pause?.();
    state.previewEl = null;
    state.previewStem = null;
    state.previewUrlObject = null;
    state.layoutEditingStem = null;
  }
  ensureLayoutRule(key);
  renderLayoutPanel();
  import('./render.js').then(({ applyVisibility }) => {
    import('./hotkey.js').then(({ stemToKeys }) => applyVisibility(stemToKeys()));
  });
}

function toggleFileOverride(enabled) {
  const sound = selectedSound();
  if (!sound || !soundMatchesGroup(sound, selectedLayoutGroup())) return;
  if (enabled) {
    state.layoutEditingStem = sound.stem;
    if (!state.layoutOverrides || typeof state.layoutOverrides !== 'object') state.layoutOverrides = {};
    if (!state.layoutOverrides[sound.stem]) {
      state.layoutOverrides[sound.stem] = { ...ensureLayoutRule(sound.dimension_key) };
      state.layoutDirty = true;
      state.layoutStatus = `Created a file-only rule for ${sound.stem}. Save to keep it.`;
    }
  } else {
    state.layoutEditingStem = null;
  }
  syncLayoutOverrideCards();
  renderLayoutPanel();
}

function obsRuleForTarget() {
  const target = activeRuleTarget();
  const group = selectedLayoutGroup();
  const transforms = state.layoutData?.transforms || {};
  if (!group) return null;
  if (target.type === 'file') {
    const sound = selectedSound();
    if (!sound) return null;
    const transform = transforms[sourceNameForSound(state.layoutData, sound)];
    return transform ? ruleFromObsTransform(transform, group) : null;
  }
  for (const sound of group.sounds || []) {
    const transform = transforms[sourceNameForSound(state.layoutData, sound)];
    if (transform) return ruleFromObsTransform(transform, group);
  }
  return null;
}

async function refreshObsAndReadSelected() {
  state.layoutStatus = 'Reading current OBS transform...';
  renderLayoutPanel();
  await loadLayoutData({ force: true, preserveRules: true });
  const target = activeRuleTarget();
  const rule = obsRuleForTarget();
  if (!rule) {
    state.layoutStatus = 'OBS did not return a transform for this selection.';
    renderLayoutPanel();
    return;
  }
  if (target.type === 'file') {
    state.layoutOverrides[target.key] = rule;
    state.layoutStatus = `Loaded current OBS transform into ${target.key}. Save to keep it.`;
  } else {
    state.layoutRules[target.key] = rule;
    state.layoutStatus = `Loaded current OBS transform into ${target.key}. Save to keep it.`;
  }
  state.layoutDirty = true;
  syncLayoutOverrideCards();
  renderLayoutPanel();
}

async function useCurrentObsForSelection() {
  await refreshObsAndReadSelected();
  const current = obsRuleForTarget();
  if (!current) return;
  await persistLayoutRules({ scope: selectedRuleIsOverride() ? 'selected-file' : 'selected-group', apply: false, origin: 'obs' });
}

function deleteFileOverride() {
  const stem = state.layoutEditingStem || state.previewStem;
  if (!stem || !state.layoutOverrides?.[stem]) return;
  delete state.layoutOverrides[stem];
  if (state.layoutEditingStem === stem) state.layoutEditingStem = null;
  state.layoutDirty = true;
  state.layoutStatus = `Cleared the file override for ${stem}. Save to keep the group rule.`;
  syncLayoutOverrideCards();
  renderLayoutPanel();
}

export function resetSelectedLayoutRule({ fromObs = false } = {}) {
  const group = selectedLayoutGroup();
  if (!group) return;
  state.layoutRules[group.key] = defaultRuleForGroup(group, { fromObs });
  for (const sound of group.sounds || []) delete state.layoutOverrides?.[sound.stem];
  if (selectedSound()?.dimension_key === group.key) state.layoutEditingStem = null;
  state.layoutDirty = true;
  state.layoutStatus = fromObs ? 'This video size was reset from current OBS.' : 'This video size was reset to its default OBS source size.';
  syncLayoutOverrideCards();
  renderLayoutPanel();
}

function resetAllLayoutRules() {
  state.layoutRules = {};
  for (const group of groups()) state.layoutRules[group.key] = defaultRuleForGroup(group);
  state.layoutOverrides = {};
  state.layoutEditingStem = null;
  state.layoutDirty = true;
  state.layoutStatus = 'All video sizes were reset to their default OBS source sizes.';
  syncLayoutOverrideCards();
  renderLayoutPanel();
}

export async function loadLayoutData({ force = false, preserveRules = false } = {}) {
  if (state.layoutLoading) return;
  if (state.layoutData && !force) return;
  state.layoutLoading = true;
  state.layoutStatus = 'Loading OBS canvas...';
  renderLayoutPanel();
  try {
    const res = await fetch(`${API}/api/layout/data`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not load OBS layout data');
    state.layoutData = data.layout || {};
    if (!preserveRules) {
      state.layoutRules = { ...(state.layoutData.rules || {}) };
      state.layoutOverrides = { ...(state.layoutData.overrides || {}) };
      state.layoutDirty = false;
    }
    syncLayoutOverrideCards();
    if (!groups().some(group => group.key === state.layoutSelectedGroup)) {
      state.layoutSelectedGroup = groups()[0]?.key || null;
    }
    ensureLayoutRule();
    state.layoutStatus = state.layoutData.obs_error
      ? `OBS is not reachable: ${state.layoutData.obs_error}`
      : '';
  } catch (err) {
    state.layoutStatus = err.message || 'Could not load OBS layout data';
  } finally {
    state.layoutLoading = false;
    renderLayoutPanel();
  }
}

function scopedLayoutPayload(scope = 'all') {
  const target = activeRuleTarget();
  const group = selectedLayoutGroup();
  const rules = state.layoutRules || {};
  const overrides = state.layoutOverrides || {};
  if (scope === 'selected-file' && target.type === 'file') {
    return { rules: {}, overrides: { [target.key]: overrides[target.key] || ensureActiveRule() } };
  }
  if (scope === 'selected-group' && group) {
    return {
      rules: { [group.key]: rules[group.key] || ensureLayoutRule(group.key) },
      overrides: {},
    };
  }
  if (scope === 'filtered-groups') {
    const visible = {};
    groups().filter(item => {
      if (state.layoutFilterDimension && item.dimension_key !== state.layoutFilterDimension) return false;
      if (state.layoutFilterCategory && state.layoutFilterCategory !== 'all' && item.category !== state.layoutFilterCategory) return false;
      return true;
    }).forEach(item => {
      visible[item.key] = rules[item.key] || ensureLayoutRule(item.key);
    });
    return { rules: visible, overrides: {} };
  }
  return { rules, overrides };
}

function layoutSyncSummary() {
  const group = selectedLayoutGroup();
  const editorRule = ensureActiveRule();
  const obsRule = obsRuleForTarget();
  const singleSource = !!state.layoutData?.singleSourceName;
  if (!group || !editorRule) return '';
  if (!obsRule) {
    return singleSource
      ? 'OBS shared player is not exposing a readable transform right now. Your saved UI rule will still apply at playback time.'
      : 'OBS did not return a readable transform for this selection yet.';
  }
  const matches = layoutRulesEqual(editorRule, obsRule);
  if (state.layoutDirty && matches) return 'UI edits match OBS, but they are not saved to the layout file yet.';
  if (state.layoutDirty && !matches) return 'UI edits are ahead of OBS. Save the UI rule to persist it, or push it to OBS for an immediate update.';
  if (!state.layoutDirty && matches) {
    return singleSource
      ? 'Saved UI rule matches the shared OBS player. This rule will be used when the file plays.'
      : 'Saved UI rule matches the current OBS transform.';
  }
  return 'OBS currently differs from the saved UI rule. Use Current OBS to keep the manual OBS change, or push the UI rule to restore the editor version.';
}

async function persistLayoutRules({ scope = 'all', apply = false, origin = 'ui' } = {}) {
  state.layoutStatus = apply ? 'Saving UI rule and pushing to OBS...' : 'Saving layout rules...';
  renderLayoutPanel();
  const payload = scopedLayoutPayload(scope);
  try {
    const res = await fetch(`${API}/api/layout/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: state.layoutRules || {},
        overrides: state.layoutOverrides || {},
        apply_rules: payload.rules || {},
        apply_overrides: payload.overrides || {},
        apply_scope: scope,
        apply,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not save layout rules');
    state.layoutData = data.layout || state.layoutData;
    state.layoutRules = { ...(state.layoutData.rules || state.layoutRules || {}) };
    state.layoutOverrides = { ...(state.layoutData.overrides || state.layoutOverrides || {}) };
    state.layoutDirty = false;
    syncLayoutOverrideCards();
    state.layoutApplyResult = data.apply_result || null;
    const applied = state.layoutApplyResult?.applied?.length || 0;
    const failed = state.layoutApplyResult?.failed?.length || 0;
    if (failed) {
      state.layoutStatus = apply
        ? `Saved ${scope}. OBS push updated ${applied} source(s); ${failed} failed.`
        : `Saved ${scope}, but OBS reported ${failed} issue(s).`;
    } else if (apply) {
      state.layoutStatus = state.layoutData?.singleSourceName
        ? 'Saved UI rules. This project uses one shared OBS source, so the rule will apply at playback time.'
        : `Saved ${scope} and pushed the UI rule to ${applied} source(s).`;
    } else if (origin === 'obs') {
      state.layoutStatus = 'Saved the current OBS transform into the UI rule.';
    } else {
      state.layoutStatus = state.layoutData?.singleSourceName
        ? 'Saved UI rules. They will apply at playback time on the shared OBS source.'
        : `Saved ${scope}. OBS keeps its current transform until you push the UI rule.`;
    }
    setSaveStatus(state.layoutStatus, failed ? 'err' : 'ok');
  } catch (err) {
    state.layoutStatus = err.message || 'Could not save layout rules';
    setSaveStatus(state.layoutStatus, 'err');
  } finally {
    renderLayoutPanel();
  }
}

export async function saveLayoutRules(scope = 'all') {
  await persistLayoutRules({ scope, apply: false, origin: 'ui' });
}

async function pushLayoutRules(scope = 'all') {
  await persistLayoutRules({ scope, apply: true, origin: 'ui' });
}

async function applyLayoutSourceProperties(payload) {
  state.layoutPropertyStatus = 'Applying source controls...';
  renderLayoutPanel();
  try {
    const res = await fetch(`${API}/api/layout/properties/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not apply source controls');
    state.layoutData = data.layout || state.layoutData;
    const applied = data.result?.applied?.length || 0;
    const failed = data.result?.failed?.length || 0;
    state.layoutPropertyStatus = failed
      ? `Applied ${applied}; ${failed} source(s) failed.`
      : `Applied to ${applied} source(s).`;
    setSaveStatus(state.layoutPropertyStatus, failed ? 'err' : 'ok');
  } catch (err) {
    state.layoutPropertyStatus = err.message || 'Could not apply source controls';
    setSaveStatus(state.layoutPropertyStatus, 'err');
  } finally {
    renderLayoutPanel();
  }
}

async function setSourceVisibility(source, visible) {
  state.layoutVisibilityStatus = `Updating ${source}...`;
  renderLayoutPanel();
  try {
    const res = await fetch(`${API}/api/layout/source-visibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, visible }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not update source visibility');
    state.layoutData = data.layout || state.layoutData;
    state.layoutVisibilityStatus = `${source} is ${visible ? 'visible' : 'hidden'}.`;
  } catch (err) {
    state.layoutVisibilityStatus = err.message || 'Could not update source visibility';
    setSaveStatus(state.layoutVisibilityStatus, 'err');
  } finally {
    renderLayoutPanel();
  }
}

export function clearLayoutPreview(options) {
  clearObsCanvasPreview(options);
}

export function showLayoutPreview(sound, url) {
  const media = showObsCanvasPreview(sound, url, state.volume);
  syncRuleDom();
  return media;
}

function field(label, key) {
  const wrap = document.createElement('label');
  wrap.className = 'layout-field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '1';
  input.dataset.layoutField = key;
  input.addEventListener('input', () => {
    setSelectedRule({ [key]: number(input.value) });
    syncRuleDom();
  });
  wrap.append(span, input);
  return wrap;
}

function button(label, className, onClick) {
  const btn = document.createElement('button');
  btn.className = className || 'layout-btn';
  btn.type = 'button';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function option(value, label) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function propCheckbox(label, key, checked = true) {
  const wrap = document.createElement('label');
  wrap.className = 'layout-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.dataset.mediaProp = key;
  input.checked = checked;
  wrap.append(input, document.createTextNode(label));
  return wrap;
}

function renderSourceControlPanel(group) {
  const section = document.createElement('div');
  section.className = 'layout-source-controls' + (state.layoutSourceControlsOpen ? '' : ' collapsed');

  const header = document.createElement('div');
  header.className = 'layout-section-header';
  const title = document.createElement('div');
  title.className = 'layout-section-title';
  title.textContent = 'Audio + Source Routing';
  const toggle = button(state.layoutSourceControlsOpen ? 'Hide' : 'Show', 'layout-btn', () => {
    state.layoutSourceControlsOpen = !state.layoutSourceControlsOpen;
    localStorage.setItem('hk-layout-source-controls-open', state.layoutSourceControlsOpen ? '1' : '0');
    renderLayoutPanel();
  });
  header.append(title, toggle);
  section.appendChild(header);

  if (!state.layoutSourceControlsOpen) {
    const collapsed = document.createElement('div');
    collapsed.className = 'layout-status';
    collapsed.textContent = 'Apply OBS monitor mode, source volume, media behavior, and track routing when needed.';
    section.appendChild(collapsed);
    return section;
  }

  const scopeRow = document.createElement('div');
  scopeRow.className = 'layout-control-grid';
  const scopeField = document.createElement('label');
  scopeField.className = 'layout-field';
  const scopeLabel = document.createElement('span');
  scopeLabel.textContent = 'Apply To';
  const scopeSelect = document.createElement('select');
  scopeSelect.className = 'layout-filter-select';
  const dimension = group?.dimension_key || group?.key || '';
  const category = group?.category || 'Uncategorized';
  scopeSelect.append(
    option(`group|${group?.key || ''}`, 'This size + category'),
    option(`dimension|${dimension}`, `Dimension ${dimension}`),
    option(`category|${category}`, `Category ${category}`),
    option('all|all', 'All profile sources'),
  );
  scopeSelect.value = state.layoutPropertyScope || `group|${group?.key || ''}`;
  if (![...scopeSelect.options].some(opt => opt.value === scopeSelect.value)) {
    scopeSelect.value = `group|${group?.key || ''}`;
  }
  scopeSelect.addEventListener('change', () => {
    state.layoutPropertyScope = scopeSelect.value;
    syncMultiState();
  });
  scopeField.append(scopeLabel, scopeSelect);

  const monitorField = document.createElement('label');
  monitorField.className = 'layout-field';
  const monitorLabel = document.createElement('span');
  monitorLabel.textContent = 'Audio Monitor';
  const monitorSelect = document.createElement('select');
  monitorSelect.className = 'layout-filter-select';
  monitorSelect.append(
    option('', 'Leave unchanged'),
    option('OBS_MONITORING_TYPE_MONITOR_ONLY', 'Monitor only'),
    option('OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT', 'Monitor and output'),
    option('OBS_MONITORING_TYPE_NONE', 'No monitor'),
  );
  monitorField.append(monitorLabel, monitorSelect);
  scopeRow.append(scopeField, monitorField);

  const multiWrap = document.createElement('div');
  multiWrap.className = 'layout-multi-groups';
  const multiTitle = document.createElement('div');
  multiTitle.className = 'layout-subtitle';
  multiTitle.textContent = 'Also apply to specific groups';
  const multiGrid = document.createElement('div');
  multiGrid.className = 'layout-multi-grid';
  const multiHint = document.createElement('div');
  multiHint.className = 'layout-status';
  multiHint.textContent = 'Only used when Apply To is set to this size + category.';
  const knownGroups = groups();
  const selectedExtras = new Set(Array.isArray(state.layoutPropertyGroups) ? state.layoutPropertyGroups : []);
  knownGroups.forEach(item => {
    const label = document.createElement('label');
    label.className = 'layout-check layout-multi-item';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = item.key;
    input.checked = selectedExtras.has(item.key);
    input.disabled = item.key === group?.key;
    input.addEventListener('change', () => {
      const next = new Set(Array.isArray(state.layoutPropertyGroups) ? state.layoutPropertyGroups : []);
      if (input.checked) next.add(item.key);
      else next.delete(item.key);
      state.layoutPropertyGroups = [...next];
    });
    label.append(input, document.createTextNode(`${item.dimension_key || item.key} / ${item.category || 'All'}`));
    multiGrid.appendChild(label);
  });
  multiWrap.append(multiTitle, multiHint, multiGrid);

  function syncMultiState() {
    const enabled = scopeSelect.value.startsWith('group|');
    multiWrap.classList.toggle('disabled', !enabled);
    multiGrid.querySelectorAll('input').forEach(input => {
      input.disabled = !enabled || input.value === group?.key;
    });
  }
  syncMultiState();

  const checks = document.createElement('div');
  checks.className = 'layout-check-grid';
  checks.append(
    propCheckbox('Restart when active', 'restart_on_activate', false),
    propCheckbox('Hardware decoding', 'hw_decode', true),
    propCheckbox('Show nothing when playback ends', 'clear_on_media_end', true),
    propCheckbox('Close file when inactive', 'close_when_inactive', true),
    propCheckbox('Loop media', 'looping', false),
  );

  const trackWrap = document.createElement('div');
  trackWrap.className = 'layout-track-wrap';
  const trackTitle = document.createElement('label');
  trackTitle.className = 'layout-check layout-track-enable';
  const trackEnable = document.createElement('input');
  trackEnable.type = 'checkbox';
  trackTitle.append(trackEnable, document.createTextNode('Set audio tracks'));
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
  speedLabel.textContent = 'Speed %';
  const speedInput = document.createElement('input');
  speedInput.type = 'number';
  speedInput.min = '1';
  speedInput.step = '1';
  speedInput.value = '100';
  speedField.append(speedLabel, speedInput);

  const volumeWrap = document.createElement('div');
  volumeWrap.className = 'layout-track-wrap';
  const volumeTitle = document.createElement('label');
  volumeTitle.className = 'layout-check layout-track-enable';
  const volumeEnable = document.createElement('input');
  volumeEnable.type = 'checkbox';
  const volumeValueSpan = document.createElement('span');
  volumeValueSpan.className = 'layout-volume-value';
  volumeValueSpan.textContent = state.layoutVolumeDb != null ? `${state.layoutVolumeDb} dB` : '— dB';
  volumeTitle.append(volumeEnable, document.createTextNode('Set volume'));

  const volumeRow = document.createElement('div');
  volumeRow.className = 'layout-volume-row';
  const volumeLabel = document.createElement('label');
  volumeLabel.className = 'layout-volume-label';
  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '-60';
  volumeSlider.max = '0';
  volumeSlider.step = '0.5';
  volumeSlider.value = String(state.layoutVolumeDb ?? -10);
  volumeLabel.append(volumeSlider);
  volumeSlider.addEventListener('input', () => {
    state.layoutVolumeDb = Number(volumeSlider.value);
    volumeValueSpan.textContent = `${state.layoutVolumeDb} dB`;
  });
  const readVolumeBtn = button('Read OBS', 'layout-btn', async () => {
    const [scopeType, ...rest] = scopeSelect.value.split('|');
    try {
      const res = await fetch(`${API}/api/layout/volume?scope_type=${encodeURIComponent(scopeType)}&scope_key=${encodeURIComponent(rest.join('|'))}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed');
      if (data.db != null) {
        state.layoutVolumeDb = Math.round(data.db * 2) / 2;
        volumeSlider.value = String(state.layoutVolumeDb);
        volumeValueSpan.textContent = `${state.layoutVolumeDb} dB`;
        volumeEnable.checked = true;
      }
    } catch (err) {
      state.layoutPropertyStatus = err.message;
      renderLayoutPanel();
    }
  });
  volumeRow.append(volumeLabel, volumeValueSpan, readVolumeBtn);
  volumeWrap.append(volumeTitle, volumeRow);

  const applyBtn = button('Apply Source Controls', 'layout-btn primary', () => {
    const [scopeType, ...rest] = scopeSelect.value.split('|');
    const baseKey = rest.join('|');
    const extraGroups = (Array.isArray(state.layoutPropertyGroups) ? state.layoutPropertyGroups : [])
      .filter(key => key && key !== baseKey);
    const useGroups = scopeType === 'group' && extraGroups.length > 0;
    const mediaProperties = {};
    checks.querySelectorAll('[data-media-prop]').forEach(input => {
      mediaProperties[input.dataset.mediaProp] = input.checked;
    });
    mediaProperties.speed_percent = Number(speedInput.value) || 100;
    const enabledTracks = [...tracks.querySelectorAll('input:checked')].map(input => input.value);
    applyLayoutSourceProperties({
      scope_type: useGroups ? 'groups' : scopeType,
      scope_key: baseKey,
      scope_keys: useGroups ? [baseKey, ...extraGroups] : undefined,
      monitor: monitorSelect.value,
      audio_tracks: trackEnable.checked ? enabledTracks : null,
      media_properties: mediaProperties,
      volume_db: volumeEnable.checked && state.layoutVolumeDb != null ? state.layoutVolumeDb : null,
    });
  });

  const status = document.createElement('div');
  status.className = 'layout-status';
  status.textContent = state.layoutPropertyStatus || 'Choose a source scope, then apply monitor mode, tracks, playback options, and volume together.';

  section.append(scopeRow, multiWrap, checks, trackWrap, speedField, volumeWrap, applyBtn, status);
  return section;
}

function renderVolumeWorkspace(group) {
  const section = document.createElement('div');
  section.className = 'layout-volume-workspace';

  const summary = document.createElement('div');
  summary.className = 'layout-volume-summary';
  const customCount = Object.keys(state.fileVolumeOffsets || {}).length;
  const scopeSounds = volumeScopeSounds(group);
  const scopeLabel = describeScopeLabel(state.layoutVolumeScope, group);
  const average = scopeSounds.length
    ? roundDb(scopeSounds.reduce((sum, sound) => sum + effectiveVolumeDb(sound.stem), 0) / scopeSounds.length, 0)
    : 0;
  [
    { label: 'Project Layer', value: `${roundDb(state.projectVolumeDb, 0)} dB`, help: 'Whole mini project baseline' },
    { label: 'Profile Layer', value: `${roundDb(state.profileVolumeDb, 0)} dB`, help: 'Current live profile baseline' },
    { label: 'Custom Offsets', value: String(customCount), help: 'Files with individual offsets' },
    { label: 'Scope Avg', value: `${average} dB`, help: `Across ${scopeSounds.length} file${scopeSounds.length === 1 ? '' : 's'}` },
  ].forEach(item => {
    const card = document.createElement('div');
    card.className = 'layout-volume-stat';
    const value = document.createElement('strong');
    value.textContent = item.value;
    const label = document.createElement('span');
    label.textContent = item.label;
    const help = document.createElement('small');
    help.textContent = item.help;
    card.append(value, label, help);
    summary.appendChild(card);
  });

  const shell = document.createElement('div');
  shell.className = 'layout-volume-shell';

  const controls = document.createElement('div');
  controls.className = 'layout-volume-controls';

  const title = document.createElement('div');
  title.className = 'layout-section-title';
  title.textContent = 'Volume Workspace';
  const sub = document.createElement('div');
  sub.className = 'layout-status';
  sub.textContent = 'Balance the whole project, then batch-adjust by layout group, category, hotkey, or one file.';

  function dualDbField({ labelText, value, onChange, helpText }) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-volume-field';
    const label = document.createElement('div');
    label.className = 'layout-volume-field-head';
    const titleEl = document.createElement('strong');
    titleEl.textContent = labelText;
    const valueEl = document.createElement('span');
    valueEl.textContent = `${roundDb(value, 0)} dB`;
    label.append(titleEl, valueEl);

    const row = document.createElement('div');
    row.className = 'layout-volume-field-row';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '-60';
    slider.max = '24';
    slider.step = '0.5';
    slider.value = String(roundDb(value, 0));
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '-60';
    input.max = '24';
    input.step = '0.5';
    input.value = String(roundDb(value, 0));

    const sync = next => {
      const normalized = roundDb(next, 0);
      slider.value = String(normalized);
      input.value = String(normalized);
      valueEl.textContent = `${normalized} dB`;
      onChange(normalized);
    };

    slider.addEventListener('input', () => sync(slider.value));
    input.addEventListener('input', () => sync(input.value));
    row.append(slider, input);

    const help = document.createElement('small');
    help.className = 'layout-volume-help';
    help.textContent = helpText;
    wrap.append(label, row, help);
    return wrap;
  }

  controls.append(
    title,
    sub,
    dualDbField({
      labelText: 'Mini Project Layer',
      value: state.projectVolumeDb,
      helpText: 'Moves every file in this mini project together.',
      onChange: next => {
        state.projectVolumeDb = next;
        syncGlobalVolumeInputs();
        markDirty();
        document.querySelectorAll('[data-volume-effective]').forEach(node => {
          node.textContent = `${effectiveVolumeDb(node.dataset.volumeEffective)} dB`;
        });
      },
    }),
    dualDbField({
      labelText: 'Active Profile Layer',
      value: state.profileVolumeDb,
      helpText: 'Fine-tunes only the currently edited profile.',
      onChange: next => {
        state.profileVolumeDb = next;
        syncGlobalVolumeInputs();
        markDirty();
        document.querySelectorAll('[data-volume-effective]').forEach(node => {
          node.textContent = `${effectiveVolumeDb(node.dataset.volumeEffective)} dB`;
        });
      },
    }),
  );

  const batch = document.createElement('div');
  batch.className = 'layout-volume-batch';
  const batchTitle = document.createElement('div');
  batchTitle.className = 'layout-subtitle';
  batchTitle.textContent = 'Batch Change';

  const batchGrid = document.createElement('div');
  batchGrid.className = 'layout-volume-batch-grid';

  const scopeField = document.createElement('label');
  scopeField.className = 'layout-field';
  const scopeLabelEl = document.createElement('span');
  scopeLabelEl.textContent = 'Scope';
  const scopeSelect = document.createElement('select');
  scopeSelect.className = 'layout-filter-select';
  scopeSelect.append(
    option('group', 'Current layout group'),
    option('category', 'Category'),
    option('hotkey', 'Hotkey group'),
    option('selected', 'Selected file'),
    option('custom', 'Files with custom offsets'),
    option('all', 'All files in profile'),
  );
  scopeSelect.value = state.layoutVolumeScope || 'group';
  scopeField.append(scopeLabelEl, scopeSelect);

  const modeField = document.createElement('label');
  modeField.className = 'layout-field';
  const modeLabelEl = document.createElement('span');
  modeLabelEl.textContent = 'Action';
  const modeSelect = document.createElement('select');
  modeSelect.className = 'layout-filter-select';
  modeSelect.append(
    option('add-offset', 'Add dB to file offsets'),
    option('set-offset', 'Set file offsets to dB'),
    option('set-effective', 'Set effective total to dB'),
    option('clear-offset', 'Clear file offsets'),
  );
  modeSelect.value = state.layoutVolumeMode || 'add-offset';
  modeField.append(modeLabelEl, modeSelect);

  const categoryField = document.createElement('label');
  categoryField.className = 'layout-field';
  const categoryLabelEl = document.createElement('span');
  categoryLabelEl.textContent = 'Category';
  const categorySelect = document.createElement('select');
  categorySelect.className = 'layout-filter-select';
  categorySelect.append(option('all', 'All categories'), option('Uncategorized', 'Uncategorized'));
  sortedCategories().forEach(name => categorySelect.append(option(name, name)));
  categorySelect.value = state.layoutVolumeCategory || 'all';
  categoryField.append(categoryLabelEl, categorySelect);

  const hotkeyField = document.createElement('label');
  hotkeyField.className = 'layout-field';
  const hotkeyLabelEl = document.createElement('span');
  hotkeyLabelEl.textContent = 'Hotkey';
  const hotkeySelect = document.createElement('select');
  hotkeySelect.className = 'layout-filter-select';
  hotkeySelect.append(option('', 'Choose a hotkey'));
  allGroupKeys().forEach(key => hotkeySelect.append(option(key, key)));
  hotkeySelect.value = state.layoutVolumeHotkey || '';
  hotkeyField.append(hotkeyLabelEl, hotkeySelect);

  const valueField = document.createElement('label');
  valueField.className = 'layout-field';
  const valueLabelEl = document.createElement('span');
  valueLabelEl.textContent = 'dB';
  const valueInput = document.createElement('input');
  valueInput.type = 'number';
  valueInput.min = '-60';
  valueInput.max = '24';
  valueInput.step = '0.5';
  valueInput.value = String(roundDb(state.layoutVolumeValue, 0));
  valueField.append(valueLabelEl, valueInput);

  batchGrid.append(scopeField, modeField, categoryField, hotkeyField, valueField);

  const batchActions = document.createElement('div');
  batchActions.className = 'layout-volume-batch-actions';
  const scopeSummary = document.createElement('div');
  scopeSummary.className = 'layout-status';
  scopeSummary.textContent = `${scopeSounds.length} file${scopeSounds.length === 1 ? '' : 's'} in ${scopeLabel}.`;
  const applyBtn = button('Apply Batch Change', 'layout-btn primary', () => {
    state.layoutVolumeScope = scopeSelect.value;
    state.layoutVolumeMode = modeSelect.value;
    state.layoutVolumeCategory = categorySelect.value;
    state.layoutVolumeHotkey = hotkeySelect.value;
    state.layoutVolumeValue = roundDb(valueInput.value, 0);
    applyBulkVolumeChange(group);
  });
  batchActions.append(scopeSummary, applyBtn);

  const syncBatchUi = () => {
    state.layoutVolumeScope = scopeSelect.value;
    state.layoutVolumeMode = modeSelect.value;
    state.layoutVolumeCategory = categorySelect.value;
    state.layoutVolumeHotkey = hotkeySelect.value;
    state.layoutVolumeValue = roundDb(valueInput.value, 0);
    categoryField.hidden = scopeSelect.value !== 'category';
    hotkeyField.hidden = scopeSelect.value !== 'hotkey';
    valueField.hidden = modeSelect.value === 'clear-offset';
    const label = describeScopeLabel(scopeSelect.value, group);
    const count = volumeScopeSounds(group).length;
    scopeSummary.textContent = `${count} file${count === 1 ? '' : 's'} in ${label}.`;
  };
  [scopeSelect, modeSelect, categorySelect, hotkeySelect, valueInput].forEach(input =>
    input.addEventListener('input', syncBatchUi)
  );
  syncBatchUi();

  batch.append(batchTitle, batchGrid, batchActions);

  const mixer = document.createElement('div');
  mixer.className = 'layout-volume-mixer';
  const mixerHead = document.createElement('div');
  mixerHead.className = 'layout-volume-mixer-head';
  const mixerTitle = document.createElement('div');
  mixerTitle.className = 'layout-subtitle';
  mixerTitle.textContent = 'Per-File Mixer';
  const search = document.createElement('input');
  search.className = 'layout-volume-search';
  search.type = 'search';
  search.placeholder = 'Filter files in this scope';
  search.value = state.layoutVolumeSearch || '';
  mixerHead.append(mixerTitle, search);

  const rows = document.createElement('div');
  rows.className = 'layout-volume-rows';
  const query = (state.layoutVolumeSearch || '').trim().toLowerCase();
  const empty = document.createElement('div');
  empty.className = 'layout-source-empty';
  empty.textContent = 'No files matched the current volume scope.';
  volumeScopeSounds(group)
    .filter(sound => {
      if (!query) return true;
      const label = displayNameForStem(sound.stem).toLowerCase();
      const cats = categoriesForStem(sound.stem).join(' ').toLowerCase();
      return sound.stem.toLowerCase().includes(query) || label.includes(query) || cats.includes(query);
    })
    .sort((left, right) => displayNameForStem(left.stem).localeCompare(displayNameForStem(right.stem)))
    .forEach(sound => {
      const row = document.createElement('div');
      row.className = 'layout-volume-row-card';
      row.dataset.volumeSearch = [
        sound.stem,
        displayNameForStem(sound.stem),
        (stemToKeys()[sound.stem] || []).join(' '),
        categoriesForStem(sound.stem).join(' '),
      ].join(' ').toLowerCase();
      const meta = document.createElement('div');
      meta.className = 'layout-volume-row-meta';
      const name = document.createElement('strong');
      name.textContent = displayNameForStem(sound.stem);
      const details = document.createElement('small');
      const keys = (stemToKeys()[sound.stem] || []).join(' ');
      const categories = categoriesForStem(sound.stem);
      details.textContent = [sound.stem, keys || 'no hotkey', categories.join(', ') || 'no category']
        .filter(Boolean)
        .join(' • ');
      meta.append(name, details);

      const controlsWrap = document.createElement('div');
      controlsWrap.className = 'layout-volume-row-controls';
      const offsetInput = document.createElement('input');
      offsetInput.type = 'range';
      offsetInput.min = '-60';
      offsetInput.max = '24';
      offsetInput.step = '0.5';
      offsetInput.value = String(fileOffsetDb(sound.stem));
      const numberInput = document.createElement('input');
      numberInput.type = 'number';
      numberInput.min = '-60';
      numberInput.max = '24';
      numberInput.step = '0.5';
      numberInput.value = String(fileOffsetDb(sound.stem));
      const badges = document.createElement('div');
      badges.className = 'layout-volume-row-badges';
      const offsetBadge = document.createElement('span');
      offsetBadge.className = 'layout-volume-badge';
      const effectiveBadge = document.createElement('span');
      effectiveBadge.className = 'layout-volume-badge active';
      effectiveBadge.dataset.volumeEffective = sound.stem;
      const resetBtn = button('Reset', 'layout-btn', () => {
        setFileOffsetDb(sound.stem, 0);
        markDirty();
        state.layoutVolumeStatus = `Reset ${displayNameForStem(sound.stem)} to the profile baseline.`;
        rerenderEditor();
      });

      const syncRow = nextRaw => {
        const next = roundDb(nextRaw, 0);
        setFileOffsetDb(sound.stem, next);
        offsetInput.value = String(next);
        numberInput.value = String(next);
        offsetBadge.textContent = `Offset ${next} dB`;
        effectiveBadge.textContent = `${effectiveVolumeDb(sound.stem)} dB`;
        markDirty();
      };

      offsetBadge.textContent = `Offset ${fileOffsetDb(sound.stem)} dB`;
      effectiveBadge.textContent = `${effectiveVolumeDb(sound.stem)} dB`;
      offsetInput.addEventListener('input', () => syncRow(offsetInput.value));
      numberInput.addEventListener('input', () => syncRow(numberInput.value));
      badges.append(offsetBadge, effectiveBadge);
      controlsWrap.append(offsetInput, numberInput, badges, resetBtn);
      row.append(meta, controlsWrap);
      rows.appendChild(row);
    });

  rows.appendChild(empty);

  const filterRows = () => {
    const needle = (search.value || '').trim().toLowerCase();
    let visibleCount = 0;
    rows.querySelectorAll('.layout-volume-row-card').forEach(row => {
      const visible = !needle || row.dataset.volumeSearch.includes(needle);
      row.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    empty.hidden = visibleCount > 0;
  };

  search.addEventListener('input', () => {
    state.layoutVolumeSearch = search.value;
    filterRows();
  });
  filterRows();

  const status = document.createElement('div');
  status.className = 'layout-status';
  status.textContent = state.layoutVolumeStatus || `Editing ${scopeSounds.length} file${scopeSounds.length === 1 ? '' : 's'} in ${scopeLabel}.`;

  mixer.append(mixerHead, rows);
  shell.append(controls, batch, mixer);
  section.append(summary, shell, status);
  return section;
}

function renderVisibilityPanel() {
  const section = document.createElement('div');
  section.className = 'layout-source-controls';
  const title = document.createElement('div');
  title.className = 'layout-section-title';
  const sources = Array.isArray(state.layoutData?.sources) ? state.layoutData.sources : [];
  const visibleCount = sources.filter(item => item.visible).length;
  const sceneName = state.layoutData?.scene || 'Scene';
  title.textContent = `Scene Visibility — ${sceneName} (${visibleCount}/${sources.length})`;

  const list = document.createElement('div');
  list.className = 'layout-source-list';
  if (!sources.length) {
    const empty = document.createElement('div');
    empty.className = 'layout-source-empty';
    empty.textContent = 'No scene sources were returned by OBS.';
    list.appendChild(empty);
  }
  sources.forEach(item => {
    const row = document.createElement('label');
    row.className = 'layout-source-row' + (item.profile_source ? ' profile-source' : '');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!item.visible;
    input.addEventListener('change', () => setSourceVisibility(item.source, input.checked));
    const meta = document.createElement('span');
    meta.className = 'layout-source-row-meta';
    const name = document.createElement('strong');
    name.textContent = item.source;
    const sub = document.createElement('small');
    const tags = [
      item.profile_source ? 'profile' : 'scene',
      item.dimension_key,
      ...(item.categories || []),
    ].filter(Boolean);
    sub.textContent = tags.join(' / ');
    meta.append(name, sub);
    row.append(input, meta);
    list.appendChild(row);
  });

  const status = document.createElement('div');
  status.className = 'layout-status';
  status.textContent = state.layoutVisibilityStatus || 'Toggle anything currently visible in this OBS scene.';
  section.append(title, list, status);
  return section;
}

function renderLayoutSectionTabs() {
  const tabs = document.createElement('div');
  tabs.className = 'layout-section-tabs';
  [
    ['canvas', 'Canvas'],
    ['audio', 'Audio Controls'],
    ['levels', 'Levels'],
  ].forEach(([value, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-section-tab' + (state.layoutSection === value ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      state.layoutSection = value;
      renderLayoutPanel();
    });
    tabs.appendChild(btn);
  });
  return tabs;
}

function buildLayoutSidebar(allGroups, selectedGroup) {
  const side = document.createElement('div');
  side.className = 'layout-side';

  const sideTitle = document.createElement('div');
  sideTitle.className = 'layout-side-title';
  sideTitle.textContent = 'OBS Groups';
  const sideSub = document.createElement('div');
  sideSub.className = 'layout-side-subtitle';
  sideSub.textContent = 'Choose the size/category group you want to edit.';
  side.append(sideTitle, sideSub);

  const groupMatches = item => {
    if (state.layoutFilterDimension && item.dimension_key !== state.layoutFilterDimension) return false;
    if (state.layoutFilterCategory && state.layoutFilterCategory !== 'all' && item.category !== state.layoutFilterCategory) return false;
    return true;
  };

  const filterApply = () => {
    const next = allGroups.find(groupMatches) || allGroups[0];
    if (next) state.layoutSelectedGroup = next.key;
    renderLayoutPanel();
    import('./render.js').then(({ applyVisibility }) => {
      import('./hotkey.js').then(({ stemToKeys }) => applyVisibility(stemToKeys()));
    });
  };

  const makeChipRow = (labelText, items, getActive, setActive) => {
    const wrap = document.createElement('div');
    wrap.className = 'layout-filter-chips-section';
    const lbl = document.createElement('div');
    lbl.className = 'layout-filter-chips-label';
    lbl.textContent = labelText;
    const row = document.createElement('div');
    row.className = 'layout-filter-chips';
    items.forEach(({ value, label }) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'layout-filter-chip' + (getActive() === value ? ' active' : '');
      chip.textContent = label;
      chip.addEventListener('click', () => {
        setActive(value);
        filterApply();
      });
      row.appendChild(chip);
    });
    wrap.append(lbl, row);
    return wrap;
  };

  const allDims = [...new Set(allGroups.map(g => g.dimension_key).filter(Boolean))].sort();
  const dimItems = [{ value: null, label: 'All' }, ...allDims.map(d => ({ value: d, label: d }))];
  const allCats = [...new Set(allGroups.map(g => g.category || 'Uncategorized').filter(Boolean))].sort();
  const catItems = [{ value: 'all', label: 'All' }, ...allCats.map(c => ({ value: c, label: c }))];

  side.appendChild(makeChipRow('Dimension', dimItems,
    () => state.layoutFilterDimension || null,
    value => { state.layoutFilterDimension = value; }
  ));
  side.appendChild(makeChipRow('Category', catItems,
    () => state.layoutFilterCategory || 'all',
    value => { state.layoutFilterCategory = value; }
  ));

  allGroups.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'layout-group-btn'
      + (item.key === selectedGroup.key ? ' active' : '')
      + (!groupMatches(item) ? ' dimmed' : '');
    btn.type = 'button';
    const names = (item.sounds || []).slice(0, 3).map(sound => sound.stem).join(', ');
    const key = document.createElement('span');
    key.className = 'layout-group-key';
    key.textContent = item.dimension_key || item.key;
    const meta = document.createElement('span');
    meta.className = 'layout-group-meta';
    meta.textContent = `${item.category || 'All categories'} - ${(item.sounds || []).length} file${(item.sounds || []).length === 1 ? '' : 's'}`;
    const samples = document.createElement('span');
    samples.className = 'layout-group-samples';
    samples.textContent = names || 'No sample files';
    btn.append(key, meta, samples);
    btn.addEventListener('click', () => selectLayoutGroup(item.key));
    side.appendChild(btn);
  });

  return side;
}

function renderCanvasWorkspace(panel, group, rule, canvas) {
  const main = document.createElement('div');
  main.className = 'layout-main';

  const hero = document.createElement('div');
  hero.className = 'layout-hero';
  const heroText = document.createElement('div');
  heroText.className = 'layout-hero-copy';
  const heroTitle = document.createElement('strong');
  heroTitle.textContent = `${group.dimension_key || group.key} canvas rules`;
  const heroSub = document.createElement('span');
  heroSub.textContent = `Scene ${state.layoutData.scene || 'Scene'} - ${canvas.width} x ${canvas.height}. Drag the preview box to move, resize, and crop this group.`;
  heroText.append(heroTitle, heroSub);
  const heroMeta = document.createElement('div');
  heroMeta.className = 'layout-hero-meta';
  heroMeta.textContent = `${(group.sounds || []).length} file${(group.sounds || []).length === 1 ? '' : 's'} in ${group.category || 'all categories'}`;
  hero.append(heroText, heroMeta);
  const syncMeta = document.createElement('div');
  syncMeta.className = 'layout-status';
  syncMeta.textContent = layoutSyncSummary();

  const editTools = document.createElement('div');
  editTools.className = 'layout-toolbar';
  const editBadge = document.createElement('div');
  editBadge.className = 'layout-edit-badge' + (selectedRuleIsOverride() ? ' override' : '');
  editBadge.textContent = selectedRuleIsOverride() ? `Editing file: ${state.layoutEditingStem}` : `Editing group: ${group.key}`;
  editTools.appendChild(editBadge);
  if (canEditFileOverride()) {
    editTools.appendChild(button(selectedRuleIsOverride() ? 'Use Group Rule' : 'Edit This File Only', 'layout-btn', () => toggleFileOverride(!selectedRuleIsOverride())));
  }
  if (state.layoutOverrides?.[state.previewStem]) {
    editTools.appendChild(button('Clear File Override', 'layout-btn danger', deleteFileOverride));
  }

  const zoomTools = document.createElement('div');
  zoomTools.className = 'layout-toolbar';
  const zoomLabel = document.createElement('span');
  zoomLabel.id = 'layout-zoom-label';
  zoomLabel.className = 'layout-zoom-label';
  zoomLabel.textContent = `${Math.round(state.layoutZoom * 100)}%`;
  zoomTools.append(
    button('-', 'layout-btn', () => setLayoutZoom(state.layoutZoom - 0.15)),
    zoomLabel,
    button('+', 'layout-btn', () => setLayoutZoom(state.layoutZoom + 0.15)),
    button('Use Current OBS', 'layout-btn', useCurrentObsForSelection),
    button('Refresh OBS', 'layout-btn', () => loadLayoutData({ force: true })),
  );

  const overlay = renderObsCanvasOverlay({
    canvas,
    group,
    rule,
    zoom: state.layoutZoom,
    volume: state.volume,
    previewUrl: null,
    getRule: () => ensureActiveRule(),
    onPatch: setSelectedRule,
    onZoom: setLayoutZoom,
    onSync: () => syncRuleDom(panel),
  });

  const controls = document.createElement('div');
  controls.className = 'layout-controls';
  controls.append(
    field('X', 'positionX'),
    field('Y', 'positionY'),
    field('Width', 'boundsWidth'),
    field('Height', 'boundsHeight'),
    field('Crop L', 'cropLeft'),
    field('Crop T', 'cropTop'),
    field('Crop R', 'cropRight'),
    field('Crop B', 'cropBottom'),
  );

  const actions = document.createElement('div');
  actions.className = 'layout-actions';
  const saveScope = document.createElement('select');
  saveScope.className = 'layout-save-scope';
  saveScope.append(
    option('all', 'Save everything'),
    option('selected-group', 'Save this group only'),
    option('filtered-groups', 'Save filtered groups'),
  );
  if (selectedRuleIsOverride()) saveScope.append(option('selected-file', 'Save this file only'));
  actions.append(
    saveScope,
    button('Reset This Size', 'layout-btn', () => resetSelectedLayoutRule()),
    button('Reset All Sizes', 'layout-btn danger', resetAllLayoutRules),
  );
  if (state.layoutData?.singleSourceName) {
    actions.append(button('Save UI Rule', 'layout-btn primary', () => saveLayoutRules(saveScope.value)));
  } else {
    actions.append(
      button('Save UI Rule', 'layout-btn', () => saveLayoutRules(saveScope.value)),
      button('Save + Push to OBS', 'layout-btn primary', () => pushLayoutRules(saveScope.value)),
    );
  }

  const status = document.createElement('div');
  status.className = 'layout-status';
  status.textContent = state.layoutStatus || `${(group.sounds || []).length} video file(s) will use this rule.`;

  main.append(hero, syncMeta, editTools, zoomTools, overlay, controls, actions, status);
  return main;
}

function buildLevelsCtx() {
  return {
    state,
    roundDb,
    effectiveVolumeDb,
    fileOffsetDb,
    categoriesForStem,
    sortedCategories,
    displayNameForStem,
    markDirty,
    syncGlobalVolumeInputs,
    triggerSave: () => import('./api.js').then(({ save }) => save()),
  };
}

function renderAudioWorkspace(group) {
  return renderAudioWorkspaceUI({
    API,
    state,
    group,
    groups: groups(),
    roundDb,
    fileOffsetDb,
    effectiveVolumeDb,
    setFileOffsetDb,
    formatDb,
    volumeMeterPercent,
    selectedVolumeStem,
    selectedAudioSound,
    setActiveVolumeStem: stem => {
      state.activeVolumeStem = stem;
      renderLayoutPanel();
    },
    describeScopeLabel,
    volumeScopeSounds,
    applyBulkVolumeChange,
    applyLayoutSourceProperties,
    setSourceVisibility,
    loadLayoutData,
    renderLayoutPanel,
    syncGlobalVolumeInputs,
    button,
    option,
    propCheckbox,
    allGroupKeys,
    sortedCategories,
    stemToKeys,
    displayNameForStem,
    categoriesForStem,
    sourceNameForSound,
    markDirty,
  });
}

export function renderLayoutPanel() {
  const panel = document.getElementById('layout-panel');
  if (!panel) return;
  panel.innerHTML = '';

  if (!state.layoutSection) state.layoutSection = 'canvas';
  panel.appendChild(renderLayoutSectionTabs());

  if (!state.layoutData) {
    const empty = document.createElement('div');
    empty.className = 'layout-empty';
    const title = document.createElement('div');
    title.className = 'empty-title';
    title.textContent = state.layoutLoading ? 'Loading OBS workspace' : 'OBS workspace';
    const sub = document.createElement('div');
    sub.className = 'empty-sub';
    sub.textContent = state.layoutStatus || 'Load OBS once, then switch between Canvas and Audio Controls.';
    const loadBtn = button(state.layoutLoading ? 'Loading...' : 'Load OBS', 'layout-btn primary', () => loadLayoutData({ force: true }));
    loadBtn.disabled = state.layoutLoading;
    empty.append(title, sub, loadBtn);
    panel.appendChild(empty);
    return;
  }

  const allGroups = groups();
  if (!allGroups.length) {
    const shell = document.createElement('div');
    shell.className = 'layout-main';
    const empty = document.createElement('div');
    empty.className = 'layout-empty';
    empty.innerHTML = state.layoutSection === 'canvas'
      ? '<div class="empty-title">No video canvas groups found</div><div class="empty-sub">This profile has no video size groups yet. You can still use Audio Controls for profile volume and OBS source routing.</div>'
      : '<div class="empty-title">No video groups yet</div><div class="empty-sub">Audio Controls still works for the whole profile and any individual files.</div>';
    shell.append(empty);
    if (state.layoutSection === 'audio') {
      shell.append(renderAudioWorkspace(null));
    } else if (state.layoutSection === 'levels') {
      shell.append(renderLevelsWorkspace(buildLevelsCtx()));
    }
    panel.appendChild(shell);
    return;
  }

  const group = selectedLayoutGroup();
  const rule = ensureActiveRule() || ensureLayoutRule(group.key);
  const canvas = canvasSize(state.layoutData);
  const previewSound = activePreviewSound();

  const shell = document.createElement('div');
  shell.className = 'layout-shell';
  const mainContent = state.layoutSection === 'levels'
    ? renderLevelsWorkspace(buildLevelsCtx())
    : state.layoutSection === 'audio'
      ? renderAudioWorkspace(group)
      : renderCanvasWorkspace(panel, group, rule, canvas);
  shell.append(buildLayoutSidebar(allGroups, group), mainContent);

  panel.appendChild(shell);

  if (state.layoutSection === 'canvas') {
    syncRuleDom(panel);
    if (previewSound && state.previewUrlObject) {
      const media = showLayoutPreview(previewSound, state.previewUrlObject);
      if (media) state.previewEl = media;
    }
  }
}
