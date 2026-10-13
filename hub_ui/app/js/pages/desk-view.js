import {stageStrip} from './desk-stage-map.js';
export function activityText(value) {
  return String(value || '').replace(/^playing:\s*/i, '').replace(/^showing:\s*/i, '').replace(/\s*\[random\]$/i, ' · shuffle');
}
export function deskView(){return `<div class="stage-desk">
  <header class="stage-desk-header"><div><h1>Live desk</h1><span id="streamState" role="status">Connecting…</span></div><div class="stage-global"><span id="deskSpotify" title="Spotify follows its own playback across all stages">Spotify · automatic</span><button id="deskSounds" class="btn btn-secondary">♫ Sound effects</button><button id="deskBroadcast" class="btn btn-secondary" disabled>Go live</button></div></header>
  ${stageStrip()}
  <section id="deskReplay" aria-label="Replay workspace" hidden></section>
  <div class="stage-editor-layout"><section class="stage-canvas" aria-label="Stage appearance"><div id="deskStageArtwork"></div><div class="stage-canvas-top"><span id="deskPictureMode">ART PREVIEW</span><button id="deskChangeImage" class="btn btn-secondary">Change image</button></div><div class="stage-canvas-bottom"><div><h2 id="deskPictureTitle">Starting soon</h2><span id="deskArtName"></span></div><button id="deskShowStage" class="btn btn-primary" disabled>Show on stream</button></div><div id="deskGamePlaceholder" hidden>Game capture</div></section>
  <aside class="stage-next"><h2>Likely next scenes</h2><div id="deskNextRoutes"></div><div class="stage-auto"><button id="deskAuto" class="btn btn-secondary" disabled>Auto scenes</button><small id="deskAutoNote"></small></div></aside></div>
  <section id="deskQueueControls" class="desk-queue-controls" aria-label="Lobby display and queue timer" hidden></section>
  <footer class="stage-desk-footer"><div id="deskStageCues" aria-label="Stage effects"></div><button id="deskBackToCurrent" class="desk-text-link" hidden></button><span id="deskSceneNotice" role="status"></span></footer>
</div>`;}
