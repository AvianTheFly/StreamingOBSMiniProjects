import { state } from './state.js';
import { API } from './constants.js';
import { render } from './render.js';

function fieldValue(field, settings) {
  const current = settings.current || {};
  const value = current[field.key];
  if (field.type === 'hotkey_map' && value && typeof value === 'object') {
    return Object.entries(value).map(([key, val]) => `${key}=${val || ''}`).join('; ');
  }
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  return String(value);
}

function parseValue(field, raw) {
  if (field.type === 'boolean') return !!raw;
  const text = String(raw ?? '').trim();
  if (field.key === 'valid_extensions') {
    return text.split(',').map(item => item.trim()).filter(Boolean);
  }
  if (field.type === 'hotkey_map') {
    const out = {};
    text.replace(/\n/g, ';').split(';').forEach(part => {
      const idx = part.indexOf('=');
      if (idx < 0) return;
      const key = part.slice(0, idx).trim();
      if (!key) return;
      out[key] = part.slice(idx + 1).trim();
    });
    return out;
  }
  if (field.type === 'number') {
    if (!text) return '';
    const value = Number(text);
    return Number.isFinite(value) ? value : text;
  }
  return text;
}

function buildField(field, settings) {
  const label = document.createElement('label');
  label.className = 'project-setting-field';
  label.dataset.key = field.key;

  const top = document.createElement('span');
  top.className = 'project-setting-label';
  top.textContent = field.label;

  let input;
  if (field.type === 'boolean') {
    input = document.createElement('select');
    [['true', 'On'], ['false', 'Off']].forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.appendChild(option);
    });
    input.value = String(Boolean(settings.current?.[field.key]));
  } else if (field.type === 'select') {
    input = document.createElement('select');
    (field.options || []).forEach(optionData => {
      const [value, text] = Array.isArray(optionData) ? optionData : [optionData, optionData];
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.appendChild(option);
    });
    input.value = fieldValue(field, settings);
  } else if (field.type === 'hotkey_map') {
    input = document.createElement('textarea');
    input.rows = 3;
    input.value = fieldValue(field, settings);
  } else if (field.type === 'info') {
    const val = settings.current?.[field.key];
    const div = document.createElement('div');
    div.className = 'project-setting-info';
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const ul = document.createElement('ul');
      ul.className = 'project-setting-info-list';
      Object.entries(val).forEach(([cmd, aliases]) => {
        const li = document.createElement('li');
        const examples = Array.isArray(aliases) ? aliases.slice(0, 3).join(', ') : String(aliases);
        const more = Array.isArray(aliases) && aliases.length > 3 ? ` +${aliases.length - 3}` : '';
        li.innerHTML = `<strong>${cmd}</strong> — ${examples}${more}`;
        ul.appendChild(li);
      });
      div.appendChild(ul);
    } else if (val) {
      div.textContent = String(val);
    }
    const infoHelp = document.createElement('span');
    infoHelp.className = 'project-setting-help';
    infoHelp.textContent = field.help || '';
    label.appendChild(top);
    label.appendChild(div);
    label.appendChild(infoHelp);
    return label;  // no data-setting-key → save skips it
  } else {
    input = document.createElement('input');
    input.type = field.type === 'number' ? 'number' : 'text';
    if (field.step) input.step = field.step;
    input.value = fieldValue(field, settings);
  }
  input.dataset.settingKey = field.key;

  const help = document.createElement('span');
  help.className = 'project-setting-help';
  help.textContent = field.help || '';

  const defaultValue = settings.defaults?.[field.key];
  const hint = document.createElement('span');
  hint.className = 'project-setting-default';
  hint.textContent = defaultValue === undefined || defaultValue === ''
    ? ''
    : `Default: ${Array.isArray(defaultValue) ? defaultValue.join(', ') : defaultValue}`;

  label.appendChild(top);
  label.appendChild(input);
  label.appendChild(help);
  if (hint.textContent) label.appendChild(hint);
  return label;
}

export function renderProjectSettings() {
  const grid = document.getElementById('project-settings-grid');
  if (!grid) return;
  const settings = state.configSettings || {};
  const fields = state.configFields || settings.fields || [];
  grid.innerHTML = '';
  let lastSection = '';
  fields.forEach(field => {
    const section = field.section || 'Settings';
    if (section !== lastSection) {
      const heading = document.createElement('div');
      heading.className = 'project-settings-section';
      heading.textContent = section;
      grid.appendChild(heading);
      lastSection = section;
    }
    grid.appendChild(buildField(field, settings));
  });
}

export function setProjectSettingsOpen(open) {
  state.settingsOpen = !!open;
  const panel = document.getElementById('project-settings-panel');
  const toggle = document.getElementById('project-settings-toggle');
  if (panel) panel.hidden = !state.settingsOpen;
  if (toggle) toggle.classList.toggle('active', state.settingsOpen);
  if (state.settingsOpen) renderProjectSettings();
}

export async function saveProjectSettings() {
  const status = document.getElementById('project-settings-status');
  const button = document.getElementById('project-settings-save');
  const settings = {};
  (state.configFields || []).forEach(field => {
    const input = document.querySelector(`[data-setting-key="${CSS.escape(field.key)}"]`);
    if (!input) return;
    const raw = field.type === 'boolean' ? input.value === 'true' : input.value;
    settings[field.key] = parseValue(field, raw);
  });

  if (status) status.textContent = 'Saving...';
  if (button) button.disabled = true;
  try {
    const res = await fetch(`${API}/api/config/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not save settings');
    state.configSettings = data.config_settings || state.configSettings;
    state.configFields = state.configSettings.fields || state.configFields;
    if (Array.isArray(data.sounds)) state.sounds = data.sounds;
    if (status) status.textContent = 'Saved. Restart the mini project to apply runtime changes.';
    renderProjectSettings();
    render();
  } catch (err) {
    if (status) status.textContent = err.message;
  } finally {
    if (button) button.disabled = false;
  }
}
