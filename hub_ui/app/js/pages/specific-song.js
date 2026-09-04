// pages/specific-song.js — Music Manager

import { api }                        from "../api.js";
import { state }                      from "../state.js";
import { toast }                      from "../toast.js";
import { esc, debounce }              from "../utils.js";

// ── Category color palette ────────────────────────────────────────────────────
const CAT_COLORS = [
  ["#65c7a4", "rgba(101,199,164,.15)"],
  ["#7db8ff", "rgba(125,184,255,.15)"],
  ["#f2cc6b", "rgba(242,204,107,.15)"],
  ["#ff8f8f", "rgba(255,143,143,.15)"],
  ["#c9a4e8", "rgba(201,164,232,.15)"],
  ["#f4a261", "rgba(244,162,97,.15)"],
  ["#a4e8d4", "rgba(164,232,212,.15)"],
  ["#e8a4b4", "rgba(232,164,180,.15)"],
];

// ── Module state ─────────────────────────────────────────────────────────────
let _library    = [];
let _categories = {};
let _filter     = { cat: null, query: "" };
let _editSong   = null;
let _unwatch    = null;
let _playingSource = null;
let _isActive   = false;
let _inRandom   = false;
let _container  = null;

// ── Computed helpers ──────────────────────────────────────────────────────────
function _catList()   { return Object.keys(_categories).sort(); }
function _catColor(n) { const i = _catList().indexOf(n); return i >= 0 ? CAT_COLORS[i % CAT_COLORS.length] : CAT_COLORS[0]; }
function _songCats(id){ return _catList().filter(c => (_categories[c] || []).includes(id)); }

function _filteredSongs() {
  let songs = _library;
  if (_filter.cat === "__uncat__") {
    const catted = new Set(Object.values(_categories).flat());
    songs = songs.filter(s => !catted.has(s.id));
  } else if (_filter.cat) {
    const ids = new Set(_categories[_filter.cat] || []);
    songs = songs.filter(s => ids.has(s.id));
  }
  const q = _filter.query.toLowerCase().trim();
  if (q) songs = songs.filter(s =>
    s.name?.toLowerCase().includes(q) ||
    s.source?.toLowerCase().includes(q) ||
    (s.aliases || []).some(a => a.toLowerCase().includes(q))
  );
  return songs;
}

