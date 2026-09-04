// pages/dashboard.js — Hub overview: all project cards + live event log

import { api }                  from "../api.js";
import { state }                from "../state.js";
import { toast }                from "../toast.js";
import { displayName, esc, timestamp } from "../utils.js";

let _unwatch = null;
let _logEl   = null;
let _guideEl = null;
let _profileProjects = [];
const MAX_LOG = 80;

const ACCESS_GUIDE = {
  specific_song: { group: "Audio", label: "Music", hotkey: "ili", voice: "song name · random · next · stop", note: "One shared OBS source; volume follows the latest OBS or Hub change." },
  soundboard: { group: "Audio + Visual", label: "Soundboard", hotkey: "/ *", voice: "effect name · random · next · stop", note: "Shared filters stay on the OBS source." },
  sound_effects: { group: "Audio", label: "Sound Effects", hotkey: "voice / assigned keys", voice: "effect name", note: "Also receives automatic League cues." },
  instant_replay: { group: "Replay", label: "Instant Replay", hotkey: "|", voice: "save [tag] · mark · play last/random/highlights", note: "Search and play individual clips from its page." },
  scene_voice_switcher: { group: "Scenes", label: "Scene Voice Switcher", hotkey: "voice", voice: "lobby or scene name", note: "Shows the matching lobby or scene source." },
  league: { group: "Automatic", label: "League", hotkey: "automatic", voice: "game events", note: "Watches the live League client and triggers overlays/audio." },
  tik_tok: { group: "Audio + Visual", label: "TikTok", hotkey: "assigned keys", voice: "asset name · random · next · stop", note: "Short-form media playback." },
  love_me: { group: "Sequence", label: "Love Me", hotkey: "987", voice: "—", note: "Runs the configured scene/audio sequence." },
};

export async function mount(container) {
  container.innerHTML = `
    <div class="page-header dashboard-hero">
      <div>
        <div class="dashboard-kicker">Personal stream controls</div>
        <div class="page-title">Stream Control Hub</div>
        <div class="page-subtitle">What you can trigger, what is running, and where to change it.</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" id="randomReplayBtn">Random replay</button>
        <button class="btn btn-secondary btn-sm" id="openAudioBtn">Audio levels</button>
        <button class="btn btn-secondary btn-sm" id="revertAllBtn">Revert all</button>
      </div>
    </div>

    <div id="commandGuide" class="command-guide"></div>

    <div class="section-heading">
      <div><div class="section-eyebrow">Live modules</div><div class="section-title">Current status</div></div>
      <span class="section-note">Open a module for its full controls</span>
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
  _guideEl = container.querySelector("#commandGuide");

  container.querySelector("#revertAllBtn").addEventListener("click", _revertAll);
  container.querySelector("#openAudioBtn").addEventListener("click", () => { window.location.hash = "#audio"; });
  container.querySelector("#randomReplayBtn").addEventListener("click", async () => {
    try {
      await api.runProjectAction("instant_replay", "play_random");
      toast.success("Playing a random replay");
    } catch (error) {
      toast.error(error.message);
    }
  });
  container.querySelector("#clearLogBtn").addEventListener("click", () => {
    if (_logEl) _logEl.innerHTML = "";
  });

  // Initial render
  _renderGrid(state.get("projects"));
  _renderGuide(state.get("projects"));

  try {
    const data = await api.getEditorProfiles();
    _profileProjects = Array.isArray(data.projects) ? data.projects : [];
    _renderGuide(state.get("projects"));
  } catch {}

  // Reactive updates
  _unwatch = state.watch("projects", projects => {
    _renderGrid(projects);
    _renderGuide(projects);
  });
}

export function unmount() {
  if (_unwatch) { _unwatch(); _unwatch = null; }
  _logEl = null;
  _guideEl = null;
  _profileProjects = [];
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

function _renderGuide(projects) {
  if (!_guideEl) return;
  const ordered = [...projects].sort((a, b) => {
    const ag = ACCESS_GUIDE[a.name]?.group || "Other";
    const bg = ACCESS_GUIDE[b.name]?.group || "Other";
    return ag.localeCompare(bg) || displayName(a.name).localeCompare(displayName(b.name));
  });
  _guideEl.innerHTML = ordered.map(project => {
    const guide = ACCESS_GUIDE[project.name] || {
      group: "Module",
      label: displayName(project.name),
      hotkey: "Open module",
      voice: "See module settings",
      note: "",
    };
    const profileProject = _profileProjects.find(item => item.key === project.name);
    const liveProfile = profileProject?.profiles?.find(profile => profile.live) || profileProject?.profiles?.[0];
    const configuredTrigger = String(liveProfile?.trigger_sequences || "").trim();
    const hotkeyCount = Number(liveProfile?.hotkey_count || 0);
    const trigger = configuredTrigger || guide.hotkey;
    return `
      <a class="command-card ${project.is_active ? "is-live" : ""}" href="#projects/${esc(project.name)}">
        <div class="command-card-top">
          <span class="command-group">${esc(guide.group)}</span>
          <span class="command-state"><i></i>${project.is_active ? "active" : "ready"}</span>
        </div>
        <strong>${esc(guide.label)}</strong>
        <div class="command-trigger"><span>Trigger</span><kbd>${esc(trigger)}</kbd>${hotkeyCount ? `<small>+ ${hotkeyCount} assigned</small>` : ""}</div>
        <div class="command-voice"><span>Say</span>${esc(guide.voice)}</div>
        <p>${esc(guide.note)}</p>
      </a>`;
  }).join("");
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
