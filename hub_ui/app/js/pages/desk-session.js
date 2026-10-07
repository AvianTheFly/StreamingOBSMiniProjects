// Stream desk presentation. Feature APIs retain routing and output ownership.
import { api } from '../api.js';
import { runWithFeedback } from '../action-feedback.js';

export function mountDeskSession(root, refresh) {
  let context = {};
  let disposed = false;
  let pending = false;
  const listeners = [];
  const get = id => root.querySelector('#' + id);
  const listen = (id, callback) => {
    const button = get(id);
    const fn = async () => {
      if (button.disabled || pending || disposed) return;
      pending = true;
      const request = runWithFeedback(button, callback, result => result?.message || 'Control applied');
      update(context);
      await request;
      pending = false;
      if (!disposed) { update(context); refresh(); }
    };
    button.addEventListener('click', fn);
    listeners.push(() => button.removeEventListener('click', fn));
  };
  for (const [id, stage] of [['lobbyAction', 'lobby'], ['gameAction', 'game'], ['endingAction', 'ending']]) {
    listen(id, async () => {
      const source = stage === 'ending' ? get('deskEndingChoice').value : stage === 'game' ? null : get('deskLobbyChoice').value || null;
      const result = await api.selectStreamStage(stage, source);
      return { ...result, message: stage === 'game' ? 'Game selected' : `${result.lobby || 'Lobby'} selected` };
    });
  }
  const projectAction = async (project, action, message) => ({ ...await api.runProjectAction(project, action), message });
  listen('deskFollow', () => projectAction('scene_voice_switcher', 'follow_scenes', 'Auto scenes enabled'));
  listen('deskHold', () => projectAction('scene_voice_switcher', 'hold_scene', 'View held'));
  listen('deskChampion', () => projectAction('league_api', 'champion_select', 'Champion select selected'));
  listen('deskQueue', () => projectAction('league_api', 'queue_lobby', 'Queue lobby selected'));
  listen('deskGoLive', () => api.runHubAction('start_stream'));
  listen('deskStartBuffer', () => api.runHubAction('start_replay_buffer'));

  // Ending a broadcast is separate from choosing the ending picture.
  const dialog = document.createElement('dialog');
  dialog.className = 'desk-end-dialog';
  dialog.setAttribute('aria-labelledby', 'deskEndTitle');
  dialog.innerHTML = '<h2 id="deskEndTitle">End your stream?</h2><div><button class="btn btn-secondary" id="deskCancelEnd">Keep streaming</button><button class="btn btn-primary" id="deskConfirmEnd">End stream now</button></div>';
  root.append(dialog);
  const open = () => { if (!get('deskEndStream').disabled && !pending) dialog.showModal(); };
  get('deskEndStream').addEventListener('click', open);
  listeners.push(() => get('deskEndStream').removeEventListener('click', open));
  get('deskCancelEnd').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (!disposed) get('deskEndStream').focus(); });
  listen('deskConfirmEnd', async () => {
    const result = await api.runHubAction('stop_stream');
    if (result?.ok !== false && !result?.error) dialog.close();
    return { ...result, message: 'Stream stop requested' };
  });
  const changed = () => update(context);
  for (const id of ['deskLobbyChoice', 'deskEndingChoice']) {
    get(id).addEventListener('change', changed);
    listeners.push(() => get(id).removeEventListener('change', changed));
  }
  function update(next) {
    if (disposed) return;
    context = next;
    const { connected, sceneKnown, coordination, projects = [], lobbyData } = context;
    const ready = connected && sceneKnown;
    const feature = projects.find(p => p.name === 'scene_voice_switcher');
    const league = projects.find(p => p.name === 'league_api');
    const workflow = league?.workflow || {};
    const holds = coordination?.scenes?.automatic_holds || [];
    const held = holds.length > 0;
    const action = (p, key) => p?.actions?.some(a => a.key === key);
    const enable = (id, allowed) => {
      const button = get(id);
      button.dataset.available = String(!!allowed && !pending);
      if (!button.hasAttribute('aria-busy')) button.disabled = !allowed || pending;
    };
    const names = lobbyData?.lobbies || [];
    enable('lobbyAction', ready && feature && names.length);
    enable('gameAction', ready && feature && lobbyData?.game_scene);
    enable('endingAction', ready && feature && names.includes(get('deskEndingChoice').value));
    enable('deskFollow', ready && action(feature, 'follow_scenes'));
    enable('deskHold', ready && action(feature, 'hold_scene'));
    get('deskFollow').setAttribute('aria-pressed', String(ready && !held));
    get('deskHold').setAttribute('aria-pressed', String(ready && held));
    const phase = workflow.connected ? workflow.phase : null;
    const labels = { None: 'Client idle', Lobby: 'Client lobby', Matchmaking: 'In queue', ReadyCheck: 'Match found', ChampSelect: 'Champion select', GameStart: 'Loading', InProgress: 'In game', Reconnect: 'Reconnecting', WaitingForStats: 'Results', PreEndOfGame: 'Results', EndOfGame: 'Results' };
    get('deskLeaguePhase').textContent = connected && phase ? `League · ${labels[phase] || phase}` : '';
    get('deskFollow').title = workflow.scene_automation === false ? 'League client automation is off in League settings' : 'Allow enabled features to change scenes';
    get('deskHold').title = 'Hold automatic scene changes; manual choices and replay remain available';
    enable('deskChampion', ready && phase === 'ChampSelect' && action(league, 'champion_select'));
    enable('deskQueue', ready && ['None', 'Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect', 'EndOfGame', 'WaitingForStats', 'PreEndOfGame'].includes(phase) && action(league, 'queue_lobby'));
    get('deskDraftStatus').textContent = !workflow.connected ? 'League client offline' : labels[phase] || '';
    get('deskEndingStatus').textContent = feature?.workflow?.session?.stage === 'ending' ? 'Ending lobby on screen' : '';
    const active = coordination?.stream?.active;
    const knownOutput = ready && typeof active === 'boolean';
    get('deskGoLive').hidden = active === true;
    get('deskEndStream').hidden = active !== true;
    enable('deskGoLive', knownOutput && active === false);
    enable('deskEndStream', knownOutput && active === true);
    enable('deskConfirmEnd', knownOutput && active === true);
    const buffer = ready ? coordination?.replay_buffer?.active : null;
    get('deskBufferStatus').textContent = buffer === true ? '' : buffer === false ? 'Replays off' : '';
    get('deskStartBuffer').hidden = buffer !== false;
    enable('deskStartBuffer', ready && buffer === false);
  }
  return { update, dispose() { disposed = true; listeners.forEach(fn => fn()); dialog.remove(); } };
}
