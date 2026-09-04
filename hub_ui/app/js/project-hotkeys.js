import { api } from "./api.js";
import { sse } from "./sse.js";
import { toast } from "./toast.js";
import { esc, displayName } from "./utils.js";

let _host = null;
let _projectKey = "";
let _project = null;
let _selectedProfile = "";
let _reloadTimer = null;
let _boundReload = null;

export async function mountProjectHotkeyPanel(host, projectKey) {
  unmountProjectHotkeyPanel();
  _host = host;
  _projectKey = projectKey;
  _host?.addEventListener("click", _handleClick);

  _boundReload = () => {
    clearTimeout(_reloadTimer);
    _reloadTimer = window.setTimeout(() => {
      _load({ silent: true });
    }, 120);
  };
  sse.subscribe("editor_profiles_updated", _boundReload);
  sse.subscribe("editor_project_settings_updated", _boundReload);

  await _load();
}

export function unmountProjectHotkeyPanel() {
  clearTimeout(_reloadTimer);
  if (_boundReload) {
    sse.unsubscribe("editor_profiles_updated", _boundReload);
    sse.unsubscribe("editor_project_settings_updated", _boundReload);
    _boundReload = null;
  }
  if (_host) {
    _host.removeEventListener("click", _handleClick);
    _host.innerHTML = "";
  }
  _host = null;
  _projectKey = "";
  _project = null;
  _selectedProfile = "";
}

async function _load({ silent = false } = {}) {
  if (!_host || !_projectKey) return;
  try {
    const data = await api.getEditorProfiles();
    const projects = Array.isArray(data?.projects) ? data.projects : [];
    _project = projects.find(project => project.key === _projectKey) || null;
    const editable = _editableProfiles(_project);
    if (_selectedProfile && !editable.some(profile => profile.name === _selectedProfile)) {
      _selectedProfile = "";
    }
    if (!_selectedProfile && editable.length) {
      _selectedProfile = editable.find(profile => profile.live)?.name || editable[0].name;
    }
    _render();
  } catch (error) {
    if (!silent) toast.error(`Could not load project hotkeys: ${error.message}`);
    if (_host) {
      _host.innerHTML = `<section class="card project-hotkey-shell"><div class="empty-state">Could not load project hotkeys.<br><code>${esc(error.message)}</code></div></section>`;
    }
  }
}

