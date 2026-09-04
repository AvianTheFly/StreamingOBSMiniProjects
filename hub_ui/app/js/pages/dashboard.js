// pages/dashboard.js — Hub overview: all project cards + live event log

import { api }                  from "../api.js";
import { state }                from "../state.js";
import { toast }                from "../toast.js";
import { displayName, esc, timestamp } from "../utils.js";

let _unwatch = null;
let _logEl   = null;
const MAX_LOG = 80;

export function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-subtitle">Live status of all running mini-projects</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="revertAllBtn">Revert all</button>
      </div>
    </div>

    <div id="projectGrid" class="project-grid"></div>

    <hr class="divider mt-24">

    <div class="page-header" style="margin-bottom:12px">
      <div class="page-title" style="font-size:15px">Live Event Log</div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="clearLogBtn">Clear</button>
      </div>
    </div>
    <div id="eventLog" class="event-log"></div>
  `;

  _logEl = container.querySelector("#eventLog");

  container.querySelector("#revertAllBtn").addEventListener("click", _revertAll);
  container.querySelector("#clearLogBtn").addEventListener("click", () => {
    if (_logEl) _logEl.innerHTML = "";
  });

  // Initial render
  _renderGrid(state.get("projects"));

  // Reactive updates
  _unwatch = state.watch("projects", _renderGrid);
}

export function unmount() {
  if (_unwatch) { _unwatch(); _unwatch = null; }
  _logEl = null;
}

// Called from app.js for every SSE event (passed as wildcard listener)
export function onEvent(type, payload) {
  if (type === "status_update") return;  // handled via state
  _appendLog(type, payload);
}

function _renderGrid(projects) {
  const grid = document.getElementById("projectGrid");
  if (!grid) return;

  if (!projects.length) {
    grid.innerHTML = `<div class="empty-state">No projects registered yet.<br>Start the hub with <code>python hub.py</code></div>`;
    return;
  }

  grid.innerHTML = "";
  projects.forEach(p => grid.appendChild(_makeCard(p)));
}

function _makeCard(p) {
  const card = document.createElement("div");
  card.className = `project-card ${p.is_active ? "is-active" : ""}`;
  card.id = `pcard-${p.name}`;

  const scenes = p.controlled_scenes?.length
    ? p.controlled_scenes.join(" · ")
    : "no scenes";

  const audioTag = p.produces_audio
    ? `<span class="badge badge-audio" title="This project outputs audio">audio</span>`
    : "";

  const actions = Array.isArray(p.actions) && p.actions.length
    ? p.actions
    : [
        { key: "pause", label: "Pause" },
        { key: "resume", label: "Resume" },
        ...(p.can_revert ? [{ key: "revert", label: "Revert" }] : []),
      ];
  const volume = p.volume || {};
  const volumeText = Number.isFinite(Number(volume.project_volume_db))
    ? `Project ${Number(volume.project_volume_db).toFixed(1)} dB - Profile ${Number(volume.profile_volume_db || 0).toFixed(1)} dB`
    : "";
  const actionButtons = actions.map(action => `
      <button class="btn ${action.key === "stop" || action.key === "revert" || action.key.includes("abort") ? "btn-danger" : "btn-secondary"} btn-sm"
        data-action="${esc(action.key)}" data-name="${esc(p.name)}" title="${esc(action.description || "")}">
        ${esc(action.label || action.key)}
      </button>
    `).join("");

  card.innerHTML = `
    <div class="project-card-header">
      <span class="project-status-dot ${p.is_active ? "project-status-dot--active" : "project-status-dot--idle"}"></span>
      <span class="project-name">${esc(displayName(p.name))}</span>
      ${p.is_active ? `<span class="badge badge-active">active</span>` : ""}
      ${audioTag}
    </div>
    <div class="project-scenes">${esc(scenes)}</div>
    <div class="project-activity">${esc(p.current_activity || "—")}</div>
    ${volumeText ? `<div class="project-volume">${esc(volumeText)}</div>` : ""}
    <div class="project-actions">
      <button class="btn btn-secondary btn-sm" data-action="open"   data-name="${esc(p.name)}">Open</button>
      ${actionButtons}
    </div>
  `;

  card.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", e => _handleCardAction(e.currentTarget));
  });

  return card;
}

function _handleCardAction(btn) {
  const { action, name } = btn.dataset;
  if (action === "open") {
    window.location.hash = `#projects/${name}`;
    return;
  }
  api.runProjectAction(name, action)
    .then(() => toast.info(`${displayName(name)}: ${action}`))
    .catch(e => toast.error(e.message));
}

async function _revertAll() {
  const projects = state.get("projects");
  for (const p of projects) {
    if (p.can_revert) {
      try { await api.revertProject(p.name); } catch {}
    }
  }
  toast.info("All projects reverted");
}

function _appendLog(type, payload) {
  if (!_logEl) return;
  const atBottom = _logEl.scrollTop + _logEl.clientHeight >= _logEl.scrollHeight - 10;

  const row = document.createElement("div");
  row.className = "event-row";
  row.innerHTML = `
    <span class="event-time">${timestamp()}</span>
    <span class="event-type">${esc(type)}</span>
    <span class="event-data">${esc(JSON.stringify(payload))}</span>
  `;
  _logEl.appendChild(row);

  // Trim old rows
  while (_logEl.children.length > MAX_LOG) {
    _logEl.removeChild(_logEl.firstChild);
  }

  if (atBottom) _logEl.scrollTop = _logEl.scrollHeight;
}
