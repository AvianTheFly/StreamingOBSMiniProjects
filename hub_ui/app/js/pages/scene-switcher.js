// pages/scene-switcher.js — Scene Voice Switcher project page

import { api }         from "../api.js";
import { state }       from "../state.js";
import { esc }         from "../utils.js";
import { runWithFeedback } from '../action-feedback.js';
import { icon } from '../catalog.js';

let _unwatch = null;
let _unwatchConnected = null;
let _generation = 0;
let _loadRevision = 0;
let _search = '';

export async function mount(container) {
  const generation = ++_generation;
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Scenes &amp; lobbies</h1>
        <p class="page-subtitle">Choose what your viewers see.</p>
      </div>
    </div>

    <div class="state-banner" id="svsBanner">
      <span class="state-indicator state-indicator--idle" id="svsIndicator"></span>
      <span class="state-label" id="svsLabel">Loading…</span>
      <span class="state-detail" id="svsDetail"></span>
    </div>

    <div class="card mb-16">
      <h2 class="card-title">Change the view</h2>
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px">
        Return to gameplay or choose a lobby for a conversation.
      </p>
      <div class="scene-buttons" id="sceneButtons">
        <span class="spinner"></span>
      </div>
    </div>

    <div class="card mb-16"><h2 class="card-title">Lobby passages</h2><p style="color:var(--muted);font-size:13px">In OBS, open <b>Tools → Scripts → passages.lua</b> to choose a cinematic dissolve, celestial aperture, stormglass gates or ember veil and set its duration. These animate changes between locations inside Lobbies. Full scene changes use your spirit performances.</p><p style="margin-top:12px"><a href="/transitions/" target="_blank" rel="noopener">Preview the eight spirit performances</a> · <a href="/#projects/starting_soon">Manage the waiting room &amp; saved looks</a></p></div>

    <details class="feature-disclosure"><summary>Voice shortcuts &amp; automation <span>How scene changes work</span></summary><div class="card mt-16">
      <div class="card-title">When lobbies appear</div>
      <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Queue and bans use one location. Between games, a new location appears after the result animation. Replays and temporary presentations finish before a pending return. Your newer scene choice cancels an older return. Startup preserves the current scene; use a lobby button whenever you want to chat.</p>
      <p style="font-size:13px;margin-bottom:16px"><a href="http://127.0.0.1:7431/production" target="_blank" rel="noopener">Configure League automation and between-games presentation</a></p>
      <div class="card-title">Hotkey</div>
      <p style="font-size:13px;color:var(--muted)">
        Press <kbd style="background:var(--panel-3);border:1px solid var(--line);border-radius:4px;padding:2px 7px;font-family:var(--mono)">\`</kbd>
        (backtick) to open the mic, then say a lobby name or "game" / "test" to switch scenes.
        Press <kbd style="background:var(--panel-3);border:1px solid var(--line);border-radius:4px;padding:2px 7px;font-family:var(--mono)">C</kbd> to send early.
        Say "next lobby" for another location.
      </p>
      <p style="font-size:13px;color:var(--muted)">Type <kbd>*-</kbd> to show your screen or <kbd>-*</kbd> to hide it. Test keeps its gameplay capture.</p>
    </div></details>
  `;

  _unwatch = state.watch("projects", _updateBanner);
  _unwatchConnected = state.watch('connected', () => _updateBanner(state.get('projects')));
  _updateBanner(state.get("projects"));
  await _loadScenes(container, generation);
}

export function unmount() {
  ++_generation;
  ++_loadRevision;
  if (_unwatch) { _unwatch(); _unwatch = null; }
  _unwatchConnected?.(); _unwatchConnected = null;
  _search = '';
}

function _updateBanner(projects, updateCurrent = true) {
  const p        = projects.find(p => p.name === "scene_voice_switcher");
  const indicator = document.getElementById("svsIndicator");
  const label     = document.getElementById("svsLabel");
  const detail    = document.getElementById("svsDetail");
  if (!indicator) return;
  document.querySelectorAll('#sceneButtons button').forEach(button => {
    button.dataset.available = String(!!p && state.get('connected'));
    if (!button.hasAttribute('aria-busy')) button.disabled = button.dataset.available === 'false';
  });
  document.querySelectorAll('#sceneButtons [data-rotation]').forEach(input => {input.disabled = !p || !state.get('connected');});

  if (!p) {
    indicator.className = "state-indicator state-indicator--idle";
    label.textContent   = "Not running";
    detail.textContent  = "";
    return;
  }

  indicator.className = `state-indicator ${p.is_active ? "state-indicator--active" : "state-indicator--idle"}`;
  label.textContent   = p.is_active ? "Active" : "Ready";
  detail.textContent  = p.current_activity ? `— ${p.current_activity}` : "";
  if(!updateCurrent)return;
  const active=p.current_activity?.startsWith('showing: ') ? p.current_activity.slice(9) : null;
  document.querySelectorAll('[data-location-card]').forEach(card=>{
    const current=card.dataset.source===active;
    card.style.outline=current?'2px solid var(--accent)':'';
    card.querySelector('h3').textContent=card.dataset.label+(current?' · On screen':'');
  });
  const current=document.getElementById('lobbyCurrentState');
  if(current&&active)current.textContent=`On screen: ${[...document.querySelectorAll('[data-location-card]')].find(card=>card.dataset.source===active)?.dataset.label||active} · Camera and chat placement is checked whenever you enter.`;
  else if(current&&!p.is_active)current.textContent='No lobby is on screen. Enter a world whenever you want to chat.';
}

