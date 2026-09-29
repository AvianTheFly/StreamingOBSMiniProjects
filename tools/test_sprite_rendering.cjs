// Offline canvas lifecycle regression; no browser, OBS, or GPU required.
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
let clears = 0, draws = 0, next = 0, pagehide;
const frames = new Map();
const context = {clearRect() { clears++; }, drawImage() { draws++; }};
const window = {};
runInNewContext(readFileSync(path.join(__dirname, '../mini projects/league_api/sprites.js'), 'utf8'), {
  window, document: {createElement: () => ({style: {}, getContext: () => context}),
    querySelector: () => ({append() {}})},
  Image: class { constructor() { this.complete = true; this.naturalWidth = this.naturalHeight = 96; } },
  performance: {now: () => 0},
  requestAnimationFrame(fn) { frames.set(++next, fn); return next; },
  cancelAnimationFrame(id) { frames.delete(id); },
  addEventListener(type, fn) { if (type === 'pagehide') pagehide = fn; }
});
function tick(now) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); }
for (let i = 0; i < 100; i++) window.levelSprites.update(null);
assert.equal(clears, 0, 'idle polling must not write to the canvas');
window.levelSprites.update({id: 1, remaining: 2, level: 6});
tick(16);
assert.equal(draws, 6);
window.levelSprites.update({id: 1, remaining: 1.9, level: 6});
assert.equal(frames.size, 1, 'polling must not duplicate animation loops');
tick(2001);
assert.equal(clears, 1, 'completion erases the final frame');
assert.equal(frames.size, 0);
for (let i = 0; i < 100; i++) window.levelSprites.update(null);
assert.equal(clears, 1);
window.levelSprites.update({id: 2, remaining: 2, level: 3});
tick(16);
pagehide();
assert.equal(clears, 2);
assert.equal(frames.size, 0);
console.log('Sprite rendering lifecycle passed');
