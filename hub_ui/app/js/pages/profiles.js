import { api } from "../api.js";
import { sse } from "../sse.js";
import { state } from "../state.js";
import { toast } from "../toast.js";
import { esc, displayName } from "../utils.js";

const FILTERS = [
  { key: "all", label: "All Projects" },
  { key: "editable", label: "Editor Backed" },
  { key: "audio", label: "Audio Projects" },
  { key: "needs_setup", label: "Needs Setup" },
  { key: "runtime", label: "Runtime Only" },
];

const QUICK_SETTING_KEYS = [
  "scene",
  "asset_dir",
  "obs_source_prefix",
  "manual_trigger_window",
  "auto_record_timeout",
  "monitor",
  "default_volume_db",
  "audio_tracks",
  "manual_hotkeys_enabled",
  "voice_commands_enabled",
  "random_commands_enabled",
];

let _container = null;
let _listEl = null;
let _summaryEl = null;
let _searchEl = null;
let _projects = [];
let _hubActions = [];
let _filter = "all";
let _search = "";
let _unwatch = null;
let _reloadTimer = null;
let _boundReload = null;

export async function mount(container) {
  _container = container;
  container.innerHTML = `
    <div class="page-header profile-command-header">
      <div>
        <div class="profile-command-kicker">Control deck</div>
        <div class="page-title">Profiles</div>
        <div class="page-subtitle">Trigger maps, profile audio, runtime transport, and project defaults in one place.</div>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-profiles-refresh>Refresh</button>
        <a href="/editor" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Open Editor</a>
      </div>
    </div>

    <section class="profile-command-shell">
      <div class="profile-hero">
        <div class="profile-hero-copy">
          <div class="profile-hero-title">High-level control across every media profile</div>
          <p class="profile-hero-text">
            Use this page as the operating layer above the hotkey editor: tune live triggers, mix per-profile audio,
            run transport commands, and keep project defaults aligned without bouncing between tools.
          </p>
        </div>
        <div id="profileSummary" class="profile-summary-grid"></div>
      </div>

      <div class="profile-toolbar">
        <label class="profile-search">
          <span class="profile-search-icon">/</span>
          <input id="profileSearch" type="search" placeholder="Search projects, scenes, profiles, or hotkeys">
        </label>
        <div class="profile-filter-group" id="profileFilterGroup">
          ${FILTERS.map(filter => `
            <button
              type="button"
              class="profile-filter-chip ${filter.key === "all" ? "is-active" : ""}"
              data-filter="${esc(filter.key)}"
            >
              ${esc(filter.label)}
            </button>
          `).join("")}
        </div>
      </div>

      <div id="profileProjectList" class="profile-command-grid"></div>
    </section>
  `;

  _listEl = container.querySelector("#profileProjectList");
  _summaryEl = container.querySelector("#profileSummary");
  _searchEl = container.querySelector("#profileSearch");

  container.addEventListener("click", _handleClick);
  _searchEl?.addEventListener("input", _handleSearch);

  _unwatch = state.watch("projects", () => {
    _renderSummary();
    _syncRuntimeState();
  });

  _boundReload = () => {
    clearTimeout(_reloadTimer);
    _reloadTimer = window.setTimeout(() => {
      _loadData({ silent: true });
    }, 120);
  };
  sse.subscribe("editor_profiles_updated", _boundReload);
  sse.subscribe("editor_project_settings_updated", _boundReload);

  await _loadData();
}

export function unmount() {
  if (_container) {
    _container.removeEventListener("click", _handleClick);
  }
  if (_searchEl) {
    _searchEl.removeEventListener("input", _handleSearch);
  }
  if (_unwatch) {
    _unwatch();
    _unwatch = null;
  }
  if (_boundReload) {
    sse.unsubscribe("editor_profiles_updated", _boundReload);
    sse.unsubscribe("editor_project_settings_updated", _boundReload);
    _boundReload = null;
  }
  clearTimeout(_reloadTimer);
  _container = null;
  _listEl = null;
  _summaryEl = null;
  _searchEl = null;
  _projects = [];
  _hubActions = [];
}

