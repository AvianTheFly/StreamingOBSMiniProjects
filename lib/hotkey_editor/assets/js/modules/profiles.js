import { state } from './state.js';
import { API } from './constants.js';
import { setSaveStatus } from './ui.js';
import { render } from './render.js';
import { applyServerData, updateProfileBar, apiSaveQuiet } from './api.js';
import { loadLayoutData } from './layout.js';

// ── API helpers ───────────────────────────────────────────────────────────────

async function profileRequest(endpoint, body) {
  const res  = await fetch(`${API}/api/profile/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Failed');
  return data;
}

function currentPageContext() {
  return {
    sounds:    state.sounds,
    asset_dir: document.getElementById('stat-dir')?.title || '',
    projects:  state.projects,
    phrases:   state.phrases,
    can_create_profiles: state.canCreateProfiles,
    config_settings: state.configSettings,
  };
}

// ── Profile CRUD ──────────────────────────────────────────────────────────────

export async function switchProfile(name) {
  if (name === state.activeProfile) return;
  if (state.dirty && !confirm('You have unsaved changes. Switch profile anyway?')) return;
  try {
    const data = await profileRequest('switch', { name });
    applyServerData({ ...data, ...currentPageContext() });
    state.dirty = false;
    setSaveStatus('', '');
    render();
  } catch (e) { alert(e.message); }
}

function suggestedDuplicateName() {
  const base = `Copy of ${state.activeProfile}`;
  if (!state.profileNames.includes(base)) return base;
  let copyNumber = 2;
  while (state.profileNames.includes(`${base} ${copyNumber}`)) copyNumber += 1;
  return `${base} ${copyNumber}`;
}

export async function duplicateProfile() {
  const name = prompt(`Duplicate "${state.activeProfile}" as:`, suggestedDuplicateName());
  if (!name || !name.trim()) return;
  if (state.dirty && !confirm('Unsaved changes will be copied to the new profile. Continue?')) return;
  try {
    await apiSaveQuiet();
    const data = await profileRequest('duplicate', {
      source: state.activeProfile,
      name: name.trim(),
    });
    applyServerData({ ...data, ...currentPageContext() });
    state.dirty = false;
    setSaveStatus('', '');
    render();
  } catch (e) { alert(e.message); }
}

export async function deleteProfile() {
  if (state.profileNames.length <= 1) { alert('Cannot delete the last profile.'); return; }
  if (!confirm(`Delete profile "${state.activeProfile}"? This cannot be undone.`)) return;
  try {
    const data = await profileRequest('delete', { name: state.activeProfile });
    applyServerData({ ...data, ...currentPageContext() });
    state.dirty = false;
    setSaveStatus('', '');
    render();
  } catch (e) { alert(e.message); }
}

export async function renameProfile() {
  const newName = prompt(`Rename "${state.activeProfile}" to:`);
  if (!newName || !newName.trim() || newName.trim() === state.activeProfile) return;
  try {
    const data = await profileRequest('rename', { from: state.activeProfile, to: newName.trim() });
    state.activeProfile = data.active_profile;
    state.liveProfile   = data.live_profile;
    state.profileNames  = data.profile_names;
    updateProfileBar();
  } catch (e) { alert(e.message); }
}

export async function setLiveProfile() {
  try {
    await apiSaveQuiet();
    const data = await profileRequest('set_live', { name: state.activeProfile });
    state.liveProfile = data.live_profile;
    updateProfileBar();
    setSaveStatus(`✓ "${state.activeProfile}" is now live — running projects will reload it`, 'ok');
  } catch (e) { alert(e.message); }
}

// ── Project switch ────────────────────────────────────────────────────────────

export async function switchProject(key) {
  if (state.dirty && !confirm('You have unsaved changes. Switch project anyway?')) return;
  try {
    const res  = await fetch(`${API}/api/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed');
    state.dirty = false;
    setSaveStatus('', '');
    state.mediaBlobUrlCache.clear();
    applyServerData(data);
    document.getElementById('sort-sel').value = state.sortMode;
    render();
    if (state.rightMode === 'layout') loadLayoutData({ force: true });
  } catch (e) { alert(e.message); }
}

export function setMediaProfileCreateOpen(open) {
  state.mediaProfileCreateOpen = !!open;
  const panel = document.getElementById('media-profile-create-panel');
  const toggle = document.getElementById('media-profile-create-toggle');
  if (panel) panel.hidden = !state.mediaProfileCreateOpen;
  if (toggle) {
    toggle.classList.toggle('active', state.mediaProfileCreateOpen);
    toggle.hidden = !state.canCreateProfiles;
  }
}

export async function createMediaProfile() {
  const status = document.getElementById('media-profile-create-status');
  const button = document.getElementById('media-profile-create-save');
  const featureInputs = document.querySelectorAll('[data-media-profile-feature]');
  const features = {};
  featureInputs.forEach(input => { features[input.dataset.mediaProfileFeature] = input.checked; });
  const body = {
    name: document.getElementById('media-profile-name')?.value || '',
    key: document.getElementById('media-profile-key')?.value || '',
    asset_dir: document.getElementById('media-profile-asset-dir')?.value || '',
    scene: document.getElementById('media-profile-scene')?.value || '',
    obs_source_prefix: document.getElementById('media-profile-prefix')?.value || '',
    trigger_sequences: document.getElementById('media-profile-trigger')?.value || '',
    features,
  };
  if (!body.name.trim()) {
    if (status) status.textContent = 'Name is required.';
    return;
  }
  if (status) status.textContent = 'Creating...';
  if (button) button.disabled = true;
  try {
    const res = await fetch(`${API}/api/media-profile/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not create media profile');
    state.dirty = false;
    state.mediaBlobUrlCache.clear();
    applyServerData(data);
    setMediaProfileCreateOpen(false);
    render();
    setSaveStatus(`Created "${data.project_name}"`, 'ok');
  } catch (err) {
    if (status) status.textContent = err.message;
  } finally {
    if (button) button.disabled = false;
  }
}
