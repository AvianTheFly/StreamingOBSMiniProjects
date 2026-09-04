import { api } from "../api.js";
import { toast } from "../toast.js";

const MONITOR_MODES = [
  { value: "OBS_MONITORING_TYPE_NONE", label: "Off", short: "Off" },
  { value: "OBS_MONITORING_TYPE_MONITOR_ONLY", label: "Monitor", short: "Mon" },
  { value: "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT", label: "Monitor + Output", short: "Out" },
];

const AUDIO_KIND_GROUPS = {
  desktop: new Set(["wasapi_output_capture", "pulse_output_capture", "coreaudio_output_capture"]),
  mic: new Set(["wasapi_input_capture", "pulse_input_capture", "coreaudio_input_capture"]),
  media: new Set(["ffmpeg_source", "vlc_source"]),
  browser: new Set(["browser_source"]),
};

const NON_AUDIO_KINDS = new Set([
  "image_source",
  "color_source_v3",
  "text_gdiplus_v2",
  "text_ft2_source_v2",
  "window_capture",
  "game_capture",
  "monitor_capture",
  "scene",
  "group",
]);

const DEFAULT_DB = -60;
const AUTO_REFRESH_MS = 8000;

let _container = null;
let _inputs = [];
let _selected = "";
let _query = "";
let _group = "all";
let _sort = "group";
let _hideMuted = false;
let _autoRefresh = true;
let _refreshTimer = null;
let _busy = new Set();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roundDb(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_DB;
  return Math.max(-60, Math.min(6, Math.round(parsed * 2) / 2));
}

function formatDb(value, withSign = false) {
  const db = roundDb(value);
  return `${withSign && db > 0 ? "+" : ""}${db.toFixed(1)} dB`;
}

function volumePercent(db) {
  return Math.max(0, Math.min(100, ((roundDb(db) + 60) / 66) * 100));
}

function percentToDb(percent) {
  return roundDb((Number(percent) / 100) * 66 - 60);
}

function monitorMeta(value) {
  return MONITOR_MODES.find(item => item.value === value) || MONITOR_MODES[0];
}

function classifyGroup(input) {
  const kind = String(input.kind || "").toLowerCase();
  const name = String(input.name || "").toLowerCase();
  if (AUDIO_KIND_GROUPS.desktop.has(kind) || /desktop|speaker|system|game|music|pc audio/.test(name)) return "desktop";
  if (AUDIO_KIND_GROUPS.mic.has(kind) || /mic|microphone|aux|voice|commentary/.test(name)) return "mic";
  if (AUDIO_KIND_GROUPS.media.has(kind)) return "media";
  if (AUDIO_KIND_GROUPS.browser.has(kind)) return "browser";
  return "other";
}

function isLikelyAudio(input) {
  const kind = String(input.kind || "").toLowerCase();
  const name = String(input.name || "").toLowerCase();
  if (NON_AUDIO_KINDS.has(kind)) return false;
  if (kind.includes("capture")) return true;
  if (kind.includes("audio")) return true;
  if (AUDIO_KIND_GROUPS.desktop.has(kind) || AUDIO_KIND_GROUPS.mic.has(kind) || AUDIO_KIND_GROUPS.media.has(kind) || AUDIO_KIND_GROUPS.browser.has(kind)) return true;
  return /desktop|speaker|system|mic|microphone|aux|music|voice|audio/.test(name);
}

