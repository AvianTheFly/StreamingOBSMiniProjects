import { api } from "../api.js";
import { sse } from "../sse.js";
import { toast } from "../toast.js";
import { esc } from "../utils.js";

const DB_MIN = -45;
const DB_MAX = 10;
const DEBOUNCE_MS = 300;
const REFRESH_MS = 1500;

let _data = [];
let _state = {};
let _timers = {};
let _pollTimer = null;
let _boundRefresh = null;
let _activeInteractions = new Set();
let _refreshQueued = false;

export async function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Audio</div>
        <div class="page-subtitle">Mini project, profile, and file output in one place</div>
      </div>
    </div>
    <div class="card mb-16 audio-help-card">
      <p class="audio-help-copy">
        Every slider shows the <strong>final output dB</strong> at that layer.
        Moving <em>Mini Project</em> shifts every profile and file below it.
        Moving <em>Profile</em> shifts every file in that profile.
        File sliders set the final output while keeping their stored offset relative to the stack.
      </p>
    </div>
    <div id="audioBody" class="audio-page-body"></div>
  `;

  _boundRefresh = () => {
    if (_hasPendingSaves()) return;
    _refresh({ silent: true });
  };
  sse.subscribe("audio_updated", _boundRefresh);
  _pollTimer = setInterval(() => {
    if (document.hidden || _hasPendingSaves()) return;
    _refresh({ silent: true });
  }, REFRESH_MS);

  await _refresh();
}

export function unmount() {
  Object.values(_timers).forEach(clearTimeout);
  _timers = {};
  _activeInteractions = new Set();
  _refreshQueued = false;
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  if (_boundRefresh) {
    sse.unsubscribe("audio_updated", _boundRefresh);
    _boundRefresh = null;
  }
}

function _render() {
  const body = document.getElementById("audioBody");
  if (!body) return;
  body.innerHTML = "";

  if (!_data.length) {
    body.innerHTML = `<div class="empty-state">No editor projects found.</div>`;
    return;
  }

  _data.forEach(project => body.appendChild(_buildProjectCard(project)));
}

function _buildProjectCard(project) {
  const stateProject = _state[project.key];
  const card = document.createElement("section");
  card.className = "audio-project-card";
  card.dataset.projectKey = project.key;

  const header = document.createElement("div");
  header.className = "audio-project-head";

  const collapseBtn = _collapseButton(`hub-audio-project:${project.key}`, true);
  collapseBtn.classList.add("audio-project-collapse");

  const titleWrap = document.createElement("div");
  titleWrap.className = "audio-project-title-wrap";

  const title = document.createElement("div");
  title.className = "audio-project-name";
  title.textContent = project.name;

  const meta = document.createElement("div");
  meta.className = "audio-project-meta";
  meta.textContent = `${project.profiles.length} profile${project.profiles.length === 1 ? "" : "s"}`;

  titleWrap.append(title, meta);

  const projectSlider = _buildSliderGroup({
    interactionKey: _interactionKey(project.key, "", "", "project"),
    layerLabel: "Mini Project",
    value: stateProject.project_volume_db,
    onInput: nextValue => {
      const previous = stateProject.project_volume_db;
      const delta = nextValue - previous;
      stateProject.project_volume_db = nextValue;
      _cascadeProject(card, delta);
      _scheduleSave(project.key);
    },
    onReset: () => {
      const delta = -stateProject.project_volume_db;
      stateProject.project_volume_db = 0;
      _cascadeProject(card, delta);
      _scheduleSave(project.key);
      return 0;
    },
  });
  projectSlider.root.classList.add("audio-project-slider");
  projectSlider.root.dataset.role = "project-group";

  header.append(collapseBtn, titleWrap, projectSlider.root);

  const body = document.createElement("div");
  body.className = "audio-project-body";
  body.hidden = !collapseBtn._isOpen();

  collapseBtn._onToggle(open => {
    body.hidden = !open;
  });

  const liveProfile = project.profiles.find(profile => profile.live);
  if (liveProfile) {
    const liveRow = document.createElement("div");
    liveRow.className = "audio-live-banner";
    liveRow.textContent = `Live profile: ${liveProfile.name}`;
    body.appendChild(liveRow);
  }

  project.profiles.forEach(profile => {
    body.appendChild(_buildProfileRow(project, profile));
  });

  card.append(header, body);
  return card;
}

function _buildProfileRow(project, profile) {
  const stateProfile = _state[project.key].profiles[profile.name];
  const projectDb = _state[project.key].project_volume_db;
  const effectiveDb = projectDb + stateProfile.profile_volume_db;

  const row = document.createElement("section");
  row.className = "audio-profile-row";
  row.dataset.profileName = profile.name;

  const header = document.createElement("div");
  header.className = "audio-profile-head";

  const collapseBtn = _collapseButton(`hub-audio-profile:${project.key}:${profile.name}`, false);
  collapseBtn.classList.add("audio-profile-collapse");

  const nameWrap = document.createElement("div");
  nameWrap.className = "audio-profile-name";

  const name = document.createElement("span");
  name.textContent = profile.name;
  nameWrap.appendChild(name);

  if (profile.live) {
    const badge = document.createElement("span");
    badge.className = "badge badge-green";
    badge.textContent = "live";
    nameWrap.appendChild(badge);
  }

  const sliderGroup = _buildSliderGroup({
    interactionKey: _interactionKey(project.key, profile.name, "", "profile"),
    layerLabel: "Profile",
    value: effectiveDb,
    onInput: nextEffectiveDb => {
      stateProfile.profile_volume_db = _round(nextEffectiveDb - _state[project.key].project_volume_db);
      _cascadeProfile(row, project.key, profile.name);
      _scheduleSave(project.key);
    },
    onReset: () => {
      stateProfile.profile_volume_db = 0;
      _cascadeProfile(row, project.key, profile.name);
      _scheduleSave(project.key);
      return _state[project.key].project_volume_db;
    },
  });
  sliderGroup.root.dataset.role = "profile-group";
  sliderGroup.root.dataset.profileName = profile.name;

  header.append(collapseBtn, nameWrap, sliderGroup.root);

  const body = document.createElement("div");
  body.className = "audio-profile-body";
  body.hidden = !collapseBtn._isOpen();

  collapseBtn._onToggle(open => {
    body.hidden = !open;
  });

  const grouped = _groupFiles(profile.files || []);
  if (!grouped.length) {
    const empty = document.createElement("div");
    empty.className = "audio-empty";
    empty.textContent = "No file volume data.";
    body.appendChild(empty);
  } else {
    grouped.forEach(group => {
      body.appendChild(_buildCategoryGroup(project, profile, group));
    });
  }

  row.append(header, body);
  return row;
}

function _buildCategoryGroup(project, profile, group) {
  const wrap = document.createElement("section");
  wrap.className = "audio-category-group";

  const header = document.createElement("button");
  header.type = "button";
  header.className = "audio-category-head";

  const storageKey = `hub-audio-category:${project.key}:${profile.name}:${group.name}`;
  const initialOpen = _readCollapse(storageKey, true);

  const arrow = document.createElement("span");
  arrow.className = "audio-cat-arrow";

  const label = document.createElement("span");
  label.className = "audio-cat-name";
  label.textContent = group.name;

  const count = document.createElement("span");
  count.className = "audio-cat-count";
  count.textContent = String(group.files.length);

  header.append(arrow, label, count);

  const body = document.createElement("div");
  body.className = "audio-category-body";
  body.hidden = !initialOpen;
  arrow.textContent = initialOpen ? "▾" : "▸";

  header.addEventListener("click", () => {
    const open = body.hidden;
    body.hidden = !open;
    arrow.textContent = open ? "▾" : "▸";
    localStorage.setItem(storageKey, open ? "open" : "closed");
  });

  group.files.forEach(file => {
    body.appendChild(_buildFileRow(project, profile, file));
  });

  wrap.append(header, body);
  return wrap;
}

function _buildFileRow(project, profile, file) {
  const row = document.createElement("div");
  row.className = "audio-file-row";
  row.dataset.profileName = profile.name;
  row.dataset.stem = file.stem;

  const nameWrap = document.createElement("div");
  nameWrap.className = "audio-file-meta";

  const name = document.createElement("div");
  name.className = "audio-file-name";
  name.textContent = file.display || file.stem;
  name.title = file.stem;

  const sub = document.createElement("div");
  sub.className = "audio-file-sub";
  sub.textContent = file.stem;

  nameWrap.append(name, sub);

  const offsetChip = document.createElement("span");
  offsetChip.className = "audio-offset-chip";
  offsetChip.title = "File offset relative to project + profile";
  const initOffset = _state[project.key]?.profiles?.[profile.name]?.file_volume_offsets?.[file.stem] ?? 0;
  _applyOffsetChip(offsetChip, initOffset);

  const sliderGroup = _buildSliderGroup({
    interactionKey: _interactionKey(project.key, profile.name, file.stem, "file"),
    layerLabel: "File",
    value: _effectiveDb(project.key, profile.name, file.stem),
    onInput: nextEffectiveDb => {
      const projectDb = _state[project.key].project_volume_db;
      const profileDb = _state[project.key].profiles[profile.name].profile_volume_db;
      const newOffset = _round(nextEffectiveDb - projectDb - profileDb);
      _state[project.key].profiles[profile.name].file_volume_offsets[file.stem] = newOffset;
      _applyOffsetChip(offsetChip, newOffset);
      _scheduleSave(project.key);
    },
    onReset: () => {
      delete _state[project.key].profiles[profile.name].file_volume_offsets[file.stem];
      _applyOffsetChip(offsetChip, 0);
      _scheduleSave(project.key);
      return _effectiveDb(project.key, profile.name, file.stem);
    },
  });
  sliderGroup.root.dataset.role = "file-group";
  sliderGroup.root.dataset.profileName = profile.name;
  sliderGroup.root.dataset.stem = file.stem;

  row.append(nameWrap, offsetChip, sliderGroup.root);
  return row;
}

function _applyOffsetChip(chip, offset) {
  const v = _round(offset);
  if (Math.abs(v) < 0.05) {
    chip.textContent = "";
    chip.className = "audio-offset-chip";
  } else {
    chip.textContent = `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
    chip.className = `audio-offset-chip ${v > 0 ? "audio-offset-pos" : "audio-offset-neg"}`;
  }
}

