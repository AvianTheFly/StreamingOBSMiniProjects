// Acts only on a Hub-marked startup page. Ordinary dashboard visits are untouched.
(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  const nonce = params.get('streaming-hub');
  const port = params.get('hub-port');
  if (!/^[A-Za-z0-9_-]{32}$/.test(nonce || '') || !/^\d{4,5}$/.test(port || '')) return;
  const labels = ['Store past broadcasts', 'Always Publish VODs', 'Stream Rewind'];
  const normalize = value => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const checked = node => node.matches('input') ? node.checked : node.getAttribute('aria-checked') === 'true';
  const switches = root => [...root.querySelectorAll('input[type="checkbox"], [role="switch"], [role="checkbox"]')];
  function control(label) {
    const name = normalize(label);
    const direct = switches(document).filter(node => normalize(node.getAttribute('aria-label')) === name);
    if (direct.length === 1) return direct[0];
    const nodes = [...document.querySelectorAll('label, span, p, div')].filter(node =>
      normalize(node.textContent) === name && ![...node.children].some(child => normalize(child.textContent) === name));
    if (nodes.length !== 1) return null;
    const labelNode = nodes[0].closest('label');
    if (labelNode?.htmlFor) {
      const target = document.getElementById(labelNode.htmlFor);
      if (target?.matches('input[type="checkbox"], [role="switch"], [role="checkbox"]')) return target;
    }
    for (let parent = nodes[0].parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const candidates = switches(parent);
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) return null;
    }
    return null;
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const key = `streaming-hub-check:${nonce}`;
  const report = state => chrome.runtime.sendMessage({type: 'streaming-hub-result', nonce, port, state});
  async function run() {
    const deadline = Date.now() + 45000;
    const verify = sessionStorage.getItem(key) === 'verify';
    while (Date.now() < deadline && !control(labels[0])) await wait(500);
    if (!control(labels[0])) {
      return report(document.querySelector('input[type="password"]') ? 'login_required' : 'error');
    }
    for (const label of labels) {
      let node = control(label);
      const until = Date.now() + 5000;
      while (!node && Date.now() < until) { await wait(200); node = control(label); }
      if (!node || node.disabled || node.getAttribute('aria-disabled') === 'true') return report('error');
      if (!checked(node)) {
        if (verify) return report('error');
        node.click();
        await wait(1200);
        node = control(label);
        if (!node || !checked(node)) return report('error');
      }
    }
    if (verify) {
      sessionStorage.removeItem(key);
      return report('ready');
    }
    sessionStorage.setItem(key, 'verify');
    await wait(1500);
    location.reload();
  }
  run().catch(() => report('error'));
})();