function _render() {
  if (!_host) return;
  if (!_project) {
    _host.innerHTML = `<section class="card project-hotkey-shell"><div class="project-hotkey-head"><div><div class="card-title">Hotkeys and Profiles</div><div class="field-help">This mini project is runtime-only here, so the Hub does not have editor-backed hotkey data to save.</div></div><a href="#profiles" class="btn btn-secondary btn-sm">Open Profiles Deck</a></div></section>`;
    return;
  }

  const current = _project.settings?.current || {};
  const editableProfiles = _editableProfiles(_project);
  const selectedProfile = editableProfiles.find(profile => profile.name === _selectedProfile) || editableProfiles[0] || null;
  const profilePreview = selectedProfile ? _previewProfileHotkeys(selectedProfile.hotkey_map || {}) : "";
  const projectPreview = _previewInterfaceHotkeys(current.interface_hotkeys || {});
  const profileTransportPreview = selectedProfile ? _previewInterfaceHotkeys(selectedProfile.interface_hotkeys || {}) : "";
  const totalProfileHotkeys = editableProfiles.reduce((sum, profile) => sum + Number(profile.hotkey_count || 0), 0);

  _host.innerHTML = `
    <section class="card project-hotkey-shell">
      <div class="project-hotkey-head">
        <div>
          <div class="card-title">Hotkeys and Profiles</div>
          <div class="field-help">Project controls stay on the left. Saved profile key maps stay on the right, with the current values always visible before you edit.</div>
        </div>
        <a href="#profiles" class="btn btn-secondary btn-sm">Open Profiles Deck</a>
      </div>
      <div class="project-hotkey-metrics">
        <div class="project-hotkey-metric"><span>Project trigger</span><strong>${esc(_triggerChipLabel(current.trigger_sequences || ""))}</strong></div>
        <div class="project-hotkey-metric"><span>Project controls</span><strong>${esc(String(Object.keys(current.interface_hotkeys || {}).length))}</strong></div>
        <div class="project-hotkey-metric"><span>Editable profiles</span><strong>${esc(String(editableProfiles.length))}</strong></div>
        <div class="project-hotkey-metric"><span>Profile hotkeys</span><strong>${esc(String(totalProfileHotkeys))}</strong></div>
      </div>
      <div class="project-hotkey-layout">
        <section class="project-hotkey-card">
          <div class="project-hotkey-card-head"><div><h3>Mini project controls</h3><p>These are the transport and listener keys for ${esc(_project.name || displayName(_project.key))}.</p></div><span class="project-hotkey-chip project-hotkey-chip--accent">${esc(_triggerChipLabel(current.trigger_sequences || ""))}</span></div>
          <details class="project-hotkey-drawer" open><summary><span>Listener trigger</span><strong>${esc(_triggerChipLabel(current.trigger_sequences || ""))}</strong></summary><div class="project-hotkey-drawer-body"><label class="profile-field"><span class="profile-field-label">Trigger sequence</span><input class="project-hotkey-trigger-input" value="${esc(String(current.trigger_sequences || ""))}" placeholder="/ *"></label><span class="field-help">Use spaces between keys and <code>;</code> between alternate sequences.</span></div></details>
          <label class="profile-field project-hotkey-field"><span class="profile-field-label">Mini project hotkeys</span><textarea class="project-hotkey-project-input" rows="8">${esc(_formatInterfaceHotkeys(current.interface_hotkeys || {}))}</textarea><span class="field-help">Examples: <code>start_listen = f</code>, <code>abort_listen = a</code>, <code>stop = s</code>.</span></label>
          <div class="project-hotkey-preview-row">${projectPreview || `<span class="project-hotkey-empty">No project control hotkeys mapped yet.</span>`}</div>
          <div class="project-hotkey-actions"><button type="button" class="btn btn-primary btn-sm" data-hotkey-project-save>Save mini project hotkeys</button></div>
        </section>
        <section class="project-hotkey-card project-hotkey-card--profile">
          <div class="project-hotkey-card-head"><div><h3>Saved profile hotkeys</h3><p>Pick a profile, review what it already has, then update the direct media keys or its trigger sequence.</p></div>${selectedProfile ? `<span class="project-hotkey-chip">${esc(selectedProfile.name)}</span>` : ""}</div>
          ${editableProfiles.length ? `<div class="project-hotkey-profile-tabs">${editableProfiles.map(profile => `<button type="button" class="project-hotkey-profile-tab ${profile.name === (selectedProfile?.name || "") ? "is-active" : ""}" data-hotkey-profile-tab="${esc(profile.name)}"><span>${esc(profile.name)}</span><strong>${esc(String(profile.hotkey_count || 0))}</strong></button>`).join("")}</div>` : `<div class="project-hotkey-empty-card">No editable saved profiles are available for this mini project.</div>`}
          ${selectedProfile ? `<details class="project-hotkey-drawer" open><summary><span>Profile trigger</span><strong>${esc(_triggerChipLabel(selectedProfile.trigger_sequences || ""))}</strong></summary><div class="project-hotkey-drawer-body"><label class="profile-field"><span class="profile-field-label">Trigger sequence</span><input class="project-hotkey-profile-trigger-input" value="${esc(String(selectedProfile.trigger_sequences || ""))}" placeholder="/ *"></label><span class="field-help">This sequence opens the manual or voice window for the selected saved profile.</span></div></details><label class="profile-field project-hotkey-field"><span class="profile-field-label">Profile hotkey map</span><textarea class="project-hotkey-profile-input" rows="10">${esc(_formatHotkeys(selectedProfile.hotkey_map || {}))}</textarea><span class="field-help">One mapping per line. Example: <code>1 = crowd_cheer | confetti_pop</code></span></label><details class="project-hotkey-drawer"><summary><span>Profile control overrides</span><strong>${esc(Object.keys(selectedProfile.interface_hotkeys || {}).length ? `${Object.keys(selectedProfile.interface_hotkeys || {}).length} mapped` : "Optional")}</strong></summary><div class="project-hotkey-drawer-body"><label class="profile-field project-hotkey-field"><span class="profile-field-label">Profile transport hotkeys</span><textarea class="project-hotkey-profile-controls-input" rows="6">${esc(_formatInterfaceHotkeys(selectedProfile.interface_hotkeys || {}))}</textarea><span class="field-help">Leave this blank unless this profile should override the mini project control keys.</span></label></div></details><div class="project-hotkey-preview-block"><div class="project-hotkey-preview-label">Current direct hotkeys</div><div class="project-hotkey-preview-row">${profilePreview || `<span class="project-hotkey-empty">No direct media hotkeys mapped yet.</span>`}</div></div><div class="project-hotkey-preview-block"><div class="project-hotkey-preview-label">Current profile control overrides</div><div class="project-hotkey-preview-row">${profileTransportPreview || `<span class="project-hotkey-empty">No profile-level control overrides saved.</span>`}</div></div><div class="project-hotkey-actions"><button type="button" class="btn btn-primary btn-sm" data-hotkey-profile-save>Save ${esc(selectedProfile.name)} hotkeys</button></div>` : ""}
        </section>
      </div>
    </section>
  `;
}