async function _loadData({ silent = false } = {}) {
  try {
    const [profilesData, hubActionsData, statusData] = await Promise.all([
      api.getEditorProfiles(),
      api.getHubActions(),
      api.getStatus(),
    ]);

    if (Array.isArray(statusData?.projects)) {
      state.set({ projects: statusData.projects, lastUpdated: Date.now() });
    }

    _projects = _sortProjects(profilesData?.projects || []);
    _hubActions = Array.isArray(hubActionsData?.actions) ? hubActionsData.actions : [];

    _renderSummary();
    _renderProjectList();
    _syncRuntimeState();
  } catch (error) {
    if (!silent) {
      toast.error(`Could not load profile controls: ${error.message}`);
    }
    if (_listEl) {
      _listEl.innerHTML = `<div class="empty-state">Could not load profiles.<br><code>${esc(error.message)}</code></div>`;
    }
  }
}

function _sortProjects(projects) {
  return [...projects].sort((left, right) => {
    const leftEditable = _hasEditableProfiles(left) ? 0 : 1;
    const rightEditable = _hasEditableProfiles(right) ? 0 : 1;
    if (leftEditable !== rightEditable) return leftEditable - rightEditable;

    const leftAudio = state.getProject(left.key)?.produces_audio ? 0 : 1;
    const rightAudio = state.getProject(right.key)?.produces_audio ? 0 : 1;
    if (leftAudio !== rightAudio) return leftAudio - rightAudio;

    return String(left.name || left.key).localeCompare(String(right.name || right.key));
  });
}

function _renderSummary() {
  if (!_summaryEl) return;

  const runtime = state.get("projects") || [];
  const editorProjects = _projects.filter(project => _hasEditableProfiles(project)).length;
  const runtimeOnly = _projects.length - editorProjects;
  const totalProfiles = _projects.reduce((sum, project) => sum + (project.profiles || []).length, 0);
  const activeRuntime = runtime.filter(project => project.is_active).length;
  const audioProjects = runtime.filter(project => project.produces_audio).length;

  const metrics = [
    { label: "Projects", value: _projects.length, detail: `${editorProjects} editor-backed / ${runtimeOnly} runtime-only` },
    { label: "Profiles", value: totalProfiles, detail: `${_projects.filter(project => _needsSetup(project)).length} need trigger work` },
    { label: "Audio", value: audioProjects, detail: `${activeRuntime} runtime project${activeRuntime === 1 ? "" : "s"} active now` },
  ];

  _summaryEl.innerHTML = `
    ${metrics.map(metric => `
      <div class="profile-metric-card">
        <span class="profile-metric-label">${esc(metric.label)}</span>
        <strong class="profile-metric-value">${esc(String(metric.value))}</strong>
        <span class="profile-metric-detail">${esc(metric.detail)}</span>
      </div>
    `).join("")}
    <div class="profile-metric-card profile-metric-card--actions">
      <span class="profile-metric-label">Hub actions</span>
      <div class="profile-action-stack">
        ${_hubActions.length ? _hubActions.map(action => `
          <button
            type="button"
            class="btn ${action.id.includes("abort") ? "btn-danger" : "btn-secondary"} btn-sm"
            data-run-hub-action="${esc(action.id)}"
            title="${esc(action.description || "")}"
          >
            ${esc(action.label || action.id)}
          </button>
        `).join("") : `<span class="muted">No hub-wide actions configured yet.</span>`}
      </div>
    </div>
  `;
}

function _renderProjectList() {
  if (!_listEl) return;

  const filtered = _projects.filter(project => _matchesProject(project, _search, _filter));
  if (!filtered.length) {
    _listEl.innerHTML = `<div class="empty-state">No projects match the current filters.</div>`;
    return;
  }

  _listEl.innerHTML = filtered.map(project => _projectCard(project)).join("");
}

