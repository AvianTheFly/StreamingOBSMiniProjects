import { state } from './state.js';
import { API } from './constants.js';
import { normalizeHotkeys } from './hotkey.js';
import { markDirty, setSaveStatus } from './ui.js';
import { render } from './render.js';
import { renderProjectSettings } from './settings.js';

// ── Profile/project UI updaters ───────────────────────────────────────────────

export function updateProfileBar() {
  const sel  = document.getElementById('profile-sel');
  const prev = sel.value;
  sel.innerHTML = '';
  state.profileNames.forEach(n => {
    const opt = document.createElement('option');
    opt.value       = n;
    opt.textContent = n + (n === state.liveProfile ? ' ●' : '');
    sel.appendChild(opt);
  });
  sel.value = state.profileNames.includes(prev) ? prev : state.activeProfile;

  const isLive = state.activeProfile === state.liveProfile;
  document.getElementById('pb-live-badge').style.display = isLive ? '' : 'none';
  document.getElementById('pb-not-live').style.display   = isLive ? 'none' : '';
  document.getElementById('pb-set-live').style.display   = isLive ? 'none' : '';
  document.getElementById('pb-delete').disabled = state.profileNames.length <= 1;
  const triggerInput = document.getElementById('profile-trigger-sequences');
  if (triggerInput && triggerInput.value !== state.profileTriggerSequences) {
    triggerInput.value = state.profileTriggerSequences || '';
  }
  const projectVolumeInput = document.getElementById('profile-project-volume-db');
  if (projectVolumeInput && projectVolumeInput.value !== String(state.projectVolumeDb ?? 0)) {
    projectVolumeInput.value = String(state.projectVolumeDb ?? 0);
  }
  const profileVolumeInput = document.getElementById('profile-volume-db');
  if (profileVolumeInput && profileVolumeInput.value !== String(state.profileVolumeDb ?? 0)) {
    profileVolumeInput.value = String(state.profileVolumeDb ?? 0);
  }
}

export function updateProjectSel() {
  const wrap = document.getElementById('project-sel-wrap');
  const sel  = document.getElementById('project-sel');
  if (!state.projects || state.projects.length <= 1) {
    wrap.classList.add('single');
    return;
  }
  wrap.classList.remove('single');
  sel.innerHTML = '';
  state.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value    = p.key;
    opt.textContent = p.name;
    opt.selected = p.active;
    sel.appendChild(opt);
  });
}

// ── Data application ──────────────────────────────────────────────────────────

export function applyServerData(data) {
  state.sounds        = data.sounds || [];
  state.hotkeys       = normalizeHotkeys(data.hotkeys || {});
  state.groupNames    = (data.group_names && typeof data.group_names === 'object') ? data.group_names : {};
  state.displayNames  = (data.display_names && typeof data.display_names === 'object') ? data.display_names : {};
  state.categories    = Array.isArray(data.categories) ? data.categories : [];
  state.soundCategories = {};
  if (data.sound_categories && typeof data.sound_categories === 'object') {
    Object.entries(data.sound_categories).forEach(([stem, value]) => {
      const categories = Array.isArray(value) ? value : value ? [value] : [];
      const clean = [...new Set(categories.map(v => String(v || '').trim()).filter(Boolean))];
      if (clean.length) state.soundCategories[stem] = clean;
    });
  }
  state.emptyGroups   = Array.isArray(data.empty_groups)   ? data.empty_groups   : [];
  state.unboundGroups = Array.isArray(data.unbound_groups) ? data.unbound_groups : [];
  state.phrases = (data.phrases && typeof data.phrases === 'object') ? data.phrases : {};
  state.interfaceHotkeys = (data.interface_hotkeys && typeof data.interface_hotkeys === 'object') ? data.interface_hotkeys : {};
  state.projectVolumeDb = Number.isFinite(Number(data.project_volume_db)) ? Number(data.project_volume_db) : 0;
  state.profileVolumeDb = Number.isFinite(Number(data.profile_volume_db)) ? Number(data.profile_volume_db) : 0;
  state.categoryVolumeDb = (data.category_volume_db && typeof data.category_volume_db === 'object') ? data.category_volume_db : {};
  state.fileVolumeOffsets = (data.file_volume_offsets && typeof data.file_volume_offsets === 'object') ? data.file_volume_offsets : {};
  state.activeProfile = data.active_profile || 'default';
  state.liveProfile   = data.live_profile   || 'default';
  state.profileNames  = Array.isArray(data.profile_names)  ? data.profile_names  : [state.activeProfile];
  state.profileTriggerSequences = data.profile_trigger_sequences || '';
  state.projects      = Array.isArray(data.projects)       ? data.projects        : [];
  state.configSettings = (data.config_settings && typeof data.config_settings === 'object') ? data.config_settings : {};
  state.configFields = Array.isArray(state.configSettings.fields) ? state.configSettings.fields : [];
  state.canCreateProfiles = !!data.can_create_profiles;
  state.currentAssetDir   = data.asset_dir   || '';
  state.currentProjectKey = (state.projects.find(p => p.active) || {}).key || '';

  if (data.project_name) {
    state.layoutData = null;
    state.layoutRules = {};
    state.layoutOverrides = {};
    state.layoutSelectedGroup = null;
    state.layoutFilterDimension = null;
    state.layoutFilterCategory = 'all';
    state.layoutEditingStem = null;
    state.layoutZoom = 1;
    state.layoutLoading = false;
    state.layoutDirty = false;
    state.layoutStatus = '';
    state.layoutApplyResult = null;
    state.activeVolumeStem = null;
    state.layoutVolumeStatus = '';
    state.layoutVolumeSearch = '';
    state.layoutSceneSearch = '';
    state.layoutSceneFilter = 'all';
    document.title = `${data.project_name} — Hotkeys`;
    document.getElementById('page-title').textContent = `${data.project_name} — Hotkeys`;
  }
  const dir = data.asset_dir || '—';
  const d   = document.getElementById('stat-dir');
  d.textContent = dir;
  d.title       = dir;

  updateProfileBar();
  updateProjectSel();
  renderProjectSettings();
  const createToggle = document.getElementById('media-profile-create-toggle');
  if (createToggle) createToggle.hidden = !state.canCreateProfiles;
}

