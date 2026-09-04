const DEFAULT_OPTIONS = {
  label: 'Choose clip',
  title: 'Trim media',
  maxDuration: 30,
  accept: 'video/*,audio/*',
  autoDownload: true,
  fileNameSuffix: 'trimmed',
};

const EXPORT_MIME_TYPES = {
  video: [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ],
  audio: [
    'audio/webm;codecs=opus',
    'audio/webm',
  ],
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00.0';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, '0')}`;
}

function pickMimeType(kind) {
  const types = EXPORT_MIME_TYPES[kind] || EXPORT_MIME_TYPES.video;
  if (!window.MediaRecorder) return '';
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function extensionForMime(mimeType, kind) {
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('webm')) return 'webm';
  return kind === 'audio' ? 'wav' : 'webm';
}

function buildOutputName(file, suffix, extension) {
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'media';
  return `${baseName}-${suffix}.${extension}`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadMetadata(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const media = document.createElement(isVideo ? 'video' : 'audio');
    media.preload = 'metadata';
    media.muted = true;
    media.src = url;

    const cleanup = () => {
      media.removeAttribute('src');
      media.load();
      URL.revokeObjectURL(url);
    };

    media.addEventListener('loadedmetadata', () => {
      const duration = media.duration;
      const width = media.videoWidth || 0;
      const height = media.videoHeight || 0;
      cleanup();
      resolve({ duration, width, height, kind: isVideo ? 'video' : 'audio' });
    }, { once: true });

    media.addEventListener('error', () => {
      cleanup();
      reject(new Error('That file could not be loaded as audio or video.'));
    }, { once: true });
  });
}

function waitForEvent(target, eventName) {
  if (eventName === 'loadedmetadata' && target.readyState >= 1) {
    return Promise.resolve();
  }

  if (eventName === 'loadeddata' && target.readyState >= 2) {
    return Promise.resolve();
  }

  if (eventName === 'seeked' && !target.seeking) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Media playback failed during export.'));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener('error', onError);
    };

    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

async function seekMedia(media, time) {
  const targetTime = Math.max(0, time);
  if (Math.abs(media.currentTime - targetTime) < 0.02) return;
  media.currentTime = targetTime;
  await waitForEvent(media, 'seeked');
}

function createMediaElement(file, kind) {
  const media = document.createElement(kind === 'video' ? 'video' : 'audio');
  media.src = URL.createObjectURL(file);
  media.crossOrigin = 'anonymous';
  media.preload = 'auto';
  media.playsInline = true;
  return media;
}

async function exportWithMediaRecorder({ file, kind, start, end, volume }) {
  if (!window.MediaRecorder) {
    throw new Error('MediaRecorder is not available in this browser.');
  }

  const media = createMediaElement(file, kind);
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = AudioContextClass ? new AudioContextClass() : null;
  let sourceNode = null;
  let gainNode = null;
  let destination = null;
  let rawStream = null;

  try {
    await waitForEvent(media, 'loadedmetadata');

    if (!media.captureStream) {
      throw new Error('Media capture is not available in this browser.');
    }

    await seekMedia(media, start);

    rawStream = media.captureStream();
    const tracks = [];

    if (kind === 'video') {
      tracks.push(...rawStream.getVideoTracks());
    }

    if (audioContext) {
      sourceNode = audioContext.createMediaElementSource(media);
      gainNode = audioContext.createGain();
      destination = audioContext.createMediaStreamDestination();
      gainNode.gain.value = volume;
      sourceNode.connect(gainNode);
      gainNode.connect(destination);
      tracks.push(...destination.stream.getAudioTracks());
    } else {
      tracks.push(...rawStream.getAudioTracks());
      media.volume = volume;
    }

    const stream = new MediaStream(tracks);
    const mimeType = pickMimeType(kind);
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener('stop', resolve, { once: true });
      recorder.addEventListener('error', () => reject(new Error('Recording failed.')), { once: true });
    });

    recorder.start(100);

    if (audioContext?.state === 'suspended') {
      await audioContext.resume();
    }

    await media.play();

    await new Promise((resolve) => {
      const stopAtEnd = () => {
        if (media.currentTime >= end || media.ended) {
          media.pause();
          resolve();
          return;
        }
        window.requestAnimationFrame(stopAtEnd);
      };
      stopAtEnd();
    });

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }

    await stopped;

    stream.getTracks().forEach((track) => track.stop());
    rawStream.getTracks().forEach((track) => track.stop());

    return {
      blob: new Blob(chunks, { type: recorder.mimeType || mimeType || file.type }),
      mimeType: recorder.mimeType || mimeType || file.type,
    };
  } finally {
    if (rawStream) rawStream.getTracks().forEach((track) => track.stop());
    if (media.src) URL.revokeObjectURL(media.src);
    media.removeAttribute('src');
    media.load();
    if (audioContext) await audioContext.close();
  }
}

