import { api } from '../api.js';

export const durationLabel = seconds => Number.isFinite(seconds) && seconds > 0
  ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—';

// Only visible cards ask for stills. Two requests share the server's preview worker.
export function mountPosters(host) {
  let disposed = false, active = 0;
  const queue = [], cache = new Map(), timers = new Set();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target); queue.push(entry.target);
    }
    pump();
  }, {root: host, rootMargin: '60px'});
  function apply(card, result) {
    if (disposed || !card.isConnected) return;
    if (result.status === 'ready') {
      card.querySelector('img').src = `/api/projects/instant_replay/poster-media?path=${encodeURIComponent(card.dataset.path)}`;
      card.querySelector('[data-duration]').textContent = durationLabel(result.duration);
    }
  }
  function delay() { return new Promise(resolve => {
    const timer = setTimeout(() => { timers.delete(timer); resolve(); }, 1200);
    timers.add(timer);
  }); }
  async function fetchCard(card) {
    const path = card.dataset.path;
    try {
      for (let attempt = 0; attempt < 40 && !disposed && card.isConnected; attempt++) {
        const result = await api.replayPoster(path);
        if (disposed) return;
        if (result.status === 'ready' || result.status === 'error') {
          cache.set(path, result); apply(card, result); return;
        }
        await delay();
      }
    } catch { /* A missing still never prevents reviewing its original. */ }
  }
  function pump() {
    while (!disposed && active < 2 && queue.length) {
      const card = queue.shift();
      if (!card.isConnected) continue;
      active++; fetchCard(card).finally(() => { active--; pump(); });
    }
  }
  return {
    scan() {
      observer.disconnect(); queue.length = 0;
      for (const card of host.querySelectorAll('[data-path]')) {
        if (cache.has(card.dataset.path)) apply(card, cache.get(card.dataset.path));
        else observer.observe(card);
      }
    },
    dispose() { disposed = true; observer.disconnect(); timers.forEach(clearTimeout); timers.clear(); queue.length = 0; cache.clear(); }
  };
}
