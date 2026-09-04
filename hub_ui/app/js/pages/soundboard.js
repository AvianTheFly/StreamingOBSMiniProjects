// pages/soundboard.js - Soundboard / TikTok project page (shared layout)

import { api } from "../api.js";
import { state } from "../state.js";
import { toast } from "../toast.js";
import { esc, displayName } from "../utils.js";
import { mountProjectHotkeyPanel, unmountProjectHotkeyPanel } from "../project-hotkeys.js";

let _unwatch = null;
let _projectName = "soundboard";
let _hotkeyHost = null;

export function setProject(name) { _projectName = name; }

export function mount(container, projectName) {
  if (projectName) _projectName = projectName;
  const proj = state.getProject(_projectName);
  const display = displayName(_projectName);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">${esc(display)}</div>
        <div class="page-subtitle">High-level controls for voice, hotkeys, playback, and OBS routing</div>
      </div>
      <div class="page-actions">
        <a href="/editor" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Open Editor</a>
        <a href="#profiles" class="btn btn-secondary btn-sm">Profiles</a>
        ${proj?.can_revert ? `<button class="btn btn-danger btn-sm" data-project-action="revert">Revert</button>` : ""}
      </div>
    </div>
    <div class="state-banner" id="sbBanner">
      <span class="state-indicator state-indicator--idle" id="sbIndicator"></span>
      <span class="state-label" id="sbLabel">Loading...</span>
      <span class="state-detail" id="sbDetail"></span>
    </div>
    <div class="project-control-grid">
      <div class="card project-command-card"><div class="card-title">Live Controls</div><div class="project-command-grid" id="sbActionGrid">${_actionButtons(proj)}</div></div>
      <div class="card project-summary-card"><div class="card-title">Routing</div><div class="project-summary-list"><div><span>Scene</span><strong id="sbScenes">${esc(proj?.controlled_scenes?.join(", ") || "Not reported")}</strong></div><div><span>Audio</span><strong id="sbAudio">${proj?.produces_audio ? "Enabled" : "Not reported"}</strong></div><div><span>Volume</span><strong id="sbVolume">Not reported</strong></div><div><span>Activity</span><strong id="sbActivity">Idle</strong></div></div><div class="project-link-row"><a href="/editor" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Hotkeys and OBS Canvas</a><a href="#profiles" class="btn btn-secondary btn-sm">Profile Triggers</a></div></div>
    </div>
    <div id="sbHotkeys" class="mt-16"></div>
  `;

  _hotkeyHost = container.querySelector("#sbHotkeys");
  if (_hotkeyHost) {
    mountProjectHotkeyPanel(_hotkeyHost, _projectName).catch(error => toast.error(`Could not load project hotkeys: ${error.message}`));
  }

  container.querySelectorAll("[data-project-action]").forEach(btn => {
    btn.addEventListener("click", () => _runAction(btn.dataset.projectAction));
  });

  _unwatch = state.watch("projects", _update);
  _update(state.get("projects"));
}

export function unmount() {
  unmountProjectHotkeyPanel();
  _hotkeyHost = null;
  if (_unwatch) { _unwatch(); _unwatch = null; }
}

function _update(projects) {
  const p = projects.find(project => project.name === _projectName);
  const indicator = document.getElementById("sbIndicator");
  const label = document.getElementById("sbLabel");
  const detail = document.getElementById("sbDetail");
  const scenes = document.getElementById("sbScenes");
  const audio = document.getElementById("sbAudio");
  const volume = document.getElementById("sbVolume");
  const activity = document.getElementById("sbActivity");
  const actionGrid = document.getElementById("sbActionGrid");
  if (!indicator) return;
  if (!p) {
    indicator.className = "state-indicator state-indicator--idle";
    label.textContent = "Not running";
    detail.textContent = "";
    return;
  }
  indicator.className = `state-indicator ${p.is_active ? "state-indicator--active" : "state-indicator--idle"}`;
  label.textContent = p.is_active ? "Active" : "Idle";
  detail.textContent = p.current_activity ? `- ${p.current_activity}` : "";
  if (scenes) scenes.textContent = p.controlled_scenes?.join(", ") || "Not reported";
  if (audio) audio.textContent = p.produces_audio ? "Enabled" : "Not reported";
  if (activity) activity.textContent = p.current_activity || "Idle";
  if (volume) {
    const v = p.volume || {};
    volume.textContent = Number.isFinite(Number(v.project_volume_db)) ? `Project ${Number(v.project_volume_db).toFixed(1)} dB / Profile ${Number(v.profile_volume_db || 0).toFixed(1)} dB` : "Not reported";
  }
  if (actionGrid) {
    actionGrid.innerHTML = _actionButtons(p);
    actionGrid.querySelectorAll("[data-project-action]").forEach(btn => btn.addEventListener("click", () => _runAction(btn.dataset.projectAction)));
  }
}

function _actionButtons(project) {
  const actions = Array.isArray(project?.actions) && project.actions.length ? project.actions : [{ key: "start_listen", label: "Start Listen" }, { key: "abort_listen", label: "Abort Listen" }, { key: "stop", label: "Stop" }, { key: "pause", label: "Pause" }, { key: "resume", label: "Resume" }, ...(project?.can_revert ? [{ key: "revert", label: "Revert" }] : [])];
  return actions.map(action => `<button class="btn ${action.key === "stop" || action.key === "revert" || action.key.includes("abort") ? "btn-danger" : "btn-secondary"}" data-project-action="${esc(action.key)}" title="${esc(action.description || "")}">${esc(action.label || action.key)}</button>`).join("");
}

async function _runAction(action) {
  try {
    await api.runProjectAction(_projectName, action);
    toast.success(`${displayName(_projectName)}: ${action}`);
  } catch (error) {
    toast.error(error.message);
  }
}