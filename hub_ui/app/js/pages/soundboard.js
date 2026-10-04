// Soundboard and short-video controls. Saved bindings stay with the editor owner.
import { api } from '../api.js';
import { state } from '../state.js';
import { esc } from '../utils.js';
import { feature, icon } from '../catalog.js';
import { runWithFeedback } from '../action-feedback.js';
import { mountProjectHotkeyPanel, unmountProjectHotkeyPanel } from '../project-hotkeys.js';

let _dispose = null;
const LABELS = { start_listen: 'Listen for a sound', stop_listen: 'Finish listening', abort_listen: 'Cancel listening', random: 'Play random', next: 'Next item', stop: 'Stop playback', pause: 'Pause', resume: 'Resume', reload: 'Reload library', test_muffins: 'Preview Muffin Dance' };
const GROUPS = [
  { label: 'Play something', help: 'Let the Hub choose, or speak the name of a saved sound.', keys: ['random', 'start_listen'] },
  { label: 'Playback', help: 'Control the current item.', keys: ['pause', 'resume', 'next', 'stop'] },
  { label: 'Voice capture', help: 'Finish to send your voice request, or cancel it.', keys: ['stop_listen', 'abort_listen'] },
];
export function mount(container, projectName = 'soundboard') {
  const f = feature(projectName);
  let disposed = false;
  let signature = '';
  let hotkeysMounted = false;
  container.innerHTML = `<div class="page-header"><div><div class="desk-eyebrow">${projectName === 'soundboard' ? 'Sounds for the moment' : 'Short clips, ready to play'}</div><h1 class="page-title">${esc(f.label)}</h1><p class="page-subtitle">Play, pause and listen. Your saved sounds and keys stay in your library.</p></div><div class="page-actions"><a href="/editor" target="_blank" rel="noopener" class="btn btn-primary">${icon('library')}Edit sounds &amp; keys ↗</a><a href="#audio" class="btn btn-secondary">Audio levels</a></div></div><div class="soundboard-status"><span class="feature-icon">${icon(f.icon)}</span><div><strong id="sbLabel">Loading controls…</strong><p id="sbActivity">Connecting to the Hub</p></div><span class="feature-state" id="sbProfile"></span></div><div class="soundboard-controls" id="sbActionGrid"></div><details class="feature-disclosure"><summary>Hotkeys &amp; profiles <span>Review or edit your saved bindings</span></summary><div id="sbHotkeys" class="mt-16"></div></details><details class="feature-disclosure"><summary>Routing &amp; maintenance <span>OBS scene, levels and library refresh</span></summary><div class="card mt-16"><div class="project-summary-list"><div><span>OBS scene</span><strong id="sbScenes">—</strong></div><div><span>Project level</span><strong id="sbVolume">—</strong></div></div><div class="mood-actions mt-16" id="sbMaintenance"></div><p class="field-help mt-12">For individual sounds, use Saved media in Audio. Placement, filters and voice phrases are in the media editor.</p></div></details>`;
  const hotkeyDrawer = container.querySelector('.feature-disclosure');
  hotkeyDrawer.addEventListener('toggle', () => {
    if (hotkeyDrawer.open && !hotkeysMounted) {
      hotkeysMounted = true;
      mountProjectHotkeyPanel(container.querySelector('#sbHotkeys'), projectName);
    }
  });
  function actionButton(a, primary = false) {
    const label = projectName === 'tik_tok' && a.key === 'start_listen' ? 'Listen for a clip' : LABELS[a.key] || a.label || a.key;
    return `<button class="btn ${a.key === 'stop' ? 'btn-danger' : primary ? 'btn-primary' : 'btn-secondary'}" data-project-action="${esc(a.key)}" title="${esc(a.description || '')}">${esc(label)}</button>`;
  }
  function update() {
    if (disposed) return;
    const p = state.getProject(projectName);
    const actions = p?.actions || [];
    container.querySelector('#sbLabel').textContent = p ? (p.is_active ? 'Active' : 'Ready to play') : 'Feature unavailable';
    container.querySelector('#sbActivity').textContent = p?.current_activity || (p ? 'Nothing playing right now.' : 'Waiting for the feature to connect.');
    container.querySelector('#sbProfile').textContent = p?.volume?.profile ? `Profile: ${p.volume.profile}` : '';
    container.querySelector('#sbScenes').textContent = p?.controlled_scenes?.join(', ') || 'No scene reported';
    const db = p?.volume?.project_volume_db;
    container.querySelector('#sbVolume').textContent = db != null && Number.isFinite(Number(db)) ? `${Number(db).toFixed(1)} dB` : 'See Audio for saved levels';
    const nextSignature = actions.map(a => a.key).join(',');
    if (signature !== nextSignature || !container.querySelector('#sbActionGrid').children.length) {
      signature = nextSignature;
      container.querySelector('#sbActionGrid').innerHTML = actions.length ? GROUPS.map(g => `<section class="card"><h2>${g.label}</h2><p>${g.help}</p><div class="mood-actions">${g.keys.map((key, i) => actions.find(a => a.key === key)).filter(Boolean).map((a, i) => actionButton(a, g.label === 'Play something' && i === 0)).join('')}</div></section>`).join('') : '<p class="desk-empty">Controls will appear when this feature is available.</p>';
      const primaryKeys = GROUPS.flatMap(g => g.keys);
      container.querySelector('#sbMaintenance').innerHTML = actions.filter(a => !primaryKeys.includes(a.key)).map(a => actionButton(a)).join('');
    }
    container.querySelectorAll('[data-project-action]').forEach(btn => {
      btn.dataset.available = String(state.get('connected') && !!p);
      if (!btn.hasAttribute('aria-busy')) btn.disabled = btn.dataset.available === 'false';
    });
  }
  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-project-action]');
    if (!btn) return;
    const action = btn.dataset.projectAction;
    await runWithFeedback(btn, () => api.runProjectAction(projectName, action), `${LABELS[action] || action} requested`);
    update();
  });
  const stops = [state.watch('projects', update), state.watch('connected', update)];
  update();
  _dispose = () => { disposed = true; stops.forEach(fn => fn()); if (hotkeysMounted) unmountProjectHotkeyPanel(); };
}
export function unmount() { _dispose?.(); _dispose = null; }