function _projectCard(project) {
  const status = state.getProject(project.key);
  const liveProfile = _liveProfile(project);
  const currentSettings = project.settings?.current || {};
  const scenes = status?.controlled_scenes?.length ? status.controlled_scenes.join(" / ") : currentSettings.scene || "No runtime scenes";
  const activity = status?.current_activity || "Standing by";
  const runtimeVolume = _runtimeVolumeText(status, liveProfile);
  const totalHotkeys = (project.profiles || []).reduce((sum, profile) => sum + Number(profile.hotkey_count || 0), 0);
  const profileCount = (project.profiles || []).length;

  return `
    <article class="profile-control-card ${status?.is_active ? "is-active" : ""}" data-runtime-project="${esc(project.key)}">
      <div class="profile-control-head">
        <div class="profile-project-brand">
          <span class="profile-project-dot ${status?.is_active ? "is-active" : ""}" data-runtime-dot></span>
          <div class="profile-project-heading">
            <div class="profile-project-title-row">
              <h2 class="profile-project-title">${esc(project.name || displayName(project.key))}</h2>
              ${status?.is_active ? `<span class="badge badge-active" data-runtime-badge>active</span>` : `<span class="badge badge-idle" data-runtime-badge>idle</span>`}
              ${status?.produces_audio ? `<span class="badge badge-audio">audio</span>` : ""}
              ${_hasEditableProfiles(project) ? `<span class="badge badge-idle">editor</span>` : `<span class="badge badge-warn">runtime</span>`}
            </div>
            <div class="profile-project-subtitle">${esc(scenes)}</div>
          </div>
        </div>
        <div class="profile-head-stats">
          <div class="profile-head-stat">
            <span>Live profile</span>
            <strong data-runtime-live-profile>${esc(liveProfile?.name || "runtime")}</strong>
          </div>
          <div class="profile-head-stat">
            <span>Hotkeys</span>
            <strong>${esc(String(totalHotkeys))}</strong>
          </div>
          <div class="profile-head-stat">
            <span>Profiles</span>
            <strong>${esc(String(profileCount))}</strong>
          </div>
        </div>
      </div>

      <div class="profile-control-body">
        <div class="profile-profile-stack">
          <section class="profile-side-card profile-runtime-card">
            <div class="profile-side-head">
              <div>
                <div class="card-title">Runtime status</div>
                <div class="field-help">Live transport controls and current runtime context.</div>
              </div>
            </div>
            <div class="profile-runtime-grid">
              <div class="profile-runtime-stat">
                <span>Activity</span>
                <strong data-runtime-activity>${esc(activity)}</strong>
              </div>
              <div class="profile-runtime-stat">
                <span>Scenes</span>
                <strong data-runtime-scenes>${esc(scenes)}</strong>
              </div>
              <div class="profile-runtime-stat">
                <span>Mix</span>
                <strong data-runtime-volume>${esc(runtimeVolume)}</strong>
              </div>
            </div>
            <div class="profile-runtime-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-open-project-page="${esc(project.key)}">Open runtime view</button>
              ${_renderRuntimeButtons(status)}
            </div>
          </section>

          ${project.profiles?.length
            ? project.profiles.map(profile => _profileEditor(project, profile)).join("")
            : `
              <section class="profile-editor-card is-empty">
                <div class="empty-state">No editor profiles exist for this project yet.</div>
              </section>
            `}
        </div>

        <div class="profile-side-stack">
          ${_renderSettingsPanel(project)}
        </div>
      </div>
    </article>
  `;
}

function _renderRuntimeButtons(status) {
  const actions = Array.isArray(status?.actions) ? status.actions : [];
  if (!actions.length) {
    return `<span class="muted">No runtime actions available.</span>`;
  }
  return actions.map(action => `
    <button
      type="button"
      class="btn ${_actionButtonClass(action.key)} btn-sm"
      data-run-project-action="${esc(status.name)}"
      data-project-action-key="${esc(action.key)}"
      title="${esc(action.description || "")}"
    >
      ${esc(action.label || action.key)}
    </button>
  `).join("");
}

