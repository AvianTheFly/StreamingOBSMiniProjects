// pages/scene-switcher.js — Scene Voice Switcher project page

import { api }         from "../api.js";
import { state }       from "../state.js";
import { toast }       from "../toast.js";
import { esc }         from "../utils.js";

let _unwatch = null;

export async function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Scene Voice Switcher</div>
        <div class="page-subtitle">Voice-controlled lobby and game scene management</div>
      </div>
    </div>

    <div class="state-banner" id="svsBanner">
      <span class="state-indicator state-indicator--idle" id="svsIndicator"></span>
      <span class="state-label" id="svsLabel">Loading…</span>
      <span class="state-detail" id="svsDetail"></span>
    </div>

    <div class="card mb-16">
      <div class="card-title">Quick Scene Switch</div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px">
        Manually switch OBS to these scenes. Normally controlled via voice (backtick key).
      </p>
      <div class="scene-buttons" id="sceneButtons">
        <span class="spinner"></span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Hotkey</div>
      <p style="font-size:13px;color:var(--muted)">
        Press <kbd style="background:var(--panel-3);border:1px solid var(--line);border-radius:4px;padding:2px 7px;font-family:var(--mono)">\`</kbd>
        (backtick) to open the mic, then say a lobby name or "game" / "test" to switch scenes.
        Press <kbd style="background:var(--panel-3);border:1px solid var(--line);border-radius:4px;padding:2px 7px;font-family:var(--mono)">C</kbd> to send early.
      </p>
    </div>
  `;

  _unwatch = state.watch("projects", _updateBanner);
  _updateBanner(state.get("projects"));
  await _loadScenes(container);
}

export function unmount() {
  if (_unwatch) { _unwatch(); _unwatch = null; }
}

function _updateBanner(projects) {
  const p        = projects.find(p => p.name === "scene_voice_switcher");
  const indicator = document.getElementById("svsIndicator");
  const label     = document.getElementById("svsLabel");
  const detail    = document.getElementById("svsDetail");
  if (!indicator) return;

  if (!p) {
    indicator.className = "state-indicator state-indicator--idle";
    label.textContent   = "Not running";
    detail.textContent  = "";
    return;
  }

  indicator.className = `state-indicator ${p.is_active ? "state-indicator--active" : "state-indicator--idle"}`;
  label.textContent   = p.is_active ? "Active" : "Idle";
  detail.textContent  = p.current_activity ? `— ${p.current_activity}` : "";
}

async function _loadScenes(container) {
  const buttonsEl = document.getElementById("sceneButtons");
  if (!buttonsEl) return;

  try {
    const { game_scene, lobbies_scene } = await api.getLobbies();
    buttonsEl.innerHTML = `
      <button class="btn btn-secondary" data-scene="${esc(lobbies_scene)}">
        ${esc(lobbies_scene)}
      </button>
      <button class="btn btn-secondary" data-scene="${esc(game_scene)}">
        ${esc(game_scene)}
      </button>
    `;
  } catch {
    buttonsEl.innerHTML = `<span style="color:var(--soft);font-size:13px">Project not running — start the hub first.</span>`;
    return;
  }

  buttonsEl.querySelectorAll("[data-scene]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const scene = btn.dataset.scene;
      try {
        await api.switchScene(scene);
        toast.success(`Switched to ${scene}`);
      } catch(e) {
        toast.error(e.message);
      }
    });
  });
}