function _uncatCount() {
  const catted = new Set(Object.values(_categories).flat());
  return _library.filter(s => !catted.has(s.id)).length;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
export async function mount(container) {
  _container = container;
  container.classList.add("page--fullbleed");
  container.innerHTML = _shell();
  _bindTransport();
  _bindSidebar();
  _bindLibrary();
  _unwatch = state.watch("projects", projects => {
    const p = projects.find(p => p.name === "specific_song");
    _updateTransport(p);
  });
  await _load();
}

export function unmount() {
  if (_unwatch) { _unwatch(); _unwatch = null; }
  if (_container) { _container.classList.remove("page--fullbleed"); _container = null; }
  document.getElementById("ss-modal-overlay")?.remove();
}

async function _load() {
  try {
    [_library, _categories] = await Promise.all([api.getSongLibrary(), api.getSongCategories()]);
  } catch(e) {
    toast.error(`Failed to load: ${e.message}`);
    _library = []; _categories = {};
  }
  _filter.cat = null; _filter.query = "";
  document.getElementById("ss-search") && (document.getElementById("ss-search").value = "");
  _renderSidebar();
  _renderLibrary();
}

// ── Transport ─────────────────────────────────────────────────────────────────
function _updateTransport(proj) {
  _isActive     = !!proj?.is_active;
  _inRandom     = !!(proj?.current_activity?.includes("[random]") || proj?.current_activity?.includes("random mode"));
  _playingSource = proj?.current_activity ?? null;

  const $ = id => document.getElementById(id);
  const titleEl = $("ss-np-title");
  if (titleEl) {
    if (_isActive && proj?.current_activity) {
      titleEl.textContent = proj.current_activity.replace(/^playing:\s*/i,"").replace(/\s*\[random\]$/i,"") || "—";
      titleEl.className = "ss-np-title active";
    } else {
      titleEl.textContent = "—";
      titleEl.className = "ss-np-title";
    }
  }

  const stopBtn   = $("ss-stop");
  const pauseBtn  = $("ss-pause");
  const resumeBtn = $("ss-resume");
  const nextBtn   = $("ss-next");
  const randInd   = $("ss-rand-indicator");

  if (stopBtn)   stopBtn.disabled   = !_isActive;
  if (pauseBtn)  pauseBtn.disabled  = !_isActive;
  if (resumeBtn) resumeBtn.disabled = _isActive;
  if (nextBtn)   nextBtn.disabled   = !_inRandom;
  if (randInd) {
    randInd.textContent = _inRandom ? "random on" : "random off";
    randInd.className   = "ss-rand-indicator" + (_inRandom ? " active" : "");
  }

  document.querySelectorAll(".ss-song-row").forEach(r => {
    const hit = _playingSource &&
      r.dataset.source && _playingSource.toLowerCase().includes(r.dataset.source.toLowerCase());
    r.classList.toggle("playing", !!hit);
  });
}

function _bindTransport() {
  const on = (id, fn) => document.getElementById(id)?.addEventListener("click", fn);
  on("ss-stop",   async () => { try { await api.stopSong();                         toast.info("Stopped");    } catch(e){ toast.error(e.message); }});
  on("ss-pause",  async () => { try { await api.pauseProject("specific_song");      toast.info("Paused");     } catch(e){ toast.error(e.message); }});
  on("ss-resume", async () => { try { await api.resumeProject("specific_song");     toast.info("Resumed");    } catch(e){ toast.error(e.message); }});
  on("ss-next",   async () => { try { await api.nextSong();                         toast.info("Skipping…");  } catch(e){ toast.error(e.message); }});
  on("ss-random-btn", async () => {
    const cat = document.getElementById("ss-random-cat")?.value || "";
    try {
      await api.randomSong(cat);
      toast.success("Random mode started" + (cat ? ` — ${cat}` : ""));
    } catch(e) { toast.error(e.message); }
  });
  on("ss-reload-btn", async () => { await _load(); toast.info("Library reloaded"); });
  on("ss-audio-btn", () => { window.location.hash = "#audio"; });
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function _bindSidebar() {
  document.getElementById("ss-new-cat-btn")?.addEventListener("click", _showNewCatInput);
  document.getElementById("ss-match-input")?.addEventListener("input", debounce(_runMatchTest, 350));
}

function _renderSidebar() {
  // Update random category select
  const catSel = document.getElementById("ss-random-cat");
  if (catSel) {
    const prev = catSel.value;
    catSel.innerHTML = `<option value="">All songs</option>` +
      _catList().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    if (prev) catSel.value = prev;
  }

  const listEl = document.getElementById("ss-cat-list");
  if (!listEl) return;

  const cats = _catList();
  const uncat = _uncatCount();

  listEl.innerHTML = `
    <div class="ss-cat-item${!_filter.cat ? " active" : ""}" data-cat="">
      <span class="ss-cat-all-icon">★</span>
      <span class="ss-cat-name">All songs</span>
      <span class="ss-cat-count">${_library.length}</span>
    </div>
    ${cats.map(name => {
      const [fg, bg] = _catColor(name);
      const count = (_categories[name] || []).length;
      const active = _filter.cat === name;
      return `<div class="ss-cat-item${active ? " active" : ""}" data-cat="${esc(name)}" style="--cat-fg:${fg};--cat-bg:${bg}">
        <span class="ss-cat-dot" style="background:${fg}"></span>
        <span class="ss-cat-name" title="${esc(name)}">${esc(name)}</span>
        <span class="ss-cat-count">${count}</span>
        <button class="ss-cat-action" data-action="rename" data-cat="${esc(name)}" title="Rename">✎</button>
        <button class="ss-cat-action ss-cat-del" data-action="delete" data-cat="${esc(name)}" title="Delete">✕</button>
      </div>`;
    }).join("")}
    ${uncat > 0 ? `<div class="ss-cat-item${_filter.cat === "__uncat__" ? " active" : ""}" data-cat="__uncat__">
      <span class="ss-cat-dot" style="background:var(--soft)"></span>
      <span class="ss-cat-name" style="color:var(--soft)">Uncategorized</span>
      <span class="ss-cat-count">${uncat}</span>
    </div>` : ""}
  `;

  listEl.querySelectorAll(".ss-cat-item").forEach(item => {
    item.addEventListener("click", e => {
      if (e.target.closest(".ss-cat-action")) return;
      const cat = item.dataset.cat || null;
      _filter.cat = cat;
      _renderSidebar();
      _renderLibrary();
    });
  });
  listEl.querySelectorAll(".ss-cat-action").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      if (btn.dataset.action === "rename") _startCatRename(btn.dataset.cat, btn.closest(".ss-cat-item"));
      if (btn.dataset.action === "delete") _confirmCatDelete(btn.dataset.cat);
    });
  });
}