async function exportAudioAsWav({ file, start, end, volume }) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Audio export is not available in this browser.');
  }

  const sourceContext = new AudioContextClass();
  const arrayBuffer = await file.arrayBuffer();
  const sourceBuffer = await sourceContext.decodeAudioData(arrayBuffer);
  await sourceContext.close();

  const sampleRate = sourceBuffer.sampleRate;
  const frameStart = Math.floor(start * sampleRate);
  const frameEnd = Math.min(sourceBuffer.length, Math.ceil(end * sampleRate));
  const frameCount = Math.max(1, frameEnd - frameStart);
  const channelCount = sourceBuffer.numberOfChannels;
  const output = new AudioBuffer({
    length: frameCount,
    numberOfChannels: channelCount,
    sampleRate,
  });

  for (let channel = 0; channel < channelCount; channel += 1) {
    const source = sourceBuffer.getChannelData(channel).subarray(frameStart, frameEnd);
    const target = output.getChannelData(channel);
    for (let index = 0; index < source.length; index += 1) {
      target[index] = clamp(source[index] * volume, -1, 1);
    }
  }

  return {
    blob: audioBufferToWav(output),
    mimeType: 'audio/wav',
  };
}

function audioBufferToWav(buffer) {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const wav = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wav);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < buffer.length; index += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = clamp(buffer.getChannelData(channel)[index], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let index = 0; index < string.length; index += 1) {
    view.setUint8(offset + index, string.charCodeAt(index));
  }
}

export class MediaTrimPicker {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = {
      file: null,
      fileUrl: '',
      kind: 'video',
      duration: 0,
      start: 0,
      end: 0,
      volume: 1,
      exporting: false,
    };
    this.elements = {};
    this.pointerCleanup = null;
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  open() {
    if (this.elements.root) return;
    this.render();
    document.body.appendChild(this.elements.root);
    document.addEventListener('keydown', this.handleKeyDown);
    this.elements.fileInput.focus();
  }

  close() {
    if (!this.elements.root) return;
    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('resize', this.handleResize);
    if (this.pointerCleanup) this.pointerCleanup();
    if (this.state.fileUrl) URL.revokeObjectURL(this.state.fileUrl);
    this.elements.root.remove();
    this.elements = {};
    this.state.fileUrl = '';
  }

