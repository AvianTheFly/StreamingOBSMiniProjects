// utils.js — Shared helpers

/** Human-friendly display name from snake_case key. */
export function displayName(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** HH:MM:SS timestamp. */
export function timestamp() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

/** Escape HTML for safe innerHTML injection. */
export function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Create an element from an HTML string (returns first child). */
export function html(str) {
  const t = document.createElement("template");
  t.innerHTML = str.trim();
  return t.content.firstChild;
}

/** Debounce a function. */
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Show/hide element. */
export function setVisible(el, visible) {
  if (el) el.style.display = visible ? "" : "none";
}

/** Insert rows into a DOM container, replacing existing content. */
export function renderList(container, items, renderItem, emptyMsg = "Nothing here.") {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">${esc(emptyMsg)}</div>`;
    return;
  }
  container.innerHTML = "";
  items.forEach(item => container.appendChild(renderItem(item)));
}