function _showNewCatInput() {
  const listEl = document.getElementById("ss-cat-list");
  if (!listEl) return;
  listEl.querySelector(".ss-cat-new-input-row")?.remove();
  const row = document.createElement("div");
  row.className = "ss-cat-new-input-row";
  row.innerHTML = `<input class="ss-cat-inline-input" placeholder="Category name…" maxlength="40">`;
  listEl.prepend(row);
  const inp = row.querySelector("input");
  inp?.focus();
  inp?.addEventListener("keydown", async e => {
    if (e.key === "Enter") {
      const name = inp.value.trim();
      row.remove();
      if (!name) return;
      if (_categories[name] !== undefined) { toast.warn(`"${name}" already exists`); return; }
      _categories[name] = [];
      try { await api.saveSongCategories(_categories); toast.success(`Created "${name}"`); }
      catch(ex) { toast.error(ex.message); delete _categories[name]; }
      _renderSidebar(); _renderLibrary();
    }
    if (e.key === "Escape") row.remove();
  });
  inp?.addEventListener("blur", () => setTimeout(() => row.remove(), 150));
}

function _startCatRename(oldName, itemEl) {
  const nameSpan = itemEl?.querySelector(".ss-cat-name");
  if (!nameSpan) return;
  nameSpan.innerHTML = `<input class="ss-cat-inline-input" value="${esc(oldName)}" maxlength="40">`;
  const inp = nameSpan.querySelector("input");
  inp?.focus(); inp?.select();
  inp?.addEventListener("keydown", async e => {
    if (e.key === "Enter") {
      const newName = inp.value.trim();
      if (!newName || newName === oldName) { _renderSidebar(); return; }
      if (_categories[newName] !== undefined) { toast.warn(`"${newName}" already exists`); _renderSidebar(); return; }
      _categories[newName] = _categories[oldName];
      delete _categories[oldName];
      if (_filter.cat === oldName) _filter.cat = newName;
      try { await api.saveSongCategories(_categories); toast.success(`Renamed to "${newName}"`); }
      catch(ex) { toast.error(ex.message); await _load(); return; }
      _renderSidebar(); _renderLibrary();
    }
    if (e.key === "Escape") _renderSidebar();
  });
  inp?.addEventListener("blur", () => setTimeout(() => _renderSidebar(), 200));
}

async function _confirmCatDelete(name) {
  const count = (_categories[name] || []).length;
  if (!confirm(`Delete category "${name}"?\n${count} song(s) will be unassigned.`)) return;
  delete _categories[name];
  if (_filter.cat === name) _filter.cat = null;
  try { await api.saveSongCategories(_categories); toast.success(`Deleted "${name}"`); }
  catch(e) { toast.error(e.message); await _load(); return; }
  _renderSidebar(); _renderLibrary();
}

