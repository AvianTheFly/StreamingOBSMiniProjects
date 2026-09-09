const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const events = {};
let observer;
const frame = {
  src: 'about:blank',
  getAttribute() { return this.src; },
  setAttribute(_, value) { this.src = value; },
};
const panel = {open: false, addEventListener(name, fn) { events[name] = fn; }};
const document = {
  hidden: false,
  querySelector: selector => selector === '#monitor' ? frame : panel,
  addEventListener(name, fn) { events[name] = fn; },
};
vm.runInNewContext(fs.readFileSync(__dirname + '/monitor.js', 'utf8'), {
  document,
  IntersectionObserver: class { constructor(fn) { observer = fn; } observe() {} },
});
assert.equal(frame.src, 'about:blank', 'Collapsed monitor must not load media');
panel.open = true; events.toggle();
assert.equal(frame.src, '/overlay?monitor=1');
document.hidden = true; events.visibilitychange();
assert.equal(frame.src, 'about:blank');
document.hidden = false; events.visibilitychange();
assert.equal(frame.src, '/overlay?monitor=1');
observer([{isIntersecting: false}]);
assert.equal(frame.src, 'about:blank');
observer([{isIntersecting: true}]);
assert.equal(frame.src, '/overlay?monitor=1');
panel.open = false; events.toggle();
assert.equal(frame.src, 'about:blank');
console.log('League monitor lifecycle passed');
