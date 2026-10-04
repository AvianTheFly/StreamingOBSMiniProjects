// app.js — Main entry point: router, SSE wiring, status bar

import { api }            from "./api.js";
import { sse }            from "./sse.js";
import { state }          from "./state.js";
import { initNav, setActiveNavItem } from "./nav.js";
import { timestamp, esc } from "./utils.js";
import { initSearch } from './search.js';
import * as libraryPage from './pages/library.js';
import * as audioWorkspace from './pages/audio-workspace.js';
import * as workflowPage from './pages/workflows.js';

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
import * as leagueAlertsPage from "./pages/league-alerts.js";
import * as instantRepPage   from "./pages/instant-replay.js";
import * as voicePage        from "./pages/voice.js";
import * as genericPage      from "./pages/project-generic.js";
import * as startingSoonPage from "./pages/starting-soon.js";
import * as leagueStatsPage from "./pages/league-stats.js";
import * as twitchCommandsPage from './pages/twitch-commands.js';
import * as moodCuesPage from './pages/mood-cues.js';

// ── Page registry ─────────────────────────────────────────────────────────────
// Map page-id → { mount(container, arg?), unmount() }
const PAGES = {
  'projects/love_me': moodCuesPage,
  "projects/twitch_commands":       twitchCommandsPage,
  "projects/league_stats":          leagueStatsPage,
  "projects/starting_soon":         startingSoonPage,
  "dashboard":                     dashboardPage,
  "library":                       libraryPage,
  "workflows":                     workflowPage,
  "rules":                         rulesPage,
  "profiles":                      profilesPage,
  "settings":                      settingsPage,
  "mixer":                         { mount: c => audioWorkspace.mount(c, 'sources'), unmount: audioWorkspace.unmount },
  "audio":                         { mount: c => audioWorkspace.mount(c, 'media'), unmount: audioWorkspace.unmount },
  "voice":                         voicePage,
  "projects/specific_song":        specificSongPage,
  "projects/scene_voice_switcher": sceneSwPage,
  "projects/soundboard":           soundboardPage,
  "projects/tik_tok":              { mount: (c) => soundboardPage.mount(c, "tik_tok"), unmount: () => soundboardPage.unmount() },
  "projects/sound_effects":        soundFxPage,
  "projects/league":               leaguePage,
  "projects/league_api":           leagueAlertsPage,
  "projects/instant_replay":       instantRepPage,
};

// ── Router ────────────────────────────────────────────────────────────────────
let _curPage   = null;
let _curModule = null;
const _pageEl  = document.getElementById("page");

function navigate(page) {
  page = (page || "dashboard").replace(/^#/, "");
  if (page === _curPage) return;
  if (_curModule?.beforeLeave && !_curModule.beforeLeave()) {
    history.replaceState(null, "", `#${_curPage}`);
    return;
  }

  const changingPage = _curPage !== null;
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
  _pageEl.scrollTop = 0;
  _pageEl.dataset.route = page;
  setActiveNavItem(page);

  try {
    const r = mod.mount(_pageEl);
    if (r instanceof Promise) r.catch(e => console.error("[router] async mount error", e));
  } catch(e) {
    console.error("[router] mount error", e);
    _pageEl.innerHTML = `<div class="empty-state" style="padding-top:60px">Failed to load page:<br><code>${esc(e.message)}</code></div>`;
  }

  const hash = `#${page}`;
  if (window.location.hash !== hash) history.replaceState(null, "", hash);
  if (changingPage) _pageEl.focus({ preventScroll: true });
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
  () => { _setConnected(true); },
  () => { _setConnected(false); },
);

// ── Navigation ────────────────────────────────────────────────────────────────
initNav(navigate);
initSearch(navigate);
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  _pageEl.focus();
});

// Seed status independently of the first SSE message. Page subscriptions mount
// synchronously so a slow profile request cannot lose the initial status update.
api.getStatus().then(({ projects }) => {
  if (Array.isArray(projects) && !state.get('lastUpdated')) state.set({ projects, lastUpdated: Date.now() });
}).catch(() => {});

// ── Initial page ──────────────────────────────────────────────────────────────
navigate(window.location.hash.replace(/^#/, "") || "dashboard");