// ── Load / save ───────────────────────────────────────────────────────────────

export async function load() {
  try {
    const res  = await fetch(`${API}/api/data`);
    const data = await res.json();
    applyServerData(data);
    const sortSel = document.getElementById('sort-sel');
    if (sortSel) sortSel.value = state.sortMode;
    const showSel = document.getElementById('library-show');
    if (showSel) showSel.value = state.libraryShow || 'all';
    const typeSel = document.getElementById('media-type-filter');
    if (typeSel) typeSel.value = state.mediaTypeFilter || 'all';
    render();
  } catch {
    document.getElementById('sound-grid').innerHTML =
      `<div class="grid-empty">
         Could not reach the server.<br>
         <span style="font-size:.78rem;color:var(--text-dim)">Run hotkey_editor.py and reload.</span>
       </div>`;
  }
}

export async function apiSaveQuiet() {
  if (!state.dirty) return;
  await fetch(`${API}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hotkeys:        normalizeHotkeys(state.hotkeys),
      profile_trigger_sequences: state.profileTriggerSequences,
      group_names:    state.groupNames,
      display_names:  state.displayNames,
      categories:     state.categories,
      sound_categories: state.soundCategories,
      empty_groups:   state.emptyGroups,
      unbound_groups: state.unboundGroups,
      phrases:        state.phrases,
      interface_hotkeys: state.interfaceHotkeys,
      project_volume_db: state.projectVolumeDb,
      profile_volume_db: state.profileVolumeDb,
      category_volume_db: state.categoryVolumeDb,
      file_volume_offsets: state.fileVolumeOffsets,
    }),
  });
}

export async function save() {
  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  setSaveStatus('Saving…', '');
  state.hotkeys = normalizeHotkeys(state.hotkeys);

  try {
    const res  = await fetch(`${API}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotkeys:        state.hotkeys,
        profile_trigger_sequences: state.profileTriggerSequences,
        group_names:    state.groupNames,
        display_names:  state.displayNames,
        categories:     state.categories,
        sound_categories: state.soundCategories,
        empty_groups:   state.emptyGroups,
        unbound_groups: state.unboundGroups,
        phrases:        state.phrases,
        interface_hotkeys: state.interfaceHotkeys,
        project_volume_db: state.projectVolumeDb,
        profile_volume_db: state.profileVolumeDb,
        file_volume_offsets: state.fileVolumeOffsets,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      state.dirty = false;
      const isLive = state.activeProfile === state.liveProfile;
      const msg    = isLive
        ? `✓ Saved — live projects will reload it`
        : `✓ Saved to "${state.activeProfile}" (profile trigger updates live)`;
      setSaveStatus(msg, 'ok');
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (err) {
    setSaveStatus(`✗ ${err.message}`, 'err');
  } finally {
    btn.disabled = false;
  }
}
