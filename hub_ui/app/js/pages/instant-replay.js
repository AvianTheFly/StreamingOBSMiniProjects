// Replay workspace: browse locally, curate a sequence, explicitly send it to OBS.
import { api } from "../api.js";
import { state } from "../state.js";
import { toast } from "../toast.js";
import { esc } from "../utils.js";
import { mountTrim } from "./replay-trim.js";
import { mountPresentation } from './replay-presentation.js';

let root, unwatch, refreshTimer, previewTimer, generation = 0;
let clips = [], groups = [], revision = 0, selected = new Set();
let query = "", scope = "highlight", page = 0, tab = "clip", clipPath = "", draft = null;
let dirty = false, saving = false, busy = false, loading = false, ready = false;
let companion = false;
let draftRevision = 0;
let renderedClips = "";
let disposeTrim;
let disposePresentation;
let playbackMode = 'showcase';
const PAGE_SIZE = 30;
const $ = selector => root?.querySelector(selector);
const title = clip => clip?.title || clip?.name || "Missing clip";
const findClip = path => clips.find(c => c.path === path);
const button = (id, label, primary = false) => `<button class="btn btn-${primary ? "primary" : "secondary"} btn-sm" id="${id}">${label}</button>`;

export function mount(container) {
  root = container; generation++; clips = []; groups = []; selected = new Set();
  query = ""; scope = "highlight"; page = 0; tab = "clip"; clipPath = ""; draft = null;
  dirty = false; saving = false; loading = false; ready = false; companion = false; renderedClips = "";
  root.innerHTML = `
    <div class="page-header"><div><div class="page-title">Replay &amp; Clips</div>
      <div class="page-subtitle">Replay a moment now. Save your best clips for later.</div></div></div>
    <section id="irPresentation" aria-label="Replay presentation studio"></section>
    <div class="ir-live card">
      <div><span class="state-indicator" id="irIndicator"></span> <strong id="irStatus">Connecting…</strong><span id="irActivity" class="ir-muted"></span></div>
      <div class="ir-actions">${button("irPause", "Pause")}${button("irResume", "Resume")}${button("irSkip", "Next clip")}${button("irStop", "Return to live")}</div>
    </div>
    <details class="card ir-help mt-16"><summary>Capture and voice commands <span class="ir-muted">— press |, then speak</span></summary>
      <div class="ir-help-grid">
        <div><h3>Capture</h3><p><code>mark</code> sets the start. <code>save</code> uses it or the game moment; <code>save 30</code> saves 30 seconds; <code>save full</code> keeps the whole buffer. Add a tag with <code>save win</code>. Quick replay is faster and may include a little extra lead-in.</p><div class="ir-actions">${button("irSaveBuffer", "Save highlight")}${button("irMark", "Mark start")}</div></div>
      <div><h3>Play</h3><p><code>quick replay</code> captures the last 15 seconds for replay only. <code>quick replay 30</code> changes the duration. <code>save and replay</code> saves a highlight candidate and requests a Twitch clip. <code>replay</code> plays the latest capture. <code>showcase</code> and <code>random</code> use highlight candidates.</p></div>
        <div><h3>Control</h3><p>Choose the side view above. <b>Live gameplay view</b> follows your gameplay capture. <b>Gated desktop</b> follows the shared screen visibility control. Use <b>Next clip</b> or <b>Return to live</b> during playback.</p></div>
      </div><p>Voice sends after two seconds, or press <kbd>C</kbd> sooner. During a sequence, <kbd>|</kbd> skips; during a single clip it stops. Browser preview stays off stream.</p>
    </details>
    <div class="ir-workspace mt-16">
      <section class="card ir-library" aria-label="Replay library">
        <div class="ir-heading"><h2>Clip library</h2>${button("irRefresh", "Refresh")}</div>
        <label class="ir-sr" for="irSearch">Search clips</label><input id="irSearch" type="search" placeholder="Search names, notes, tags or dates…">
        <div class="ir-actions"><label class="ir-sr" for="irScope">Filter clips</label><select id="irScope"><option value="highlight" selected>Highlight candidates</option><option value="replay_only">Replay only</option><option value="all">All clips</option><option value="favorites">Favorites</option><option value="kept">Kept clips</option><option value="current game">Current game</option><option value="previous game">Previous game</option><option value="highlight reel">Game reels</option></select><span id="irCount" class="ir-muted"></span></div>
        <div class="ir-selection"><label><input type="checkbox" id="irSelectPage"> Select this page</label><span id="irSelected">0 selected</span>${button("irClear", "Clear")}${button("irAdd", "Add to compilation")}${button("irMakeHighlight", "Keep for highlights")}${button("irMakeReplayOnly", "Replay only")}</div>
        <div id="irClips" class="ir-clip-list">Loading clips…</div>
        <div class="ir-pagination">${button("irPrev", "Previous")}<span id="irPage"></span>${button("irNext", "Next")}</div>
      </section>
      <section class="card ir-editor" aria-label="Replay editor">
        <div class="ir-tabs" role="tablist" aria-label="Replay workspace"><button id="irClipTab" role="tab">Preview &amp; details</button><button id="irGroupTab" role="tab">Compilations <span id="irGroupCount"></span></button></div>
        <div id="irEditor"></div>
      </section>
    </div>`;
  disposePresentation = mountPresentation($('#irPresentation'),{canCapture:()=>ready&&!busy});
  bind("#irRandom", () => live(() => api.runProjectAction("instant_replay", "play_random")));
  bind("#irHighlights", () => live(() => api.runProjectAction("instant_replay", "play_highlights")));
  bind("#irSaveReplay", () => live(() => api.runProjectAction("instant_replay", "save_replay"), 'Saving this moment, then replaying the finished clip'));
  bind("#irReplay", () => live(() => api.runProjectAction("instant_replay", "play_replay")));
  bind('#irQuickReplay', () => live(() => api.captureQuickReplay(Number($('#irQuickSeconds').value)), 'Capturing replay-only moment'));
  bind("#irLatest", () => live(() => api.runProjectAction("instant_replay", "play_showcase")));
  bind("#irPause", () => perform(() => api.pauseProject("instant_replay")));
  bind("#irResume", () => perform(() => api.resumeProject("instant_replay")));
  bind("#irSkip", () => perform(() => api.skipReplayClip()));
  bind("#irStop", () => perform(() => api.revertProject("instant_replay")));
  bind("#irSaveBuffer", () => perform(() => api.runProjectAction("instant_replay", "save"), "Saving buffer… New clips appear here when ready."));
  bind("#irMark", () => perform(() => api.runProjectAction("instant_replay", "mark"), "Start marked for your next save"));
  bind("#irRefresh", () => load(true));
  bind("#irSearch", e => { query = e.target.value.toLowerCase(); page = 0; renderClips(); }, "input");
  bind("#irScope", e => { scope = e.target.value; page = 0; renderClips(); }, "change");
  bind("#irPrev", () => { page--; renderClips(); });
  bind("#irNext", () => { page++; renderClips(); });
  bind("#irClear", () => { selected.clear(); renderClips(); });
  bind("#irSelectPage", e => { visiblePage().forEach(c => e.target.checked ? selected.add(c.path) : selected.delete(c.path)); renderClips(); }, "change");
  bind("#irAdd", () => addPaths([...selected]));
  for(const [id,purpose] of [['irMakeHighlight','highlight'],['irMakeReplayOnly','replay_only']])bind(`#${id}`,async()=>{
    if(!selected.size||!canLeave())return;
    dirty=false;draftRevision=revision;
    if(await save({action:'purpose',paths:[...selected],purpose})){await load(true);renderEditor();}
  });
  bind("#irClipTab", () => switchTab("clip"));
  bind("#irGroupTab", () => switchTab("group"));
  renderEditor(); load(); refreshTimer = setInterval(() => load(), 10000);
  unwatch = state.watch("projects", updateStatus); updateStatus(state.get("projects"));
  window.addEventListener("beforeunload", beforeUnload);
}

