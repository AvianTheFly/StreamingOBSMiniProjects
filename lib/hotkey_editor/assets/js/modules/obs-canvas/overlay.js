import { number } from './model.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sourceSize(group) {
  return {
    width: Math.max(1, number(group?.width, 1)),
    height: Math.max(1, number(group?.height, 1)),
  };
}

function cropValues(rule, group) {
  const source = sourceSize(group);
  const left = clamp(number(rule.cropLeft), 0, source.width - 1);
  const right = clamp(number(rule.cropRight), 0, source.width - left - 1);
  const top = clamp(number(rule.cropTop), 0, source.height - 1);
  const bottom = clamp(number(rule.cropBottom), 0, source.height - top - 1);
  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(1, source.width - left - right),
    height: Math.max(1, source.height - top - bottom),
    sourceWidth: source.width,
    sourceHeight: source.height,
  };
}

function syncCropMedia(frame, crop) {
  const media = frame?.querySelector('.obs-canvas-video');
  if (!media) return;
  media.style.width = `${(crop.sourceWidth / crop.width) * 100}%`;
  media.style.height = `${(crop.sourceHeight / crop.height) * 100}%`;
  media.style.left = `${-(crop.left / crop.width) * 100}%`;
  media.style.top = `${-(crop.top / crop.height) * 100}%`;
}

function setHandle(handle, x, y) {
  if (!handle) return;
  handle.style.left = `calc(${x}% - 0.42rem)`;
  handle.style.top = `calc(${y}% - 0.42rem)`;
}

export function syncObsCanvasOverlay({ panel, canvas, group, rule }) {
  const box = panel?.querySelector('.obs-canvas-source');
  const cropFrame = panel?.querySelector('.obs-canvas-crop');
  if (!box || !cropFrame || !rule) return;

  box.style.left = `${(number(rule.positionX) / canvas.width) * 100}%`;
  box.style.top = `${(number(rule.positionY) / canvas.height) * 100}%`;
  box.style.width = `${(number(rule.boundsWidth, group?.width || 1) / canvas.width) * 100}%`;
  box.style.height = `${(number(rule.boundsHeight, group?.height || 1) / canvas.height) * 100}%`;

  const crop = cropValues(rule, group);
  const left = (crop.left / crop.sourceWidth) * 100;
  const top = (crop.top / crop.sourceHeight) * 100;
  const width = (crop.width / crop.sourceWidth) * 100;
  const height = (crop.height / crop.sourceHeight) * 100;
  const right = 100 - left - width;
  const bottom = 100 - top - height;
  const midX = left + width / 2;
  const midY = top + height / 2;

  cropFrame.style.left = `${left}%`;
  cropFrame.style.right = `${right}%`;
  cropFrame.style.top = `${top}%`;
  cropFrame.style.bottom = `${bottom}%`;
  syncCropMedia(cropFrame, crop);

  setHandle(box.querySelector('[data-crop-edge="left"]'), left, midY);
  setHandle(box.querySelector('[data-crop-edge="right"]'), left + width, midY);
  setHandle(box.querySelector('[data-crop-edge="top"]'), midX, top);
  setHandle(box.querySelector('[data-crop-edge="bottom"]'), midX, top + height);
  setHandle(box.querySelector('[data-crop-edge="top-left"]'), left, top);
  setHandle(box.querySelector('[data-crop-edge="top-right"]'), left + width, top);
  setHandle(box.querySelector('[data-crop-edge="bottom-left"]'), left, top + height);
  setHandle(box.querySelector('[data-crop-edge="bottom-right"]'), left + width, top + height);
}

function zoomAt(viewport, zoom, onZoom, event, nextZoom) {
  const stage = viewport.querySelector('.obs-canvas-stage');
  if (!stage) {
    onZoom(nextZoom);
    return;
  }
  const stageRect = stage.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const anchorX = stageRect.width ? (event.clientX - stageRect.left) / stageRect.width : 0.5;
  const anchorY = stageRect.height ? (event.clientY - stageRect.top) / stageRect.height : 0.5;
  const pointerX = event.clientX - viewportRect.left;
  const pointerY = event.clientY - viewportRect.top;

  onZoom(nextZoom);
  stage.style.width = `${Math.round(clamp(nextZoom, 0.6, 3) * 100)}%`;
  stage.style.maxWidth = nextZoom > 1 ? 'none' : '100%';

  const nextRect = stage.getBoundingClientRect();
  viewport.scrollLeft = Math.max(0, anchorX * nextRect.width - pointerX);
  viewport.scrollTop = Math.max(0, anchorY * nextRect.height - pointerY);
}

