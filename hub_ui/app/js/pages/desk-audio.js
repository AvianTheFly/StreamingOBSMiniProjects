// Small physical-source mixer. OBS and the existing audio API own source levels.
import { api } from '../api.js';
import { state } from '../state.js';
import { esc } from '../utils.js';
import { runWithFeedback } from '../action-feedback.js';
import { icon } from '../catalog.js';

const MIC = new Set(['wasapi_input_capture', 'pulse_input_capture', 'coreaudio_input_capture']);
const DESKTOP = new Set(['wasapi_output_capture', 'pulse_output_capture', 'coreaudio_output_capture']);
const rounded = value => Math.max(-60, Math.min(6, Math.round(Number(value) * 2) / 2));
const levelText = value => value == null || !Number.isFinite(Number(value)) ? 'Unavailable' : `${Number(value).toFixed(1)} dB`;

export function mountDeskAudio(host, feedback) {
  let disposed = false, timer = null, fetching = false, generation = 0;
  let inputs = [], fresh = false, attempted = false;
  const rows = new Map(), busy = new Set(), editing = new Set(), pendingLevels = new Map();
  const connected = () => state.get('connected');

  function render() {
    if (disposed) return;
    const shown = inputs.filter(i => MIC.has(i.kind) || DESKTOP.has(i.kind))
      .sort((a, b) => Number(MIC.has(b.kind)) - Number(MIC.has(a.kind)));
    const names = new Set(shown.map(i => i.name));
    for (const [name, row] of rows) if (!names.has(name)) {row.remove(); rows.delete(name);}
    host.querySelector('.desk-empty')?.remove();
    if (!shown.length) {
      const empty = document.createElement('p'); empty.className = 'desk-empty';
      empty.textContent = !attempted ? 'Loading audio…' : !connected() || !fresh ? 'Audio status unavailable' : 'No microphone or desktop sources';
      host.append(empty);
    }
    shown.forEach(input => {
      let row = rows.get(input.name);
      if (!row) {
        row = document.createElement('div');row.className = 'desk-audio-channel';row.dataset.audioInput = input.name;
        row.innerHTML = `<div class="desk-audio-channel-heading">${icon(MIC.has(input.kind) ? 'voice' : 'audio')}<strong>${esc(input.name)}</strong><button class="btn btn-secondary" data-desk-mute></button></div><label class="desk-audio-level"><span>Volume <output>${esc(levelText(input.volume_db))}</output></span><input type="range" min="-60" max="6" step="0.5" aria-label="${esc(input.name)} volume"></label><span class="desk-audio-channel-state"></span>`;
        const slider = row.querySelector('input');
        slider.addEventListener('input', () => {editing.add(input.name);row.querySelector('output').textContent = levelText(slider.value);});
        slider.addEventListener('change', async () => {
          const value = rounded(slider.value);
          editing.delete(input.name);
          if(busy.has(input.name)) {generation++;pendingLevels.set(input.name,value);return;}
          await adjust(input.name, {volume_db: value}, slider, `${input.name} volume saved`);
        });
        slider.addEventListener('blur', () => {if(!busy.has(input.name)) {editing.delete(input.name);render();}});
        const mute = row.querySelector('button');
        mute.onclick = () => {
          const current = inputs.find(i => i.name === input.name);
          if(current) adjust(input.name, {muted: !current.muted}, mute, `${input.name} ${current.muted ? 'unmuted' : 'muted'}`);
        };
        rows.set(input.name, row);host.append(row);
      }
      const available = connected() && fresh && !busy.has(input.name);
      const slider = row.querySelector('input'), mute = row.querySelector('button');
      slider.disabled = !connected() || !fresh || (busy.has(input.name) && !slider.hasAttribute('aria-busy'));
      mute.dataset.available = String(available);
      if (!mute.hasAttribute('aria-busy')) {
        mute.disabled = !available;
        mute.textContent = input.muted ? 'Unmute' : 'Mute';
        mute.setAttribute('aria-label', `${input.muted ? 'Unmute' : 'Mute'} ${input.name}`);
        mute.setAttribute('aria-pressed', String(input.muted));
      }
      if (!editing.has(input.name) && !busy.has(input.name) && document.activeElement !== slider) {
        slider.value = rounded(input.volume_db);row.querySelector('output').textContent = levelText(input.volume_db);
      }
      row.querySelector('.desk-audio-channel-state').textContent = !connected() || !fresh ? 'Status unavailable' : slider.hasAttribute('aria-busy') ? 'Updating volume…' : input.muted ? 'Muted in OBS' : '';
      row.dataset.muted = String(input.muted);
    });
  }

  async function adjust(name, changes, control, message) {
    if(disposed || busy.has(name) || !fresh || !connected())return;
    generation++;busy.add(name);
    feedback.textContent='';
    // Pending feedback handles repeated buttons; only the named source is edited.
    let result;
    if (control.tagName === 'BUTTON') {
      const pending=runWithFeedback(control, () => api.setObsAudio(name, changes), message);
      render();result=await pending;
    }
    else {
      control.setAttribute('aria-busy', 'true');render();
      try {result = await api.setObsAudio(name, changes);if(result?.ok===false)throw Error(result.error || 'Volume change rejected');}
      catch(e) {result=undefined;feedback.textContent = e.message;}
      finally {control.removeAttribute('aria-busy');}
    }
    if(disposed)return;
    generation++;
    if(result !== undefined) {
      const current = inputs.find(i => i.name === name);if(current)Object.assign(current, changes);
      feedback.textContent = message;
    } else if(!pendingLevels.has(name)) {
      const current=inputs.find(i=>i.name===name),row=rows.get(name);
      if(current && row) {row.querySelector('input').value=rounded(current.volume_db);row.querySelector('output').textContent=levelText(current.volume_db);}
    }
    busy.delete(name);
    if(pendingLevels.has(name)) {
      const latest=pendingLevels.get(name);pendingLevels.delete(name);
      if(connected() && fresh) {adjust(name,{volume_db:latest},control,message);return;}
    }
    render();poll();
  }

  async function poll() {
    if(disposed || fetching)return;
    clearTimeout(timer);
    if(document.hidden) {timer=setTimeout(poll,8000);return;}
    const intent = generation;fetching=true;
    try {
      const data = await api.getObsAudio();
      if(disposed || intent!==generation)return;
      if(!Array.isArray(data.inputs))throw Error('Audio status unavailable');
      inputs=data.inputs;fresh=true;attempted=true;render();
    } catch {
      if(!disposed && intent===generation) {fresh=false;attempted=true;render();}
    } finally {
      fetching=false;if(!disposed)timer=setTimeout(poll,8000);
    }
  }
  const unwatch = state.watch('connected', () => {render();if(connected())poll();});
  poll();
  return {dispose() {disposed=true;generation++;clearTimeout(timer);pendingLevels.clear();unwatch();}};
}
