// pages/sound-effects.js — Sound Effects project page

import { api }                  from "../api.js";
import { state }                from "../state.js";
import { toast }                from "../toast.js";
import { esc, debounce }        from "../utils.js";

let _library = [];
let _unwatch = null;

export async function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Sound Effects</div>
        <div class="page-subtitle">Hotkey + voice triggered sound effects</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="revertSfxBtn">Revert</button>
      </div>
    </div>

    <div class="state-banner" id="sfxBanner">
      <span class="state-indicator state-indicator--idle" id="sfxIndicator"></span>
      <span class="state-label" id="sfxLabel">Loading…</span>
      <span class="state-detail" id="sfxDetail"></span>
    </div>

    <div class="search-bar mb-12">
      <input id="sfxSearch" type="text" placeholder="Search effects…">
    </div>

    <div id="sfxGrid" class="sfx-grid"></div>
  `;

  container.querySelector("#revertSfxBtn").addEventListener("click", async () => {
    try { await api.revertProject("sound_effects"); toast.success("Reverted"); }
    catch(e) { toast.error(e.message); }
  });

  const search = container.querySelector("#sfxSearch");
  search.addEventListener("input", debounce(() => _filter(search.value), 150));

  _unwatch = state.watch("projects", _updateBanner);
  _updateBanner(state.get("projects"));

  await _load();
}

export function unmount() {
  if (_unwatch) { _unwatch(); _unwatch = null; }
}

function _updateBanner(projects) {
  const p         = projects.find(p => p.name === "sound_effects");
  const indicator = document.getElementById("sfxIndicator");
  const label     = document.getElementById("sfxLabel");
  const detail    = document.getElementById("sfxDetail");
  if (!indicator) return;

  if (!p) { indicator.className = "state-indicator state-indicator--idle"; label.textContent = "Not running"; detail.textContent = ""; return; }
  indicator.className = `state-indicator ${p.is_active ? "state-indicator--active" : "state-indicator--idle"}`;
  label.textContent   = p.is_active ? "Active" : "Idle";
  detail.textContent  = p.current_activity ? `— ${p.current_activity}` : "";
}

async function _load() {
  try {
    _library = await api.getSfxLibrary();
  } catch(e) {
    toast.error(`Failed to load SFX library: ${e.message}`);
    _library = [];
  }
  _renderGrid(_library);
}

function _filter(q) {
  const filtered = q.trim()
    ? _library.filter(s => s.toLowerCase().includes(q.toLowerCase()))
    : _library;
  _renderGrid(filtered);
}

function _renderGrid(items) {
  const el = document.getElementById("sfxGrid");
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">No sound effects found.</div>`;
    return;
  }

  el.innerHTML = "";
  items.forEach(stem => {
    const btn = document.createElement("button");
    btn.className = "sfx-btn";
    btn.title = stem;
    btn.textContent = stem.replace(/_/g, " ");
    btn.addEventListener("click", () => _play(stem));
    el.appendChild(btn);
  });
}

async function _play(stem) {
  try {
    await api.playSfx(stem);
  } catch(e) {
    toast.error(e.message);
  }
}
