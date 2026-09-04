// pages/instant-replay.js — Instant Replay project page

import { api }     from "../api.js";
import { state }   from "../state.js";
import { toast }   from "../toast.js";
import { esc }     from "../utils.js";

let _unwatch = null;
let _refreshTimer = null;
let _clips = [];
let _query = "";
let _scope = "all";

export function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Instant Replay</div>
        <div class="page-subtitle">Automatic kill-highlight replay buffer with coordinated audio resume</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" id="irRandomBtn">Play Random</button>
        <button class="btn btn-secondary btn-sm" id="irLatestBtn">Play Latest</button>
        <button class="btn btn-secondary btn-sm" id="irPauseBtn">Pause</button>
        <button class="btn btn-secondary btn-sm" id="irResumeBtn">Resume</button>
        <button class="btn btn-secondary btn-sm" id="irRevertBtn">Revert</button>
      </div>
    </div>

    <div class="state-banner" id="irBanner">
      <span class="state-indicator state-indicator--idle" id="irIndicator"></span>
      <span class="state-label" id="irLabel">Loading…</span>
      <span class="state-detail" id="irDetail"></span>
    </div>

    <div class="command-strip mt-16">
      <div><span class="command-label">Voice key</span><kbd>|</kbd></div>
      <div><span class="command-label">Save</span><code>save [tag]</code></div>
      <div><span class="command-label">Play</span><code>play last / random / highlights</code></div>
      <div><span class="command-label">Pick one</span><code>play win 2</code></div>
    </div>

    <div class="card mt-16">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>Saved Clips</span>
        <button class="btn btn-secondary btn-sm" id="irRefreshClipsBtn">Refresh</button>
      </div>
      <div class="clip-toolbar">
        <input class="input" id="irClipSearch" type="search" placeholder="Search clip name, tag, or date">
        <select class="select" id="irClipScope" aria-label="Filter clips">
          <option value="all">All clips</option>
          <option value="current game">Current game</option>
          <option value="previous game">Previous game</option>
          <option value="saved">Saved</option>
          <option value="highlight reel">Highlight reels</option>
        </select>
      </div>
      <div id="irClips" class="ir-copy ir-copy--small">Loading clips…</div>
    </div>
  `;

  container.querySelector("#irPauseBtn").addEventListener("click", async () => {
    try { await api.pauseProject("instant_replay"); toast.success("Replay paused"); }
    catch(e) { toast.error(e.message); }
  });

  container.querySelector("#irResumeBtn").addEventListener("click", async () => {
    try { await api.resumeProject("instant_replay"); toast.success("Replay resumed"); }
    catch(e) { toast.error(e.message); }
  });

  container.querySelector("#irRevertBtn").addEventListener("click", async () => {
    try { await api.revertProject("instant_replay"); toast.success("Reverted"); }
    catch(e) { toast.error(e.message); }
  });

  container.querySelector("#irRandomBtn").addEventListener("click", () => _runReplayAction("play_random", "Playing a random clip"));
  container.querySelector("#irLatestBtn").addEventListener("click", () => _runReplayAction("play_latest", "Playing the latest clip"));
  container.querySelector("#irClipSearch").addEventListener("input", event => {
    _query = event.target.value.trim().toLowerCase();
    _renderClips();
  });
  container.querySelector("#irClipScope").addEventListener("change", event => {
    _scope = event.target.value;
    _renderClips();
  });

  container.querySelector("#irRefreshClipsBtn").addEventListener("click", _loadClips);
  _loadClips();
  _refreshTimer = setInterval(_loadClips, 5000);

  _unwatch = state.watch("projects", _update);
  _update(state.get("projects"));
}

export function unmount() {
  if (_unwatch) { _unwatch(); _unwatch = null; }
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
}

async function _loadClips() {
  const target = document.getElementById("irClips");
  if (!target) return;
  try {
    const data = await api.getReplayClips();
    _clips = Array.isArray(data.clips) ? data.clips : [];
    _renderClips();
  } catch (error) {
    target.textContent = `Could not load clips: ${error.message}`;
  }
}

function _renderClips() {
  const target = document.getElementById("irClips");
  if (!target) return;
  const visible = _clips.filter(clip => {
    if (_scope !== "all" && clip.scope !== _scope) return false;
    if (!_query) return true;
    const saved = new Date((clip.saved_at || 0) * 1000).toLocaleString();
    return `${clip.name || ""} ${clip.tag || ""} ${clip.scope || ""} ${saved}`.toLowerCase().includes(_query);
  });
  if (!visible.length) {
    target.innerHTML = _clips.length ? "No clips match this filter." : "No saved replay clips found.";
    return;
  }
  target.innerHTML = `
      <div style="overflow:auto">
        <table class="clip-table">
          <thead><tr><th>Saved</th><th>Clip</th><th>Type</th><th class="align-right">Size</th><th></th></tr></thead>
          <tbody>${visible.map(clip => {
            const index = _clips.indexOf(clip);
            return `
            <tr>
              <td class="clip-date">${esc(new Date((clip.saved_at || 0) * 1000).toLocaleString())}</td>
              <td><strong>${esc(clip.name || "Unnamed")}</strong>${clip.tag ? `<br><span class="clip-tag">${esc(clip.tag)}</span>` : ""}</td>
              <td><span class="clip-scope">${esc(clip.scope || "saved")}</span></td>
              <td class="align-right clip-size">${_formatBytes(clip.size_bytes || 0)}</td>
              <td class="align-right"><button class="btn btn-secondary btn-sm" data-play-clip="${index}">Play</button></td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>`;
  target.querySelectorAll("[data-play-clip]").forEach(button => {
    button.addEventListener("click", async () => {
      const clip = _clips[Number(button.dataset.playClip)];
      if (!clip) return;
      try {
        await api.playReplayClip(clip.path);
        toast.success(`Playing ${clip.name}`);
      } catch (error) {
        toast.error(error.message);
      }
    });
  });
}

async function _runReplayAction(action, message) {
  try {
    await api.runProjectAction("instant_replay", action);
    toast.success(message);
  } catch (error) {
    toast.error(error.message);
  }
}

function _formatBytes(value) {
  const mb = Number(value || 0) / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

function _update(projects) {
  const p         = projects.find(p => p.name === "instant_replay");
  const indicator = document.getElementById("irIndicator");
  const label     = document.getElementById("irLabel");
  const detail    = document.getElementById("irDetail");
  const pauseBtn  = document.getElementById("irPauseBtn");
  const resumeBtn = document.getElementById("irResumeBtn");
  const revertBtn = document.getElementById("irRevertBtn");
  if (!indicator) return;

  if (!p) {
    indicator.className = "state-indicator state-indicator--idle";
    label.textContent = "Not running";
    detail.textContent = "";
    if (pauseBtn) pauseBtn.disabled = true;
    if (resumeBtn) resumeBtn.disabled = true;
    if (revertBtn) revertBtn.disabled = true;
    return;
  }

  const activity = p.current_activity || "";
  const isActive = !!p.is_active;
  const isPaused = activity.toLowerCase().includes("paused");

  indicator.className = `state-indicator ${isActive ? "state-indicator--active" : "state-indicator--idle"}`;
  label.textContent = isPaused ? "Paused" : (isActive ? "Active" : "Idle");
  detail.textContent = activity;

  if (pauseBtn) pauseBtn.disabled = !isActive || isPaused;
  if (resumeBtn) resumeBtn.disabled = !isPaused;
  if (revertBtn) revertBtn.disabled = !isActive;
}