function nearestCropEdge(event, box, rule, group) {
  const rect = box.getBoundingClientRect();
  const crop = cropValues(rule, group);
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const left = rect.width * (crop.left / crop.sourceWidth);
  const right = rect.width * ((crop.left + crop.width) / crop.sourceWidth);
  const top = rect.height * (crop.top / crop.sourceHeight);
  const bottom = rect.height * ((crop.top + crop.height) / crop.sourceHeight);
  return [
    ['left', Math.abs(x - left)],
    ['right', Math.abs(x - right)],
    ['top', Math.abs(y - top)],
    ['bottom', Math.abs(y - bottom)],
  ].sort((a, b) => a[1] - b[1])[0][0];
}

function isNearEdge(event, box, threshold = 14) {
  const rect = box.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return x < threshold || x > rect.width - threshold || y < threshold || y > rect.height - threshold;
}

function edgeCursor(event, box, threshold = 14) {
  if (event.shiftKey) return 'crosshair';
  const rect = box.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const nearLeft = x < threshold;
  const nearRight = x > rect.width - threshold;
  const nearTop = y < threshold;
  const nearBottom = y > rect.height - threshold;
  if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
    return (nearLeft === nearTop) ? 'nwse-resize' : 'nesw-resize';
  }
  if (nearLeft || nearRight) return 'ew-resize';
  if (nearTop || nearBottom) return 'ns-resize';
  return 'move';
}

