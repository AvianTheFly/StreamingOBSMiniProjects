// pages/league.js — League of Legends integration page

import { api }         from "../api.js";
import { state }       from "../state.js";
import { toast }       from "../toast.js";
import { esc }         from "../utils.js";

let _unwatch = null;

export function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">League of Legends</div>
        <div class="page-subtitle">Live game overlay automation via Riot Live Client API</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="leagueRevertBtn">Revert overlays</button>
      </div>
    </div>

    <div class="state-banner" id="leagueBanner">
      <span class="state-indicator state-indicator--idle" id="leagueIndicator"></span>
      <span class="state-label"  id="leagueLabel">Loading…</span>
      <span class="state-detail" id="leagueDetail"></span>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-title">Controlled overlays</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.7">
          <p>Scene: <code>LeagueGameAssets</code></p>
          <ul style="padding-left:18px;margin-top:6px">
            <li>Death / Respawn borders</li>
            <li>Level-up sprites</li>
            <li>Kill streak triangles</li>
            <li>Multi-kill overlays (Double – Penta)</li>
            <li>Map event overlays (Dragon, Baron, Herald…)</li>
            <li>Turret / Inhibitor destroyed overlays</li>
          </ul>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Cross-project integration</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.7">
          <p><b>Scene switching</b> → emits <code>game.connected</code> / <code>game.disconnected</code></p>
          <p style="margin-top:6px">→ handled by <em>scene_voice_switcher</em></p>
          <p style="margin-top:10px"><b>SFX</b> → emits <code>sfx.play</code></p>
          <p style="margin-top:6px">→ handled by <em>sound_effects</em></p>
          <p style="margin-top:10px"><b>Instant Replay</b> → writes kill timestamps</p>
          <p style="margin-top:6px">→ queried by <em>instant_replay</em></p>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-title">Recall hotkey</div>
      <p style="font-size:13px;color:var(--muted)">
        Press <kbd style="background:var(--panel-3);border:1px solid var(--line);border-radius:4px;padding:2px 7px;font-family:var(--mono)">B</kbd>
        while in-game to arm the recall detector. The respawn border appears automatically when your recall completes.
      </p>
    </div>
  `;

  container.querySelector("#leagueRevertBtn").addEventListener("click", async () => {
    try {
      await api.revertProject("league");
      toast.success("League overlays reverted");
    } catch(e) {
      toast.error(e.message);
    }
  });

  _unwatch = state.watch("projects", _update);
  _update(state.get("projects"));
}

export function unmount() {
  if (_unwatch) { _unwatch(); _unwatch = null; }
}

function _update(projects) {
  const p         = projects.find(p => p.name === "league");
  const indicator = document.getElementById("leagueIndicator");
  const label     = document.getElementById("leagueLabel");
  const detail    = document.getElementById("leagueDetail");
  if (!indicator) return;

  if (!p) {
    indicator.className = "state-indicator state-indicator--idle";
    label.textContent   = "Not running";
    detail.textContent  = "";
    return;
  }
  indicator.className = `state-indicator ${p.is_active ? "state-indicator--active" : "state-indicator--idle"}`;
  label.textContent   = p.is_active ? "Game in progress" : "No game detected";
  detail.textContent  = p.current_activity ? `— ${p.current_activity}` : "";
}
