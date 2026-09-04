// nav.js — Sidebar navigation and project list rendering

import { state }       from "./state.js";
import { displayName } from "./utils.js";

const PROJECT_ICONS = {
  specific_song:       "♫",
  soundboard:          "🎛",
  tik_tok:             "▶",
  sound_effects:       "🔊",
  scene_voice_switcher:"🎬",
  league:              "⚔",
  instant_replay:      "⏮",
  love_me:             "♥",
};

export function initNav(navigate) {
  // Mobile toggle
  const toggle = document.getElementById("navToggle");
  const nav    = document.getElementById("nav");
  if (toggle) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }

  // Close nav on link click (mobile)
  nav?.querySelectorAll(".nav-item[data-page]").forEach(a => {
    a.addEventListener("click", () => nav.classList.remove("open"));
  });

  // Render project nav items when projects list changes
  state.watch("projects", (projects) => {
    _renderProjectNav(projects, navigate);
  });

  // Initial render
  _renderProjectNav(state.get("projects"), navigate);
}

function _renderProjectNav(projects, navigate) {
  const container = document.getElementById("navProjects");
  if (!container) return;
  container.innerHTML = "";

  projects.forEach(p => {
    const a = document.createElement("a");
    a.className = "nav-item";
    a.href = `#projects/${p.name}`;
    a.dataset.page = `projects/${p.name}`;

    const dot = document.createElement("span");
    dot.className = `nav-dot ${p.is_active ? "nav-dot--active" : "nav-dot--idle"}`;
    dot.title = p.is_active ? (p.current_activity || "active") : "idle";

    const icon = document.createElement("span");
    icon.style.fontSize = "13px";
    icon.style.lineHeight = "1";
    icon.textContent = PROJECT_ICONS[p.name] || "◆";

    const label = document.createElement("span");
    label.textContent = displayName(p.name);

    a.appendChild(icon);
    a.appendChild(label);
    a.appendChild(dot);

    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(`projects/${p.name}`);
    });

    container.appendChild(a);
  });
}

export function setActiveNavItem(page) {
  document.querySelectorAll(".nav-item").forEach(el => {
    const target = el.dataset.page;
    el.classList.toggle("active", target === page);
  });
}
