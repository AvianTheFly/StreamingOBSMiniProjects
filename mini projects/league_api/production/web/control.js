const form = document.querySelector('#settings'),
  notice = document.querySelector('#notice');
let saved = null,
  busy = false;
async function request(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not reach the League service');
  return data;
}
function labels() {
  document.querySelector('#opacityValue').textContent =
    Math.round(form.elements.opacity.value * 100) + '%';
  document.querySelector('#edgeValue').textContent = form.elements.edge_width.value + ' px';
}
function status(data) {
  document.querySelector('#connection').textContent = data.status;
  document.querySelector('#ready').textContent = data.overlay_ready
    ? 'OBS overlay is connected.'
    : 'OBS overlay is not connected. Start OBS or reconnect the source.';
}
async function reload() {
  const data = await request('/production/settings');
  saved = data.settings;
  for (const [key, value] of Object.entries(saved)) {
    const input = form.elements.namedItem(key);
    if (input) {
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    }
  }
  labels();
  status(data);
}
async function action(callback) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    await callback();
  } catch (error) {
    notice.textContent = error.message;
  } finally {
    busy = false;
    document.querySelectorAll('button').forEach((b) => (b.disabled = false));
  }
}
form.addEventListener('input', labels);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  action(async () => {
    const settings = {};
    for (const input of form.elements) {
      if (!input.name) continue;
      settings[input.name] = input.type === 'checkbox' ? input.checked : Number(input.value);
    }
    const data = await request('/production/configure', { revision: saved.revision, settings });
    saved = data.settings;
    notice.textContent = 'Production borders saved.';
    status(data);
  });
});
document.querySelector('#reload').onclick = () =>
  action(async () => {
    await reload();
    notice.textContent = 'Saved controls restored.';
  });
document.querySelector('#clear').onclick = () =>
  action(async () => {
    await request('/production/clear', {});
    notice.textContent = 'Current borders cleared. The next new event can still play.';
  });
document.querySelector('#obs').onclick = () =>
  action(async () => {
    await request('/production/obs', {});
    notice.textContent = 'OBS browser source refreshed.';
  });
document.querySelectorAll('[data-preview]').forEach(
  (button) =>
    (button.onclick = () =>
      action(async () => {
        await request('/production/preview', { key: button.dataset.preview });
        notice.textContent = 'Showing ' + button.textContent.trim().split('\n')[0] + '.';
      })),
);
await action(reload);
setInterval(async () => {
  try {
    status(await request('/production/settings'));
  } catch {
    document.querySelector('#connection').textContent = 'League service disconnected';
  }
}, 2000);