function visibleInputs() {
  const needle = _query.trim().toLowerCase();
  const list = _inputs.filter(input => isLikelyAudio(input));
  const filtered = list.filter(input => {
    if (_group !== "all" && classifyGroup(input) !== _group) return false;
    if (_hideMuted && !input.muted) return false;
    if (!needle) return true;
    return [input.name, input.kind, classifyGroup(input), monitorMeta(input.monitor).label]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  const sorted = [...filtered];
  if (_sort === "loudest") {
    sorted.sort((a, b) => b.volume_db - a.volume_db || a.name.localeCompare(b.name));
  } else if (_sort === "quietest") {
    sorted.sort((a, b) => a.volume_db - b.volume_db || a.name.localeCompare(b.name));
  } else if (_sort === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (_sort === "monitor") {
    sorted.sort((a, b) => monitorMeta(a.monitor).label.localeCompare(monitorMeta(b.monitor).label) || a.name.localeCompare(b.name));
  } else {
    sorted.sort((a, b) => classifyGroup(a).localeCompare(classifyGroup(b)) || a.name.localeCompare(b.name));
  }
  return sorted;
}

function selectedInput() {
  const visible = visibleInputs();
  if (_selected) {
    const found = _inputs.find(input => input.name === _selected);
    if (found) return found;
  }
  return visible[0] || _inputs.find(input => isLikelyAudio(input)) || null;
}

function stats() {
  const visible = visibleInputs();
  const muted = visible.filter(input => input.muted).length;
  const monitored = visible.filter(input => input.monitor !== "OBS_MONITORING_TYPE_NONE").length;
  const avg = visible.length
    ? roundDb(visible.reduce((sum, input) => sum + roundDb(input.volume_db), 0) / visible.length)
    : DEFAULT_DB;
  return { visible, muted, monitored, avg };
}

async function loadInputs({ silent = false } = {}) {
  if (!_container) return;
  if (!silent) setBoardState("loading", "Reading audio inputs from OBS…");
  try {
    const data = await api.getObsAudio();
    if (data.error) throw new Error(data.error);
    _inputs = Array.isArray(data.inputs) ? data.inputs.map(input => ({
      ...input,
      volume_db: roundDb(input.volume_db),
      muted: !!input.muted,
      monitor: input.monitor || "OBS_MONITORING_TYPE_NONE",
    })) : [];
    if (!_selected || !_inputs.some(input => input.name === _selected)) {
      _selected = selectedInput()?.name || "";
    }
    render();
  } catch (err) {
    setBoardState("error", err.message || "Could not load OBS audio inputs.");
  }
}

async function applyToInput(name, changes, { successMessage = "" } = {}) {
  const input = _inputs.find(item => item.name === name);
  if (!input) return;
  _busy.add(name);
  Object.assign(input, changes);
  render();
  try {
    await api.setObsAudio(name, changes);
    if (successMessage) toast.success(successMessage);
  } catch (err) {
    toast.error(`${name}: ${err.message}`);
    await loadInputs({ silent: true });
  } finally {
    _busy.delete(name);
    render();
  }
}

async function applyToVisible(buildChanges, label) {
  const targets = visibleInputs();
  if (!targets.length) {
    toast.info("No visible channels to update.");
    return;
  }
  for (const input of targets) {
    const changes = buildChanges(input);
    if (!changes || !Object.keys(changes).length) continue;
    await applyToInput(input.name, changes);
  }
  toast.success(`${label} on ${targets.length} channel${targets.length === 1 ? "" : "s"}.`);
}

function setBoardState(type, message) {
  const board = _container?.querySelector("#mixerChannelBoard");
  if (!board) return;
  board.innerHTML = `<div class="empty-state mixer-empty-state mixer-empty-state--${type}">${escapeHtml(message)}</div>`;
  const inspector = _container?.querySelector("#mixerInspector");
  if (inspector) inspector.innerHTML = `<div class="mixer-inspector-empty">${escapeHtml(message)}</div>`;
}

function makeStatCard(label, value, help) {
  return `
    <div class="mixer-stat-card">
      <strong>${value}</strong>
      <span>${label}</span>
      <small>${help}</small>
    </div>
  `;
}

function monitorButtons(input) {
  const safeName = escapeHtml(input.name);
  return MONITOR_MODES.map(mode => `
    <button class="mixer-segment ${input.monitor === mode.value ? "is-active" : ""}" data-monitor="${mode.value}" data-input="${safeName}">
      ${mode.short}
    </button>
  `).join("");
}

function inputRow(input) {
  const selected = _selected === input.name;
  const monitor = monitorMeta(input.monitor);
  const group = classifyGroup(input);
  const busy = _busy.has(input.name);
  const safeName = escapeHtml(input.name);
  const safeKind = escapeHtml(input.kind || "");
  return `
    <article class="mixer-channel ${selected ? "is-selected" : ""} ${input.muted ? "is-muted" : ""}" data-channel="${safeName}">
      <div class="mixer-channel-head">
        <div class="mixer-channel-meta">
          <div class="mixer-channel-name" title="${safeName}">${safeName}</div>
          <div class="mixer-channel-tags">
            <span class="badge badge-${group === "other" ? "idle" : "audio"}">${group}</span>
            <span class="badge ${input.muted ? "badge-danger" : "badge-active"}">${input.muted ? "muted" : "live"}</span>
            <span class="badge badge-idle">${monitor.label}</span>
            ${input.kind ? `<span class="badge badge-idle">${safeKind}</span>` : ""}
          </div>
        </div>
        <div class="mixer-channel-db">${formatDb(input.volume_db, true)}</div>
      </div>
      <div class="mixer-meter">
        <div class="mixer-meter-fill" style="width:${volumePercent(input.volume_db)}%"></div>
      </div>
      <div class="mixer-channel-controls">
        <input class="mixer-slider" data-slider="${safeName}" type="range" min="0" max="100" step="0.5" value="${volumePercent(input.volume_db)}" ${busy ? "disabled" : ""}>
        <input class="mixer-db-input" data-db="${safeName}" type="number" min="-60" max="6" step="0.5" value="${roundDb(input.volume_db)}" ${busy ? "disabled" : ""}>
        <button class="btn ${input.muted ? "btn-danger" : "btn-secondary"} btn-sm" data-mute="${safeName}" ${busy ? "disabled" : ""}>
          ${input.muted ? "Unmute" : "Mute"}
        </button>
      </div>
      <div class="mixer-channel-foot">
        <div class="mixer-segmented" data-monitor-group="${safeName}">
          ${monitorButtons(input)}
        </div>
      </div>
    </article>
  `;
}

function inspectorView(input) {
  if (!input) {
    return `<div class="mixer-inspector-empty">Pick a channel to inspect it here.</div>`;
  }
  const group = classifyGroup(input);
  const monitor = monitorMeta(input.monitor);
  const busy = _busy.has(input.name);
  const safeName = escapeHtml(input.name);
  const safeKind = escapeHtml(input.kind || "unknown");
  return `
    <div class="mixer-inspector-card">
      <div class="mixer-inspector-title">
        <div>
          <div class="page-title" style="font-size:18px">${safeName}</div>
          <div class="page-subtitle">Focused channel controls for faster OBS audio changes.</div>
        </div>
        <div class="mixer-channel-tags">
          <span class="badge badge-${group === "other" ? "idle" : "audio"}">${group}</span>
          <span class="badge ${input.muted ? "badge-danger" : "badge-active"}">${input.muted ? "muted" : "live"}</span>
        </div>
      </div>

      <div class="mixer-inspector-grid">
        <div class="mixer-inspector-metric">
          <span>Current Level</span>
          <strong>${formatDb(input.volume_db, true)}</strong>
        </div>
        <div class="mixer-inspector-metric">
          <span>Monitor Path</span>
          <strong>${monitor.label}</strong>
        </div>
        <div class="mixer-inspector-metric">
          <span>OBS Kind</span>
          <strong>${safeKind}</strong>
        </div>
      </div>

      <div class="mixer-detail-block">
        <div class="card-title">Precision Volume</div>
        <div class="mixer-detail-volume">
          <input class="mixer-slider mixer-slider--large" data-slider="${safeName}" type="range" min="0" max="100" step="0.5" value="${volumePercent(input.volume_db)}" ${busy ? "disabled" : ""}>
          <input class="mixer-db-input mixer-db-input--large" data-db="${safeName}" type="number" min="-60" max="6" step="0.5" value="${roundDb(input.volume_db)}" ${busy ? "disabled" : ""}>
        </div>
        <div class="mixer-action-row">
          <button class="btn btn-secondary btn-sm" data-nudge="${safeName}" data-amount="-6" ${busy ? "disabled" : ""}>-6 dB</button>
          <button class="btn btn-secondary btn-sm" data-nudge="${safeName}" data-amount="-3" ${busy ? "disabled" : ""}>-3 dB</button>
          <button class="btn btn-secondary btn-sm" data-set-db="${safeName}" data-value="0" ${busy ? "disabled" : ""}>0 dB</button>
          <button class="btn btn-secondary btn-sm" data-nudge="${safeName}" data-amount="3" ${busy ? "disabled" : ""}>+3 dB</button>
          <button class="btn btn-secondary btn-sm" data-nudge="${safeName}" data-amount="6" ${busy ? "disabled" : ""}>+6 dB</button>
        </div>
      </div>

      <div class="mixer-detail-block">
        <div class="card-title">Routing</div>
        <div class="mixer-segmented mixer-segmented--wide" data-monitor-group="${safeName}">
          ${monitorButtons(input)}
        </div>
      </div>

      <div class="mixer-detail-block">
        <div class="card-title">Quick Actions</div>
        <div class="mixer-action-row">
          <button class="btn ${input.muted ? "btn-danger" : "btn-secondary"} btn-sm" data-mute="${safeName}" ${busy ? "disabled" : ""}>
            ${input.muted ? "Unmute Channel" : "Mute Channel"}
          </button>
          <button class="btn btn-secondary btn-sm" data-set-db="${safeName}" data-value="-12" ${busy ? "disabled" : ""}>Target -12 dB</button>
          <button class="btn btn-secondary btn-sm" data-set-db="${safeName}" data-value="-18" ${busy ? "disabled" : ""}>Target -18 dB</button>
        </div>
      </div>
    </div>
  `;
}

function render() {
  if (!_container) return;
  const { visible, muted, monitored, avg } = stats();
  const inspector = selectedInput();
  const safeQuery = escapeHtml(_query);
  if (inspector) _selected = inspector.name;

  _container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">OBS Mixer</div>
        <div class="page-subtitle">A real audio workspace for OBS inputs instead of a tiny utility panel.</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="mixerAutoRefresh">${_autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}</button>
        <button class="btn btn-secondary btn-sm" id="mixerRefreshBtn">Refresh</button>
      </div>
    </div>

    <div class="mixer-hero">
      ${makeStatCard("Visible Channels", String(visible.length), "Current filter result")}
      ${makeStatCard("Muted", String(muted), "Channels silenced in OBS")}
      ${makeStatCard("Monitoring", String(monitored), "Channels routed to monitor")}
      ${makeStatCard("Average", formatDb(avg, true), "Visible channel average")}
    </div>

    <div class="card mixer-toolbar-card">
      <div class="mixer-toolbar-row">
        <input id="mixerSearch" type="text" placeholder="Search channel name, kind, or routing..." value="${safeQuery}">
        <select id="mixerGroup">
          <option value="all"${_group === "all" ? " selected" : ""}>All audio</option>
          <option value="desktop"${_group === "desktop" ? " selected" : ""}>Desktop</option>
          <option value="mic"${_group === "mic" ? " selected" : ""}>Mic</option>
          <option value="media"${_group === "media" ? " selected" : ""}>Media</option>
          <option value="browser"${_group === "browser" ? " selected" : ""}>Browser</option>
          <option value="other"${_group === "other" ? " selected" : ""}>Other</option>
        </select>
        <select id="mixerSort">
          <option value="group"${_sort === "group" ? " selected" : ""}>Sort by group</option>
          <option value="loudest"${_sort === "loudest" ? " selected" : ""}>Loudest first</option>
          <option value="quietest"${_sort === "quietest" ? " selected" : ""}>Quietest first</option>
          <option value="monitor"${_sort === "monitor" ? " selected" : ""}>Monitor mode</option>
          <option value="name"${_sort === "name" ? " selected" : ""}>Name</option>
        </select>
      </div>
      <div class="mixer-toolbar-row mixer-toolbar-row--chips">
        <button class="btn ${_hideMuted ? "btn-primary" : "btn-secondary"} btn-sm" id="mixerMutedToggle">${_hideMuted ? "Showing muted only" : "Show muted only"}</button>
        <button class="btn btn-secondary btn-sm" id="mixerMuteVisible">Mute visible</button>
        <button class="btn btn-secondary btn-sm" id="mixerUnmuteVisible">Unmute visible</button>
        <button class="btn btn-secondary btn-sm" id="mixerLowerVisible">-3 dB visible</button>
        <button class="btn btn-secondary btn-sm" id="mixerResetVisible">0 dB visible</button>
        <button class="btn btn-secondary btn-sm" id="mixerMonitorOffVisible">Monitor off visible</button>
      </div>
    </div>

    <div class="mixer-layout">
      <section class="card mixer-board-card">
        <div class="card-title">Channels</div>
        <div class="mixer-channel-board" id="mixerChannelBoard">
          ${visible.length ? visible.map(inputRow).join("") : `<div class="empty-state mixer-empty-state">No OBS audio channels matched the current filters.</div>`}
        </div>
      </section>

      <aside class="card mixer-inspector" id="mixerInspector">
        ${inspectorView(inspector)}
      </aside>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  _container.querySelector("#mixerRefreshBtn")?.addEventListener("click", () => loadInputs());
  _container.querySelector("#mixerAutoRefresh")?.addEventListener("click", () => {
    _autoRefresh = !_autoRefresh;
    scheduleRefresh();
    render();
  });
  _container.querySelector("#mixerSearch")?.addEventListener("input", event => {
    _query = event.target.value;
    render();
  });
  _container.querySelector("#mixerGroup")?.addEventListener("input", event => {
    _group = event.target.value;
    render();
  });
  _container.querySelector("#mixerSort")?.addEventListener("input", event => {
    _sort = event.target.value;
    render();
  });
  _container.querySelector("#mixerMutedToggle")?.addEventListener("click", () => {
    _hideMuted = !_hideMuted;
    render();
  });
  _container.querySelector("#mixerMuteVisible")?.addEventListener("click", () => applyToVisible(() => ({ muted: true }), "Muted visible channels"));
  _container.querySelector("#mixerUnmuteVisible")?.addEventListener("click", () => applyToVisible(() => ({ muted: false }), "Unmuted visible channels"));
  _container.querySelector("#mixerLowerVisible")?.addEventListener("click", () => applyToVisible(input => ({ volume_db: roundDb(input.volume_db - 3) }), "Lowered visible channels"));
  _container.querySelector("#mixerResetVisible")?.addEventListener("click", () => applyToVisible(() => ({ volume_db: 0 }), "Reset visible channels to 0 dB"));
  _container.querySelector("#mixerMonitorOffVisible")?.addEventListener("click", () => applyToVisible(() => ({ monitor: "OBS_MONITORING_TYPE_NONE" }), "Turned monitoring off"));

  _container.querySelectorAll("[data-channel]").forEach(node => {
    node.addEventListener("click", event => {
      if (event.target.closest("input,button")) return;
      _selected = node.dataset.channel;
      render();
    });
  });

  _container.querySelectorAll("[data-slider]").forEach(node => {
    node.addEventListener("change", event => {
      const name = event.target.dataset.slider;
      const db = percentToDb(event.target.value);
      applyToInput(name, { volume_db: db });
    });
  });

  _container.querySelectorAll("[data-db]").forEach(node => {
    node.addEventListener("change", event => {
      const name = event.target.dataset.db;
      applyToInput(name, { volume_db: roundDb(event.target.value) });
    });
  });

  _container.querySelectorAll("[data-mute]").forEach(node => {
    node.addEventListener("click", event => {
      const name = event.currentTarget.dataset.mute;
      const input = _inputs.find(item => item.name === name);
      if (!input) return;
      applyToInput(name, { muted: !input.muted });
    });
  });

  _container.querySelectorAll("[data-monitor]").forEach(node => {
    node.addEventListener("click", event => {
      const name = event.currentTarget.dataset.input;
      const monitor = event.currentTarget.dataset.monitor;
      applyToInput(name, { monitor });
    });
  });

  _container.querySelectorAll("[data-nudge]").forEach(node => {
    node.addEventListener("click", event => {
      const name = event.currentTarget.dataset.nudge;
      const amount = Number(event.currentTarget.dataset.amount || 0);
      const input = _inputs.find(item => item.name === name);
      if (!input) return;
      applyToInput(name, { volume_db: roundDb(input.volume_db + amount) });
    });
  });

  _container.querySelectorAll("[data-set-db]").forEach(node => {
    node.addEventListener("click", event => {
      const name = event.currentTarget.dataset.setDb;
      const value = roundDb(event.currentTarget.dataset.value);
      applyToInput(name, { volume_db: value });
    });
  });
}

function scheduleRefresh() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
  if (_autoRefresh) {
    _refreshTimer = setInterval(() => {
      if (_busy.size) return;
      loadInputs({ silent: true });
    }, AUTO_REFRESH_MS);
  }
}

export function mount(container) {
  _container = container;
  _selected = "";
  _query = "";
  _group = "all";
  _sort = "group";
  _hideMuted = false;
  _autoRefresh = true;
  _busy = new Set();
  scheduleRefresh();
  setBoardState("loading", "Reading audio inputs from OBS…");
  loadInputs({ silent: true });
}

export function unmount() {
  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = null;
  _container = null;
  _inputs = [];
  _busy = new Set();
}