function startCropDrag(event, edge, box, group, getRule, onPatch, onSync) {
  event.preventDefault();
  event.stopPropagation();
  try { box.setPointerCapture(event.pointerId); } catch (_) {}
  const startRule = { ...getRule() };
  const crop = cropValues(startRule, group);
  const rect = box.getBoundingClientRect();
  // Scale from screen pixels to source pixels (for crop delta)
  const cropScaleX = crop.sourceWidth / Math.max(1, rect.width);
  const cropScaleY = crop.sourceHeight / Math.max(1, rect.height);
  // OBS canvas scale: source pixels → canvas pixels (for position compensation)
  const obsScaleX = number(startRule.scaleX) || (number(startRule.boundsWidth, crop.sourceWidth) / crop.sourceWidth);
  const obsScaleY = number(startRule.scaleY) || (number(startRule.boundsHeight, crop.sourceHeight) / crop.sourceHeight);
  const start = { x: event.clientX, y: event.clientY };

  const onMove = (moveEvent) => {
    const dx = (moveEvent.clientX - start.x) * cropScaleX;
    const dy = (moveEvent.clientY - start.y) * cropScaleY;
    const patch = {};
    if (edge.includes('left')) {
      const newCropLeft = clamp(number(startRule.cropLeft) + dx, 0, crop.sourceWidth - number(startRule.cropRight) - 1);
      patch.cropLeft = newCropLeft;
      // Keep the visible content's left edge at the same OBS canvas position
      patch.positionX = number(startRule.positionX) - (newCropLeft - number(startRule.cropLeft)) * obsScaleX;
    }
    if (edge.includes('right')) {
      patch.cropRight = clamp(number(startRule.cropRight) - dx, 0, crop.sourceWidth - number(startRule.cropLeft) - 1);
    }
    if (edge.includes('top')) {
      const newCropTop = clamp(number(startRule.cropTop) + dy, 0, crop.sourceHeight - number(startRule.cropBottom) - 1);
      patch.cropTop = newCropTop;
      // Keep the visible content's top edge at the same OBS canvas position
      patch.positionY = number(startRule.positionY) - (newCropTop - number(startRule.cropTop)) * obsScaleY;
    }
    if (edge.includes('bottom')) {
      patch.cropBottom = clamp(number(startRule.cropBottom) - dy, 0, crop.sourceHeight - number(startRule.cropTop) - 1);
    }
    onPatch(patch);
    onSync();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
}

function attachSourceDrag({ panel, stage, box, canvas, group, getRule, onPatch, onSync }) {
  const syncCropMode = (event = null) => {
    box.classList.toggle('crop-mode', !!event?.shiftKey);
  };
  const startMoveOrResize = (event, mode, edgeInfo = null) => {
    event.preventDefault();
    event.stopPropagation();
    try { box.setPointerCapture(event.pointerId); } catch (_) {}
    const startRule = { ...getRule() };
    const stageRect = stage.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, stageRect.width);
    const scaleY = canvas.height / Math.max(1, stageRect.height);
    const source = sourceSize(group);
    const aspect = source.width / Math.max(1, source.height);
    const start = { x: event.clientX, y: event.clientY };

    const onMove = (moveEvent) => {
      const dx = (moveEvent.clientX - start.x) * scaleX;
      const dy = (moveEvent.clientY - start.y) * scaleY;
      if (mode === 'resize' && edgeInfo) {
        const startW = number(startRule.boundsWidth, source.width);
        const startH = number(startRule.boundsHeight, source.height);
        // Compute raw width/height deltas based on which edge was grabbed
        const rawDw = edgeInfo.right ? dx : edgeInfo.left ? -dx : 0;
        const rawDh = edgeInfo.bottom ? dy : edgeInfo.top ? -dy : 0;
        const anyHoriz = edgeInfo.left || edgeInfo.right;
        const anyVert = edgeInfo.top || edgeInfo.bottom;
        let nextWidth, nextHeight;
        if (anyHoriz && anyVert) {
          if (Math.abs(rawDw) >= Math.abs(rawDh * aspect)) {
            nextWidth = Math.max(20, startW + rawDw);
            nextHeight = nextWidth / aspect;
          } else {
            nextHeight = Math.max(20, startH + rawDh);
            nextWidth = nextHeight * aspect;
          }
        } else if (anyHoriz) {
          nextWidth = Math.max(20, startW + rawDw);
          nextHeight = nextWidth / aspect;
        } else {
          nextHeight = Math.max(20, startH + rawDh);
          nextWidth = nextHeight * aspect;
        }
        // For left/top edges, adjust position to keep the opposite edge fixed
        let nextX = number(startRule.positionX);
        let nextY = number(startRule.positionY);
        if (edgeInfo.left) nextX = number(startRule.positionX) + (startW - nextWidth);
        if (edgeInfo.top) nextY = number(startRule.positionY) + (startH - nextHeight);
        onPatch({
          positionX: nextX,
          positionY: nextY,
          boundsWidth: nextWidth,
          boundsHeight: nextHeight,
          scaleX: nextWidth / source.width,
          scaleY: nextHeight / source.height,
          boundsType: 'OBS_BOUNDS_NONE',
        });
      } else {
        const w = number(startRule.boundsWidth, source.width);
        const h = number(startRule.boundsHeight, source.height);
        // Allow negative positions for sources larger than the canvas
        onPatch({
          positionX: clamp(number(startRule.positionX) + dx, -w, canvas.width),
          positionY: clamp(number(startRule.positionY) + dy, -h, canvas.height),
        });
      }
      onSync();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  box.addEventListener('pointermove', event => {
    if (event.buttons) return;
    syncCropMode(event);
    if (event.target.closest('.obs-crop-handle')) return;
    box.style.cursor = edgeCursor(event, box);
  });
  box.addEventListener('pointerleave', () => {
    box.classList.remove('crop-mode');
  });

  box.addEventListener('pointerdown', event => {
    if (event.target.closest('button, input, select, .obs-crop-handle')) return;
    if (event.shiftKey) {
      startCropDrag(event, nearestCropEdge(event, box, getRule(), group), box, group, getRule, onPatch, onSync);
      return;
    }
    if (isNearEdge(event, box)) {
      const rect = box.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const t = 14;
      const edgeInfo = {
        left: x < t,
        right: x > rect.width - t,
        top: y < t,
        bottom: y > rect.height - t,
      };
      startMoveOrResize(event, 'resize', edgeInfo);
    } else {
      startMoveOrResize(event, 'move');
    }
  });

  box.querySelectorAll('.obs-crop-handle').forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      startCropDrag(event, handle.dataset.cropEdge, box, group, getRule, onPatch, onSync);
    });
  });
}

