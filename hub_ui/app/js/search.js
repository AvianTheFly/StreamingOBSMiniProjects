import { state } from './state.js';
import { destinations, icon } from './catalog.js';
import { esc } from './utils.js';

export function initSearch(navigate) {
  const dialog = document.createElement('dialog');
  dialog.className = 'control-search';
  dialog.setAttribute('aria-label', 'Find a control or page');
  dialog.innerHTML = `<div class="search-heading">${icon('search')}<input type="search" aria-label="Search controls" placeholder="Try replay, music, volume or hotkeys…" autocomplete="off"><button class="btn btn-secondary btn-sm" data-close>Esc</button></div><div class="search-results" role="list" aria-label="Results"></div><div class="search-footnote">Find a page · ↑ ↓ to move · Enter to open</div>`;
  document.body.appendChild(dialog);
  const input = dialog.querySelector('input');
  const results = dialog.querySelector('.search-results');
  let selected = 0;
  function render() {
    const query = input.value.trim().toLowerCase();
    const items = destinations(state.get('projects')).filter(f => `${f.label} ${f.description} ${f.keywords || ''}`.toLowerCase().includes(query));
    selected = 0;
    results.innerHTML = items.length ? items.map((f, i) => `<a class="search-result ${i === 0 ? 'is-selected' : ''}" role="listitem" href="${esc(f.href)}" ${f.href.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${icon(f.icon)}<span><strong>${esc(f.label)}</strong><small>${esc(f.description)}</small></span><span class="search-return" aria-hidden="true">${f.href.startsWith('#') ? '↵' : '↗'}</span></a>`).join('') : '<p class="search-empty">No controls match. Try “audio”, “replay” or “settings”.</p>';
  }
  function open() { input.value = ''; render(); dialog.showModal(); input.focus(); }
  document.getElementById('workspaceSearch').addEventListener('click', open);
  document.querySelector('#workspaceSearch [data-icon]').innerHTML = icon('search');
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {
    if (e.target === dialog) { dialog.close(); return; }
    const a = e.target.closest('a');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (a.getAttribute('href').startsWith('#')) {
      e.preventDefault(); dialog.close(); navigate(a.getAttribute('href').slice(1));
      return;
    }
    dialog.close();
  });
  input.addEventListener('input', render);
  input.addEventListener('keydown', e => {
    const links = [...results.querySelectorAll('a')];
    if (e.key === 'Enter') { e.preventDefault(); links[selected]?.click(); }
    if (['ArrowDown', 'ArrowUp'].includes(e.key) && links.length) {
      e.preventDefault(); selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((a, i) => a.classList.toggle('is-selected', i === selected));
      links[selected].scrollIntoView({ block: 'nearest' });
    }
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); if (dialog.open) dialog.close(); else open();
    }
  });
}