function _profileEditor(project, profile) {
  const hotkeyText = _formatHotkeys(profile.hotkey_map || {});
  const interfaceText = _formatInterfaceHotkeys(profile.interface_hotkeys || {}, project.settings?.interface_actions || []);
  const preview = _previewHotkeys(profile.hotkey_map || {});
  const triggerSummary = _triggerChipLabel(profile.trigger_sequences || "");

  return `
    <section
      class="profile-editor-card ${profile.live ? "is-live" : ""} ${profile.readonly ? "is-readonly" : ""}"
      data-project="${esc(project.key)}"
      data-profile="${esc(profile.name)}"
    >
      <div class="profile-editor-head">
        <div>
          <div class="profile-editor-title-row">
            <h3 class="profile-editor-title">${esc(profile.name)}</h3>
            ${profile.live ? `<span class="badge badge-active">live</span>` : `<span class="badge badge-idle">saved</span>`}
            ${profile.readonly ? `<span class="badge badge-warn">runtime only</span>` : ""}
          </div>
          <div class="field-help">
            ${profile.readonly
              ? "This project exposes runtime controls here, but its profile mapping is managed elsewhere."
              : "Edit the trigger phrase, direct hotkeys, and transport keys for this specific profile."}
          </div>
        </div>
        <div class="profile-editor-stats">
          <span>${esc(String(profile.hotkey_count || 0))} hotkeys</span>
          <span>${esc(_formatTriggerSummary(profile.trigger_sequences || ""))}</span>
        </div>
      </div>

      <div class="profile-editor-grid">
        <label class="profile-field">
          <span class="profile-field-label">Project mix</span>
          <input
            class="profile-project-volume-input"
            type="number"
            step="0.5"
            value="${esc(String(_numberOr(profile.project_volume_db, 0)))}"
            ${profile.readonly ? "disabled" : ""}
          >
        </label>
        <label class="profile-field">
          <span class="profile-field-label">Profile mix</span>
          <input
            class="profile-volume-input"
            type="number"
            step="0.5"
            value="${esc(String(_numberOr(profile.profile_volume_db, 0)))}"
            ${profile.readonly ? "disabled" : ""}
          >
        </label>
      </div>

      <details class="profile-trigger-drawer">
        <summary>
          <span class="profile-trigger-summary-copy">
            <span class="profile-trigger-summary-label">Listener trigger</span>
            <span class="profile-trigger-summary-help">Click to edit the sequence that opens this profile.</span>
          </span>
          <span class="profile-trigger-pill">${esc(triggerSummary)}</span>
        </summary>
        <div class="profile-trigger-drawer-body">
          <label class="profile-field">
            <span class="profile-field-label">Trigger sequence</span>
            <input
              class="profile-trigger-input"
              value="${esc(profile.trigger_sequences || "")}"
              placeholder="/ *"
              ${profile.readonly ? "disabled" : ""}
            >
          </label>
          <span class="field-help">Use spaces between keys and <code>;</code> between alternate sequences. Example: <code>/ *</code> or <code>q q ; ! !</code>.</span>
        </div>
      </details>

      <div class="profile-text-grid">
        <label class="profile-field">
          <span class="profile-field-label">Hotkey trigger map</span>
          <textarea class="profile-hotkeys-input" rows="6" ${profile.readonly ? "disabled" : ""}>${esc(hotkeyText)}</textarea>
          <span class="field-help">One mapping per line. Example: <code>1 = crowd_cheer | confetti_pop</code></span>
        </label>
        <label class="profile-field">
          <span class="profile-field-label">Transport hotkeys</span>
          <textarea class="profile-interface-input" rows="6" ${profile.readonly ? "disabled" : ""}>${esc(interfaceText)}</textarea>
          <span class="field-help">Examples: <code>start_listen = f</code>, <code>stop = s</code>, <code>random = r</code></span>
        </label>
      </div>

      <div class="profile-editor-footer">
        <div class="profile-hotkey-preview">
          ${preview || `<span class="profile-hotkey-empty">No direct hotkeys mapped yet.</span>`}
        </div>
        ${profile.readonly
          ? `<span class="muted">Runtime project only</span>`
          : `<button type="button" class="btn btn-primary btn-sm" data-profile-save>Save profile</button>`}
      </div>
    </section>
  `;
}

