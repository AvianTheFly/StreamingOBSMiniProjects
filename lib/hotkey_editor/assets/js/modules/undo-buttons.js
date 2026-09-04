import { markDirty } from './ui.js';

export function bindUndoButton(button, {
  canUndo,
  undo,
  render,
  titleReady = 'Undo last change',
  titleEmpty = 'Nothing to undo',
} = {}) {
  if (!button) return;

  const refresh = () => {
    const ready = !!canUndo?.();
    button.disabled = !ready;
    button.title = ready ? titleReady : titleEmpty;
  };

  button.onclick = (event) => {
    event.stopPropagation();
    if (!canUndo?.()) {
      refresh();
      return;
    }
    undo?.();
    markDirty();
    render?.();
  };

  refresh();
}