  render() {
    const root = document.createElement('div');
    root.className = 'mtp-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
      <section class="mtp-dialog" aria-labelledby="mtp-title">
        <header class="mtp-header">
          <div class="mtp-title">
            <h2 id="mtp-title">${this.options.title}</h2>
            <p>Drop in a clip under ${this.options.maxDuration} seconds.</p>
          </div>
          <button class="mtp-icon-button" type="button" data-mtp-close aria-label="Close">x</button>
        </header>
        <div class="mtp-body">
          <div class="mtp-preview" data-mtp-drop-zone>
            <div class="mtp-empty" data-mtp-empty>
              <div class="mtp-empty-icon" aria-hidden="true">♪</div>
              <div>
                <strong>Choose a short audio or video file</strong>
                <span>Drag it here, or browse from your computer.</span>
              </div>
              <button class="mtp-drop-button" type="button" data-mtp-browse>Browse file</button>
              <input class="mtp-file-input" type="file" accept="${this.options.accept}" data-mtp-file>
            </div>
          </div>
          <div class="mtp-panel">
            <div class="mtp-info-row">
              <div class="mtp-file-meta" data-mtp-file-meta>No file selected</div>
              <div class="mtp-time-label" data-mtp-time>0:00.0 - 0:00.0</div>
            </div>
            <div class="mtp-volume-row">
              <label>
                Volume
                <input class="mtp-volume-range" type="range" min="0" max="2" value="1" step="0.01" data-mtp-volume>
              </label>
              <span class="mtp-time-label" data-mtp-volume-label>100%</span>
            </div>
            <div class="mtp-timeline" data-mtp-timeline style="--mtp-start: 0%; --mtp-end: 100%;">
              <button class="mtp-track" type="button" data-mtp-track="preview" aria-label="Preview timeline">
                <span class="mtp-track-label" data-mtp-preview-label>Preview</span>
                <canvas data-mtp-preview-canvas></canvas>
              </button>
              <button class="mtp-track" type="button" data-mtp-track="volume" aria-label="Volume timeline">
                <span class="mtp-track-label">Volume</span>
                <canvas data-mtp-volume-canvas></canvas>
                <span class="mtp-volume-fill" data-mtp-volume-fill></span>
              </button>
              <div class="mtp-selection" data-mtp-selection>
                <span class="mtp-window"></span>
                <button class="mtp-handle mtp-handle-start" type="button" data-mtp-handle="start" aria-label="Trim start"></button>
                <button class="mtp-handle mtp-handle-end" type="button" data-mtp-handle="end" aria-label="Trim end"></button>
              </div>
            </div>
          </div>
        </div>
        <footer class="mtp-footer">
          <div class="mtp-status" data-mtp-status>Ready.</div>
          <div class="mtp-footer-actions">
            <button class="mtp-action mtp-action-secondary" type="button" data-mtp-reset disabled>Reset trim</button>
            <button class="mtp-action mtp-action-primary" type="button" data-mtp-save disabled>Save clip</button>
          </div>
        </footer>
      </section>
    `;

    this.elements = {
      root,
      dialog: root.querySelector('.mtp-dialog'),
      close: root.querySelector('[data-mtp-close]'),
      browse: root.querySelector('[data-mtp-browse]'),
      fileInput: root.querySelector('[data-mtp-file]'),
      dropZone: root.querySelector('[data-mtp-drop-zone]'),
      empty: root.querySelector('[data-mtp-empty]'),
      fileMeta: root.querySelector('[data-mtp-file-meta]'),
      time: root.querySelector('[data-mtp-time]'),
      volume: root.querySelector('[data-mtp-volume]'),
      volumeLabel: root.querySelector('[data-mtp-volume-label]'),
      timeline: root.querySelector('[data-mtp-timeline]'),
      selection: root.querySelector('[data-mtp-selection]'),
      previewCanvas: root.querySelector('[data-mtp-preview-canvas]'),
      volumeCanvas: root.querySelector('[data-mtp-volume-canvas]'),
      previewLabel: root.querySelector('[data-mtp-preview-label]'),
      volumeFill: root.querySelector('[data-mtp-volume-fill]'),
      save: root.querySelector('[data-mtp-save]'),
      reset: root.querySelector('[data-mtp-reset]'),
      status: root.querySelector('[data-mtp-status]'),
    };

    this.bindEvents();
    this.resizeCanvases();
    this.drawEmptyTracks();
  }

  bindEvents() {
    this.elements.close.addEventListener('click', () => this.close());
    this.elements.root.addEventListener('click', (event) => {
      if (event.target === this.elements.root) this.close();
    });
    this.elements.browse.addEventListener('click', () => this.elements.fileInput.click());
    this.elements.fileInput.addEventListener('change', (event) => {
      const [file] = event.target.files;
      if (file) this.loadFile(file);
      event.target.value = '';
    });

    this.elements.dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.elements.dropZone.classList.add('is-dragging');
    });
    this.elements.dropZone.addEventListener('dragleave', () => {
      this.elements.dropZone.classList.remove('is-dragging');
    });
    this.elements.dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      this.elements.dropZone.classList.remove('is-dragging');
      const [file] = event.dataTransfer.files;
      if (file) this.loadFile(file);
    });

    this.elements.volume.addEventListener('input', () => {
      this.state.volume = Number(this.elements.volume.value);
      this.updateVolumeUi();
    });

    this.elements.reset.addEventListener('click', () => {
      this.state.start = 0;
      this.state.end = this.state.duration;
      this.updateTimelineUi();
      this.seekPreview(this.state.start);
    });

    this.elements.save.addEventListener('click', () => this.save());

    this.elements.timeline.querySelectorAll('[data-mtp-track]').forEach((track) => {
      track.addEventListener('click', (event) => this.handleTrackClick(event));
    });

    this.elements.timeline.querySelectorAll('[data-mtp-handle]').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => this.startHandleDrag(event));
      handle.addEventListener('keydown', (event) => this.handleTrimKey(event));
    });

    window.addEventListener('resize', this.handleResize);
  }

  handleKeyDown(event) {
    if (event.key === 'Escape' && !this.state.exporting) {
      this.close();
    }
  }

  handleResize() {
    if (!this.elements.root) return;
    this.resizeCanvases();
    this.drawTracks();
  }

  async loadFile(file) {
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      this.setStatus('Please choose an audio or video file.');
      return;
    }

    this.setStatus('Loading media...');

    try {
      const metadata = await loadMetadata(file);
      if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) {
        throw new Error('The media duration could not be read.');
      }

      if (metadata.duration > this.options.maxDuration) {
        this.setStatus(`Please choose a file ${this.options.maxDuration} seconds or shorter.`);
        return;
      }

      if (this.state.fileUrl) URL.revokeObjectURL(this.state.fileUrl);

      this.state.file = file;
      this.state.fileUrl = URL.createObjectURL(file);
      this.state.kind = metadata.kind;
      this.state.duration = metadata.duration;
      this.state.start = 0;
      this.state.end = metadata.duration;
      this.state.volume = 1;
      this.elements.volume.value = '1';

      this.renderPreview();
      this.updateTimelineUi();
      this.updateVolumeUi();
      this.drawTracks();
      this.elements.save.disabled = false;
      this.elements.reset.disabled = false;
      this.setStatus('Adjust the handles, preview the clip, then save.');
    } catch (error) {
      this.setStatus(error.message);
    }
  }

  renderPreview() {
    this.elements.empty.hidden = true;
    this.elements.dropZone.querySelectorAll('[data-mtp-live-preview]').forEach((node) => node.remove());

    if (this.state.kind === 'video') {
      const video = document.createElement('video');
      video.className = 'mtp-media';
      video.controls = true;
      video.playsInline = true;
      video.src = this.state.fileUrl;
      video.dataset.mtpLivePreview = 'true';
      video.addEventListener('timeupdate', () => {
        if (video.currentTime > this.state.end) video.currentTime = this.state.start;
      });
      this.elements.dropZone.appendChild(video);
      this.elements.previewMedia = video;
    } else {
      const wrapper = document.createElement('div');
      wrapper.className = 'mtp-audio-preview';
      wrapper.dataset.mtpLivePreview = 'true';
      wrapper.innerHTML = `
        <div class="mtp-audio-icon" aria-hidden="true">♪</div>
        <audio controls src="${this.state.fileUrl}"></audio>
      `;
      const audio = wrapper.querySelector('audio');
      audio.addEventListener('timeupdate', () => {
        if (audio.currentTime > this.state.end) audio.currentTime = this.state.start;
      });
      this.elements.dropZone.appendChild(wrapper);
      this.elements.previewMedia = audio;
    }

    this.elements.previewMedia.volume = this.state.volume;
    this.elements.previewLabel.textContent = this.state.kind === 'video' ? 'Preview' : 'Audio';
    this.elements.fileMeta.textContent = `${this.state.file.name} · ${formatTime(this.state.duration)}`;
  }

  updateTimelineUi() {
    const duration = this.state.duration || 1;
    const startPct = (this.state.start / duration) * 100;
    const endPct = (this.state.end / duration) * 100;
    this.elements.timeline.style.setProperty('--mtp-start', `${startPct}%`);
    this.elements.timeline.style.setProperty('--mtp-end', `${endPct}%`);
    this.elements.time.textContent = `${formatTime(this.state.start)} - ${formatTime(this.state.end)}`;
  }

  updateVolumeUi() {
    this.elements.volumeLabel.textContent = `${Math.round(this.state.volume * 100)}%`;
    this.elements.volumeFill.style.height = `${clamp(this.state.volume / 2, 0, 1) * 100}%`;
    if (this.elements.previewMedia) {
      this.elements.previewMedia.volume = clamp(this.state.volume, 0, 1);
    }
  }

  handleTrackClick(event) {
    if (!this.state.file || event.target.closest('[data-mtp-handle]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const time = percent * this.state.duration;
    const distanceToStart = Math.abs(time - this.state.start);
    const distanceToEnd = Math.abs(time - this.state.end);

    if (distanceToStart < distanceToEnd) {
      this.state.start = clamp(time, 0, this.state.end - 0.1);
    } else {
      this.state.end = clamp(time, this.state.start + 0.1, this.state.duration);
    }

    this.updateTimelineUi();
    this.seekPreview(this.state.start);
  }

  startHandleDrag(event) {
    if (!this.state.file) return;
    const handle = event.currentTarget.dataset.mtpHandle;
    const rect = this.elements.selection.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();

    const move = (moveEvent) => {
      const percent = clamp((moveEvent.clientX - rect.left) / rect.width, 0, 1);
      const time = percent * this.state.duration;
      if (handle === 'start') {
        this.state.start = clamp(time, 0, this.state.end - 0.1);
      } else {
        this.state.end = clamp(time, this.state.start + 0.1, this.state.duration);
      }
      this.updateTimelineUi();
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.pointerCleanup = null;
      this.seekPreview(handle === 'start' ? this.state.start : Math.max(this.state.start, this.state.end - 0.25));
    };

    this.pointerCleanup = up;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  handleTrimKey(event) {
    if (!this.state.file || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const amount = event.shiftKey ? 1 : 0.1;
    const handle = event.currentTarget.dataset.mtpHandle;
    event.preventDefault();

    if (handle === 'start') {
      this.state.start = clamp(this.state.start + direction * amount, 0, this.state.end - 0.1);
    } else {
      this.state.end = clamp(this.state.end + direction * amount, this.state.start + 0.1, this.state.duration);
    }

    this.updateTimelineUi();
    this.seekPreview(this.state.start);
  }

  seekPreview(time) {
    if (!this.elements.previewMedia) return;
    this.elements.previewMedia.currentTime = clamp(time, 0, this.state.duration);
  }

  resizeCanvases() {
    [this.elements.previewCanvas, this.elements.volumeCanvas].forEach((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
    });
  }

  drawTracks() {
    this.resizeCanvases();
    this.drawEmptyTracks();
    if (!this.state.file) return;

    if (this.state.kind === 'video') {
      this.drawVideoThumbnails();
      this.drawVolumeTrack();
    } else {
      this.drawAudioTrack(this.elements.previewCanvas, 'rgba(91,141,238,0.82)');
      this.drawVolumeTrack();
    }
  }

  drawEmptyTracks() {
    this.drawTrackBackground(this.elements.previewCanvas, 'No media');
    this.drawTrackBackground(this.elements.volumeCanvas, 'Volume');
  }

  drawTrackBackground(canvas, label) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1b2030';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let x = 0; x < width; x += Math.max(12, width / 28)) {
      ctx.fillRect(x, 0, 1, height);
    }
    ctx.fillStyle = 'rgba(216,223,240,0.28)';
    ctx.font = `${Math.max(11, Math.round(height * 0.2))}px system-ui`;
    ctx.fillText(label, width / 2 - ctx.measureText(label).width / 2, height / 2 + 4);
  }

  async drawVideoThumbnails() {
    const canvas = this.elements.previewCanvas;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const thumbs = 10;
    const thumbWidth = width / thumbs;
    const video = createMediaElement(this.state.file, 'video');
    video.muted = true;

    try {
      await waitForEvent(video, 'loadedmetadata');
      await waitForEvent(video, 'loadeddata');
      for (let index = 0; index < thumbs; index += 1) {
        await seekMedia(video, clamp((index / thumbs) * this.state.duration, 0, this.state.duration - 0.05));
        ctx.drawImage(video, index * thumbWidth, 0, thumbWidth + 1, height);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, width, height);
    } catch {
      this.drawTrackBackground(canvas, 'Preview');
    } finally {
      URL.revokeObjectURL(video.src);
      video.removeAttribute('src');
      video.load();
    }
  }

  async drawAudioTrack(canvas, color) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    this.drawTrackBackground(canvas, 'Audio');

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const audioContext = new AudioContextClass();
      const buffer = await audioContext.decodeAudioData(await this.state.file.arrayBuffer());
      await audioContext.close();
      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / width);
      const mid = height / 2;
      ctx.fillStyle = color;

      for (let x = 0; x < width; x += 1) {
        let min = 1;
        let max = -1;
        const start = x * step;
        const end = Math.min(data.length, start + step);
        for (let index = start; index < end; index += 1) {
          const value = data[index];
          if (value < min) min = value;
          if (value > max) max = value;
        }
        ctx.fillRect(x, mid + min * mid, 1, Math.max(1, (max - min) * mid));
      }
    } catch {
      this.drawTrackBackground(canvas, 'Audio');
    }
  }

  drawVolumeTrack() {
    this.drawAudioTrack(this.elements.volumeCanvas, 'rgba(77,184,122,0.72)');
  }

  async save() {
    if (!this.state.file || this.state.exporting) return;
    this.state.exporting = true;
    this.elements.save.disabled = true;
    this.setStatus('Saving trimmed clip...');

    const detail = {
      sourceFile: this.state.file,
      start: this.state.start,
      end: this.state.end,
      duration: this.state.end - this.state.start,
      volume: this.state.volume,
      kind: this.state.kind,
    };

    try {
      let output;
      try {
        output = await exportWithMediaRecorder({
          file: this.state.file,
          kind: this.state.kind,
          start: this.state.start,
          end: this.state.end,
          volume: this.state.volume,
        });
      } catch (error) {
        if (this.state.kind !== 'audio') throw error;
        output = await exportAudioAsWav({
          file: this.state.file,
          start: this.state.start,
          end: this.state.end,
          volume: this.state.volume,
        });
      }

      const extension = extensionForMime(output.mimeType, this.state.kind);
      const fileName = buildOutputName(this.state.file, this.options.fileNameSuffix, extension);
      const objectUrl = URL.createObjectURL(output.blob);
      const result = {
        ...detail,
        blob: output.blob,
        mimeType: output.mimeType,
        fileName,
        objectUrl,
      };

      if (this.options.autoDownload) {
        downloadBlob(output.blob, fileName);
      }

      const eventTarget = this.options.eventTarget || this.elements.root;
      eventTarget.dispatchEvent(new CustomEvent('media-trim-save', {
        bubbles: true,
        detail: result,
      }));

      await this.options.onSave?.(result);
      this.setStatus(`Saved ${fileName}.`);
    } catch (error) {
      this.setStatus(error.message || 'The clip could not be saved.');
    } finally {
      this.state.exporting = false;
      if (this.elements.save) this.elements.save.disabled = false;
    }
  }

  setStatus(message) {
    if (this.elements.status) this.elements.status.textContent = message;
  }
}

export function createMediaTrimButton(options = {}) {
  const picker = new MediaTrimPicker(options);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = options.className || 'media-trim-button';
  button.textContent = options.label || DEFAULT_OPTIONS.label;
  button.addEventListener('click', () => picker.open());

  if (options.target) {
    const target = typeof options.target === 'string'
      ? document.querySelector(options.target)
      : options.target;
    target?.appendChild(button);
  }

  return { button, picker };
}

export class MediaTrimButtonElement extends HTMLElement {
  connectedCallback() {
    if (this.button) return;
    const label = this.getAttribute('label') || DEFAULT_OPTIONS.label;
    const maxDuration = Number(this.getAttribute('max-duration')) || DEFAULT_OPTIONS.maxDuration;
    const autoDownload = this.getAttribute('auto-download') !== 'false';
    const { button, picker } = createMediaTrimButton({
      label,
      maxDuration,
      autoDownload,
      eventTarget: this,
    });
    this.button = button;
    this.picker = picker;
    this.appendChild(button);
  }

  disconnectedCallback() {
    this.picker?.close();
  }
}

if (!customElements.get('media-trim-button')) {
  customElements.define('media-trim-button', MediaTrimButtonElement);
}

window.MediaTrimPicker = {
  MediaTrimPicker,
  MediaTrimButtonElement,
  createMediaTrimButton,
};