function _renderSettingsPanel(project) {
  const settings = project.settings || {};
  const fields = Array.isArray(settings.fields) ? settings.fields : [];
  const current = settings.current || {};
  const triggerField = fields.find(field => field.key === "trigger_sequences") || null;

  if (!fields.length || !Object.keys(current).length) {
    return `
      <section class="profile-side-card profile-settings-card">
        <div class="card-title">Project defaults</div>
        <div class="empty-state">No editable project defaults are exposed for this runtime project.</div>
      </section>
    `;
  }

  const quickFields = fields.filter(field => QUICK_SETTING_KEYS.includes(field.key));
  const advancedFields = fields.filter(field => !QUICK_SETTING_KEYS.includes(field.key) && field.key !== "trigger_sequences");

  return `
    <section class="profile-side-card profile-settings-card" data-project-settings="${esc(project.key)}">
      <div class="profile-side-head">
        <div>
          <div class="card-title">Project defaults</div>
          <div class="field-help">These settings shape the project globally. Per-profile mix overrides stay in the cards on the left.</div>
        </div>
      </div>

      ${triggerField ? _renderProjectTriggerDrawer(project, triggerField, current[triggerField.key]) : ""}

      <div class="profile-settings-grid">
        ${quickFields.map(field => _renderSettingField(field, current[field.key])).join("")}
      </div>

      ${advancedFields.length ? `
        <details class="profile-advanced-settings">
          <summary>Advanced project settings</summary>
          <div class="profile-settings-grid profile-settings-grid--advanced">
            ${advancedFields.map(field => _renderSettingField(field, current[field.key])).join("")}
          </div>
        </details>
      ` : ""}

      <div class="profile-settings-footer">
        <span class="field-help profile-settings-file">${esc(settings.file || "")}</span>
        <button type="button" class="btn btn-secondary btn-sm" data-settings-save>Save project defaults</button>
      </div>
    </section>
  `;
}

function _renderProjectTriggerDrawer(project, field, value) {
  const profileLinks = (project.profiles || [])
    .filter(profile => !profile.readonly)
    .map(profile => `
      <button
        type="button"
        class="profile-trigger-link"
        data-profile-trigger-jump="${esc(project.key)}::${esc(profile.name)}"
      >
        <span>${esc(profile.name)}</span>
        <strong>${esc(_triggerChipLabel(profile.trigger_sequences || ""))}</strong>
      </button>
    `)
    .join("");

  return `
    <details class="profile-trigger-drawer profile-trigger-drawer--project">
      <summary>
        <span class="profile-trigger-summary-copy">
          <span class="profile-trigger-summary-label">Project listener trigger</span>
          <span class="profile-trigger-summary-help">${esc(field.help || "Choose the sequence that opens the project listener.")}</span>
        </span>
        <span class="profile-trigger-pill">${esc(_triggerChipLabel(value))}</span>
      </summary>
      <div class="profile-trigger-drawer-body">
        <label class="profile-field">
          <span class="profile-field-label">${esc(field.label || field.key)}</span>
          <input
            type="text"
            value="${esc(String(_settingValueForInput(field.type || "text", value) ?? ""))}"
            data-setting-key="${esc(field.key)}"
            data-setting-type="${esc(field.type || "text")}"
            placeholder="/ *"
          >
        </label>
        <span class="field-help">This is the global listener for the project. Use the profile cards if you want a different trigger sequence per saved profile.</span>
        ${profileLinks ? `
          <div class="profile-trigger-jump-list">
            <span class="profile-trigger-jump-label">Profile shortcuts</span>
            <div class="profile-trigger-jump-grid">
              ${profileLinks}
            </div>
          </div>
        ` : ""}
      </div>
    </details>
  `;
}