function attachObsMediaControls(video) {
  const controls = document.getElementById('obs-media-controls');
  if (!controls) return;
  controls.innerHTML = '';
  controls.classList.add('active');

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'obs-media-play-btn';
  playBtn.textContent = video.paused ? '\u25B6' : '\u23F8';

  const seek = document.createElement('input');
  seek.type = 'range';
  seek.className = 'obs-media-seek';
  seek.min = '0';
  seek.max = '1000';
  seek.value = '0';

  const timeLabel = document.createElement('span');
  timeLabel.className = 'obs-media-time';
  timeLabel.textContent = '0:00';

  const fmt = t => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  playBtn.addEventListener('click', () => {
    if (video.paused) video.play(); else video.pause();
  });
  video.addEventListener('play', () => { playBtn.textContent = '\u23F8'; });
  video.addEventListener('pause', () => { playBtn.textContent = '\u25B6'; });
  video.addEventListener('timeupdate', () => {
    if (!video.duration || document.activeElement === seek) return;
    seek.value = String((video.currentTime / video.duration) * 1000);
    timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
  });
  seek.addEventListener('input', () => {
    if (video.duration) video.currentTime = (Number(seek.value) / 1000) * video.duration;
  });

  controls.append(playBtn, seek, timeLabel);
}

export function renderObsCanvasOverlay({
  canvas,
  group,
  rule,
  zoom,
  volume,
  previewUrl,
  onPatch,
  onZoom,
  getRule,
  onSync,
}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'obs-canvas-wrapper';

  const viewport = document.createElement('div');
  viewport.className = 'obs-canvas-viewport';
  viewport.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.12 : 0.12;
    zoomAt(viewport, zoom, onZoom, event, zoom + delta);
  }, { passive: false });

  const stage = document.createElement('div');
  stage.className = 'obs-canvas-stage';
  stage.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
  stage.style.width = `${Math.round(zoom * 100)}%`;
  if (zoom > 1) stage.style.maxWidth = 'none';

  const grid = document.createElement('div');
  grid.className = 'obs-canvas-grid';

  const box = document.createElement('div');
  box.className = 'obs-canvas-source';
  const label = document.createElement('div');
  label.className = 'obs-canvas-label';
  label.textContent = group?.key || 'Video';
  const hint = document.createElement('div');
  hint.className = 'obs-canvas-hint';
  hint.textContent = 'Drag to move · edge to scale · handle to trim';
  const cropFrame = document.createElement('div');
  cropFrame.className = 'obs-canvas-crop';
  cropFrame.id = 'obs-canvas-crop';
  cropFrame.innerHTML = '<div class="obs-canvas-empty">Click a video card to preview it here</div>';
  if (previewUrl) showObsCanvasPreview(null, previewUrl, volume, cropFrame);

  ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(edge => {
    const handle = document.createElement('div');
    handle.className = `obs-crop-handle ${edge}`;
    handle.dataset.cropEdge = edge;
    handle.title = 'Drag to crop';
    box.appendChild(handle);
  });

  box.append(label, hint, cropFrame);
  stage.append(grid, box);
  viewport.appendChild(stage);

  const mediaControls = document.createElement('div');
  mediaControls.id = 'obs-media-controls';
  mediaControls.className = 'obs-media-controls';

  wrapper.append(viewport, mediaControls);

  attachSourceDrag({ panel: viewport, stage, box, canvas, group, getRule, onPatch, onSync });
  queueMicrotask(() => syncObsCanvasOverlay({ panel: viewport, canvas, group, rule }));
  return wrapper;
}

export function clearObsCanvasPreview({ stop = true } = {}) {
  const frame = document.getElementById('obs-canvas-crop');
  const media = frame?.querySelector('video, audio');
  if (stop) media?.pause?.();
  if (!frame) return;
  frame.classList.remove('has-media');
  frame.innerHTML = '<div class="obs-canvas-empty">Click a video card to preview it here</div>';
  const controls = document.getElementById('obs-media-controls');
  if (controls) { controls.innerHTML = ''; controls.classList.remove('active'); }
}

export function showObsCanvasPreview(_sound, url, volume = 0.64, frame = null) {
  const target = frame || document.getElementById('obs-canvas-crop');
  if (!target || !url) return null;
  target.innerHTML = '';
  target.classList.add('has-media');
  const video = document.createElement('video');
  video.className = 'obs-canvas-video';
  video.src = url;
  video.autoplay = true;
  video.loop = true;
  video.muted = false;
  video.playsInline = true;
  video.volume = volume;
  target.appendChild(video);
  video.play()?.catch?.(() => {});
  if (!frame) attachObsMediaControls(video);
  return video;
}
