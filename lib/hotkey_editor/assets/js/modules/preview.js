import { state } from './state.js';
import { API, VIDEO_EXTS, AUDIO_EXTS, IMAGE_EXTS } from './constants.js';
import { MediaTrimPicker } from './media-trim-picker.js';
import { clearLayoutPreview, selectLayoutGroup, showLayoutPreview } from './layout.js';

// ── File type detection ───────────────────────────────────────────────────────

export function fileExt(sound) {
  return String(sound?.ext || '').toLowerCase();
}

export function isVideoSound(sound) {
  return VIDEO_EXTS.has(fileExt(sound));
}

export function isImageSound(sound) {
  return IMAGE_EXTS.has(fileExt(sound));
}

export function isAudioSound(sound) {
  const ext = fileExt(sound);
  return AUDIO_EXTS.has(ext) || (!isVideoSound(sound) && !isImageSound(sound));
}

export function mediaTypeForSound(sound) {
  if (isVideoSound(sound)) return 'video';
  if (isImageSound(sound)) return 'image';
  return 'audio';
}

// ── Media URL resolution ──────────────────────────────────────────────────────

export function mediaUrlCandidates(soundOrStem) {
  const sound = typeof soundOrStem === 'string'
    ? state.sounds.find(s => s.stem === soundOrStem)
    : soundOrStem;
  if (!sound) return [];

  const ext = sound.ext || '';
  const filename = sound.filename || sound.file || `${sound.stem}${ext}`;
  const encodedStem = encodeURIComponent(sound.stem);
  const encodedFile = encodeURIComponent(filename);

  return [...new Set([
    sound.preview_url,
    sound.url,
    sound.src,
    sound.media_url,
    sound.file_url,
    `${API}/api/media/${encodedStem}`,
    `${API}/api/file/${encodedStem}`,
    `${API}/api/asset/${encodedStem}`,
    `${API}/api/play/${encodedStem}`,
    `${API}/assets/${encodedFile}`,
    `${API}/media/${encodedFile}`,
    `${API}/static/${encodedFile}`,
  ].filter(Boolean))];
}

export async function getMediaObjectUrl(sound) {
  const cacheKey = sound.filename || sound.file || `${sound.stem}${sound.ext || ''}`;
  if (state.mediaBlobUrlCache.has(cacheKey)) return state.mediaBlobUrlCache.get(cacheKey);

  let lastErr = null;
  for (const url of mediaUrlCandidates(sound)) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob || blob.size === 0) throw new Error('Empty file');
      const objectUrl = URL.createObjectURL(blob);
      state.mediaBlobUrlCache.set(cacheKey, objectUrl);
      return objectUrl;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Preview could not be loaded');
}

function updatePreviewTrimButton({ enabled = false, label = 'Trim' } = {}) {
  const trimBtn = document.getElementById('preview-trim');
  if (!trimBtn) return;
  trimBtn.disabled = !enabled;
  trimBtn.textContent = label;
}

function displayNameForStem(stem) {
  return String(state.displayNames?.[stem] || '').trim() || stem;
}

async function getPreviewFile(sound) {
  const url = await getMediaObjectUrl(sound);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not read the preview file.');
  const blob = await res.blob();
  const fileName = sound.filename || sound.file || `${sound.stem}${sound.ext || ''}`;
  return new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
}

