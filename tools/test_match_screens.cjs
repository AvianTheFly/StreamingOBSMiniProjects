// Verify the real renderer cannot fade the game back in before a scene handoff.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const elements = [];
function element() {
  const item = {style: {}, firstChild: null, append() {}, getContext() {return {};},
    replaceChildren(...children) {this.firstChild = children[0];}};
  elements.push(item);
  return item;
}
let now = 0;
const timers = new Map();
let nextTimer = 0;
const context = {
  document: {hidden: false, createElement: element, querySelector: element, addEventListener() {}},
  window: {addEventListener() {}},
  Image: class {constructor() {this.style = {}; this.complete = true; this.naturalWidth = 1920;}},
  ProductionScene: class {constructor() {this.ready = Promise.resolve();} clear() {} draw() {}},
  performance: {now: () => now},
  setTimeout: callback => {timers.set(++nextTimer, callback); return nextTimer;},
  clearTimeout: id => timers.delete(id),
};
const filename = path.join(__dirname, '../mini projects/league_api/production/web/match-screens.js');
const source = fs.readFileSync(filename, 'utf8').replace(/^import[^\n]+\n/, '');
vm.runInNewContext(source, context, {filename});
const cover = elements[0];
const api = context.window.leagueMatchScreens;
api.update({key: 'victory', elapsed: 4.8, duration: 5, remaining: 10.2, protected: true}, {});
assert.equal(cover.style.opacity, '1');
now = 1500;
for (const callback of [...timers.values()]) callback();
assert.equal(cover.style.display, 'block');
assert.equal(cover.style.opacity, '1', 'The full cover survives the original image deadline');
api.disconnected();
assert.equal(cover.style.opacity, '1');
api.update(null, {});
assert.equal(cover.style.display, 'none', 'Confirmed server release removes the cover');
now = 0;
api.update({key: 'victory', elapsed: 4.8, duration: 5, remaining: .2, protected: false}, {});
assert(Number(cover.style.opacity) < 1, 'Preview keeps its original fade');
now = 500;
api.disconnected();
assert.equal(cover.style.display, 'none');
now = 0;
api.update({key: 'defeat', elapsed: 5, duration: 5, remaining: 10, protected: true}, {});
now = 10001;
api.disconnected();
assert.equal(cover.style.display, 'none', 'A lost service still has a finite safety deadline');
console.log('Match-screen rendering: protected handoff, preview fade, clear and failure deadline passed');
