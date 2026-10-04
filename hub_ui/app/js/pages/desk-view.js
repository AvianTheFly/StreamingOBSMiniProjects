// Live desk structure and display language. Runtime status stays in dashboard.js.
import { icon } from '../catalog.js';

export function activityText(value) {
  return String(value || '').replace(/^playing:\s*/i, '').replace(/^showing:\s*/i, '')
    .replace(/\s*\[random\]$/i, ' · shuffle');
}

export function deskView() {
  return `<div class="page-header desk-header"><div class="desk-title"><h1 class="page-title">Live desk</h1><span id="streamState" class="desk-stream-state" role="status">Checking stream…</span></div>
    <div class="desk-view-switch"><span>Workspace view</span><div class="desk-mode" role="group" aria-label="Workspace view">
      <button data-desk-mode="game" aria-pressed="false">${icon('play')}In game</button><button data-desk-mode="produce" aria-pressed="true">${icon('desk')}Out of game</button>
    </div></div></div>
    <section class="desk-program" aria-labelledby="sceneHeading">
      <div class="desk-program-view"><div class="desk-panel-heading"><h2 id="sceneHeading">Current scene</h2><span class="obs-indicator" id="obsIndicator">Connecting to OBS</span></div>
      <strong class="scene-name" id="currentScene">—</strong><span class="scene-caption" id="sceneCaption"></span></div>
      <div class="scene-choices"><button class="btn btn-secondary" id="gameAction" disabled>${icon('play')}Gameplay</button><button class="btn btn-secondary" id="lobbyAction" disabled>${icon('scene')}Another lobby</button><button class="desk-text-link" data-desk-panel="scenes" data-produce-only>Choose scene ${icon('arrow')}</button></div>
      <div class="desk-desktop"><span class="desk-control-label">Desktop capture</span><span id="desktopState">Checking…</span><div class="desk-visibility" role="group" aria-label="Desktop capture visibility"><button class="btn btn-secondary" data-hub-action="show_screen" aria-label="Show desktop" aria-pressed="false">Show</button><button class="btn btn-secondary" data-hub-action="hide_screen" aria-label="Hide desktop" aria-pressed="false">Hide</button></div></div>
    </section>
    <div class="desk-body"><div class="desk-main-controls">
      <section class="desk-now" aria-labelledby="activityHeading"><div class="desk-panel-heading"><h2 id="activityHeading">Active now <span id="activeCount" class="activity-count">0</span></h2><button class="btn btn-quiet stop-audio" id="stopAudioAction" hidden>${icon('stop')}Stop all Hub audio</button></div><div id="activeFeatures"></div></section>
      <section class="desk-game-tools" id="gameTools" hidden aria-label="In-game controls">
        <div class="desk-game-heading"><h2>Voice & hotkeys</h2><a href="#voice" id="voiceState">Checking microphone…</a></div>
        <div class="desk-trigger-row"><button class="btn btn-primary" data-project="soundboard" data-action="start_listen">${icon('voice')}Start voice trigger</button><button class="btn btn-secondary" data-project="soundboard" data-action="stop_listen" hidden>Finish & play</button><button class="btn btn-quiet" data-project="soundboard" data-action="abort_listen" hidden>Cancel</button><button class="btn btn-secondary" data-project="soundboard" data-action="random">Random sound</button><a class="desk-text-link" href="#profiles">Hotkeys ${icon('arrow')}</a></div>
        <div class="desk-automation-status">${icon('automation')}<span id="automationState">Checking automation…</span><button class="desk-text-link" data-desk-panel="automation">Manage ${icon('arrow')}</button></div>
      </section>
      <section class="desk-launch-section" aria-labelledby="deskChooseHeading"><div class="desk-section-heading"><h2 id="deskChooseHeading">Show & play</h2><a href="#library" class="desk-text-link">All controls ${icon('arrow')}</a></div>
        <div class="desk-launch-grid">
          <button class="desk-launch" data-desk-panel="clips">${icon('replay')}<strong>Show a clip</strong><span>Saved clips & replays</span>${icon('arrow')}</button>
          <button class="desk-launch" data-desk-panel="music">${icon('music')}<strong>Play music</strong><span>Your song library</span>${icon('arrow')}</button>
          <button class="desk-launch" data-desk-panel="sounds">${icon('soundboard')}<strong>Play a sound</strong><span>Soundboard & audio cues</span>${icon('arrow')}</button>
          <button class="desk-launch" data-desk-panel="waiting" data-produce-only>${icon('spark')}<strong>Starting Soon</strong><span>Show a waiting room</span>${icon('arrow')}</button>
        </div>
      </section>
      <div class="desk-secondary-controls"><button class="btn btn-secondary" data-desk-panel="automation">${icon('automation')}Alerts & overlays ${icon('arrow')}</button><button class="btn btn-secondary" data-desk-panel="workflows">${icon('desk')}Run a workflow ${icon('arrow')}</button><a class="desk-text-link" href="#workflows">Workflow map ${icon('arrow')}</a></div>
    </div>
    <aside class="desk-live-controls" aria-label="Current playback and capture">
      <section class="desk-audio" aria-labelledby="deskAudioHeading"><div class="desk-panel-heading"><h2 id="deskAudioHeading">Live audio</h2><a class="desk-text-link" href="#mixer">Full mixer ${icon('arrow')}</a></div><div id="deskAudioChannels"><p class="desk-empty">Loading audio…</p></div><span id="deskAudioFeedback" role="status" aria-live="polite"></span></section>
      <section class="desk-capture" aria-labelledby="captureHeading"><h2 id="captureHeading">Quick replay</h2><button class="btn btn-primary" data-project="instant_replay" data-action="save">${icon('save')}Save clip</button><button class="btn btn-secondary" data-project="instant_replay" data-action="play_replay">${icon('replay')}Replay latest</button><a href="#projects/instant_replay" class="desk-text-link">Replay studio ${icon('arrow')}</a></section>
    </aside></div>
    <details class="desk-diagnostics"><summary>System status <span id="loadedCount">Connecting to Hub…</span></summary><div class="diagnostics-body"><div id="twitchStartupCheck"></div><div class="desk-section-heading"><h2>Activity log</h2><button class="btn btn-secondary btn-sm" id="clearLogBtn">Clear log</button></div><div id="eventLog" class="event-log"></div></div></details>`;
}
