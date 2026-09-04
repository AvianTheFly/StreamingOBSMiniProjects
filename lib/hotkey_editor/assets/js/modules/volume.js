import { state } from './state.js';

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function levelToVolume(level) {
  const normalized = clamp(level);
  return normalized * normalized;
}

function setVolumeLevel(level) {
  state.volumeLevel = clamp(level);
  state.volume = levelToVolume(state.volumeLevel);
  if (state.volumeLevel > 0) {
    state.lastVolLevel = state.volumeLevel;
    state.lastVol = state.volume;
  }
}

export function updateVolIcon() {
  const icon = document.getElementById('vol-icon');
  if (!icon) return;
  if (state.volumeLevel === 0) icon.textContent = 'Mute';
  else if (state.volumeLevel < 0.4) icon.textContent = 'Low';
  else icon.textContent = 'Vol';
}

export function applyVolumeToPreview() {
  if (state.previewEl) state.previewEl.volume = clamp(state.volume);
}

export function initVolume() {
  const volSlider = document.getElementById('vol-slider');
  const volLabel  = document.getElementById('vol-label');
  const volIcon   = document.getElementById('vol-icon');
  if (!volSlider || !volLabel || !volIcon) return;

  volSlider.addEventListener('input', e => {
    setVolumeLevel(e.target.value / 100);
    volLabel.textContent = `${Math.round(state.volumeLevel * 100)}%`;
    updateVolIcon();
    applyVolumeToPreview();
  });

  volIcon.addEventListener('click', () => {
    if (state.volumeLevel > 0) {
      state.lastVolLevel = state.volumeLevel;
      state.lastVol = state.volume;
      setVolumeLevel(0);
    } else {
      setVolumeLevel(state.lastVolLevel || 0.8);
    }
    volSlider.value = Math.round(state.volumeLevel * 100);
    volLabel.textContent = `${Math.round(state.volumeLevel * 100)}%`;
    updateVolIcon();
    applyVolumeToPreview();
  });

  volSlider.value = Math.round(state.volumeLevel * 100);
  volLabel.textContent = `${Math.round(state.volumeLevel * 100)}%`;
  updateVolIcon();
}
