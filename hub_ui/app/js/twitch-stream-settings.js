// Dashboard presentation only; the Hub owns the check and browser lifetime.
import { esc } from './utils.js';

export function watchTwitchSettings(element) {
  let disposed = false;
  let timer = null;
  async function refresh() {
    try {
      const response = await fetch('/api/twitch-stream-settings');
      const status = await response.json();
      if (disposed) return;
      element.innerHTML = `<div class="section-eyebrow">Twitch startup check</div>
        <div>${esc(status.message)}</div>
        <button class="btn btn-secondary btn-sm mt-12" data-twitch-retry ${status.busy ? 'disabled' : ''}>Check again</button>`;
      element.querySelector('[data-twitch-retry]').onclick = async () => {
        try {
          await fetch('/api/twitch-stream-settings', {method: 'POST',
            headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'login'})});
        } finally { if (!disposed) refresh(); }
      };
    } catch {
      if (!disposed) element.textContent = 'Twitch startup check status unavailable.';
    }
    if (!disposed) {
      clearTimeout(timer);
      timer = setTimeout(refresh, 2000);
    }
  }
  refresh();
  return () => { disposed = true; clearTimeout(timer); };
}
