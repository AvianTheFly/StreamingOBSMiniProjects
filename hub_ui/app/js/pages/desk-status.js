// Observed state; clicks never determine which view is highlighted.
export function updateDeskStatus(root, context) {
  const { connected, scenes, gameScene, lobbies = [], session, currentLobby, replay, replayStage, captureRequest } = context;
  const ready = connected && scenes?.observing === true;
  const scene = ready ? scenes.scene : null;
  let phase = '';
  if (ready && scenes.temporary_owner === 'instant_replay') phase = 'replay';
  else if (ready && (scene === 'Starting Soon' || scenes.temporary_owner === 'starting_soon')) phase = 'starting';
  else if (scene && scene === gameScene) phase = 'game';
  else if (scene && (scene === 'Lobbies' || lobbies.includes(scene))) {
    phase = session?.held && session.lobby === currentLobby && ['break', 'ending'].includes(session.stage) ? session.stage : 'lobby';
  }
  if (ready) root.querySelector('#currentScene').textContent = { starting: 'Starting soon', lobby: currentLobby || 'Lobby', game: 'Game', break: 'Lobby', ending: 'Ending', replay: 'Replay' }[phase] || scene || '—';
  for (const [id, key] of [['startingAction','starting'],['lobbyAction','lobby'],['gameAction','game'],['endingAction','ending']]) {
    root.querySelector('#' + id).setAttribute('aria-pressed', String(phase === key));
  }
  const capture = replayStage?.capture;
  root.querySelector('#deskReplayStatus').textContent = !ready || !replay || !replayStage ? 'Replay unavailable' : captureRequest ? 'Capturing…' : replayStage.active || replay.is_active ? 'Playing replay' : replayStage.pending ? 'Preparing replay…' : capture?.status === 'error' ? capture.message || 'Capture failed' : ['saving','queued','trimming'].includes(capture?.status) ? 'Preparing replay…' : '';
}