function _buildSliderGroup({ interactionKey, layerLabel, value, onInput, onReset }) {
  const root = document.createElement("div");
  root.className = "audio-slider-group";

  const label = document.createElement("span");
  label.className = "audio-layer-label";
  label.textContent = layerLabel;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "audio-slider";
  slider.min = String(DB_MIN);
  slider.max = String(DB_MAX);
  slider.step = "0.5";
  slider.value = String(_clamp(value));

  const valueLabel = document.createElement("span");
  valueLabel.className = "audio-db-label";
  valueLabel.textContent = _fmt(_clamp(value));

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn-secondary btn-sm audio-zero-btn";
  resetBtn.textContent = "0";
  resetBtn.title = "Reset this layer";

  let dragging = false;
  const endInteraction = () => {
    if (!dragging) return;
    dragging = false;
    _unlockInteraction(interactionKey);
  };
  const startInteraction = () => {
    if (dragging) return;
    dragging = true;
    _lockInteraction(interactionKey);
  };

  slider.addEventListener("input", () => {
    const nextValue = _clamp(_num(slider.value));
    valueLabel.textContent = _fmt(nextValue);
    onInput(nextValue);
  });
  slider.addEventListener("pointerdown", startInteraction);
  slider.addEventListener("pointerup", endInteraction);
  slider.addEventListener("pointercancel", endInteraction);
  slider.addEventListener("keydown", startInteraction);
  slider.addEventListener("keyup", endInteraction);
  slider.addEventListener("change", endInteraction);
  slider.addEventListener("blur", endInteraction);

  resetBtn.addEventListener("click", () => {
    const nextValue = _clamp(_num(onReset()));
    slider.value = String(nextValue);
    valueLabel.textContent = _fmt(nextValue);
  });

  root.append(label, slider, valueLabel, resetBtn);
  root._slider = slider;
  root._label = valueLabel;
  return { root, slider, valueLabel };
}

