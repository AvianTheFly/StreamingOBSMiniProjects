import { state } from '../state.js';
import { feature, TOOLS, GROUPS, icon } from '../catalog.js';
import { esc } from '../utils.js';

let _dispose = null;
export function mount(container) {
  container.innerHTML = `<div class="page-header"><div><div class="desk-eyebrow">Make it yours</div><h1 class="page-title">Library &amp; tools</h1><p class="page-subtitle">Everything for your stream, organized by what you want to do.</p></div></div><div class="library-toolbar"><label class="library-search">${icon('search')}<input type="search" id="libraryQuery" placeholder="Find a feature or tool…" aria-label="Search library"></label><div class="filter-pills" aria-label="Filter library"><button class="is-selected" data-group="All" aria-pressed="true">All</button>${GROUPS.map(g => `<button data-group="${esc(g)}" aria-pressed="false">${esc(g)}</button>`).join('')}</div></div><div id="libraryResults"></div>`;
  let group = 'All';
  const query = container.querySelector('#libraryQuery');
  const results = container.querySelector('#libraryResults');
  let signature = '';
  function render(projects) {
    const items = [...projects.map(p => ({ ...feature(p.name), project: p })), ...TOOLS];
    const filtered = items.filter(f => (group === 'All' || group === f.group) && `${f.label} ${f.description} ${f.keywords || ''}`.toLowerCase().includes(query.value.trim().toLowerCase()));
    const structure = `${group}|${query.value}|${filtered.map(f => f.id).join(',')}`;
    if (structure !== signature) {
      signature = structure;
      const groups = [...GROUPS, 'Other tools'];
      results.innerHTML = filtered.length ? groups.map(g => {
        const entries = filtered.filter(f => f.group === g);
        if (!entries.length) return '';
        return `<section class="library-group"><h2>${esc(g)}</h2><div class="library-grid">${entries.map(f => `<a class="library-tile" href="${esc(f.href)}" ${f.href.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}><div class="library-tile-top"><span class="feature-icon">${icon(f.icon)}</span><span class="feature-state" data-library-state="${esc(f.id)}"></span></div><h3>${esc(f.label)}</h3><p>${esc(f.description)}</p><span class="library-tile-link">${f.href.startsWith('#') ? 'Open controls' : 'Open studio ↗'}${icon('arrow')}</span></a>`).join('')}</div></section>`;
      }).join('') : '<div class="desk-empty">No matches. Try another search or choose “All”.</div>';
    }
    results.querySelectorAll('[data-library-state]').forEach(el => {
      const p = projects.find(p => p.name === el.dataset.libraryState);
      el.textContent = p ? (p.is_active ? 'Active' : 'Idle') : 'Studio';
      el.classList.toggle('is-active', !!p?.is_active);
    });
  }
  query.addEventListener('input', () => render(state.get('projects')));
  container.querySelectorAll('[data-group]').forEach(btn => btn.addEventListener('click', () => {
    group = btn.dataset.group;
    container.querySelectorAll('[data-group]').forEach(b => { b.classList.toggle('is-selected', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    render(state.get('projects'));
  }));
  _dispose = state.watch('projects', render);
  render(state.get('projects'));
}
export function unmount() { _dispose?.(); _dispose = null; }
