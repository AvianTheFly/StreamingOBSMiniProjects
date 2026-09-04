// pages/project-generic.js - Generic fallback for projects without a custom page

import { api } from "../api.js";
import { state } from "../state.js";
import { toast } from "../toast.js";
import { esc, displayName } from "../utils.js";
import { mountProjectHotkeyPanel, unmountProjectHotkeyPanel } from "../project-hotkeys.js";

let _unwatch = null;
let _name = "";
let _hotkeyHost = null;

export function mount(container, projectName) {
  _name = projectName;
  const display = displayName(projectName);
  const proj = state.getProject(projectName);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">${esc(display)}</div>
        <div class="page-subtitle">${esc(proj?.controlled_scenes?.join(", ") || "Mini project")}</div>
      </div>
      <div class="page-actions">
        ${_actionButtons(proj, true)}
      </div>
    </div>

    <div class="state-banner" id="genBanner">
      <span class="state-indicator state-indicator--idle" id="genIndicator"></span>
      <span class="state-label" id="genLabel">Loading...</span>
      <span class="state-detail" id="genDetail"></span>
    </div>

    <div class="card mt-16">
      <div class="card-title">Project info</div>
      <div id="genInfo" style="font-size:13px;color:var(--muted);line-height:1.8"></div>
    </div>

    <div id="genHotkeys" class="mt-16"></div>
  `;

  _hotkeyHost = container.querySelector("#genHotkeys");
  if (_hotkeyHost) {
    mountProjectHotkeyPanel(_hotkeyHost, projectName).catch(error => {
      toast.error(`Could not load project hotkeys: ${error.message}`);
    });
  }

  container.querySelectorAll("[data-project-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await api.runProjectAction(_name, btn.dataset.projectAction);
        toast.info(`${display}: ${btn.dataset.projectAction}`);
      } catch (error) {
        toast.error(error.message);
      }
    });
  });

  _unwatch = state.watch("projects", _update);
  _update(state.get("projects"));
}

function _actionButtons(project, small = false) {
  const actions = Array.isArray(project?.actions) && project.actions.length
    ? project.actions
    : [
      { key: "pause", label: "Pause" },
      { key: "resume", label: "Resume" },
      ...(project?.can_revert ? [{ key: "revert", label: "Revert" }] : []),
    ];
  return actions.map(action => `
    <button class="btn ${action.key === "revert" || action.key === "stop" || action.key.includes("abort") ? "btn-danger" : "btn-secondary"}${small ? " btn-sm" : ""}"
      data-project-action="${esc(action.key)}" title="${esc(action.description || "")}">
      ${esc(action.label || action.key)}
    </button>
  `).join("");
}

export function unmount() {
  unmountProjectHotkeyPanel();
  _hotkeyHost = null;
  if (_unwatch) { _unwatch(); _unwatch = null; }
}

function _update(projects) {
  const p = projects.find(project => project.name === _name);
  const indicator = document.getElementById("genIndicator");
  const label = document.getElementById("genLabel");
  const detail = document.getElementById("genDetail");
  const info = document.getElementById("genInfo");
  if (!indicator) return;

  if (!p) {
    indicator.className = "state-indicator state-indicator--idle";
    label.textContent = "Not registered";
    return;
  }

  indicator.className = `state-indicator ${p.is_active ? "state-indicator--active" : "state-indicator--idle"}`;
  label.textContent = p.is_active ? "Active" : "Idle";
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