// Only a fixed local status endpoint; never read or send cookies or credentials.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!sender.url?.startsWith('https://dashboard.twitch.tv/u/') ||
      message?.type !== 'streaming-hub-result') return;
  const port = Number(message.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 ||
      !/^[A-Za-z0-9_-]{32}$/.test(message.nonce) ||
      !['ready', 'error', 'login_required'].includes(message.state)) return;
  fetch(`http://127.0.0.1:${port}/api/twitch-stream-settings/result`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({nonce: message.nonce, state: message.state})
  }).then(async response => {
    respond({ok: response.ok});
    if (!response.ok || message.state !== 'ready' || !Number.isInteger(sender.tab?.id)) return;
    // Close only the acknowledged setup tab, never an ordinary dashboard visit.
    const marked = url => {
      const page = new URL(url);
      const params = new URLSearchParams(page.hash.slice(1));
      return page.origin === 'https://dashboard.twitch.tv' &&
        /^\/u\/[^/]+\/settings\/stream\/?$/.test(page.pathname) &&
        params.get('streaming-hub') === message.nonce &&
        params.get('hub-port') === String(port);
    };
    if (!marked(sender.url)) return;
    const tab = await chrome.tabs.get(sender.tab.id);
    if (marked(tab.url || '') && (!tab.pendingUrl || marked(tab.pendingUrl)))
      await chrome.tabs.remove(sender.tab.id);
  }).catch(() => respond({ok: false}));
  return true;
});