async function replaceMediaOnServer(sound, result) {
  const params = new URLSearchParams({
    stem: sound.stem,
    filename: result.fileName,
    original: sound.filename || sound.file || `${sound.stem}${sound.ext || ''}`,
  });
  const res = await fetch(`${API}/api/media/replace?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': result.mimeType || result.blob.type || 'application/octet-stream' },
    body: result.blob,
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Could not replace the media file.');
  }
  return data;
}

export async function openPreviewTrimEditor() {
  const sound = state.sounds.find(s => s.stem === state.previewStem);
  if (!sound) return;

  const trimBtn = document.getElementById('preview-trim');
  const originalLabel = trimBtn?.textContent || 'Trim';
  updatePreviewTrimButton({ enabled: false, label: 'Loading...' });

  try {
    const file = await getPreviewFile(sound);
    const picker = new MediaTrimPicker({
      title: `Trim ${displayNameForStem(sound.stem)}`,
      autoDownload: false,
      fileNameSuffix: 'trimmed',
      onSave: async (result) => {
        picker.setStatus('Replacing original file...');
        const data = await replaceMediaOnServer(sound, result);
        state.mediaBlobUrlCache.forEach(url => URL.revokeObjectURL(url));
        state.mediaBlobUrlCache.clear();
        if (Array.isArray(data.sounds)) state.sounds = data.sounds;
        picker.setStatus('File replaced. Refreshing card...');
        picker.close();

        const { render } = await import('./render.js');
        render();
        await previewSound(sound.stem);
      },
    });

    picker.open();
    await picker.loadFile(file);
  } catch (error) {
    const sub = document.getElementById('preview-sub');
    if (sub) sub.textContent = error.message || 'Trim editor could not open';
  } finally {
    updatePreviewTrimButton({ enabled: !!state.previewStem, label: originalLabel });
  }
}

// ── Preview pane ──────────────────────────────────────────────────────────────

export function syncPreviewCardState() {
  document.querySelectorAll('.sound-card.previewing').forEach(el => el.classList.remove('previewing'));
  if (!state.previewStem) return;
  const card = document.querySelector(`.sound-card[data-stem="${CSS.escape(state.previewStem)}"]`);
  if (card) card.classList.add('previewing');
}

export function stopPreview({ keepSelection = true } = {}) {
  if (state.previewEl) {
    state.previewEl.pause?.();
    state.previewEl.removeAttribute?.('src');
    state.previewEl.load?.();
  }
  state.previewEl        = null;
  state.previewUrlObject = null;
  if (state.rightMode === 'layout') clearLayoutPreview({ stop: false });

  if (!keepSelection) state.previewStem = null;

  const body  = document.getElementById('preview-body');
  const sound = state.sounds.find(s => s.stem === state.previewStem);

  if (!sound) {
    state.previewStem = null;
    updatePreviewTrimButton({ enabled: false });
    document.getElementById('preview-name').textContent  = 'Nothing selected';
    document.getElementById('preview-sub').textContent   = 'Click a file on the left to preview it.';
    document.getElementById('preview-badge').textContent = 'Preview';
    if (body) body.innerHTML = '<div class="preview-empty">Audio and video previews appear here.</div>';
  }

  syncPreviewCardState();
}

export async function previewSound(stem) {
  const sound = state.sounds.find(s => s.stem === stem);
  if (!sound) return;

  const body  = document.getElementById('preview-body');
  const badge = document.getElementById('preview-badge');
  const name  = document.getElementById('preview-name');
  const sub   = document.getElementById('preview-sub');

  state.previewStem = stem;
  stopPreview({ keepSelection: true });
  state.previewStem = stem;

  if (state.rightMode === 'layout' && isVideoSound(sound)) {
    const allGroups = state.layoutData?.groups || [];
    const matchGroup = allGroups.find(g => g.sounds?.some(s => s.stem === sound.stem))
      || allGroups.find(g => g.dimension_key === sound.dimension_key);
    const targetKey = matchGroup?.key || null;
    if (targetKey && state.layoutSelectedGroup !== targetKey) {
      selectLayoutGroup(targetKey);
    }
    if (state.layoutOverrides?.[sound.stem]) state.layoutEditingStem = sound.stem;
    badge.textContent = 'Canvas';
    name.textContent = displayNameForStem(sound.stem);
    sub.textContent = 'Previewing in the OBS canvas mockup.';
    updatePreviewTrimButton({ enabled: false, label: 'Trim' });
    syncPreviewCardState();

    try {
      const resolvedUrl = await getMediaObjectUrl(sound);
      if (state.previewStem !== stem || state.rightMode !== 'layout') return;
      const media = showLayoutPreview(sound, resolvedUrl);
      if (!media) throw new Error('Canvas preview is not ready');
      state.previewEl = media;
      state.previewUrlObject = resolvedUrl;
      updatePreviewTrimButton({ enabled: true, label: 'Trim' });
    } catch {
      if (state.previewStem !== stem) return;
      const frame = document.getElementById('obs-canvas-crop');
      if (frame) frame.innerHTML = '<div class="obs-canvas-empty">Preview could not be loaded</div>';
      sub.textContent = 'Canvas preview failed';
      updatePreviewTrimButton({ enabled: false });
    }
    return;
  }

  body.innerHTML = '<div class="preview-empty">Loading preview…</div>';
  badge.textContent = isVideoSound(sound) ? 'Video' : 'Audio';
  name.textContent  = displayNameForStem(sound.stem);
  sub.textContent   = displayNameForStem(sound.stem) === sound.stem
    ? `${sound.ext || 'file'} preview`
    : `${sound.stem}${sound.ext || ''}`;
  updatePreviewTrimButton({ enabled: false, label: 'Trim' });
  syncPreviewCardState();

  try {
    const resolvedUrl = await getMediaObjectUrl(sound);
    if (state.previewStem !== stem) return;

    const media = document.createElement(isVideoSound(sound) ? 'video' : 'audio');
    media.className = 'preview-media';
    media.controls  = true;
    media.preload   = 'auto';
    media.volume    = state.volume;
    media.src       = resolvedUrl;
    if (media.tagName === 'VIDEO') media.playsInline = true;

    body.innerHTML = '';
    body.appendChild(media);

    state.previewEl        = media;
    state.previewUrlObject = resolvedUrl;
    updatePreviewTrimButton({ enabled: true, label: 'Trim' });

    const playAttempt = media.play();
    if (playAttempt && typeof playAttempt.catch === 'function') playAttempt.catch(() => {});

  } catch {
    if (state.previewStem !== stem) return;
    body.innerHTML = '<div class="preview-empty">Preview could not be loaded for this file.</div>';
    sub.textContent = 'Preview failed';
    updatePreviewTrimButton({ enabled: false });
  }
}
