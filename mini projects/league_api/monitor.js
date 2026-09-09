// The editor is not a second always-on OBS renderer. Unload the iframe when
// collapsed/off-screen/backgrounded so Chromium releases its media decoders.
(() => {
  const panel = document.querySelector('.monitor-tools');
  const frame = document.querySelector('#monitor');
  let inView = true;
  function syncMonitor() {
    const url = panel.open && !document.hidden && inView
      ? '/overlay?monitor=1' : 'about:blank';
    if (frame.getAttribute('src') !== url) frame.setAttribute('src', url);
  }
  panel.addEventListener('toggle', syncMonitor);
  document.addEventListener('visibilitychange', syncMonitor);
  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      syncMonitor();
    }).observe(frame);
  }
  syncMonitor();
})();