function _renderSettingField(field, value) {
  const type = field.type || "text";
  const formatted = _settingValueForInput(type, value);
  const help = field.help ? `<span class="field-help">${esc(field.help)}</span>` : "";

  if (type === "select") {
    const options = Array.isArray(field.options) ? field.options : [];
    return `
      <label class="profile-field profile-setting-field">
        <span class="profile-field-label">${esc(field.label || field.key)}</span>
        <select data-setting-key="${esc(field.key)}" data-setting-type="${esc(type)}">
          ${options.map(([optionValue, optionLabel]) => `
            <option value="${esc(String(optionValue))}" ${String(optionValue) === String(formatted) ? "selected" : ""}>
              ${esc(String(optionLabel))}
            </option>
          `).join("")}
        </select>
        ${help}
      </label>
    `;
  }

  if (type === "boolean") {
    return `
      <label class="profile-field profile-setting-field">
        <span class="profile-field-label">${esc(field.label || field.key)}</span>
        <select data-setting-key="${esc(field.key)}" data-setting-type="${esc(type)}">
          <option value="true" ${formatted === true ? "selected" : ""}>Enabled</option>
          <option value="false" ${formatted === false ? "selected" : ""}>Disabled</option>
        </select>
        ${help}
      </label>
    `;
  }

  if (type === "hotkey_map") {
    return `
      <label class="profile-field profile-setting-field profile-setting-field--wide">
        <span class="profile-field-label">${esc(field.label || field.key)}</span>
        <textarea rows="4" data-setting-key="${esc(field.key)}" data-setting-type="${esc(type)}">${esc(String(formatted || ""))}</textarea>
        ${help}
      </label>
    `;
  }

  const inputType = type === "number" ? "number" : "text";
  const step = field.step ? `step="${esc(String(field.step))}"` : "";
  return `
    <label class="profile-field profile-setting-field ${type === "path" ? "profile-setting-field--wide" : ""}">
      <span class="profile-field-label">${esc(field.label || field.key)}</span>
      <input
        type="${esc(inputType)}"
        value="${esc(String(formatted ?? ""))}"
        data-setting-key="${esc(field.key)}"
        data-setting-type="${esc(type)}"
        ${step}
      >
      ${help}
    </label>
  `;
}

function _handleSearch(event) {
  _search = String(event.target.value || "").trim().toLowerCase();
  _renderProjectList();
  _syncRuntimeState();
}

async function _handleClick(event) {
  const filterBtn = event.target.closest("[data-filter]");
  if (filterBtn) {
    _filter = filterBtn.dataset.filter || "all";
    _container?.querySelectorAll("[data-filter]").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.filter === _filter);
    });
    _renderProjectList();
    _syncRuntimeState();
    return;
  }

  const refreshBtn = event.target.closest("[data-profiles-refresh]");
  if (refreshBtn) {
    await _loadData();
    toast.info("Profile control deck refreshed");
    return;
  }

  const hubActionBtn = event.target.closest("[data-run-hub-action]");
  if (hubActionBtn) {
    const actionId = hubActionBtn.dataset.runHubAction;
    try {
      await api.runHubAction(actionId);
      toast.success(`${displayName(actionId)} ran`);
    } catch (error) {
      toast.error(error.message);
    }
    return;
  }

  const openBtn = event.target.closest("[data-open-project-page]");
  if (openBtn) {
    window.location.hash = `#projects/${openBtn.dataset.openProjectPage}`;
    return;
  }

  const runtimeBtn = event.target.closest("[data-run-project-action]");
  if (runtimeBtn) {
    const project = runtimeBtn.dataset.runProjectAction;
    const action = runtimeBtn.dataset.projectActionKey;
    try {
      await api.runProjectAction(project, action);
      toast.success(`${displayName(project)}: ${displayName(action)}`);
    } catch (error) {
      toast.error(error.message);
    }
    return;
  }

  const profileSaveBtn = event.target.closest("[data-profile-save]");
  if (profileSaveBtn) {
    await _saveProfile(profileSaveBtn.closest("[data-project][data-profile]"));
    return;
  }

  const triggerJumpBtn = event.target.closest("[data-profile-trigger-jump]");
  if (triggerJumpBtn) {
    const [projectKey, profileName] = String(triggerJumpBtn.dataset.profileTriggerJump || "").split("::");
    _openProfileTriggerDrawer(projectKey, profileName);
    return;
  }

  const settingsSaveBtn = event.target.closest("[data-settings-save]");
  if (settingsSaveBtn) {
    await _saveProjectSettings(settingsSaveBtn.closest("[data-project-settings]"));
  }
}

async function _saveProfile(panel) {
  if (!panel) return;

  const project = panel.dataset.project;
  const profile = panel.dataset.profile;
  const payload = {
    project,
    profile,
    trigger_sequences: panel.querySelector(".profile-trigger-input")?.value.trim() || "",
    hotkeys: _parseHotkeys(panel.querySelector(".profile-hotkeys-input")?.value || ""),
    interface_hotkeys: _parseInterfaceHotkeys(panel.querySelector(".profile-interface-input")?.value || ""),
    project_volume_db: Number(panel.querySelector(".profile-project-volume-input")?.value || 0),
    profile_volume_db: Number(panel.querySelector(".profile-volume-input")?.value || 0),
  };

  try {
    await api.saveEditorProfile(payload);
    _updateLocalProfile(project, profile, payload);
    toast.success(`${displayName(project)} / ${profile} saved`);
  } catch (error) {
    toast.error(error.message);
  }
}