export function unmount() {
  disposePresentation?.(); disposePresentation = null;
  disposeTrim?.(); disposeTrim = null;
  generation++; clearInterval(refreshTimer); clearTimeout(previewTimer); unwatch?.();
  $("video")?.pause(); root = null;
  window.removeEventListener("beforeunload", beforeUnload);
}
export function beforeLeave() { return canLeave(); }
function beforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } }
function bind(selector, fn, event = "click") { $(selector)?.addEventListener(event, fn); }
function canLeave() { return !saving && (!dirty || window.confirm("Discard your unsaved edits?")); }
function switchTab(next) { if (next === tab || !canLeave()) return; dirty = false; tab = next; draft = null; renderEditor(); }
async function perform(fn, message) {
  try { const data = await fn(); if (data?.ok === false) throw Error(data.error || "Action unavailable"); if (message) toast.success(message); return data; }
  catch (e) { toast.error(e.message); return null; }
}
async function live(fn, message = 'Playback requested in OBS') {
  $("video")?.pause();
  if (!ready) { toast.error("Replay playback is offline. Open OBS to enable playback."); return; }
  if (busy) { toast.error("Stop the current replay before starting another."); return; }
  await perform(fn, message);
}
async function load(force = false) {
  if (!root || loading) return;
  loading = true; const token = generation;
  try {
    const data = await api.getReplayClips();
    if (!root || token !== generation) return;
    clips = data.clips || []; groups = data.groups || []; revision = data.revision;
    ready = !!data.ready;
    let twitchStatus = $("#irTwitchClip");
    if (!twitchStatus) {
      twitchStatus = document.createElement("p");
      twitchStatus.id = "irTwitchClip";
      twitchStatus.className = "ir-muted";
      $("#irSaveBuffer").parentElement.after(twitchStatus);
    }
    const twitch = data.twitch_clip;
    twitchStatus.textContent = twitch?.message || (twitch ? "Save also requests a 60-second Twitch clip, independent of replay timing. " : "");
    if (twitch?.status === "ready" && /^https:\/\/(clips\.twitch\.tv|www\.twitch\.tv)\//.test(twitch.url)) {
      const link = document.createElement("a");
      link.href = twitch.url; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = " Open Twitch clip";
      twitchStatus.append(link);
    } else if (twitch && (twitch.status === "error" || twitch.status === "idle")) {
      const link = document.createElement("a");
      link.href = "http://127.0.0.1:7443/"; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = " Connect Twitch";
      twitchStatus.append(link);
    }
    selected = new Set([...selected].filter(p => findClip(p)));
    $("#irGroupCount").textContent = `(${groups.length})`;
    renderClips();
    updateStatus(state.get("projects"));
    // Keep an active preview and unsaved form stable during background refresh.
    if (!dirty && tab === "group" && (force || !draft?.id && !draft?.name && !draft?.paths.length && groups.length)) {
      const previousId = draft?.id;
      draft = structuredClone(groups.find(g => g.id === previousId) || groups[0] || freshDraft());
      renderEditor();
    }
  } catch (e) { if (root && token === generation) { if (!clips.length) $("#irClips").textContent = `Could not load clips: ${e.message}`; else if (force) toast.error(e.message); } }
  finally { if (token === generation) loading = false; }
}
function filtered() {
  return clips.filter(c => (scope === "all" || (scope === 'highlight'?c.purpose!=='replay_only':scope==='replay_only'?c.purpose==='replay_only':scope === "favorites" ? c.favorite : scope === "kept" ? c.kept : c.scope === scope)) &&
    `${title(c)} ${c.name} ${c.notes} ${c.tag} ${new Date(c.saved_at * 1000).toLocaleString()}`.toLowerCase().includes(query));
}
function visiblePage() { return filtered().slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE); }
function renderClips() {
  const matches = filtered(); page = Math.max(0, Math.min(page, Math.ceil(matches.length / PAGE_SIZE) - 1));
  const visible = visiblePage();
  $("#irCount").textContent = `${matches.length} clips`;
  $("#irSelected").textContent = `${selected.size} selected`;
  $("#irAdd").disabled = !selected.size || saving;
  $("#irClear").disabled = !selected.size;
  $('#irMakeHighlight').disabled=!selected.size||saving;$('#irMakeReplayOnly').disabled=!selected.size||saving;
  $("#irSelectPage").checked = !!visible.length && visible.every(c => selected.has(c.path));
  $("#irSelectPage").indeterminate = visible.some(c => selected.has(c.path)) && !$("#irSelectPage").checked;
  $("#irPrev").disabled = page === 0;
  $("#irNext").disabled = (page + 1) * PAGE_SIZE >= matches.length;
  $("#irPage").textContent = matches.length ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, matches.length)} of ${matches.length}` : "";
  const clipHTML = visible.map(c => `<div class="ir-clip ${clipPath === c.path ? "is-selected" : ""}" draggable="true" data-id="${c.id}">
    <input type="checkbox" aria-label="Select ${esc(title(c))}" ${selected.has(c.path) ? "checked" : ""}>
    <button class="ir-clip-open" title="Preview and edit ${esc(title(c))}"><strong>${c.favorite ? "★ " : ""}${esc(title(c))}</strong><span>${c.purpose==='replay_only'?'Replay only':'Highlight candidate'} · ${esc(c.scope)} · ${esc(new Date(c.saved_at * 1000).toLocaleDateString())} · ${(c.size_bytes / 1048576).toFixed(0)} MB</span></button>
    <button class="btn btn-secondary btn-sm ir-clip-add" aria-label="Add ${esc(title(c))} to compilation">+</button></div>`).join("") || `<div class="ir-empty">${clips.length ? "No matching clips. Try another search or filter." : "Your saved clips will appear here. Open Live shortcuts above to save your first replay."}</div>`;
  if (tab === "group" && $("#irAddSelected")) groupState();
  if (clipHTML === renderedClips) return;
  renderedClips = clipHTML;
  const focusedId = document.activeElement?.closest("[data-id]")?.dataset.id;
  const focusedCheckbox = document.activeElement?.type === "checkbox";
  $("#irClips").innerHTML = clipHTML;
  $("#irClips").querySelectorAll("[data-id]").forEach(row => {
    const c = clips.find(c => c.id === row.dataset.id);
    row.querySelector("input").onchange = e => { e.target.checked ? selected.add(c.path) : selected.delete(c.path); renderClips(); };
    row.querySelector(".ir-clip-open").onclick = () => { if (!canLeave()) return; tab = "clip"; dirty = false; clipPath = c.path; renderClips(); renderEditor(); };
    row.querySelector(".ir-clip-add").onclick = () => addPaths([c.path]);
    row.ondragstart = e => { e.dataTransfer.setData("application/x-replay-clips", JSON.stringify(selected.has(c.path) ? [...selected] : [c.path])); e.dataTransfer.effectAllowed = "copy"; };
  });
  if (focusedId && focusedCheckbox) $(`#irClips [data-id="${focusedId}"] input`)?.focus();
}
function renderEditor() {
  disposeTrim?.(); disposeTrim = null;
  clearTimeout(previewTimer); $("video")?.pause();
  $("#irClipTab").setAttribute("aria-selected", String(tab === "clip"));
  $("#irGroupTab").setAttribute("aria-selected", String(tab === "group"));
  draftRevision = revision;
  if (tab === "group") return renderGroup();
  const c = findClip(clipPath);
  if (!c) { $("#irEditor").innerHTML = `<div class="ir-empty"><h3>Pick a clip to see what’s inside</h3><p>Click its name to preview it here, edit its display name, or add notes.</p><p>Making an intro? Select clips on the left, then choose <b>Add to compilation</b>.</p></div>`; return; }
  $("#irEditor").innerHTML = `<div class="ir-heading"><h2>Clip details</h2><div class="ir-actions"><select id="irClipMode" class="ir-preview-mode" aria-label="Clip presentation"><option value="showcase">Clip Showcase</option><option value="replay">Quick Replay</option></select>${button("irPlayClip", "Play in OBS", true)}</div></div>
    <div class="ir-preview" id="irPreview"><span>Preview stays in this browser.</span>${button("irPreviewStart", "Load preview")}</div>
    <p id="irPreviewHint" class="ir-muted">A small preview is prepared on demand. Your original stays unchanged.</p>
    <div id="irTrim"><p class="ir-muted">Load the preview to trim a moment and save it as a new clip.</p></div>
    <form id="irClipForm" class="ir-form"><label>Display name<input id="irTitle" maxlength="160" value="${esc(title(c))}" required></label>
    <label>Notes<textarea id="irNotes" rows="3" maxlength="4000" placeholder="What happens in this clip?">${esc(c.notes)}</textarea></label>
    <label class="ir-check"><input id="irFavorite" type="checkbox" ${c.favorite ? "checked" : ""}> Favorite</label>
    <label>Use this clip for<select id="irPurpose"><option value="highlight" ${c.purpose!=='replay_only'?'selected':''}>Highlight candidate</option><option value="replay_only" ${c.purpose==='replay_only'?'selected':''}>Replay only</option></select></label>
    <p class="ir-muted">Saving details or adding to a compilation keeps this clip through automatic game-reel cleanup. This edits library labels, not the source filename or voice tag.</p>
    <div class="ir-actions"><button class="btn btn-primary btn-sm" id="irSaveDetails" type="submit" disabled>Save details</button><span id="irSaveState" role="status" class="ir-muted">Saved</span></div></form>
    <details class="ir-file"><summary>Original file</summary><p>${esc(c.path)}</p>${c.tag ? `<p>Voice tag: ${esc(c.tag)}</p>` : ""}</details>`;
  $('#irClipMode').value = playbackMode;
  bind('#irClipMode', e => { playbackMode=e.target.value; }, 'change');
  bind("#irPlayClip", () => live(() => api.playReplayClip(c.path, playbackMode)));
  $("#irPlayClip").disabled = !ready || busy;
  bind("#irPreviewStart", () => startPreview(c.path));
  bind("#irClipForm", () => { dirty = true; $("#irSaveDetails").disabled = false; $("#irSaveState").textContent = "Unsaved changes"; }, "input");
  bind("#irClipForm", async e => {
    e.preventDefault();
    if (await save({action: "clip", path: c.path, title: $("#irTitle").value, notes: $("#irNotes").value, favorite: $("#irFavorite").checked, purpose:$('#irPurpose').value})) {
      $("#irSaveDetails").disabled = true; $("#irSaveState").textContent = "Saved · clip kept";
    }
  }, "submit");
}
async function startPreview(path) {
  const token = generation;
  const poll = async () => {
    if (!root || token !== generation || clipPath !== path || tab !== "clip") return;
    try {
      const result = await api.replayPreview(path);
      if (!root || token !== generation || clipPath !== path || tab !== "clip") return;
      if (result.status === "ready") {
        $("#irPreview").innerHTML = `<video controls preload="metadata" aria-label="Local clip preview" src="/api/projects/instant_replay/preview-media?path=${encodeURIComponent(path)}"></video>`;
        $("#irPreviewHint").textContent = "Local preview only. Use Play in OBS when you want it on stream.";
        disposeTrim?.();
        disposeTrim = mountTrim($("#irTrim"), $("#irPreview video"), {path, title: title(findClip(path))}, async (result, open) => {
          await load(true);
          // Keeping the original editor open also keeps any unsaved notes intact.
          open.onclick = async () => {
            if (!canLeave()) return;
            await load(true);
            if (!root || token !== generation || !findClip(result.path)) return;
            dirty = false; clipPath = result.path; tab = "clip";
            query = ""; scope = "all"; page = 0; $("#irSearch").value = ""; $("#irScope").value = "all";
            renderClips(); renderEditor(); startPreview(result.path);
            $("#irEditor").scrollIntoView({block: "start", behavior: "smooth"});
          };
        }, result => {
          // Our own added copy must not make unsaved source notes conflict.
          if (draftRevision === result.previous_revision) draftRevision = result.revision;
        });
      } else if (result.status === "error") { $("#irPreview").textContent = result.error; }
      else { $("#irPreview").textContent = result.status === "busy" ? "Another preview is preparing. Yours will follow…" : "Preparing browser preview… You can keep editing."; previewTimer = setTimeout(poll, 2000); }
    } catch (e) { if (root && token === generation && clipPath === path && tab === "clip") $("#irPreview").textContent = e.message; }
  };
  $("#irPreview").textContent = "Preparing browser preview…"; poll();
}
function freshDraft() { return { id: null, name: "", paths: [] }; }
function renderGroup() {
  if (!draft) draft = groups.length ? structuredClone(groups[0]) : freshDraft();
  $("#irEditor").innerHTML = `<div class="ir-heading"><h2>Compilations</h2>${button("irNewGroup", "+ New")}</div>
    <p class="ir-muted">Save as many intros or clip sequences as you need. Only one group is open at a time.</p>
    <label class="ir-form">Choose a compilation<select id="irGroupPicker"><option value="">New compilation…</option>${groups.map(g => `<option value="${g.id}" ${g.id === draft.id ? "selected" : ""}>${esc(g.name)} (${g.paths.length} clips)</option>`).join("")}</select></label>
    <label class="ir-form">Compilation name<input id="irGroupName" maxlength="100" placeholder="e.g. Stream intro" value="${esc(draft.name)}"></label>
    <div class="ir-heading"><strong>Playback order <span id="irSequenceCount"></span></strong>${button("irAddSelected", "Add selected clips")}</div>
    <div id="irSequence" class="ir-sequence" aria-label="Compilation playback order"></div>
    <p class="ir-muted">Drag clips here from the library. Reorder by dragging or use ↑ / ↓. Removing a clip here keeps its original file.</p>
    <div class="ir-actions">${button("irSaveGroup", "Save compilation", true)}${button("irCancelGroup", "Cancel edits")}<span id="irGroupState" role="status" class="ir-muted"></span></div>
    <div class="ir-group-play">${button("irPlayGroup", "Play compilation in OBS", true)}<p id="irGroupVoice" class="ir-muted"></p></div>
    <details class="ir-file"><summary>Manage this compilation</summary><div class="ir-actions">${button("irDuplicate", "Duplicate")}${button("irDeleteGroup", "Delete compilation")}</div><p class="ir-muted">Deleting a compilation leaves all recordings and kept clips intact.</p></details>`;
  $("#irGroupPicker").value = draft.id || "";
  bind("#irNewGroup", () => { if (!canLeave()) return; draft = freshDraft(); dirty = false; renderEditor(); $("#irGroupName").focus(); });
  bind("#irGroupPicker", e => { const id = e.target.value; if (!canLeave()) { e.target.value = draft.id || ""; return; } draft = structuredClone(groups.find(g => g.id === id) || freshDraft()); dirty = false; renderEditor(); }, "change");
  bind("#irGroupName", e => { draft.name = e.target.value; dirty = true; groupState(); }, "input");
  bind("#irAddSelected", () => addPaths([...selected]));
  bind("#irCancelGroup", () => { draft = structuredClone(groups.find(g => g.id === draft.id) || freshDraft()); dirty = false; renderEditor(); });
  bind("#irSaveGroup", async () => {
    const result = await save({ action: "group", ...draft });
    if (result) { draft = structuredClone(groups.find(g => g.name === draft.name.trim())); renderEditor(); }
  });
  bind("#irPlayGroup", () => live(() => api.playReplayGroup(draft.id)));
  bind("#irDuplicate", () => { if (!canLeave()) return; draft = { ...structuredClone(draft), id: null, name: `${draft.name} copy` }; dirty = true; renderEditor(); });
  bind("#irDeleteGroup", async () => {
    if (!draft.id || !window.confirm(`Delete “${draft.name}”? The recordings will stay.`)) return;
    if (await save({ action: "delete_group", id: draft.id })) { draft = null; renderEditor(); }
  });
  renderSequence();
}
function groupState() {
  if (tab !== "group") return;
  $("#irSaveGroup").disabled = saving || !dirty || !draft.name.trim();
  $("#irCancelGroup").disabled = saving || !dirty;
  $("#irPlayGroup").disabled = !ready || busy || dirty || saving || !draft.id || !draft.paths.length || draft.paths.some(p => !findClip(p));
  $("#irDeleteGroup").disabled = saving || !draft.id;
  $("#irDuplicate").disabled = saving || !draft.id;
  $("#irAddSelected").disabled = saving || !selected.size;
  $("#irGroupState").textContent = saving ? "Saving…" : dirty ? "Unsaved changes — save before playing" : draft.id ? "Saved" : "Name this group and add clips to begin";
  $("#irGroupVoice").textContent = draft.id && !dirty ? `Voice: press |, then say “play intro ${draft.name}”` : "Save to enable playback and a voice command.";
}
function addPaths(paths) {
  if (!paths.length || saving) return;
  if (tab !== "group") { if (!canLeave()) return; tab = "group"; draft = freshDraft(); dirty = false; renderEditor(); }
  draft.paths.push(...paths.filter(p => findClip(p))); dirty = true; renderSequence();
  $("#irGroupName").focus();
}
function renderSequence() {
  $("#irSequenceCount").textContent = `(${draft.paths.length})`;
  const target = $("#irSequence");
  target.innerHTML = draft.paths.map((path, i) => `<div class="ir-sequence-row" draggable="true" data-index="${i}"><span class="ir-muted">${i + 1}</span><span class="ir-sequence-name">${esc(title(findClip(path)))}${!findClip(path) ? `<small>${esc(path.split(/[\\/]/).pop())} — remove or replace before playing</small>` : ""}</span><button class="btn btn-secondary btn-sm" data-move="-1" aria-label="Move clip ${i + 1} up" ${i === 0 ? "disabled" : ""}>↑</button><button class="btn btn-secondary btn-sm" data-move="1" aria-label="Move clip ${i + 1} down" ${i === draft.paths.length - 1 ? "disabled" : ""}>↓</button><button class="btn btn-secondary btn-sm" data-remove aria-label="Remove clip ${i + 1}">×</button></div>`).join("") || `<div class="ir-empty">Drop clips here, or select clips in the library and choose <b>Add selected clips</b>.</div>`;
  const move = (from, to) => { if (saving || from === to || from < 0 || to < 0 || from >= draft.paths.length || to >= draft.paths.length) return; const [item] = draft.paths.splice(from, 1); draft.paths.splice(to, 0, item); dirty = true; renderSequence(); };
  target.querySelectorAll("[data-index]").forEach(row => {
    const i = Number(row.dataset.index);
    row.querySelectorAll("[data-move]").forEach(b => b.onclick = () => move(i, i + Number(b.dataset.move)));
    row.querySelector("[data-remove]").onclick = () => { if (saving) return; draft.paths.splice(i, 1); dirty = true; renderSequence(); };
    row.ondragstart = e => { e.dataTransfer.setData("application/x-replay-order", String(i)); e.dataTransfer.effectAllowed = "move"; };
  });
  target.ondragover = e => { if ([...e.dataTransfer.types].some(t => t.startsWith("application/x-replay-"))) { e.preventDefault(); target.classList.add("is-dragging"); } };
  target.ondragleave = e => { if (!target.contains(e.relatedTarget)) target.classList.remove("is-dragging"); };
  target.ondrop = e => {
    e.preventDefault(); target.classList.remove("is-dragging"); if (saving) return;
    const order = e.dataTransfer.getData("application/x-replay-order");
    if (order !== "") { const dest = e.target.closest("[data-index]"); move(Number(order), dest ? Number(dest.dataset.index) : draft.paths.length - 1); }
    else { try { const paths = JSON.parse(e.dataTransfer.getData("application/x-replay-clips")); if (Array.isArray(paths)) addPaths(paths); } catch {} }
  };
  groupState();
}
async function save(payload) {
  if (saving) return null;
  saving = true; const token = generation;
  root.querySelectorAll("#irEditor input, #irEditor textarea, #irEditor select, #irEditor button").forEach(e => e.disabled = true);
  try {
    const data = await api.saveReplayLibrary({ ...payload, revision: draftRevision });
    if (!root || token !== generation) return null;
    dirty = false; groups = data.groups; revision = data.revision; draftRevision = revision;
    clips.forEach(c => { const meta = data.clips[c.id]; if (meta) Object.assign(c, meta, { title: meta.title || c.name }); });
    $("#irGroupCount").textContent = `(${groups.length})`; renderClips(); toast.success("Saved"); return data;
  } catch (e) {
    if (root && token === generation) {
      toast.error(e.message);
      let recover = $("#irReloadSaved");
      if (!recover) {
        recover = document.createElement("button"); recover.id = "irReloadSaved";
        recover.className = "btn btn-secondary btn-sm";
        recover.textContent = "Reload saved version";
        recover.onclick = async () => {
          if (!canLeave()) return;
          dirty = false; await load(true);
          if (root && token === generation) renderEditor();
        };
        $("#irEditor").appendChild(recover);
      }
    }
    return null;
  }
  finally { if (root && token === generation) { saving = false; root.querySelectorAll("#irEditor input, #irEditor textarea, #irEditor select, #irEditor button").forEach(e => e.disabled = false); groupState(); } }
}
function updateStatus(projects = []) {
  if (!root) return;
  const p = projects?.find(p => p.name === "instant_replay");
  const waiting = p?.current_activity === 'saving for replay';
  busy = !!p?.is_active || waiting;
  const paused = busy && (p.current_activity || "").includes("paused");
  $("#irStatus").textContent = !ready ? "Playback offline" : waiting ? 'Saving for replay' : paused ? "Paused in OBS" : busy ? "Playing in OBS" : "Ready for replay";
  $("#irActivity").textContent = !ready ? " · Preview, trim and organize clips here. Open OBS to enable playback." : busy ? ` · ${p.current_activity || "replay"}` : " · Preview and organize clips below";
  $("#irIndicator").className = `state-indicator state-indicator--${busy ? "active" : "idle"}`;
  $("#irPause").disabled = !busy || paused || waiting; $("#irResume").disabled = !paused;
  $("#irSkip").disabled = !busy || waiting; $("#irStop").disabled = !busy;
  $("#irRandom").disabled = !ready || busy; $("#irLatest").disabled = !ready || busy; $("#irReplay").disabled = !ready || busy;
  $('#irHighlights').disabled = !ready || busy; $('#irSaveReplay').disabled = !ready || busy;
  $('#irQuickReplay').disabled = !ready || busy;
  $("#irSaveBuffer").disabled = !ready; $("#irMark").disabled = !ready;
  if ($("#irPlayClip")) $("#irPlayClip").disabled = !ready || busy || saving;
  if (tab === "group" && $("#irPlayGroup")) groupState();
}
