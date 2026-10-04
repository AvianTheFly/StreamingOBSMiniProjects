// A presentation wrapper keeps both existing audio owners and their semantics.
import * as mixer from './mixer.js';
import * as media from './audio.js';
let _current = null;
export function mount(container, mode = 'sources') {
  container.innerHTML = `<div class="page-header"><div><div class="desk-eyebrow">Get the balance right</div><h1 class="page-title">Audio</h1><p class="page-subtitle">Control what your stream hears.</p></div></div><nav class="workspace-tabs" aria-label="Audio view"><a href="#mixer" ${mode === 'sources' ? 'aria-current="page"' : ''}>OBS sources <small>Live volume &amp; mute</small></a><a href="#audio" ${mode === 'media' ? 'aria-current="page"' : ''}>Saved media <small>Project, profile &amp; file levels</small></a></nav><div class="audio-workspace-body"></div>`;
  _current = mode === 'media' ? media : mixer;
  return _current.mount(container.querySelector('.audio-workspace-body'));
}
export function unmount() { _current?.unmount(); _current = null; }
