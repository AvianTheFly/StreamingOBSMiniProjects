// toast.js — Non-blocking toast notifications

const DURATION = 3500;

function show(msg, type = "info") {
  const container = document.getElementById("toasts");
  if (!container) return;

  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = msg;

  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.style.transition = "opacity .2s, transform .2s";
    setTimeout(() => el.remove(), 220);
  }, DURATION);
}

export const toast = {
  success: (msg) => show(msg, "success"),
  error:   (msg) => show(msg, "error"),
  info:    (msg) => show(msg, "info"),
};
