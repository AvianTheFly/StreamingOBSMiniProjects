// pages/settings.js — Global hub settings

import { api }   from "../api.js";
import { toast } from "../toast.js";
import { esc }   from "../utils.js";

const TRIGGER_PROJECTS = [
  { key: "specific_song", label: "Specific Song",  desc: "ili trigger" },
  { key: "tik_tok",       label: "TikTok",          desc: "media trigger" },
  { key: "soundboard",    label: "Soundboard",      desc: "media trigger" },
  { key: "sound_effects", label: "Sound Effects",   desc: "989 trigger" },
];

const TRIGGER_MODE_OPTIONS = [
  { value: "abort",        label: "Abort — stop immediately, open mic" },
  { value: "pause",        label: "Pause — hold position; resume if no match" },
  { value: "keep_playing", label: "Keep playing — only swap if new match found" },
];

const FIELDS = [
  {
    section: "Voice / Whisper",
    fields: [
      { key: "whisper_model",    label: "Model",    type: "text",   help: 'e.g. "large-v3" or a local path' },
      { key: "whisper_device",   label: "Device",   type: "text",   help: '"cuda" for GPU, "cpu" for CPU' },
      { key: "whisper_compute",  label: "Compute",  type: "text",   help: '"float16" (GPU) or "int8" (CPU)' },
      { key: "whisper_language", label: "Language", type: "text",   help: '"en" for English' },
    ],
  },
  {
    section: "Microphone",
    fields: [
      { key: "mic_device",      label: "Device Index", type: "number", help: "Run tools/mic_test.py to find your index" },
      { key: "mic_sample_rate", label: "Sample Rate",  type: "number", help: "Usually 16000" },
      { key: "rms_threshold",   label: "RMS Threshold",type: "number", step: "0.001", help: "Silence floor (0.01 is a safe default)" },
    ],
  },
];

let _settings = {};
let _actions = [];
let _actionHotkeys = {};
let _workflows = [];
let _projects = [];

