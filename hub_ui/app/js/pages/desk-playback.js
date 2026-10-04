// Current activity and scoped transport controls. No playback state is owned here.
import { api } from '../api.js';
import { feature, icon } from '../catalog.js';
import { esc } from '../utils.js';
import { runWithFeedback } from '../action-feedback.js';
import { activityText } from './desk-view.js';

export function playbackPresentation(project, pauses = {}) {
  const claims = pauses[project.name]?.owners || [];
  const holds = claims.filter(c => c.kind !== 'manual');
  const paused = project.is_paused || claims.length > 0;
  const blockedResume = holds.length > 0 && !claims.some(c => c.kind === 'manual');
  const supported = key => project.actions?.some(a => a.key === key);
  const overlay = project.name === 'spotify';
  const waitingRoom = project.name === 'starting_soon';
  const controls = [];
  const transport = paused ? 'resume' : 'pause';
  if (supported(transport)) controls.push({
    key: transport,
    label: overlay ? (paused ? 'Show overlay' : 'Hide overlay') : waitingRoom ? (paused ? 'Resume clips' : 'Pause clips') : (paused ? 'Resume' : 'Pause'),
    enabled: transport !== 'resume' || !blockedResume,
  });
  const skip = ['skip', 'next'].find(supported);
  if (skip && !overlay) controls.push({key: skip, label: waitingRoom ? 'Skip clip' : 'Skip', enabled: true});
  const stop = ['finish', 'stop', 'revert'].find(supported);
  if (stop && !overlay) controls.push({key: stop, label: project.name === 'starting_soon' ? 'End Starting Soon' : 'Stop', enabled: true});
  const status = holds.length ? `Waiting for ${[...new Set(holds.map(c => feature(c.owner).label))].join(', ')}` : paused ? (overlay ? 'Overlay hidden' : waitingRoom ? 'Clips paused' : 'Paused') : overlay ? 'Overlay showing' : waitingRoom ? 'Waiting room showing' : 'Playing';
  return {controls, status, paused};
}

export function mountDeskPlayback(host, refresh) {
  const cards = new Map();
  let disposed = false;
  let latest = {projects: [], connected: false, pauses: {}};

  function create(project) {
    const f = feature(project.name);
    const card = document.createElement('div');
    card.className = 'desk-playback-card';
    card.dataset.playbackProject = project.name;
    card.innerHTML = `<a class="desk-playback-title" href="${esc(f.href)}" ${f.href.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${icon(f.icon)}<strong>${esc(f.label)}</strong>${icon('arrow')}</a><span class="desk-playback-detail"></span><div class="desk-playback-bottom"><span class="desk-playback-state"></span><div class="desk-playback-actions"></div></div>`;
    cards.set(project.name, card);
    host.append(card);
    return card;
  }

  function update(projects, connected, pauses = {}) {
    if (disposed) return;
    latest = {projects, connected, pauses};
    const active = projects.filter(p => p.is_active);
    const names = new Set(active.map(p => p.name));
    for (const [name, card] of cards) {
      if (!names.has(name)) { card.remove(); cards.delete(name); }
    }
    host.querySelector('.desk-empty')?.remove();
    if (!active.length) {
      const empty = document.createElement('p');
      empty.className = 'desk-empty';
      empty.textContent = connected ? 'No Hub media playing' : 'Playback status unavailable';
      host.append(empty);
    }
    for (const project of active) {
      const card = cards.get(project.name) || create(project);
      const presentation = playbackPresentation(project, pauses);
      card.querySelector('.desk-playback-detail').textContent = activityText(project.current_activity || feature(project.name).label);
      card.querySelector('.desk-playback-detail').title = project.current_activity || '';
      card.querySelector('.desk-playback-state').textContent = connected ? presentation.status : 'Last known · status unavailable';
      card.dataset.paused = String(presentation.paused);
      const actions = card.querySelector('.desk-playback-actions');
      const existing = [...actions.children];
      presentation.controls.forEach((control, index) => {
        let button = existing[index];
        if (!button) {
          button = document.createElement('button');
          button.className = 'btn btn-secondary';
          actions.append(button);
          button.onclick = async () => {
            const key = button.dataset.action;
            const label = button.textContent;
            await runWithFeedback(button, () => api.runProjectAction(project.name, key), `${label} requested · ${feature(project.name).label}`);
            if (disposed) return;
            update(latest.projects, latest.connected, latest.pauses);
            refresh();
          };
        }
        button.dataset.available = String(connected && control.enabled);
        if (!button.hasAttribute('aria-busy')) {
          button.dataset.action = control.key;
          button.textContent = control.label;
          button.setAttribute('aria-label', `${control.label} ${feature(project.name).label}`);
          button.disabled = !connected || !control.enabled;
          button.title = control.enabled ? '' : presentation.status;
        }
      });
      existing.slice(presentation.controls.length).forEach(b => b.remove());
    }
  }
  return {update, dispose() {disposed = true; cards.clear();}};
}