function _cascadeProject(card, delta) {
  card.querySelectorAll("[data-role='profile-group']").forEach(group => {
    const slider = group._slider;
    const value = _clamp(_num(slider.value) + delta);
    slider.value = String(value);
    group._label.textContent = _fmt(value);
  });

  card.querySelectorAll("[data-role='file-group']").forEach(group => {
    const slider = group._slider;
    const value = _clamp(_num(slider.value) + delta);
    slider.value = String(value);
    group._label.textContent = _fmt(value);
  });
}

function _cascadeProfile(profileRow, projectKey, profileName) {
  profileRow.querySelectorAll("[data-role='file-group']").forEach(group => {
    const stem = group.dataset.stem;
    const value = _effectiveDb(projectKey, profileName, stem);
    group._slider.value = String(value);
    group._label.textContent = _fmt(value);
  });
}

function _groupFiles(files) {
  const categoryMap = new Map();
  const uncategorized = [];

  files.forEach(file => {
    const categories = Array.isArray(file.categories) ? file.categories : [];
    if (!categories.length) {
      uncategorized.push(file);
      return;
    }
    categories.forEach(category => {
      if (!categoryMap.has(category)) categoryMap.set(category, []);
      categoryMap.get(category).push(file);
    });
  });

  const grouped = [...categoryMap.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([name, groupFiles]) => ({ name, files: groupFiles }));

  if (uncategorized.length) grouped.push({ name: "Uncategorized", files: uncategorized });
  return grouped;
}

function _effectiveDb(projectKey, profileName, stem) {
  const projectDb = _state[projectKey]?.project_volume_db ?? 0;
  const profileDb = _state[projectKey]?.profiles?.[profileName]?.profile_volume_db ?? 0;
  const offsetDb = _state[projectKey]?.profiles?.[profileName]?.file_volume_offsets?.[stem] ?? 0;
  return _clamp(_round(projectDb + profileDb + offsetDb));
}

