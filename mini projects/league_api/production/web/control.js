const form = document.querySelector('#settings'),
  notice = document.querySelector('#notice');
let saved = null,
  busy = false;
let catalog = [],
  groups = {};
const edits = new Map();
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
let clientBusy = false;
for (const [key, name] of [['astral','Astral Observatory'],['tidal','Tidal Vault'],['neon','Neon Concourse'],['frost','Frost Sanctum'],['verdant','Verdant Engine']]) {
  const link = document.createElement('a'); link.className = 'theme-card';
  link.href = `/champ-select?demo=1&theme=${key}`; link.target = '_blank'; link.rel = 'noopener';
  const img = document.createElement('img'); img.src = `/champ-select/backgrounds/${key}.jpg`; img.alt = '';
  const label = document.createElement('span'); label.textContent = name + ' · preview';
  link.append(img,label); document.querySelector('#themeGallery').append(link);
}
async function pollClient() {
  try {
    const data = await request('/client-scenes');
    document.querySelector('#clientStatus').textContent = data.status;
    document.querySelector('#clientError').textContent = data.error || '';
    if (!clientBusy) {
      document.querySelector('#clientEnabled').checked = data.settings.enabled;
      document.querySelector('#clientTheme').value = data.settings.theme || 'random';
      document.querySelector('#clientIdle').value = data.settings.idle_presentation || 'scene';
      document.querySelector('#clientHideNow').disabled = !data.settings.enabled || !['None', 'Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect', 'EndOfGame', 'PreEndOfGame', 'WaitingForStats'].includes(data.phase);
      document.querySelector('#clientShowScreen').disabled = !['None', 'Lobby', 'EndOfGame', 'PreEndOfGame', 'WaitingForStats', 'TerminatedInError'].includes(data.phase) && !data.status.startsWith('League client unavailable');
    }
  } catch {
    document.querySelector('#clientStatus').textContent = 'League client service unavailable';
  }
  setTimeout(pollClient, 1500);
}
document.querySelector('#clientEnabled').addEventListener('change', async (event) => {
  clientBusy = true;
  event.target.disabled = true;
  try {
    await request('/client-scenes', { enabled: event.target.checked });
    notice.textContent = event.target.checked ? 'League client scene automation enabled.' : 'League client scene automation paused.';
  } catch (error) {
    notice.textContent = error.message;
    event.target.checked = !event.target.checked;
  } finally {
    clientBusy = false;
    event.target.disabled = false;
  }
});
document.querySelector('#clientTheme').addEventListener('change', async (event) => {
  clientBusy = true; event.target.disabled = true;
  try {
    await request('/client-scenes', {theme:event.target.value});
    notice.textContent = event.target.value === 'random' ? 'A new world will be chosen for each draft.' : 'Champion select theme saved.';
  } catch (error) { notice.textContent = error.message; }
  finally { clientBusy = false; event.target.disabled = false; pollClient(); }
});
document.querySelector('#clientIdle').addEventListener('change', async (event) => {
  clientBusy = true; event.target.disabled = true;
  try {
    await request('/client-scenes', {idle_presentation: event.target.value});
    notice.textContent = 'Between-games presentation saved.';
  } catch (error) { notice.textContent = error.message; }
  finally { clientBusy = false; event.target.disabled = false; }
});
for (const [id, path] of [['clientHideNow', '/client-scenes/hide-now'], ['clientShowScreen', '/client-scenes/show-screen']]) {
  document.querySelector('#' + id).addEventListener('click', async (event) => {
    event.target.disabled = true;
    try {
      const data = await request(path, {});
      document.querySelector('#clientStatus').textContent = data.status;
      notice.textContent = id === 'clientHideNow' ? 'Screen hidden. You can start queue now.' : 'Screen restored.';
    } catch (error) {
      notice.textContent = error.message;
    } finally {
      event.target.disabled = false;
    }
  });
}
pollClient();
function labels() {
  document.querySelector('#intensityValue').textContent =
    Math.round(form.elements.intensity.value * 100) + '%';
  document.querySelector('#opacityValue').textContent =
    Math.round(form.elements.opacity.value * 100) + '%';
  document.querySelector('#edgeValue').textContent = form.elements.edge_width.value + ' px';
}
function status(data) {
  document.querySelector('#connection').textContent = data.status;
  document.querySelector('#activity').textContent =
    (data.activity || [])
      .slice(-4)
      .reverse()
      .map((a) => a.title + ' — ' + a.result)
      .join(' · ') || 'Waiting for game events.';
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
  catalog = data.catalog || [];
  groups = data.groups || {};
  edits.clear();
  renderGallery();
  const select = document.querySelector('#eventGroup');
  if (select.options.length === 1)
    for (const [key, title] of Object.entries(groups)) {
      const option = new Option(title, key);
      select.add(option);
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
    if (!saved) throw new Error('Reload the controls before saving.');
    const settings = {};
    for (const input of form.elements) {
      if (!input.name) continue;
      settings[input.name] = input.type === 'checkbox' ? input.checked : Number(input.value);
    }
    const data = await request('/production/configure', { revision: saved.revision, settings });
    saved = data.settings;
    catalog = data.catalog;
    renderGallery();
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

setInterval(async () => {
  try {
    status(await request('/production/settings'));
  } catch {
    document.querySelector('#connection').textContent = 'League service disconnected';
  }
}, 2000);

function element(tag, text, className = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function renderGallery() {
  const gallery = document.querySelector('#eventGallery');
  gallery.replaceChildren();
  const group = document.querySelector('#eventGroup').value,
    query = document.querySelector('#eventSearch').value.toLowerCase();
  const selected = catalog.filter(
    (e) =>
      (group === 'all' || e.category === group) &&
      (e.title + ' ' + e.key).toLowerCase().includes(query),
  );
  document.querySelector('#eventCount').textContent =
    selected.length + ' / ' + catalog.length + ' effects';
  for (const event of selected) {
    const reset = edits.has(event.key) && edits.get(event.key) === null;
    const patch = edits.has(event.key)
      ? edits.get(event.key) || {}
      : saved.event_options?.[event.key] || {};
    const card = element('article', null, 'event-card');
    card.dataset.effect = event.key;
    const head = element('div', null, 'section-head');
    head.append(element('h3', event.title));
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked =
      patch.enabled ?? (edits.has(event.key) ? event.default_enabled : event.event_enabled);
    toggle.setAttribute('aria-label', 'Automatically show ' + event.title);
    head.append(toggle);
    card.append(head);
    card.append(
      element(
        'p',
        (groups[event.category] || event.category) +
          (event.confidence === 'possible' ? ' · Unconfirmed signal' : ''),
        'event-meta',
      ),
    );
    const fields = element('div', null, 'event-fields');
    for (const [name, label, min, max, step, value] of [
      ['intensity', 'Impact', 0.3, 1.6, 0.05, patch.intensity ?? 1],
      [
        'duration',
        'Seconds',
        2,
        5,
        0.1,
        Math.max(2, patch.duration ?? (reset ? event.default_duration : event.duration)),
      ],
    ]) {
      const wrap = element('label', label),
        input = document.createElement('input');
      input.type = 'number';
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = value;
      input.setAttribute('aria-label', event.title + ' ' + label);
      wrap.append(input);
      fields.append(wrap);
      input.oninput = () => {
        updateEvent(event.key, name, Number(input.value));
      };
    }
    card.append(fields);
    toggle.onchange = () => {
      updateEvent(event.key, 'enabled', toggle.checked);
    };
    const actions = element('div', null, 'event-actions'),
      play = element('button', 'Preview'),
      resetButton = element('button', 'Reset');
    play.dataset.preview = event.key;
    play.onclick = () =>
      action(async () => {
        await request('/production/preview', { key: event.key });
        notice.textContent = 'Showing ' + event.title + '.';
      });
    resetButton.onclick = () => {
      edits.set(event.key, null);
      renderGallery();
      markDirty();
    };
    actions.append(play, resetButton);
    card.append(actions);
    gallery.append(card);
  }
}
function updateEvent(key, name, value) {
  const previous = edits.has(key) ? edits.get(key) || {} : saved.event_options?.[key] || {};
  edits.set(key, { ...previous, [name]: value });
  markDirty();
}
function markDirty() {
  document.querySelector('#eventSaveStatus').textContent = edits.size + ' effect edits to save';
}
document.querySelector('#eventGroup').onchange = renderGallery;
document.querySelector('#eventSearch').oninput = renderGallery;
document.querySelector('#saveEvents').onclick = () =>
  action(async () => {
    if (!saved) throw new Error('Reload the controls before saving.');
    const event_options = structuredClone(saved.event_options || {});
    for (const [key, patch] of edits) {
      if (patch === null) delete event_options[key];
      else event_options[key] = patch;
    }
    const data = await request('/production/configure', {
      revision: saved.revision,
      settings: { event_options },
    });
    saved = data.settings;
    catalog = data.catalog;
    edits.clear();
    renderGallery();
    document.querySelector('#eventSaveStatus').textContent = 'Effect edits saved.';
    status(data);
  });

await action(reload);
