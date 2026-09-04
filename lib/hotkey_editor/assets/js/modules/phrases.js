import { state } from './state.js';
import { API } from './constants.js';
import { displayNameForStem } from './card-utils.js';
import { setSaveStatus } from './ui.js';

function phraseText(stem) {
  const raw = state.phrases?.[stem];
  return Array.isArray(raw) ? raw.join('\n') : '';
}

function setPhraseText(stem, value) {
  if (!state.phrases || typeof state.phrases !== 'object') state.phrases = {};
  const phrases = String(value || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
  const unique = [...new Set(phrases.map(item => item.toLowerCase()))]
    .map(lower => phrases.find(item => item.toLowerCase() === lower));
  if (unique.length) state.phrases[stem] = unique;
  else delete state.phrases[stem];
}

export async function savePhrases() {
  const status = document.getElementById('phrases-status');
  const button = document.getElementById('phrases-save');
  if (status) status.textContent = 'Saving...';
  if (button) button.disabled = true;
  try {
    const res = await fetch(`${API}/api/phrases/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrases: state.phrases || {} }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not save phrases');
    state.phrases = data.phrases || {};
    if (status) status.textContent = 'Saved.';
    setSaveStatus('Voice phrases saved', 'ok');
    renderPhrasesPanel();
  } catch (err) {
    if (status) status.textContent = err.message;
    setSaveStatus(err.message, 'err');
  } finally {
    if (button) button.disabled = false;
  }
}

async function transcribeAudio(blob) {
  const res = await fetch(`${API}/api/voice/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'audio/webm' },
    body: blob,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Transcription failed');
  return String(data.text || '').trim();
}

async function scorePhrase(phrase) {
  const stems = state.sounds.map(s => s.stem);
  const res = await fetch(`${API}/api/voice/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phrase, stems }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Scoring failed');
  return data.results || [];
}

function buildMicButton(onTranscript) {
  let recorder = null;
  let chunks = [];
  let recording = false;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'phrase-mic-btn';
  btn.title = 'Click to record a voice phrase';
  btn.textContent = '\uD83C\uDFA4';

  btn.addEventListener('click', async () => {
    if (recording) {
      recorder?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        recording = false;
        btn.textContent = '\uD83C\uDFA4';
        btn.classList.remove('recording');
        btn.title = 'Click to record a voice phrase';
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const prev = btn.textContent;
        btn.textContent = '\u23F3';
        btn.disabled = true;
        try {
          const text = await transcribeAudio(blob);
          if (text) onTranscript(text);
        } catch (err) {
          btn.title = `Error: ${err.message}`;
        } finally {
          btn.textContent = prev;
          btn.disabled = false;
        }
      };
      recorder.start();
      recording = true;
      btn.textContent = '\u23F9';
      btn.classList.add('recording');
      btn.title = 'Recording — click to stop';
    } catch (err) {
      btn.title = `Mic unavailable: ${err.message}`;
    }
  });

  return btn;
}

function buildScoreTester() {
  const section = document.createElement('div');
  section.className = 'phrase-score-section';

  const label = document.createElement('div');
  label.className = 'phrase-score-label';
  label.textContent = 'Test voice match';

  const row = document.createElement('div');
  row.className = 'phrase-score-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'phrase-score-input';
  input.placeholder = 'Type a phrase to see what it matches\u2026';

  const micBtn = buildMicButton(text => {
    input.value = text;
    runScore();
  });
  micBtn.className += ' phrase-mic-btn-score';
  micBtn.title = 'Record a phrase to test matching';

  const results = document.createElement('div');
  results.className = 'phrase-score-results';

  const runScore = async () => {
    const phrase = input.value.trim();
    if (!phrase) { results.innerHTML = ''; return; }
    results.textContent = 'Matching\u2026';
    try {
      const scored = await scorePhrase(phrase);
      results.innerHTML = '';
      if (!scored.length) {
        results.textContent = 'No results returned from server.';
        return;
      }
      scored.slice(0, 8).forEach(item => {
        const rowEl = document.createElement('div');
        rowEl.className = 'phrase-score-row-item';
        const pct = Math.round((item.score || 0) * 100);
        const bar = document.createElement('div');
        bar.className = 'phrase-score-bar';
        bar.style.width = `${Math.min(100, pct)}%`;
        const name = document.createElement('span');
        name.className = 'phrase-score-name';
        name.textContent = displayNameForStem(item.stem);
        const scoreVal = document.createElement('span');
        scoreVal.className = 'phrase-score-value';
        scoreVal.textContent = `${pct}%`;
        rowEl.append(bar, name, scoreVal);
        results.appendChild(rowEl);
      });
    } catch (err) {
      results.textContent = err.message;
    }
  };

  let debounce = null;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(runScore, 480);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(debounce); runScore(); } });
  row.append(input, micBtn);
  section.append(label, row, results);
  return section;
}

function buildPhraseCard(stem) {
  const card = document.createElement('div');
  card.className = 'phrase-card phrase-card-active';
  card.dataset.stem = stem;

  const head = document.createElement('div');
  head.className = 'phrase-card-head';

  const title = document.createElement('span');
  title.className = 'phrase-card-title';
  title.textContent = displayNameForStem(stem);

  const stemLabel = document.createElement('span');
  stemLabel.className = 'phrase-card-stem';
  stemLabel.textContent = stem;

  const rmBtn = document.createElement('button');
  rmBtn.type = 'button';
  rmBtn.className = 'phrase-card-remove';
  rmBtn.title = 'Remove — file still matches by title';
  rmBtn.textContent = '\u00D7';
  rmBtn.addEventListener('click', () => {
    delete state.phrases[stem];
    renderPhrasesPanel();
  });

  head.append(title, stemLabel, rmBtn);

  const area = document.createElement('textarea');
  area.className = 'phrase-card-area';
  area.rows = 3;
  area.placeholder = 'similar phrase\ncommon mishear\nshort nickname';
  area.value = phraseText(stem);
  area.addEventListener('input', () => setPhraseText(stem, area.value));

  const footer = document.createElement('div');
  footer.className = 'phrase-card-footer';

  const micBtn = buildMicButton(text => {
    const existing = area.value.trim();
    area.value = existing ? `${existing}\n${text}` : text;
    setPhraseText(stem, area.value);
  });
  micBtn.title = 'Record phrase to add to this file';

  footer.appendChild(micBtn);
  card.append(head, area, footer);
  return card;
}

export function renderPhrasesPanel() {
  const panel = document.getElementById('phrases-panel');
  if (!panel) return;
  panel.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'phrases-head';
  head.innerHTML = `
    <div>
      <div class="phrases-title">Voice Phrases</div>
      <div class="phrases-sub">Drag a file card here to add custom phrases. Files without phrases still match by their title.</div>
    </div>
    <div class="phrases-actions">
      <span id="phrases-status" class="phrases-status"></span>
      <button id="phrases-save" class="layout-btn primary" type="button">Save</button>
    </div>`;
  panel.appendChild(head);
  head.querySelector('#phrases-save')?.addEventListener('click', savePhrases);

  panel.appendChild(buildScoreTester());

  const zone = document.createElement('div');
  zone.className = 'phrase-drop-zone';
  zone.id = 'phrase-drop-zone';

  const phrasedStems = Object.keys(state.phrases || {}).filter(stem =>
    state.sounds.some(s => s.stem === stem)
  ).sort();

  if (!phrasedStems.length) {
    const empty = document.createElement('div');
    empty.className = 'phrase-zone-empty';
    empty.textContent = 'Drag a file card here to add voice phrases for it.';
    zone.appendChild(empty);
  } else {
    phrasedStems.forEach(stem => zone.appendChild(buildPhraseCard(stem)));
  }

  zone.addEventListener('dragover', e => {
    if (!state.dragStem) return;
    e.preventDefault();
    zone.classList.add('drop-target');
  });
  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drop-target');
  });
  zone.addEventListener('drop', e => {
    if (!state.dragStem) return;
    e.preventDefault();
    zone.classList.remove('drop-target');
    const stem = state.dragStem;
    if (!state.phrases) state.phrases = {};
    if (!Array.isArray(state.phrases[stem])) state.phrases[stem] = [];
    renderPhrasesPanel();
  });

  const zoneLabel = document.createElement('div');
  zoneLabel.className = 'phrase-drop-zone-label';
  zoneLabel.textContent = `Voice Matchable (${phrasedStems.length} file${phrasedStems.length === 1 ? '' : 's'})`;

  panel.append(zoneLabel, zone);
}