function _scheduleSave(projectKey) {
  if (_timers[projectKey]) clearTimeout(_timers[projectKey]);
  _timers[projectKey] = setTimeout(() => _save(projectKey), DEBOUNCE_MS);
}

async function _save(projectKey) {
  const stateProject = _state[projectKey];
  delete _timers[projectKey];
  if (!stateProject) return;
  const payload = {
    project: projectKey,
    project_volume_db: stateProject.project_volume_db,
    profiles: Object.fromEntries(
      Object.entries(stateProject.profiles).map(([profileName, profileState]) => [
        profileName,
        {
          profile_volume_db: profileState.profile_volume_db,
          file_volume_offsets: { ...profileState.file_volume_offsets },
        },
      ])
    ),
  };

  try {
    await api.saveAudio(payload);
  } catch (error) {
    toast.error(`Audio save failed: ${error.message}`);
  }
}

async function _refresh({ silent = false } = {}) {
  try {
    const data = await api.getAudio();
    _applyData(data);
    if (_activeInteractions.size) {
      _refreshQueued = true;
      return;
    }
    _render();
  } catch (error) {
    if (!silent) {
      toast.error(`Could not load audio data: ${error.message}`);
      const body = document.getElementById("audioBody");
      if (body) body.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`;
    }
  }
}

function _applyData(data) {
  const nextData = Array.isArray(data.projects) ? data.projects : [];
  const nextState = {};

  nextData.forEach(project => {
    nextState[project.key] = {
      project_volume_db: _num(project.project_volume_db),
      profiles: Object.fromEntries(
        (project.profiles || []).map(profile => [
          profile.name,
          {
            profile_volume_db: _num(profile.profile_volume_db),
            file_volume_offsets: Object.fromEntries(
              (profile.files || []).map(file => [file.stem, _num(file.offset_db)])
            ),
          },
        ])
      ),
    };
  });

  _preserveActiveInteractionState(nextState);
  _data = nextData;
  _state = nextState;
}

function _hasPendingSaves() {
  return Object.values(_timers).some(Boolean);
}

function _interactionKey(projectKey, profileName, stem, role) {
  return [projectKey || "", profileName || "", stem || "", role || ""].join("::");
}

function _lockInteraction(key) {
  _activeInteractions.add(key);
}

function _unlockInteraction(key) {
  _activeInteractions.delete(key);
  if (_activeInteractions.size) return;
  if (_refreshQueued) {
    _refreshQueued = false;
    _render();
  }
}

function _preserveActiveInteractionState(nextState) {
  _activeInteractions.forEach(key => {
    const [projectKey, profileName, stem, role] = key.split("::");
    const currentProject = _state[projectKey];
    const nextProject = nextState[projectKey];
    if (!currentProject || !nextProject) return;

    if (role === "project") {
      nextProject.project_volume_db = currentProject.project_volume_db;
      return;
    }

    const currentProfile = currentProject.profiles?.[profileName];
    const nextProfile = nextProject.profiles?.[profileName];
    if (!currentProfile || !nextProfile) return;

    if (role === "profile") {
      nextProfile.profile_volume_db = currentProfile.profile_volume_db;
      return;
    }

    if (role === "file" && stem) {
      const currentOffset = currentProfile.file_volume_offsets?.[stem];
      nextProfile.file_volume_offsets = { ...nextProfile.file_volume_offsets };
      if (currentOffset == null) delete nextProfile.file_volume_offsets[stem];
      else nextProfile.file_volume_offsets[stem] = currentOffset;
    }
  });
}

function _collapseButton(storageKey, defaultOpen) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "audio-collapse-btn";

  let open = _readCollapse(storageKey, defaultOpen);
  button.textContent = open ? "▼" : "▶";
  button.dataset.collapsed = String(!open);

  button._isOpen = () => open;
  button._onToggle = callback => {
    button.addEventListener("click", () => {
      open = !open;
      button.textContent = open ? "▼" : "▶";
      button.dataset.collapsed = String(!open);
      localStorage.setItem(storageKey, open ? "open" : "closed");
      callback(open);
    });
  };

  return button;
}

function _readCollapse(storageKey, defaultOpen) {
  const raw = localStorage.getItem(storageKey);
  if (raw === "open") return true;
  if (raw === "closed") return false;
  return defaultOpen;
}

function _num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function _round(value) {
  return Math.round(_num(value) * 10) / 10;
}

function _clamp(value) {
  return Math.max(DB_MIN, Math.min(DB_MAX, _round(value)));
}

function _fmt(db) {
  const value = _round(db);
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} dB`;
}