// ── Voice matcher ─────────────────────────────────────────────────────────────
async function _runMatchTest() {
  const q = document.getElementById("ss-match-input")?.value.trim();
  const resultEl = document.getElementById("ss-match-result");
  if (!resultEl) return;
  if (!q) { resultEl.innerHTML = ""; return; }
  try {
    const data = await api.testSongMatch(q);
    if (!data.match) {
      resultEl.innerHTML = `<div class="ss-match-none">No match above threshold</div>`;
    } else {
      const { song, score } = data.match;
      const alts = (data.top || []).filter(t => t.song.id !== song.id).slice(0, 3);
      resultEl.innerHTML = `
        <div class="ss-match-best">
          <span class="ss-match-name">${esc(song.name)}</span>
          <div class="ss-match-score-wrap">
            <div class="ss-match-bar-wrap"><div class="ss-match-bar" style="width:${score}%"></div></div>
            <span class="ss-match-pct">${score}%</span>
          </div>
        </div>
        ${alts.length ? `<div class="ss-match-alts">${alts.map(a =>
          `<div class="ss-match-alt"><span>${esc(a.song.name)}</span><span class="ss-match-alt-pct">${a.score}%</span></div>`
        ).join("")}</div>` : ""}
      `;
    }
  } catch(e) {
    resultEl.innerHTML = `<div class="ss-match-none">${esc(e.message)}</div>`;
  }
}

// ── Library ───────────────────────────────────────────────────────────────────
function _bindLibrary() {
  document.getElementById("ss-search")?.addEventListener("input", e => {
    _filter.query = e.target.value;
    _renderLibrary();
  });
}

function _renderCatFilterBar() {
  const bar = document.getElementById("ss-cat-filter");
  if (!bar) return;
  const cats = _catList();
  if (!cats.length) { bar.innerHTML = ""; return; }
  bar.innerHTML = cats.map(c => {
    const [fg] = _catColor(c);
    const active = _filter.cat === c;
    return `<button class="ss-filter-chip${active ? " active" : ""}" data-cat="${esc(c)}"` +
      (active ? ` style="color:${fg};border-color:${fg}40;background:${fg}18"` : "") +
      `>${esc(c)}</button>`;
  }).join("");
  bar.querySelectorAll(".ss-filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      _filter.cat = _filter.cat === btn.dataset.cat ? null : btn.dataset.cat;
      _renderSidebar(); _renderLibrary();
    });
  });
}

function _renderLibrary() {
  _renderCatFilterBar();
  const songs   = _filteredSongs();
  const listEl  = document.getElementById("ss-song-list");
  if (!listEl) return;

  if (!songs.length) {
    listEl.innerHTML = `<div class="empty-state">No songs match the current filter.</div>`;
    return;
  }

  listEl.innerHTML = "";
  songs.forEach(song => {
    const cats  = _songCats(song.id);
    const src   = `ss__${song.source || ""}`;
    const isPlaying = _playingSource && song.source &&
      _playingSource.toLowerCase().includes(song.source.toLowerCase());

    const catTags = cats.map(c => {
      const [fg, bg] = _catColor(c);
      return `<span class="ss-cat-tag" style="color:${fg};background:${bg};border-color:${fg}40">${esc(c)}</span>`;
    }).join("");

    const row = document.createElement("div");
    row.className = "ss-song-row" + (isPlaying ? " playing" : "");
    row.dataset.source = song.source || "";
    row.innerHTML = `
      <button class="ss-play-btn btn-icon" title="Play">▶</button>
      <div class="ss-song-info">
        <span class="ss-song-name">${esc(song.name || "—")}</span>
        <span class="ss-song-source">${esc(song.source || "")}</span>
      </div>
      <div class="ss-song-tags">
        ${catTags || `<span class="ss-no-cat">uncategorized</span>`}
        ${(song.aliases || []).length ? `<span class="ss-alias-badge" title="${esc((song.aliases||[]).join(", "))}">+${song.aliases.length} alias</span>` : ""}
      </div>
      <button class="ss-edit-btn btn-icon" title="Edit">✎</button>
    `;
    row.querySelector(".ss-play-btn").addEventListener("click",  e => { e.stopPropagation(); _play(src, song.name); });
    row.querySelector(".ss-edit-btn").addEventListener("click",  e => { e.stopPropagation(); _openEditModal(song); });
    row.addEventListener("click", () => _play(src, song.name));
    listEl.appendChild(row);
  });
}

async function _play(source, name) {
  try { await api.playSong(source); toast.success(`Playing: ${name}`); }
  catch(e) { toast.error(e.message); }
}

