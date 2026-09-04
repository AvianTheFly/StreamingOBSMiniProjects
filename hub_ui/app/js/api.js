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
  playReplayClip: (path) => _req("POST", "/api/projects/instant_replay/play", { path }),
  getReplayClipMeta: (path) => _req("GET", `/api/projects/instant_replay/meta?path=${encodeURIComponent(path)}`),
  saveReplayClipSettings: (data) => _req("POST", "/api/projects/instant_replay/clip-settings", data),
  trimReplayFile: (data) => _req("POST", "/api/projects/instant_replay/trim-file", data),
  playIntroMontage: () => _req("POST", "/api/projects/instant_replay/play-intro", {}),
  replayMediaUrl: (path) => `/api/projects/instant_replay/media?path=${encodeURIComponent(path)}`,
  replayThumbnailUrl: (path) => `/api/projects/instant_replay/thumbnail?path=${encodeURIComponent(path)}`,

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
