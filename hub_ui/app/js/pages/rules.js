// pages/rules.js - Hub coordination rules editor

import { api } from "../api.js";
import { toast } from "../toast.js";
import { esc, displayName } from "../utils.js";

let _rules = [];
let _audioProjects = [];
let _projects = [];

export async function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Hub Rules</div>
        <div class="page-subtitle">Choose what pauses when another project starts</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="addRuleBtn">+ Add Rule</button>
        <button class="btn btn-primary btn-sm" id="saveRulesBtn">Save</button>
      </div>
    </div>

    <div class="card mb-16">
      <div class="card-title">About Rules</div>
      <p class="rules-copy">
        A rule says: when <b>this project</b> starts, pause the checked projects first.
        If <em>Resume on finish</em> is checked, those projects resume when the requester stops.
        Saved rules live in <code>hub_rules.json</code> and are applied to the running hub immediately.
      </p>
    </div>

    <div id="audioRuleMap" class="rules-audio-map mb-16"></div>
    <div id="rulesList" class="rules-list"></div>
  `;

  container.querySelector("#addRuleBtn").addEventListener("click", _addRule);
  container.querySelector("#saveRulesBtn").addEventListener("click", _saveRules);

  await _load();
}

export function unmount() {}

async function _load() {
  try {
    const [ruleData, projectData] = await Promise.all([
      api.getRules(),
      api.getProjects(),
    ]);
    _rules = _cleanRules(ruleData.rules || []);
    _audioProjects = ruleData.audio_projects || [];
    _projects = (projectData || [])
      .map(p => p.name)
      .filter(Boolean)
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
    _render();
  } catch (e) {
    toast.error(`Failed to load rules: ${e.message}`);
  }
}

function _render() {
  const map = document.getElementById("audioRuleMap");
  if (map) map.innerHTML = _audioMapHtml();

  const list = document.getElementById("rulesList");
  if (!list) return;

  if (!_rules.length) {
    list.innerHTML = `<div class="empty-state">No rules defined. Click "+ Add Rule" to create one.</div>`;
    return;
  }

  list.innerHTML = "";
  _rules.forEach((rule, idx) => list.appendChild(_makeRow(rule, idx)));
}

function _makeRow(rule, idx) {
  const row = document.createElement("div");
  row.className = "rule-row";

  row.innerHTML = `
    <div>
      <div class="rule-label">When this plays</div>
      <select class="rule-requester">
        ${_projectOptions(rule.requester)}
      </select>
    </div>
    <div class="rule-arrow">-></div>
    <div>
      <div class="rule-label">Pause these projects</div>
      <div class="rule-project-grid">
        ${_projectChecks(rule)}
      </div>
    </div>
    <label class="resume-toggle">
      <input type="checkbox" class="resume-check" ${rule.resume_on_finish ? "checked" : ""}>
      Resume on finish
    </label>
    <button class="btn btn-icon rule-delete-btn" title="Delete rule">x</button>
  `;

  row.querySelector(".rule-requester").addEventListener("change", e => {
    _rules[idx].requester = e.target.value.trim();
    _rules[idx].pause = _rules[idx].pause.filter(name => name !== _rules[idx].requester);
    _render();
  });

  row.querySelectorAll(".rule-project-checkbox").forEach(input => {
    input.addEventListener("change", e => {
      const name = e.target.dataset.project;
      const pause = new Set(_rules[idx].pause || []);
      if (e.target.checked) pause.add(name);
      else pause.delete(name);
      pause.delete(_rules[idx].requester);
      _rules[idx].pause = [...pause];
    });
  });

  row.querySelector(".resume-check").addEventListener("change", e => {
    _rules[idx].resume_on_finish = e.target.checked;
  });

  row.querySelector(".rule-delete-btn").addEventListener("click", () => {
    _rules.splice(idx, 1);
    _render();
  });

  return row;
}

function _audioMapHtml() {
  const chips = _audioProjects.length
    ? _audioProjects
        .map(name => `<span class="badge badge-audio">${esc(displayName(name))}</span>`)
        .join("")
    : `<span class="rule-map-empty">No audio projects reported by the hub.</span>`;

  return `
    <div class="rule-map-title">Audio Projects</div>
    <div class="rule-map-copy">These are highlighted in rule checklists so audio coordination is visible instead of hidden.</div>
    <div class="rule-map-note">
      <span class="badge badge-audio">tip</span>
      <span>Use <b>Resume on finish</b> for projects like Instant Replay when you want paused playback to continue from where it left off instead of restarting.</span>
    </div>
    <div class="rule-map-chips">${chips}</div>
  `;
}

function _projectOptions(selected) {
  const names = _knownProjectNames(selected);
  const placeholder = `<option value="">Choose project...</option>`;
  return placeholder + names.map(name => `
    <option value="${esc(name)}" ${name === selected ? "selected" : ""}>
      ${esc(displayName(name))}
    </option>
  `).join("");
}

function _projectChecks(rule) {
  const names = _knownProjectNames(...(rule.pause || []), rule.requester);
  if (!names.length) {
    return `<div class="rule-map-empty">No projects found yet.</div>`;
  }

  const pause = new Set(rule.pause || []);
  return names.map(name => {
    const isRequester = name === rule.requester;
    const isAudio = _audioProjects.includes(name);
    return `
      <label class="rule-project-check ${isAudio ? "is-audio" : ""} ${isRequester ? "is-disabled" : ""}">
        <input
          class="rule-project-checkbox"
          type="checkbox"
          data-project="${esc(name)}"
          ${pause.has(name) && !isRequester ? "checked" : ""}
          ${isRequester ? "disabled" : ""}
        >
        <span>${esc(displayName(name))}</span>
        ${isAudio ? `<span class="badge badge-audio">audio</span>` : ""}
      </label>
    `;
  }).join("");
}

function _knownProjectNames(...extraNames) {
  return [...new Set([
    ..._projects,
    ..._audioProjects,
    ...extraNames.filter(Boolean),
  ])].sort((a, b) => displayName(a).localeCompare(displayName(b)));
}

function _addRule() {
  _rules.push({ requester: "", pause: [], resume_on_finish: true });
  _render();
  const rows = document.querySelectorAll(".rule-requester");
  if (rows.length) rows[rows.length - 1].focus();
}

async function _saveRules() {
  const valid = _cleanRules(_rules).filter(r => r.requester);
  try {
    await api.saveRules(valid);
    _rules = valid;
    toast.success("Rules saved and applied");
    _render();
  } catch (e) {
    toast.error(`Save failed: ${e.message}`);
  }
}

function _cleanRules(rules) {
  return rules.map(rule => {
    const requester = String(rule.requester || "").trim();
    const pause = [...new Set(rule.pause || [])]
      .map(name => String(name || "").trim())
      .filter(name => name && name !== requester);
    return {
      requester,
      pause,
      resume_on_finish: rule.resume_on_finish !== false,
    };
  });
}