// ── Song editor modal ─────────────────────────────────────────────────────────
function _openEditModal(song) {
  _editSong = { ...song, aliases: [...(song.aliases || [])], _cats: _songCats(song.id) };
  _renderModal();
}

function _renderModal() {
  const s = _editSong;
  if (!s) return;
  document.getElementById("ss-modal-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "ss-modal-overlay";
  overlay.className = "ss-modal-overlay";

  const allCats = _catList();

  overlay.innerHTML = `
    <div class="ss-modal" role="dialog">
      <div class="ss-modal-header">
        <span class="ss-modal-title">Edit Song</span>
        <button class="btn-icon" id="ss-modal-close" title="Close">✕</button>
      </div>
      <div class="ss-modal-body">

        <div class="ss-modal-field">
          <span class="ss-modal-label">Song name</span>
          <div class="ss-modal-readonly">${esc(s.name)}</div>
          <div class="ss-modal-hint">Name changes require re-running full_sync.py.</div>
        </div>

        <div class="ss-modal-field">
          <span class="ss-modal-label">Source file</span>
          <div class="ss-modal-readonly ss-mono">${esc(s.source || "—")}</div>
        </div>

        <div class="ss-modal-field">
          <span class="ss-modal-label">Voice aliases <span style="color:var(--soft);font-weight:400;text-transform:none;letter-spacing:0">— alternate names Whisper might hear</span></span>
          <div id="ss-alias-list" class="ss-alias-list">${
            (s.aliases || []).map((a, i) =>
              `<span class="ss-alias-chip">${esc(a)}<button class="ss-alias-del" data-idx="${i}" title="Remove">✕</button></span>`
            ).join("") || `<span class="ss-alias-empty">No aliases yet</span>`
          }</div>
          <div class="ss-alias-add">
            <input id="ss-alias-input" type="text" placeholder="e.g. give x, hate evry thng…" maxlength="80">
            <button class="btn btn-sm btn-secondary" id="ss-alias-add-btn">Add</button>
          </div>
        </div>

        <div class="ss-modal-field">
          <span class="ss-modal-label">Categories <span style="color:var(--soft);font-weight:400;text-transform:none;letter-spacing:0">— a song can be in multiple</span></span>
          ${allCats.length ? `
            <div class="ss-modal-cats">
              ${allCats.map(c => {
                const [fg, bg] = _catColor(c);
                const checked  = s._cats.includes(c);
                return `<label class="ss-modal-cat-check${checked?" checked":""}" style="--cat-fg:${fg};--cat-bg:${bg}">
                  <input type="checkbox" value="${esc(c)}"${checked?" checked":""}><span>${esc(c)}</span>
                </label>`;
              }).join("")}
            </div>
          ` : `<div class="ss-modal-hint">No categories yet — create one in the sidebar.</div>`}
        </div>

      </div>
      <div class="ss-modal-footer">
        <button class="btn btn-secondary" id="ss-modal-cancel">Cancel</button>
        <button class="btn btn-primary"   id="ss-modal-save">Save changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) _closeModal(); });
  document.getElementById("ss-modal-close")?.addEventListener("click",  _closeModal);
  document.getElementById("ss-modal-cancel")?.addEventListener("click", _closeModal);
  document.getElementById("ss-modal-save")?.addEventListener("click",   _saveModal);

  // Alias delete
  overlay.querySelectorAll(".ss-alias-del").forEach(btn => {
    btn.addEventListener("click", () => {
      _editSong.aliases.splice(parseInt(btn.dataset.idx), 1);
      _renderModal();
    });
  });

  // Alias add
  const aliasInput = document.getElementById("ss-alias-input");
  const addAlias = () => {
    const val = aliasInput?.value.trim();
    if (!val) return;
    if (!_editSong.aliases.includes(val)) { _editSong.aliases.push(val); _renderModal(); }
    else toast.warn("Alias already exists");
  };
  document.getElementById("ss-alias-add-btn")?.addEventListener("click", addAlias);
  aliasInput?.addEventListener("keydown", e => { if (e.key === "Enter") addAlias(); });

  // Category toggles
  overlay.querySelectorAll(".ss-modal-cat-check input").forEach(cb => {
    cb.addEventListener("change", () => {
      const cat = cb.value;
      const label = cb.closest("label");
      if (cb.checked) { if (!_editSong._cats.includes(cat)) _editSong._cats.push(cat); label?.classList.add("checked"); }
      else            { _editSong._cats = _editSong._cats.filter(c => c !== cat); label?.classList.remove("checked"); }
    });
  });
}

function _closeModal() {
  document.getElementById("ss-modal-overlay")?.remove();
  _editSong = null;
}

async function _saveModal() {
  const s = _editSong;
  if (!s) return;

  // Apply alias changes to library
  const libIdx = _library.findIndex(x => x.id === s.id);
  if (libIdx >= 0) _library[libIdx] = { ..._library[libIdx], aliases: s.aliases };

  // Apply category changes
  _catList().forEach(cat => {
    const ids  = _categories[cat] || [];
    const inCat = s._cats.includes(cat);
    const idx   = ids.indexOf(s.id);
    if (inCat && idx < 0) ids.push(s.id);
    if (!inCat && idx >= 0) ids.splice(idx, 1);
    _categories[cat] = ids;
  });

  const saveBtn = document.getElementById("ss-modal-save");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

  try {
    await Promise.all([api.saveSongLibrary(_library), api.saveSongCategories(_categories)]);
    toast.success("Saved");
    _closeModal();
    _renderSidebar();
    _renderLibrary();
  } catch(e) {
    toast.error(e.message);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save changes"; }
  }
}

// ── HTML shell ────────────────────────────────────────────────────────────────
function _shell() {
  return `
<div class="ss-manager">
  <div class="ss-transport">
    <div class="ss-np">
      <span class="ss-np-icon">♪</span>
      <span id="ss-np-title" class="ss-np-title">—</span>
    </div>
    <div class="ss-transport-controls">
      <button id="ss-stop"   class="btn-icon ss-ctrl-btn" title="Stop"   disabled>■</button>
      <button id="ss-pause"  class="btn-icon ss-ctrl-btn" title="Pause"  disabled>⏸</button>
      <button id="ss-resume" class="btn-icon ss-ctrl-btn" title="Resume" disabled>▶</button>
      <div class="ss-transport-sep"></div>
      <button id="ss-next"   class="btn-icon ss-ctrl-btn" title="Skip to next (random only)" disabled>⏭</button>
      <div class="ss-random-group">
        <button id="ss-random-btn" class="btn btn-sm btn-secondary">🔀 Random</button>
        <select id="ss-random-cat" class="ss-random-cat-sel"><option value="">All songs</option></select>
      </div>
      <span id="ss-rand-indicator" class="ss-rand-indicator">random off</span>
    </div>
    <button class="btn btn-sm btn-secondary" id="ss-audio-btn" title="Open Music volume controls">Volume</button>
    <button class="btn btn-sm btn-secondary ss-reload-btn" id="ss-reload-btn" title="Reload library">↺</button>
  </div>

  <div class="ss-body">
    <aside class="ss-sidebar">
      <div class="ss-sidebar-top">
        <div class="ss-sidebar-heading">Categories</div>
        <button id="ss-new-cat-btn" class="ss-new-cat-btn">+ New</button>
      </div>
      <div id="ss-cat-list" class="ss-cat-list"></div>

      <div class="ss-matcher-wrap">
        <div class="ss-sidebar-heading">Voice Tester</div>
        <input id="ss-match-input" type="text" placeholder="Try a voice command…" autocomplete="off">
        <div id="ss-match-result" class="ss-match-result"></div>
      </div>
    </aside>

    <main class="ss-main">
      <div class="ss-library-header">
        <div class="search-bar">
          <input id="ss-search" type="text" placeholder="Search songs…" autocomplete="off">
        </div>
        <div id="ss-cat-filter" class="ss-cat-filter-bar"></div>
      </div>
      <div id="ss-song-list" class="ss-song-list"></div>
    </main>
  </div>
</div>
  `.trim();
}
