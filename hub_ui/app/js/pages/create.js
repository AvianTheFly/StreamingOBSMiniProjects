// pages/create.js — New mini-project creation wizard

import { api }   from "../api.js";
import { toast } from "../toast.js";
import { esc }   from "../utils.js";

const TEMPLATES = [
  {
    id:   "blank",
    name: "Blank",
    desc: "Minimal boilerplate: __init__.py, main.py with a basic run() loop.",
    extra: [],
  },
  {
    id:   "media_player",
    name: "Media Player",
    desc: "Like Soundboard / TikTok. Plays audio/video files. Compatible with the Hotkey Editor.",
    extra: [],
  },
  {
    id:   "event_handler",
    name: "Event Handler",
    desc: "Subscribes to a hub event and reacts. Good for SFX responses or OBS scene changes.",
    extra: [
      { key: "event_name", label: "Event name", placeholder: "e.g. game.connected", type: "text" },
    ],
  },
  {
    id:   "voice_triggered",
    name: "Voice Triggered",
    desc: "Listens for a key sequence, opens the mic, and processes Whisper transcripts.",
    extra: [
      { key: "trigger_sequence", label: "Trigger sequence", placeholder: "e.g. / * *", type: "text" },
    ],
  },
];

let _selected = "blank";

export function mount(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">New Project</div>
        <div class="page-subtitle">Generate a new mini-project from a template</div>
      </div>
    </div>

    <div class="create-form">
      <div>
        <div class="rule-label" style="margin-bottom:8px">Project name</div>
        <input id="projName" type="text" placeholder="e.g. my_overlay" style="max-width:280px">
        <div class="field-help">snake_case, letters/digits/underscores only. Creates <code>mini projects/&lt;name&gt;/</code></div>
      </div>

      <div>
        <div class="rule-label" style="margin-bottom:8px">Template</div>
        <div class="template-grid" id="templateGrid"></div>
      </div>

      <div id="extraFields"></div>

      <div>
        <button class="btn btn-primary" id="createBtn">Create project</button>
        <div id="createResult" style="margin-top:12px;font-size:13px;color:var(--muted)"></div>
      </div>
    </div>
  `;

  _renderTemplates(container);
  container.querySelector("#createBtn").addEventListener("click", _create);
}

export function unmount() {}

function _renderTemplates(container) {
  const grid = container.querySelector("#templateGrid");
  grid.innerHTML = "";

  TEMPLATES.forEach(t => {
    const card = document.createElement("button");
    card.className = `template-card ${t.id === _selected ? "selected" : ""}`;
    card.dataset.id = t.id;
    card.innerHTML = `
      <div class="template-card-name">${esc(t.name)}</div>
      <div class="template-card-desc">${esc(t.desc)}</div>
    `;
    card.addEventListener("click", () => {
      _selected = t.id;
      grid.querySelectorAll(".template-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      _renderExtra();
    });
    grid.appendChild(card);
  });

  _renderExtra();
}

function _renderExtra() {
  const el = document.getElementById("extraFields");
  if (!el) return;

  const tmpl = TEMPLATES.find(t => t.id === _selected);
  if (!tmpl?.extra?.length) { el.innerHTML = ""; return; }

  el.innerHTML = tmpl.extra.map(f => `
    <div>
      <div class="rule-label" style="margin-bottom:6px">${esc(f.label)}</div>
      <input id="extra-${esc(f.key)}" type="${esc(f.type)}" placeholder="${esc(f.placeholder)}" style="max-width:320px">
    </div>
  `).join("");
}

async function _create() {
  const name = document.getElementById("projName")?.value?.trim().toLowerCase().replace(/\s+/g, "_");
  if (!name) { toast.error("Project name required"); return; }
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    toast.error("Name must start with a letter and contain only a-z, 0-9, _");
    return;
  }

  const tmpl = TEMPLATES.find(t => t.id === _selected);
  const extra = {};
  tmpl?.extra?.forEach(f => {
    const el = document.getElementById(`extra-${f.key}`);
    if (el) extra[f.key] = el.value.trim();
  });

  const resultEl = document.getElementById("createResult");
  if (resultEl) resultEl.textContent = "Creating…";

  try {
    const res = await api.createProject({ name, template: _selected, ...extra });
    if (resultEl) {
      resultEl.innerHTML = `
        <span style="color:var(--accent)">✓ Created</span>
        <code style="margin-left:8px">${esc(res.path)}</code>
        <span style="margin-left:8px;color:var(--soft)">— restart hub to load</span>
      `;
    }
    toast.success(`Project '${name}' created`);
    document.getElementById("projName").value = "";
  } catch(e) {
    if (resultEl) resultEl.textContent = "";
    toast.error(e.message);
  }
}
