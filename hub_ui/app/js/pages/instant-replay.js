// pages/instant-replay.js — Instant Replay project page

import { api }     from "../api.js";
import { state }   from "../state.js";
import { toast }   from "../toast.js";
import { esc }     from "../utils.js";

let _unwatch = null;

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

  _unwatch = state.watch("projects", _update);
  _update(state.get("projects"));
}

export function unmount() {
  if (_unwatch) { _unwatch(); _unwatch = null; }
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