async function _saveProjectSettings(panel) {
  if (!panel) return;

  const project = panel.dataset.projectSettings;
  const settings = {};
  panel.querySelectorAll("[data-setting-key]").forEach(input => {
    settings[input.dataset.settingKey] = _readSettingInput(input);
  });

  try {
    await api.saveEditorProjectSettings({ project, settings });
    _updateLocalProjectSettings(project, settings);
    toast.success(`${displayName(project)} defaults saved`);
  } catch (error) {
    toast.error(error.message);
  }
}

function _updateLocalProfile(projectKey, profileName, payload) {
  const project = _projects.find(item => item.key === projectKey);
  const profile = project?.profiles?.find(item => item.name === profileName);
  if (!profile) return;

  profile.trigger_sequences = payload.trigger_sequences;
  profile.hotkey_map = payload.hotkeys;
  profile.hotkeys = Object.keys(payload.hotkeys).sort();
  profile.hotkey_count = Object.keys(payload.hotkeys).length;
  profile.interface_hotkeys = payload.interface_hotkeys;
  profile.project_volume_db = payload.project_volume_db;
  profile.profile_volume_db = payload.profile_volume_db;
  _renderSummary();
  _renderProjectList();
  _syncRuntimeState();
}

function _updateLocalProjectSettings(projectKey, settings) {
  const project = _projects.find(item => item.key === projectKey);
  if (!project?.settings?.current) return;
  project.settings.current = { ...project.settings.current, ...settings };
  _renderProjectList();
  _syncRuntimeState();
}

