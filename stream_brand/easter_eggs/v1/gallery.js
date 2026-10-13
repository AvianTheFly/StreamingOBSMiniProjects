// Standalone review UI. One bounded visible animation loop; no Hub or OBS APIs.
const catalog = globalThis.CAMEO_CATALOG, $ = s => document.querySelector(s);
const canvas = $('canvas'), ctx = canvas.getContext('2d'), renderer = new Cameo.Renderer(catalog);
let clip = catalog.clips[0], seconds = 0, playing = false, raf = 0, previousTime = 0, selection = 0;
const options = () => ({ scale: Number($('#scale').value), flip: $('#flip').checked });
function paint() {
  renderer.draw(ctx, clip, seconds, options());
  $('#scrub').value = Math.min(119, Math.round(seconds * 24));
  $('#time').textContent = `${seconds.toFixed(2)} / 5.00`;
  $('#phase').textContent = seconds < .2 ? 'Clear' : seconds < .85 ? 'Entrance' : seconds < 3.7 ? 'Performance' : seconds < 4 ? 'Hold' : seconds < 4.8 ? 'Exit' : 'Clear';
}
function stop() { playing = false; cancelAnimationFrame(raf); raf = 0; $('#play').textContent = 'Play once'; }
function tick(now) {
  if (!playing || document.hidden) return;
  seconds += Math.min(.1, (now - previousTime) / 1000) * Number($('#speed').value); previousTime = now;
  if (seconds >= 5) { if ($('#loop').checked) seconds %= 5; else { seconds = 5; stop(); } }
  paint(); if (playing) raf = requestAnimationFrame(tick);
}
function play() { stop(); if (seconds >= 4.8) seconds = 0; playing = true; previousTime = performance.now(); $('#play').textContent = 'Pause'; raf = requestAnimationFrame(tick); }
async function select(id, autoplay = false) {
  const generation = ++selection; stop(); const next = catalog.clips.find(c => c.id === id); if (!next) return;
  $('#play').disabled = true;
  if (next.character !== renderer.character || !renderer.images.size) await renderer.load(next.character);
  if (generation !== selection) return;
  clip = next; seconds = 0;
  const char = catalog.characters.find(c => c.id === clip.character);
  $('#character-label').textContent = char.name; $('#act-name').textContent = clip.name; $('#kind').textContent = clip.kind;
  $('#beats').textContent = clip.beats.split(';').map(s => s.trim()).join(' → ') + '.';
  $('#art-note').textContent = char.art;
  $('#clip-download').href = clip.file; $('#frames-download').href = `frames/${clip.id}.zip`; $('#pose-link').href = char.poses[clip.character === 'boo' ? 1 : clip.row * 8 + 4];
  for (const button of document.querySelectorAll('nav button')) button.classList.toggle('active', button.dataset.character === clip.character);
  $('#acts').replaceChildren();
  for (const act of catalog.clips.filter(c => c.character === clip.character)) {
    const button = document.createElement('button'); button.className = 'act' + (act.id === clip.id ? ' active' : '');
    const kind = document.createElement('small'), title = document.createElement('strong'); kind.textContent = act.kind; title.textContent = act.name;
    button.append(kind, title); button.onclick = () => select(act.id, true); $('#acts').append(button);
  }
  $('#play').disabled = false; paint(); if (autoplay) play();
}
for (const char of catalog.characters) {
  const button = document.createElement('button'); button.dataset.character = char.id;
  const image = document.createElement('img'); image.src = char.poses[0]; image.alt = ''; const name = document.createElement('span'); name.className = 'name'; name.textContent = char.name;
  button.append(image, name); button.onclick = () => select(catalog.clips.find(c => c.character === char.id).id, true); $('#cast').append(button);
}
$('#play').onclick = () => playing ? stop() : play();
$('#previous').onclick = () => { stop(); seconds = Math.max(0, seconds - 1 / 24); paint(); };
$('#next').onclick = () => { stop(); seconds = Math.min(119 / 24, seconds + 1 / 24); paint(); };
$('#scrub').oninput = () => { stop(); seconds = Number($('#scrub').value) / 24; paint(); };
for (const id of ['scale', 'flip']) $('#' + id).oninput = paint;
$('#background').onchange = () => { $('#stage').className = 'stage ' + $('#background').value; };
$('#random').onclick = () => select(catalog.clips[Math.floor(Math.random() * catalog.clips.length)].id, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
window.addEventListener('pagehide', () => { stop(); selection++; renderer.dispose(); });
select(clip.id).then(() => { globalThis.galleryReady = true; });
// Explicit finite export surface. This owns no timer and is also useful to hosts.
globalThis.cameoReview = { catalog, select, renderer, sample: Cameo.sample, stop,
  get clip() { return clip; }, seek(t) { stop(); seconds = t; paint(); },
  render(t) { renderer.draw(ctx, clip, t); return canvas.toDataURL('image/png'); },
  setSize(w, h) { canvas.width = w; canvas.height = h; }, get playing() { return playing; } };
