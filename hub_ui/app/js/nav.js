import { state } from './state.js';
import { feature, icon } from './catalog.js';
import { esc } from './utils.js';

const SHORTCUTS = ['instant_replay', 'soundboard', 'specific_song', 'scene_voice_switcher', 'starting_soon'];
let _page = 'dashboard';

export function initNav(navigate) {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const scrim = document.getElementById('navScrim');
  const narrowScreen = matchMedia('(max-width: 760px)');
  function syncAccessibility() {
    nav.inert = narrowScreen.matches && !nav.classList.contains('open');
  }
  function close(restoreFocus = false) {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    scrim.hidden = true;
    syncAccessibility();
    if (restoreFocus && narrowScreen.matches) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    scrim.hidden = !open;
    syncAccessibility();
  });
  scrim.addEventListener('click', () => close(true));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) close(true); });
  narrowScreen.addEventListener('change', () => close());
  syncAccessibility();
  nav.querySelectorAll('[data-icon]').forEach(a => a.insertAdjacentHTML('afterbegin', icon(a.dataset.icon)));
  nav.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(a.getAttribute('href').slice(1));
    close();
  });
  function render(projects) {
    const container = document.getElementById('navProjects');
    const names = SHORTCUTS.filter(name => !projects.length || projects.some(p => p.name === name));
    const signature = names.join(',');
    if (container.dataset.signature !== signature) {
      container.dataset.signature = signature;
      container.innerHTML = names.map(name => {
        const f = feature(name);
        return `<a class="nav-item" href="${esc(f.href)}" data-page="projects/${esc(name)}">${icon(f.icon)}<span>${esc(f.label)}</span><span class="nav-dot" data-status="${esc(name)}"></span></a>`;
      }).join('');
    }
    container.querySelectorAll('[data-status]').forEach(dot => {
      const p = projects.find(p => p.name === dot.dataset.status);
      dot.className = `nav-dot ${p?.is_active ? 'nav-dot--active' : 'nav-dot--idle'}`;
      dot.title = p?.is_active ? p.current_activity || 'Active' : 'Idle';
    });
    setActiveNavItem(_page);
  }
  state.watch('projects', render);
  render(state.get('projects'));
}

export function setActiveNavItem(page) {
  _page = page;
  document.querySelectorAll('.nav-item[data-page]').forEach(a => {
    const active = a.dataset.page === page || (a.dataset.page === 'mixer' && page === 'audio');
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const setup = document.getElementById('navSetup');
  if (setup?.querySelector('[aria-current="page"]')) setup.open = true;
  const crumb = document.getElementById('breadcrumbs');
  if (crumb) {
    const isFeature = page.startsWith('projects/');
    const labels = { dashboard: 'Live desk', library: 'Library & tools', mixer: 'Audio', audio: 'Audio', rules: 'Automation rules', profiles: 'Hotkeys & profiles', voice: 'Voice & microphone', settings: 'Hub settings' };
    const label = isFeature ? feature(page.slice(9)).label : page === 'workflows' ? 'Stream map' : labels[page] || 'Live desk';
    crumb.innerHTML = `<a href="#${isFeature ? 'library' : 'dashboard'}">${isFeature ? 'Library & tools' : 'Workspace'}</a><span aria-hidden="true">/</span><span>${esc(label)}</span>`;
    document.title = `${label} · Stream Hub`;
  }
}