export async function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Settings</div>
        <div class="page-subtitle">Global hub configuration — restart required for some changes</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" id="saveSettingsBtn">Save</button>
      </div>
    </div>

    <div class="card mb-16" style="max-width:680px">
      <p style="font-size:13px;color:var(--muted);line-height:1.6">
        These settings override the values in <code>hub_config.py</code> and are persisted in
        <code>hub_settings.json</code>. OBS connection settings are in <code>.env</code> (see <code>.env.example</code>).
        Changes to Whisper/mic settings take effect after restarting the hub.
      </p>
    </div>

    <form id="settingsForm" class="settings-form" style="max-width:680px"></form>
    <div id="hubActionsForm" class="settings-form mt-12" style="max-width:900px"></div>
  `;

  container.querySelector("#saveSettingsBtn").addEventListener("click", _save);

  try {
    const [settings, actionData, status] = await Promise.all([
      api.getSettings(),
      api.getHubActions(),
      api.getStatus(),
    ]);
    _settings = settings;
    _actions = actionData.actions || [];
    _actionHotkeys = actionData.hotkeys || {};
    _workflows = Array.isArray(actionData.workflows) ? actionData.workflows : [];
    _projects = (status.projects || []).map(p => p.name).filter(Boolean).sort();
    _render();
  } catch(e) {
    toast.error(`Could not load settings: ${e.message}`);
  }
}

export function unmount() {}

function _render() {
  const form = document.getElementById("settingsForm");
  if (!form) return;
  form.innerHTML = "";

  FIELDS.forEach(({ section, fields }) => {
    const sec = document.createElement("div");
    sec.className = "settings-section";
    sec.innerHTML = `<div class="settings-section-title">${esc(section)}</div>`;

    fields.forEach(f => {
      const row = document.createElement("div");
      row.className = "field-row";
      const val = _settings[f.key] ?? "";
      row.innerHTML = `
        <div class="field-label">${esc(f.label)}</div>
        <div>
          <input id="field-${esc(f.key)}" type="${esc(f.type)}"
                 value="${esc(String(val))}"
                 ${f.step ? `step="${esc(f.step)}"` : ""}>
          ${f.help ? `<div class="field-help">${esc(f.help)}</div>` : ""}
        </div>
      `;
      sec.appendChild(row);
    });

    form.appendChild(sec);
  });

  _renderHubActions();
  _renderWorkflows();
  _renderProjectTriggerModes();
}

function _renderHubActions() {
  const form = document.getElementById("hubActionsForm");
  if (!form) return;
  form.innerHTML = "";

  const sec = document.createElement("div");
  sec.className = "settings-section";
  sec.innerHTML = `
    <div class="settings-section-title">Hub Hotkeys</div>
    <div class="field-help">
      Global hub actions can control multiple projects at once. Use quick typed sequences like <code>0 0 0</code> or <code>a b c</code>.
    </div>
    <div class="hub-action-grid"></div>
  `;

  const grid = sec.querySelector(".hub-action-grid");
  if (!_actions.length) {
    grid.innerHTML = `<div class="empty-state">No hub actions available.</div>`;
  }

  _actions.forEach(action => {
    const cfg = _actionHotkeys[action.id] || {};
    const card = document.createElement("div");
    card.className = "hub-action-card";
    card.innerHTML = `
      <div>
        <div class="hub-action-title">${esc(action.label)}</div>
        <div class="field-help">${esc(action.description || "")}</div>
      </div>
      <label class="resume-toggle">
        <input type="checkbox" data-action-enabled="${esc(action.id)}" ${cfg.enabled ? "checked" : ""}>
        Enabled
      </label>
      <label class="field-row compact">
        <span class="field-label">Sequence</span>
        <input type="text" data-action-sequence="${esc(action.id)}" value="${esc(cfg.sequence || "")}" placeholder="example: 0 0 0">
      </label>
      <button type="button" class="btn btn-secondary btn-sm" data-action-run="${esc(action.id)}">Run now</button>
    `;
    card.querySelector("[data-action-run]").addEventListener("click", async () => {
      try {
        const result = await api.runHubAction(action.id);
        toast.success(result.message || "Hub action ran");
      } catch (e) {
        toast.error(`Action failed: ${e.message}`);
      }
    });
    grid.appendChild(card);
  });

  form.appendChild(sec);
}

function _renderProjectTriggerModes() {
  const form = document.getElementById("hubActionsForm");
  if (!form) return;
  const modes = _settings.project_trigger_modes || {};
  const sec = document.createElement("div");
  sec.className = "settings-section";
  sec.innerHTML = `
    <div class="settings-section-title">Project Trigger Behavior</div>
    <div class="field-help" style="margin-bottom:12px">
      Controls what happens when the hotkey trigger is pressed while media is already playing.
      <br><strong>Abort</strong> — stops immediately, then opens mic for a new pick.
      <strong>Pause</strong> — pauses at current position; resumes automatically if no voice match is found.
      <strong>Keep playing</strong> — leaves media running and opens the mic; only swaps if a new match is found.
    </div>
    <div class="hub-action-grid"></div>
  `;
  const grid = sec.querySelector(".hub-action-grid");
  TRIGGER_PROJECTS.forEach(({ key, label, desc }) => {
    const current = modes[key] || "abort";
    const card = document.createElement("div");
    card.className = "hub-action-card";
    card.style.gridTemplateColumns = "minmax(140px, 220px) 1fr";
    card.innerHTML = `
      <div>
        <div class="hub-action-title">${esc(label)}</div>
        <div class="field-help">${esc(desc)}</div>
      </div>
      <select data-trigger-mode="${esc(key)}">
        ${TRIGGER_MODE_OPTIONS.map(o =>
          `<option value="${esc(o.value)}"${current === o.value ? " selected" : ""}>${esc(o.label)}</option>`
        ).join("")}
      </select>
    `;
    grid.appendChild(card);
  });
  form.appendChild(sec);
}

function _renderWorkflows() {
  const form = document.getElementById("hubActionsForm");
  if (!form) return;
  const sec = document.createElement("div");
  sec.className = "settings-section";
  sec.innerHTML = `
    <div class="settings-section-title">Hub Workflows</div>
    <div class="field-help">One hotkey can run several mini-project interface actions in order.</div>
    <div id="workflowList" class="workflow-list"></div>
    <button type="button" class="btn btn-secondary btn-sm" id="addWorkflowBtn">+ Add Workflow</button>
  `;
  form.appendChild(sec);
  const list = sec.querySelector("#workflowList");
  _workflows.forEach((workflow, idx) => list.appendChild(_workflowCard(workflow, idx)));
  sec.querySelector("#addWorkflowBtn").addEventListener("click", () => {
    _workflows.push({
      id: `workflow_${Date.now()}`,
      name: "New Workflow",
      enabled: false,
      sequence: "",
      steps: [{ kind: "project", project: _projects[0] || "", action: "revert" }],
    });
    _render();
  });
}

function _workflowCard(workflow, idx) {
  const card = document.createElement("div");
  card.className = "workflow-card";
  card.innerHTML = `
    <div class="workflow-head">
      <input class="workflow-name" value="${esc(workflow.name || "")}" placeholder="Workflow name">
      <label class="resume-toggle"><input type="checkbox" class="workflow-enabled" ${workflow.enabled ? "checked" : ""}> Enabled</label>
      <input class="workflow-sequence" value="${esc(workflow.sequence || "")}" placeholder="hotkey sequence">
      <button type="button" class="btn btn-secondary btn-sm workflow-run">Run now</button>
      <button type="button" class="btn btn-icon workflow-delete">x</button>
    </div>
    <div class="workflow-steps"></div>
    <button type="button" class="btn btn-secondary btn-sm workflow-add-step">+ Step</button>
  `;
  const sync = () => {
    workflow.name = card.querySelector(".workflow-name").value.trim() || "Workflow";
    workflow.enabled = card.querySelector(".workflow-enabled").checked;
    workflow.sequence = card.querySelector(".workflow-sequence").value.trim();
  };
  card.querySelectorAll(".workflow-name,.workflow-enabled,.workflow-sequence").forEach(el => el.addEventListener("input", sync));
  const stepsEl = card.querySelector(".workflow-steps");
  (workflow.steps || []).forEach((step, stepIdx) => stepsEl.appendChild(_workflowStep(workflow, step, stepIdx)));
  card.querySelector(".workflow-add-step").addEventListener("click", () => {
    workflow.steps = workflow.steps || [];
    workflow.steps.push({ kind: "project", project: _projects[0] || "", action: "revert" });
    _render();
  });
  card.querySelector(".workflow-delete").addEventListener("click", () => {
    _workflows.splice(idx, 1);
    _render();
  });
  card.querySelector(".workflow-run").addEventListener("click", async () => {
    sync();
    try {
      await api.saveSettings({ ..._settings, hub_workflows: _workflows });
      const result = await api.runWorkflow(workflow.id);
      toast.success(result.message || "Workflow ran");
    } catch (e) {
      toast.error(e.message);
    }
  });
  return card;
}

function _workflowStep(workflow, step, stepIdx) {
  const row = document.createElement("div");
  row.className = "workflow-step";
  const projectOptions = _projects.map(name => `<option value="${esc(name)}" ${step.project === name ? "selected" : ""}>${esc(name)}</option>`).join("");
  const hubActionOptions = _actions.map(action => `<option value="${esc(action.id)}" ${step.action_id === action.id ? "selected" : ""}>${esc(action.label)}</option>`).join("");
  row.innerHTML = `
    <select class="step-kind">
      <option value="project" ${step.kind !== "hub_action" ? "selected" : ""}>Project action</option>
      <option value="hub_action" ${step.kind === "hub_action" ? "selected" : ""}>Hub action</option>
    </select>
    <select class="step-project">${projectOptions}</select>
    <select class="step-action">
      <option value="revert" ${step.action === "revert" ? "selected" : ""}>revert</option>
      <option value="pause" ${step.action === "pause" ? "selected" : ""}>pause</option>
      <option value="resume" ${step.action === "resume" ? "selected" : ""}>resume</option>
    </select>
    <select class="step-hub-action">${hubActionOptions}</select>
    <button type="button" class="btn btn-icon step-delete">x</button>
  `;
  const sync = () => {
    step.kind = row.querySelector(".step-kind").value;
    step.project = row.querySelector(".step-project").value;
    step.action = row.querySelector(".step-action").value;
    step.action_id = row.querySelector(".step-hub-action").value;
    row.classList.toggle("is-hub-action", step.kind === "hub_action");
  };
  row.querySelectorAll("select").forEach(el => el.addEventListener("change", sync));
  row.querySelector(".step-delete").addEventListener("click", () => {
    workflow.steps.splice(stepIdx, 1);
    _render();
  });
  sync();
  return row;
}

async function _save() {
  // Collect all values
  FIELDS.forEach(({ fields }) => {
    fields.forEach(f => {
      const el = document.getElementById(`field-${f.key}`);
      if (!el) return;
      _settings[f.key] = f.type === "number" ? Number(el.value) : el.value;
    });
  });

  _settings.project_trigger_modes = _settings.project_trigger_modes || {};
  TRIGGER_PROJECTS.forEach(({ key }) => {
    const el = document.querySelector(`[data-trigger-mode="${CSS.escape(key)}"]`);
    if (el) _settings.project_trigger_modes[key] = el.value;
  });

  _settings.hub_hotkeys = _settings.hub_hotkeys || {};
  _actions.forEach(action => {
    const enabled = document.querySelector(`[data-action-enabled="${CSS.escape(action.id)}"]`)?.checked || false;
    const sequence = document.querySelector(`[data-action-sequence="${CSS.escape(action.id)}"]`)?.value.trim() || "";
    _settings.hub_hotkeys[action.id] = {
      ...(_settings.hub_hotkeys[action.id] || {}),
      enabled,
      sequence,
      max_interval: Number(_settings.hub_hotkeys[action.id]?.max_interval || 0.8),
    };
  });
  _settings.hub_workflows = _workflows;

  try {
    await api.saveSettings(_settings);
    toast.success("Settings saved - hub hotkeys update immediately; voice/mic changes need restart");
  } catch(e) {
    toast.error(`Save failed: ${e.message}`);
  }
}
