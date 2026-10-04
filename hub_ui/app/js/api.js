// api.js — All fetch calls to the hub server

const BASE = "";  // same origin

async function _req(method, path, body) {
  const opts = {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // ── Status & project list ──────────────────────────────────────────────
  getStatus:   () => _req("GET",  "/api/status"),
  getProjects: () => _req("GET",  "/api/projects"),
  getCoordination: () => _req('GET', '/api/coordination'),
  getWorkflowMap: () => _req('GET', '/api/workflow-map'),
  getWorkflowLive: () => _req('GET', '/api/workflow-map/live'),
  getWorkflowHistory: (filters={}) => _req('GET', '/api/workflow-map/history?' + new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==null&&v!==undefined))),
  getWorkflowSource: (path,symbol) => _req('GET', '/api/workflow-map/source?' + new URLSearchParams({path,symbol})),

  // ── Rules ─────────────────────────────────────────────────────────────
  getRules:    () => _req("GET",  "/api/rules"),
  saveRules:   (rules) => _req("POST", "/api/rules", { rules }),

  getHubActions: () => _req("GET", "/api/hub-actions"),
  runHubAction:  (id) => _req("POST", `/api/hub-actions/${encodeURIComponent(id)}`),
  getEditorProfiles: () => _req("GET", "/api/editor-profiles"),
  saveEditorProfile: (data) => _req("POST", "/api/editor-profiles", data),
  saveEditorProjectSettings: (data) => _req("POST", "/api/editor-project-settings", data),
  runProjectAction: (project, action) => _req("POST", `/api/project-actions/${encodeURIComponent(project)}/${encodeURIComponent(action)}`),
  runWorkflow: (id) => _req("POST", `/api/workflows/${encodeURIComponent(id)}`),

  // ── Settings ──────────────────────────────────────────────────────────
  getSettings: () => _req("GET",  "/api/settings"),
  saveSettings:(s)  => _req("POST", "/api/settings", s),

  // ── Project control ───────────────────────────────────────────────────
  revertProject: (name) => _req("POST", `/api/projects/${name}/revert`),
  pauseProject:  (name) => _req("POST", `/api/projects/${name}/pause`),
  resumeProject: (name) => _req("POST", `/api/projects/${name}/resume`),

  // ── Instant replay ────────────────────────────────────────────────────
  getReplayClips: () => _req("GET", "/api/projects/instant_replay/clips"),
  captureQuickReplay: (seconds = 15) => _req('POST', '/api/projects/instant_replay/capture', {seconds}),
  playReplayClip: (path, mode) => _req("POST", "/api/projects/instant_replay/play", { path, mode }),
  playReplayGroup: (group_id, mode = 'showcase') => _req("POST", "/api/projects/instant_replay/play", { group_id, mode }),
  saveReplayLibrary: (data) => _req("POST", "/api/projects/instant_replay/library", data),
  skipReplayClip: () => _req("POST", "/api/projects/instant_replay/skip", {}),
  setReplayCompanion: (enabled) => _req("POST", "/api/projects/instant_replay/companion", { enabled }),
  getReplayStage: () => _req("GET", "/api/projects/instant_replay/stage"),
  setReplayView: (view) => _req("POST", "/api/projects/instant_replay/companion", { view }),
  saveReplayPresentation: (data) => _req("POST", "/api/projects/instant_replay/presentation", data),
  replayPreview: (path) => _req("GET", `/api/projects/instant_replay/preview?path=${encodeURIComponent(path)}`),
  trimReplay: (data) => _req("POST", "/api/projects/instant_replay/trim", data),
  replayTrimStatus: (job) => _req("GET", `/api/projects/instant_replay/trim?job=${encodeURIComponent(job)}`),

  // ── Specific song ─────────────────────────────────────────────────────
  getSongLibrary:    ()       => _req("GET",  "/api/projects/specific_song/library"),
  getSongCategories: ()       => _req("GET",  "/api/projects/specific_song/categories"),
  playSong:          (source) => _req("POST", "/api/projects/specific_song/play", { source }),
  stopSong:          ()       => _req("POST", "/api/projects/specific_song/stop"),
  randomSong:        (cat)    => _req("POST", "/api/projects/specific_song/random",          { category: cat || "" }),
  nextSong:          ()       => _req("POST", "/api/projects/specific_song/next"),
  saveSongLibrary:   (songs)  => _req("POST", "/api/projects/specific_song/save_library",    { songs }),
  saveSongCategories:(cats)   => _req("POST", "/api/projects/specific_song/save_categories", { categories: cats }),
  testSongMatch:     (query)  => _req("POST", "/api/projects/specific_song/match_test",      { query }),

  // ── Scene switcher ────────────────────────────────────────────────────
  getLobbies:    () => _req("GET",  "/api/projects/scene_voice_switcher/lobbies"),
  selectLobby:  (source = null, screenVisible) => _req("POST", "/api/projects/scene_voice_switcher/select_lobby", { source, ...(screenVisible === undefined ? {} : {screen_visible: screenVisible}) }),
  configureLobby: (source, changes) => _req('POST', '/api/projects/scene_voice_switcher/configure_lobby', {source, changes}),
  restoreLobby: (source) => _req('POST', '/api/projects/scene_voice_switcher/restore_lobby', {source}),
  switchScene:   (scene) => _req("POST", "/api/projects/scene_voice_switcher/switch_scene", { scene }),

  // ── Sound effects ─────────────────────────────────────────────────────
  getSfxLibrary: () => _req("GET",  "/api/projects/sound_effects/library"),
  playSfx:       (source) => _req("POST", "/api/projects/sound_effects/play", { source }),

  // ── Profile volume mixer ──────────────────────────────────────────────────
  getAudio:    ()     => _req("GET",  "/api/audio"),
  saveAudio:   (data) => _req("POST", "/api/audio", data),

  // ── OBS Audio Mixer ───────────────────────────────────────────────────────
  getObsAudio: ()                => _req("GET",  "/api/obs/audio"),
  setObsAudio: (input, changes)  => _req("POST", "/api/obs/audio", { input, ...changes }),

};
