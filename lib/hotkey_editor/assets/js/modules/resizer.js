export function initPanelResizer() {
  const resizer = document.getElementById('panel-resizer');
  const left    = document.getElementById('panel-left');
  const body    = document.querySelector('.app-body');
  if (!resizer || !left || !body) return;

  let dragging = false;

  const onMove = e => {
    if (!dragging || window.innerWidth <= 980) return;
    const rect    = body.getBoundingClientRect();
    const next    = e.clientX - rect.left;
    const min     = 260;
    const max     = Math.max(min, rect.width - 360);
    const clamped = Math.max(min, Math.min(next, max));
    left.style.width = `${clamped}px`;
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stop);
  };

  resizer.addEventListener('pointerdown', e => {
    if (window.innerWidth <= 980) return;
    dragging = true;
    resizer.classList.add('dragging');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    e.preventDefault();
  });
}
