// app.js — Main entry point: router, SSE wiring, status bar

import { api }            from "./api.js";
import { sse }            from "./sse.js";
import { state }          from "./state.js";
import { toast }          from "./toast.js";
import { initNav, setActiveNavItem } from "./nav.js";
import { timestamp }      from "./utils.js";

// ── Page modules ─────────────────────────────────────────────────────────────
import * as dashboardPage    from "./pages/dashboard.js";
import * as rulesPage        from "./pages/rules.js";
import * as profilesPage     from "./pages/profiles.js";
import * as settingsPage     from "./pages/settings.js";
import * as specificSongPage from "./pages/specific-song.js";
import * as sceneSwPage      from "./pages/scene-switcher.js";
import * as soundboardPage   from "./pages/soundboard.js";
import * as soundFxPage      from "./pages/sound-effects.js";
import * as leaguePage       from "./pages/league.js";
import * as instantRepPage   from "./pages/instant-replay.js";
import * as mixerPage        from "./pages/mixer.js";
import * as audioPage        from "./pages/audio.js";
import * as createPage       from "./pages/create.js";
import * as genericPage      from "./pages/project-generic.js";

// ── Page registry ─────────────────────────────────────────────────────────────
// Map page-id → { mount(container, arg?), unmount() }
const PAGES = {
  "dashboard":                     dashboardPage,
  "rules":                         rulesPage,
  "profiles":                      profilesPage,
  "settings":                      settingsPage,
  "mixer":                         mixerPage,
  "audio":                         audioPage,
  "create":                        createPage,
  "projects/specific_song":        specificSongPage,
  "projects/scene_voice_switcher": sceneSwPage,
  "projects/soundboard":           soundboardPage,
  "projects/tik_tok":              { mount: (c) => soundboardPage.mount(c, "tik_tok"), unmount: () => soundboardPage.unmount() },
  "projects/sound_effects":        soundFxPage,
  "projects/league":               leaguePage,
  "projects/instant_replay":       instantRepPage,
};

// ── Router ────────────────────────────────────────────────────────────────────
let _curPage   = null;
let _curModule = null;
const _pageEl  = document.getElementById("page");

function navigate(page) {
  page = (page || "dashboard").replace(/^#/, "");

  // Unmount previous page
  if (_curModule?.unmount) {
    try { _curModule.unmount(); } catch(e) { console.warn("[router] unmount error", e); }
  }

  // Resolve module
  let mod = PAGES[page];
  if (!mod && page.startsWith("projects/")) {
    const name = page.slice("projects/".length);
    mod = {
      mount:   (c) => genericPage.mount(c, name),
      unmount: ()  => genericPage.unmount(),
    };
  }
  if (!mod) {
    mod  = dashboardPage;
    page = "dashboard";
  }

  _curPage   = page;
  _curModule = mod;

  _pageEl.innerHTML = "";
  setActiveNavItem(page);

  try {
    const r = mod.mount(_pageEl);
    if (r instanceof Promise) r.catch(e => console.error("[router] async mount error", e));
  } catch(e) {
    console.error("[router] mount error", e);
    _pageEl.innerHTML = `<div class="empty-state" style="padding-top:60px">Failed to load page:<br><code>${e.message}</code></div>`;
  }

  const hash = `#${page}`;
  if (window.location.hash !== hash) history.replaceState(null, "", hash);
}

// Expose navigate globally for inline href navigation
window._navigate = navigate;

// ── Hash routing ──────────────────────────────────────────────────────────────
window.addEventListener("hashchange", () => {
  navigate(window.location.hash.replace(/^#/, "") || "dashboard");
});

// ── SSE & reactive state ──────────────────────────────────────────────────────
const _dotEl  = document.getElementById("statusDot");
const _textEl = document.getElementById("statusText");
const _timeEl = document.getElementById("statusTime");

function _setConnected(ok) {
  state.set({ connected: ok });
  if (_dotEl)  _dotEl.className    = `status-dot status-dot--${ok ? "ok" : "offline"}`;
  if (_textEl) _textEl.textContent = ok ? "Hub connected" : "Reconnecting…";
}

// Status updates → state
sse.subscribe("status_update", ({ projects }) => {
  if (Array.isArray(projects)) {
    state.set({ projects, lastUpdated: Date.now() });
    if (_timeEl) _timeEl.textContent = `Updated ${timestamp()}`;
  }
});

// Hub events → dashboard log (all types including wildcards)
sse.subscribe("*", (type, payload) => {
  if (typeof dashboardPage.onEvent === "function") {
    dashboardPage.onEvent(type, payload);
  }
});

sse.connect(
  () => { _setConnected(true);  toast.info("Hub connected");    },
  () => { _setConnected(false); },
);

// ── Navigation ────────────────────────────────────────────────────────────────
initNav(navigate);

// Static nav links (Hub / Tools sections defined in HTML)
document.querySelectorAll(".nav-item[data-page]").forEach(a => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(a.dataset.page);
  });
});

// ── Fix Hotkey Editor nav link with actual port ───────────────────────────────
fetch("/api/info").then(r => r.json()).then(({ editor_port }) => {
  document.querySelectorAll("a.nav-external").forEach(a => {
    a.href = `http://localhost:${editor_port}`;
  });
}).catch(() => {});

// ── Initial page ──────────────────────────────────────────────────────────────
navigate(window.location.hash.replace(/^#/, "") || "dashboard");