async function _handleClick(event) {
  const profileTab = event.target.closest("[data-hotkey-profile-tab]");
  if (profileTab) {
    _selectedProfile = profileTab.dataset.hotkeyProfileTab || "";
    _render();
    return;
  }
  if (event.target.closest("[data-hotkey-project-save]")) {
    await _saveProject();
    return;
  }
  if (event.target.closest("[data-hotkey-profile-save]")) {
    await _saveProfile();
  }
}

async function _saveProject() {
  if (!_host || !_project) return;
  const current = _project.settings?.current || {};
  const settings = { ...current, trigger_sequences: _host.querySelector(".project-hotkey-trigger-input")?.value.trim() || "", interface_hotkeys: _parseInterfaceHotkeys(_host.querySelector(".project-hotkey-project-input")?.value || "") };
  try {
    await api.saveEditorProjectSettings({ project: _project.key, settings });
    if (_project.settings) _project.settings.current = settings;
    toast.success(`${displayName(_project.key)} hotkeys saved`);
    _render();
  } catch (error) {
    toast.error(error.message);
  }
}

async function _saveProfile() {
  if (!_host || !_project) return;
  const profile = _editableProfiles(_project).find(item => item.name === _selectedProfile);
  if (!profile) return;
  const payload = { project: _project.key, profile: profile.name, trigger_sequences: _host.querySelector(".project-hotkey-profile-trigger-input")?.value.trim() || "", hotkeys: _parseHotkeys(_host.querySelector(".project-hotkey-profile-input")?.value || ""), interface_hotkeys: _parseInterfaceHotkeys(_host.querySelector(".project-hotkey-profile-controls-input")?.value || ""), project_volume_db: Number(profile.project_volume_db || 0), profile_volume_db: Number(profile.profile_volume_db || 0) };
  try {
    await api.saveEditorProfile(payload);
    profile.trigger_sequences = payload.trigger_sequences;
    profile.hotkey_map = payload.hotkeys;
    profile.hotkeys = Object.keys(payload.hotkeys).sort();
    profile.hotkey_count = profile.hotkeys.length;
    profile.interface_hotkeys = payload.interface_hotkeys;
    toast.success(`${displayName(_project.key)} / ${profile.name} saved`);
    _render();
  } catch (error) {
    toast.error(error.message);
  }
}

function _editableProfiles(project) { return (project?.profiles || []).filter(profile => !profile.readonly); }
function _formatHotkeys(map) { return Object.entries(map || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key} = ${Array.isArray(value) ? value.join(" | ") : value}`).join("\n"); }
function _formatInterfaceHotkeys(map) { return Object.entries(map || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key} = ${value}`).join("\n"); }
function _parseHotkeys(text) { const output = {}; String(text || "").split(/\r?\n|;/).map(line => line.trim()).filter(Boolean).forEach(line => { const [rawKey, ...rest] = line.split("="); const key = String(rawKey || "").trim(); const value = rest.join("=").split("#")[0].trim(); if (!key || !value) return; const stems = value.split("|").map(item => item.trim()).filter(Boolean); if (stems.length === 1) output[key] = stems[0]; if (stems.length > 1) output[key] = stems; }); return output; }
function _parseInterfaceHotkeys(text) { const output = {}; String(text || "").split(/\r?\n|;/).map(line => line.trim()).filter(Boolean).forEach(line => { const [rawKey, ...rest] = line.split("="); const key = String(rawKey || "").trim(); const value = rest.join("=").split("#")[0].trim(); if (!key) return; output[key] = value; }); return output; }
function _previewProfileHotkeys(map) { const entries = Object.entries(map || {}); if (!entries.length) return ""; return entries.slice(0, 10).map(([key, value]) => { const summary = Array.isArray(value) ? `${value.length} items` : String(value); return `<span class="project-hotkey-chip"><strong>${esc(key)}</strong><span>${esc(summary)}</span></span>`; }).join(""); }
function _previewInterfaceHotkeys(map) { const entries = Object.entries(map || {}); if (!entries.length) return ""; return entries.slice(0, 10).map(([key, value]) => `<span class="project-hotkey-chip project-hotkey-chip--soft"><strong>${esc(key)}</strong><span>${esc(String(value))}</span></span>`).join(""); }
function _triggerChipLabel(value) { const text = String(value || "").trim(); return text || "Set trigger"; }