async function _loadScenes(container, generation) {
  const buttonsEl = document.getElementById("sceneButtons");
  if (!buttonsEl) return;

  try {
    const revision = ++_loadRevision;
    const { game_scene, lobbies = [], locations = [], screen = {}, current_lobby, program_scene } = await api.getLobbies();
    if (generation !== _generation || revision !== _loadRevision) return;
    buttonsEl.innerHTML = `
      ${game_scene ? `<button class="btn btn-primary" data-scene="${esc(game_scene)}">${icon('play')}Gameplay</button>` : ''}
      <button class="btn btn-secondary" data-lobby="">
        ${icon('scene')}Another lobby
      </button>
      <button class="btn btn-secondary" data-screen="show_screen">Show screen · *-</button>
      <button class="btn btn-secondary" data-screen="hide_screen">Hide screen · -*</button>
      <button class="btn btn-secondary" data-refresh>Refresh layouts</button>
      <span id="lobbyScreenState" style="color:var(--muted);align-self:center">Screen ${screen.visible ? 'shown' : 'hidden'}</span>
      <p id="lobbyCurrentState" style="width:100%;margin:4px 0" role="status">${current_lobby ? `On screen: <b>${esc(locations.find(l=>l.source===current_lobby)?.label || current_lobby)}</b>` : `Current scene: <b>${esc(program_scene || '—')}</b>`} · Camera and chat placement is checked whenever you enter.</p>
      <p style="width:100%;color:var(--muted);font-size:12px;margin:0">Enter lobby keeps your screen visibility. Enter + screen shows your desktop in that world's display. Automatic returns hide the desktop.</p>
      <label style="width:100%">Find a lobby<input class="input" type="search" id="lobbySearch" value="${esc(_search)}" placeholder="Forest, arcade, railway…" style="width:100%;margin-top:6px"></label>
      <div class="scene-library-heading" style="width:100%">Choose a place to chat</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;width:100%">
        ${(locations.length ? locations : lobbies.map(source => ({source,label:source}))).map(location => _locationCard({...location,current:location.source===current_lobby})).join('')}
      </div>
      <p id="lobbyNoMatches" hidden>No matching lobby. Try another name.</p>
    `;
  } catch {
    if (generation !== _generation) return;
    buttonsEl.innerHTML = `<span style="color:var(--soft);font-size:13px">Project not running — start the hub first.</span>`;
    return;
  }

  buttonsEl.querySelectorAll("[data-scene]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const scene = btn.dataset.scene;
      const result = await runWithFeedback(btn, () => api.switchScene(scene), `Switched to ${scene}`);
      if (result && generation === _generation) await _loadScenes(container, generation);
    });
  });
  buttonsEl.querySelectorAll('[data-lobby]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await runWithFeedback(btn, () => api.selectLobby(btn.dataset.lobby || null, btn.dataset.withScreen === 'true' ? true : undefined), result => `Showing ${result.lobby || 'a lobby'}`);
      if (result && generation === _generation) await _loadScenes(container, generation);
    });
  });
  buttonsEl.querySelectorAll('[data-screen]').forEach(btn => btn.addEventListener('click', async () => {
    const result = await runWithFeedback(btn, () => api.runHubAction(btn.dataset.screen), 'Screen visibility updated');
    if (result && generation === _generation) {
      const label = document.getElementById('lobbyScreenState');
      if (label) label.textContent = `Screen ${btn.dataset.screen === 'show_screen' ? 'shown' : 'hidden'}`;
    }
  }));
  buttonsEl.querySelector('[data-refresh]')?.addEventListener('click', () => _loadScenes(container,generation));
  const search = buttonsEl.querySelector('#lobbySearch');
  const filter = () => {
    _search=search.value;
    let count=0;
    buttonsEl.querySelectorAll('[data-location-card]').forEach(card=>{
      card.hidden=!card.dataset.search.includes(_search.trim().toLowerCase());
      if(!card.hidden)count++;
    });
    buttonsEl.querySelector('#lobbyNoMatches').hidden=count>0;
  };
  search.addEventListener('input',filter);filter();
  buttonsEl.querySelectorAll('[data-restore]').forEach(btn => btn.addEventListener('click', async () => {
    const result = await runWithFeedback(btn, () => api.restoreLobby(btn.dataset.restore), 'Saved lobby placement restored');
    if (result && generation === _generation) await _loadScenes(container, generation);
  }));
  buttonsEl.querySelectorAll('[data-rotation]').forEach(input => input.addEventListener('change', async () => {
    const previous = !input.checked;
    input.disabled = true;
    try { await api.configureLobby(input.dataset.rotation, {rotation: input.checked}); }
    catch (error) { input.checked = previous; const {toast} = await import('../toast.js'); toast.error(error.message); }
    finally { input.disabled = !state.get('connected'); }
  }));
  buttonsEl.querySelectorAll('[data-placement]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const changes = {};
    for (const key of ['screen','camera','chat']) changes[key] = ['x','y','w','h'].map(axis => Number(form.elements[`${key}_${axis}`].value));
    const result = await runWithFeedback(form.querySelector('button'), () => api.configureLobby(form.dataset.placement, changes), 'Lobby placement saved');
    if (result && generation === _generation) await _loadScenes(container, generation);
  }));
  _updateBanner(state.get('projects'), false);
}

