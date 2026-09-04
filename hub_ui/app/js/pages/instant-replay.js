// pages/instant-replay.js — Instant Replay project page

import { api }     from "../api.js";
import { state }   from "../state.js";
import { toast }   from "../toast.js";
import { esc }     from "../utils.js";

let _unwatch = null;
let _refreshTimer = null;
let _clips = [];

export function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Instant Replay</div>
        <div class="page-subtitle">Automatic kill-highlight replay buffer with coordinated audio resume</div>
      </div>
      <div class="page-actions">
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

    <div class="ir-grid mt-16">
      <div class="card">
        <div class="card-title">How it works</div>
        <p class="ir-copy">
          The instant replay project monitors kill timestamps from the <em>league</em> project and
          triggers OBS's replay buffer to save a clip around each kill.
          It also has a manual hotkey to save a replay at any time.
        </p>
      </div>

      <div class="card ir-coordination-card">
        <div class="card-title">Audio Coordination</div>
        <p class="ir-copy">
          Replay playback now pauses other projects through the shared pause/resume system.
          When replay ends, projects such as <em>specific song</em> resume from their paused position
          instead of restarting from the beginning.
        </p>
        <p class="ir-copy ir-copy--small">
          Use <b>Hub Rules</b> to choose which projects should pause for replay and whether they should resume automatically.
        </p>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-title">Replay Controls</div>
      <p class="ir-copy ir-copy--small">
        <b>Pause</b> freezes the current replay clip in place.
        <b>Resume</b> continues that clip without restarting it.
        <b>Revert</b> cancels replay and returns to the normal scene.
      </p>
    </div>

    <div class="card mt-16">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>Saved Clips</span>
        <button class="btn btn-secondary btn-sm" id="irRefreshClipsBtn">Refresh</button>
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
    if (!_clips.length) {
      target.innerHTML = "No saved replay clips found.";
      return;
    }
    target.innerHTML = `
      <div style="overflow:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="text-align:left;padding:8px">Saved</th><th style="text-align:left;padding:8px">Clip</th><th style="text-align:left;padding:8px">Type</th><th style="text-align:right;padding:8px">Size</th><th></th></tr></thead>
          <tbody>${_clips.map((clip, index) => `
            <tr style="border-top:1px solid var(--border)">
              <td style="padding:8px;white-space:nowrap">${esc(new Date((clip.saved_at || 0) * 1000).toLocaleString())}</td>
              <td style="padding:8px">${esc(clip.name || "Unnamed")}${clip.tag ? `<br><span style="color:var(--muted)">Tag: ${esc(clip.tag)}</span>` : ""}</td>
              <td style="padding:8px">${esc(clip.scope || "saved")}</td>
              <td style="padding:8px;text-align:right;white-space:nowrap">${_formatBytes(clip.size_bytes || 0)}</td>
              <td style="padding:8px;text-align:right"><button class="btn btn-secondary btn-sm" data-play-clip="${index}">Play</button></td>
            </tr>`).join("")}</tbody>
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
  } catch (error) {
    target.textContent = `Could not load clips: ${error.message}`;
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
