// pages/project-generic.js - Generic fallback for projects without a custom page

import { api } from "../api.js";
import { state } from "../state.js";
import { toast } from "../toast.js";
import { esc } from "../utils.js";
import { feature, icon } from '../catalog.js';
import { runWithFeedback } from '../action-feedback.js';
import { mountProjectHotkeyPanel, unmountProjectHotkeyPanel } from "../project-hotkeys.js";

let _unwatch = null;
let _name = "";
let _hotkeyHost = null;
let _unwatchConnected = null;

export function mount(container, projectName) {
  _name = projectName;
  const display = feature(projectName);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${esc(display.label)}</h1>
        <p class="page-subtitle">${esc(display.description)}</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-secondary" href="/editor" target="_blank" rel="noopener">${icon('keyboard')}Open media editor</a>
      </div>
    </div>

    <div class="state-banner" id="genBanner">
      <span class="state-indicator state-indicator--idle" id="genIndicator"></span>
      <span class="state-label" id="genLabel">Loading...</span>
      <span class="state-detail" id="genDetail"></span>
    </div>

    <section class="card mt-16"><h2 class="card-title">Controls</h2><div class="mood-actions" id="genActions"></div></section>

    <details class="feature-disclosure"><summary>Hotkeys &amp; profiles <span>Keys, phrases and saved triggers</span></summary><div id="genHotkeys" class="mt-16"></div></details>
    <details class="feature-disclosure"><summary>Feature details <span>Scenes and technical information</span></summary><div class="card mt-16">
      <div id="genInfo" style="font-size:13px;color:var(--muted);line-height:1.8"></div>
    </div></details>
  `;

  _hotkeyHost = container.querySelector("#genHotkeys");
  const hotkeyHost = _hotkeyHost;
  let hotkeysLoaded = false;
  container.querySelector('.feature-disclosure').addEventListener('toggle', event => {
    if (!event.target.open || hotkeysLoaded || !hotkeyHost.isConnected) return;
    hotkeysLoaded = true;
    mountProjectHotkeyPanel(hotkeyHost, projectName).catch(error => toast.error(`Could not load hotkeys: ${error.message}`));
  });
  container.querySelector('#genActions').addEventListener('click', event => {
    const button = event.target.closest('[data-project-action]');
    if (!button || button.disabled) return;
    runWithFeedback(button, () => api.runProjectAction(projectName, button.dataset.projectAction), `${display.label}: control applied`);
  });

  _unwatch = state.watch("projects", _update);
  _unwatchConnected = state.watch('connected', () => _update(state.get('projects')));
  _update(state.get("projects"));
}

function _actionButtons(project, small = false) {
  const actions = Array.isArray(project?.actions) ? project.actions : project ? [
      { key: "pause", label: "Pause" },
      { key: "resume", label: "Resume" },
      ...(project?.can_revert ? [{ key: "revert", label: "Revert" }] : []),
    ] : [];
  return actions.map(action => `
    <button class="btn ${action.key === "revert" || action.key === "stop" || action.key.includes("abort") ? "btn-danger" : "btn-secondary"}${small ? " btn-sm" : ""}"
      data-project-action="${esc(action.key)}" title="${esc(action.description || "")}">
      ${esc(action.key === 'revert' && action.label === 'Revert' ? 'Stop & clear' : action.label || action.key)}
    </button>
  `).join("");
}

export function unmount() {
  unmountProjectHotkeyPanel();
  _hotkeyHost = null;
  if (_unwatch) { _unwatch(); _unwatch = null; }
  _unwatchConnected?.(); _unwatchConnected = null;
}

function _update(projects) {
  const p = projects.find(project => project.name === _name);
  const indicator = document.getElementById("genIndicator");
  const label = document.getElementById("genLabel");
  const detail = document.getElementById("genDetail");
  const info = document.getElementById("genInfo");
  if (!indicator) return;
  const controls = document.getElementById('genActions');
  const buttons = _actionButtons(p);
  if (controls.dataset.signature !== buttons) {
    controls.dataset.signature = buttons;
    controls.innerHTML = buttons || '<p class="field-help">This feature runs automatically. Its settings are available below.</p>';
  }
  controls.querySelectorAll('[data-project-action]').forEach(button => {
    button.dataset.available = String(!!p && state.get('connected'));
    if (!button.hasAttribute('aria-busy')) button.disabled = button.dataset.available === 'false';
  });

  if (!p) {
    indicator.className = "state-indicator state-indicator--idle";
    label.textContent = "Not registered";
    return;
  }

  indicator.className = `state-indicator ${p.is_active ? "state-indicator--active" : "state-indicator--idle"}`;
  label.textContent = p.is_active ? "Active" : "Ready";
  detail.textContent = p.current_activity ? `- ${p.current_activity}` : "";

  if (info) {
    info.innerHTML = `
      <div><b>Controlled scenes:</b> ${esc(p.controlled_scenes?.join(", ") || "-")}</div>
      <div><b>Produces audio:</b>    ${p.produces_audio ? "Yes" : "No"}</div>
      <div><b>Can revert:</b>        ${p.can_revert ? "Yes" : "No"}</div>
      <div><b>Current activity:</b>  ${esc(p.current_activity || "-")}</div>
    `;
  }
}