function _locationCard(location) {
  const {source,label,description,managed,rotation,layout,art_url,ready,current} = location;
  return `<article class="card" data-location-card data-source="${esc(source)}" data-label="${esc(label)}" data-search="${esc(`${source} ${label} ${description||''}`.toLowerCase())}" style="padding:0;overflow:hidden;${current?'outline:2px solid var(--accent)':''}">
    ${art_url ? `<div style="position:relative"><img src="${esc(art_url)}" alt="${esc(label)}" loading="lazy" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover">${layout ? ['screen','camera','chat'].map((key,i)=>{const [x,y,w,h]=layout[key];const color=['#7db8ff','#65c7a4','#e0b0ff'][i];return `<span aria-label="${key} placement" style="position:absolute;left:${x/1920*100}%;top:${y/1080*100}%;width:${w/1920*100}%;height:${h/1080*100}%;border:1px solid ${color};pointer-events:none"><small style="display:block;width:fit-content;padding:1px 4px;font-size:10px;background:#10151edb;color:${color}">${['Screen','Host','Chat'][i]}</small></span>`;}).join('') : ''}</div>` : ''}
    <div style="padding:16px"><h3 style="margin:0 0 6px">${esc(label)}${current?' · On screen':''}</h3>
    <p style="color:var(--muted);font-size:12px;min-height:32px">${esc(description || source)}</p>
    <button class="btn btn-primary" data-lobby="${esc(source)}">Enter lobby</button>
    <button class="btn btn-secondary" data-lobby="${esc(source)}" data-with-screen="true">Enter + screen</button>
    ${source === 'Spirit Afterparty' ? '<p><a href="/spirit-lobby/studio.html" target="_blank" rel="noopener">Customize clubhouse displays</a></p>' : ''}
    ${managed ? `<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" data-rotation="${esc(source)}" ${rotation ? 'checked' : ''}>Include in automatic rotation</label>
    <details style="margin-top:12px"><summary>Manage placement${ready ? '' : ' · needs repair'}</summary>
      <p style="color:var(--muted);font-size:12px">Placement is saved for this world and applied on entry. Screen visibility is shared across all lobbies. Placement uses the 1920 × 1080 canvas.</p>
      <button class="btn btn-secondary" data-restore="${esc(source)}">Restore saved placement</button>
      <form data-placement="${esc(source)}" style="margin-top:12px">
        ${['screen','camera','chat'].map(key => `<fieldset style="border:0;padding:0;margin:0 0 10px"><legend>${key[0].toUpperCase()+key.slice(1)}</legend><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${['x','y','w','h'].map((axis,index) => `<label style="font-size:11px">${['Left','Top','Width','Height'][index]}<input class="input" style="width:100%;padding:5px" type="number" name="${key}_${axis}" value="${layout[key][index]}" min="0" max="1920" required></label>`).join('')}</div></fieldset>`).join('')}
        <button class="btn btn-secondary" type="submit">Save placement</button>
      </form>
    </details>` : ''}</div>
  </article>`;
}
