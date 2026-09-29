// One decoded image, one canvas; animation frames run only during a burst.
(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1920; canvas.height = 1080;
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  document.querySelector('#stage').append(canvas);
  const ctx = canvas.getContext('2d'), icon = new Image();
  icon.src = '/sprite.png';
  let lastId = null, frame = 0, dirty = false;
  const clearCanvas = () => {
    if (!dirty) return;
    ctx.clearRect(0, 0, 1920, 1080);
    dirty = false;
  };
  const clear = () => { cancelAnimationFrame(frame); frame = 0; clearCanvas(); };
  window.levelSprites = { update(event) {
    if (!event || event.remaining <= 0) { clear(); return; }
    if (event.id === lastId) return;
    lastId = event.id; clear();
    const start = performance.now(), elapsed = Math.max(0, 2 - event.remaining);
    const params = Array.from({length: Math.min(100, event.level)}, () => ({
      anchor: 150 + Math.floor(Math.random() * 1621), amp: 40 + Math.random() * 80,
      freq: 1.5 + Math.random() * 1.5, phase: Math.random() * Math.PI * 2
    }));
    function draw(now) {
      frame = 0;
      clearCanvas();
      const p = Math.min(1, (elapsed + (now - start) / 1000) / 2);
      if (p >= 1) return;
      if (icon.complete && icon.naturalWidth) {
        const scale = Math.min(96 / icon.naturalWidth, 96 / icon.naturalHeight);
        const w = icon.naturalWidth * scale, h = icon.naturalHeight * scale;
        for (const s of params) {
          const x = s.anchor + s.amp * Math.sin(s.phase + p * s.freq * Math.PI * 2);
          const y = 1000 - 1020 * (1 - (1 - p) ** 2);
          ctx.drawImage(icon, x + (96-w)/2, y + (96-h)/2, w, h);
          dirty = true;
        }
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
  }};
  addEventListener('pagehide', clear);
})();