function _openProfileTriggerDrawer(projectKey, profileName) {
  if (!_container || !projectKey || !profileName) return;
  const panel = _container.querySelector(`[data-project="${CSS.escape(projectKey)}"][data-profile="${CSS.escape(profileName)}"]`);
  if (!panel) return;
  const drawer = panel.querySelector(".profile-trigger-drawer");
  if (drawer) drawer.open = true;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function _syncRuntimeState() {
  if (!_container) return;

  _container.querySelectorAll("[data-runtime-project]").forEach(card => {
    const project = card.dataset.runtimeProject;
    const status = state.getProject(project);
    const localProject = _projects.find(item => item.key === project);
    const liveProfile = _liveProfile(localProject);
    const scenes = status?.controlled_scenes?.length
      ? status.controlled_scenes.join(" / ")
      : localProject?.settings?.current?.scene || "No runtime scenes";
    const runtimeVolume = _runtimeVolumeText(status, liveProfile);

    card.classList.toggle("is-active", Boolean(status?.is_active));

    const dot = card.querySelector("[data-runtime-dot]");
    if (dot) {
      dot.classList.toggle("is-active", Boolean(status?.is_active));
    }

    const badge = card.querySelector("[data-runtime-badge]");
    if (badge) {
      badge.className = `badge ${status?.is_active ? "badge-active" : "badge-idle"}`;
      badge.textContent = status?.is_active ? "active" : "idle";
    }

    const activity = card.querySelector("[data-runtime-activity]");
    if (activity) activity.textContent = status?.current_activity || "Standing by";

    const scenesEl = card.querySelector("[data-runtime-scenes]");
    if (scenesEl) scenesEl.textContent = scenes;

    const volumeEl = card.querySelector("[data-runtime-volume]");
    if (volumeEl) volumeEl.textContent = runtimeVolume;

    const profileEl = card.querySelector("[data-runtime-live-profile]");
    if (profileEl) profileEl.textContent = liveProfile?.name || status?.volume?.profile || "runtime";

    const subtitle = card.querySelector(".profile-project-subtitle");
    if (subtitle) subtitle.textContent = scenes;
  });
}

function _matchesProject(project, search, filter) {
  const status = state.getProject(project.key);
  const haystack = [
    project.key,
    project.name,
    project.path,
    status?.controlled_scenes?.join(" "),
    ...(project.profiles || []).map(profile => profile.name),
    ...(project.profiles || []).flatMap(profile => Object.keys(profile.hotkey_map || {})),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (search && !haystack.includes(search)) {
    return false;
  }

  if (filter === "editable") return _hasEditableProfiles(project);
  if (filter === "audio") return Boolean(status?.produces_audio);
  if (filter === "needs_setup") return _needsSetup(project);
  if (filter === "runtime") return !_hasEditableProfiles(project);

  return true;
}

function _hasEditableProfiles(project) {
  return (project.profiles || []).some(profile => !profile.readonly);
}

function _needsSetup(project) {
  return (project.profiles || []).some(profile => !profile.readonly && Number(profile.hotkey_count || 0) === 0);
}

function _liveProfile(project) {
  return (project?.profiles || []).find(profile => profile.live) || project?.profiles?.[0] || null;
}

function _runtimeVolumeText(status, liveProfile) {
  const runtimeVolume = status?.volume || {};
  const projectDb = _numberOr(runtimeVolume.project_volume_db, liveProfile?.project_volume_db);
  const profileDb = _numberOr(runtimeVolume.profile_volume_db, liveProfile?.profile_volume_db);

  if (projectDb === null && profileDb === null) {
    return "No live mix data";
  }

  return `Project ${_formatDb(projectDb || 0)} / Profile ${_formatDb(profileDb || 0)}`;
}

function _settingValueForInput(type, value) {
  if (type === "boolean") {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return Boolean(value);
  }
  if (type === "hotkey_map") return _formatInterfaceHotkeys(value || {}, []);
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return value ?? "";
}

function _readSettingInput(input) {
  const type = input.dataset.settingType || "text";
  const raw = input.value;

  if (type === "boolean") return raw === "true";
  if (type === "number") return raw.trim() === "" ? "" : Number(raw);
  if (type === "hotkey_map") return _parseInterfaceHotkeys(raw);

  return raw;
}

function _formatHotkeys(map) {
  return Object.entries(map || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key} = ${Array.isArray(value) ? value.join(" | ") : value}`)
    .join("\n");
}

function _formatInterfaceHotkeys(map, interfaceActions) {
  const labels = new Map((interfaceActions || []).map(action => [action.key, action.label]));
  return Object.entries(map || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      const label = labels.get(key);
      return label ? `${key} = ${value}    # ${label}` : `${key} = ${value}`;
    })
    .join("\n");
}

function _parseHotkeys(text) {
  const output = {};
  String(text || "")
    .split(/\r?\n|;/)
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      const [rawKey, ...rest] = line.split("=");
      const key = String(rawKey || "").trim();
      const value = rest.join("=").split("#")[0].trim();
      if (!key || !value) return;
      const stems = value.split("|").map(item => item.trim()).filter(Boolean);
      if (stems.length === 1) output[key] = stems[0];
      if (stems.length > 1) output[key] = stems;
    });
  return output;
}

function _parseInterfaceHotkeys(text) {
  const output = {};
  String(text || "")
    .split(/\r?\n|;/)
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      const [rawKey, ...rest] = line.split("=");
      const key = String(rawKey || "").trim();
      const value = rest.join("=").split("#")[0].trim();
      if (!key) return;
      output[key] = value;
    });
  return output;
}

function _previewHotkeys(map) {
  const entries = Object.entries(map || {});
  if (!entries.length) return "";

  return entries.slice(0, 10).map(([key, value]) => {
    const count = Array.isArray(value) ? value.length : 1;
    return `<span class="profile-key-chip"><strong>${esc(key)}</strong><span>${esc(count === 1 ? "1 item" : `${count} items`)}</span></span>`;
  }).join("");
}

function _actionButtonClass(action) {
  return action === "stop" || action === "revert" || String(action).includes("abort")
    ? "btn-danger"
    : "btn-secondary";
}

function _formatTriggerSummary(value) {
  const text = String(value || "").trim();
  return text ? `Trigger: ${text}` : "No trigger sequence";
}

function _triggerChipLabel(value) {
  const text = String(value || "").trim();
  return text || "Set trigger";
}

function _formatDb(value) {
  const number = Number(value || 0);
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(1)} dB`;
}

function _numberOr(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}
