import { esc } from "../utils.js";
import { toast } from "../toast.js";

let container = null;
let timer = null;
let controller = null;
let sessionId = null;

export function mount(element) {
  container = element;
  element.innerHTML = `
    <div class="page-header"><div><div class="page-title">Voice</div>
      <div class="page-subtitle">Shared microphone, transcription, and project delivery</div></div>
      <a href="#settings" class="btn btn-sm">Voice settings</a></div>
    <div class="card mb-16"><div id="voiceStatus" aria-live="polite">Connecting…</div>
      <div class="page-actions mt-12">
        <button class="btn btn-primary btn-sm" id="voiceFinish" disabled>Finish recording</button>
        <button class="btn btn-sm" id="voiceCancel" disabled>Cancel command</button>
      </div></div>
    <div class="card mb-16"><h3>Projects using voice</h3><div id="voiceConsumers"></div></div>
    <div class="card"><div class="page-header"><h3>Recent transcripts</h3>
      <button class="btn btn-sm" id="voiceClear">Clear history</button></div>
      <p class="page-subtitle">Last 50 sessions, kept in memory until Hub restart.</p>
      <div id="voiceHistory"></div></div>`;
  element.querySelector("#voiceFinish").onclick = () => action("finish");
  element.querySelector("#voiceCancel").onclick = () => action("cancel");
  element.querySelector("#voiceClear").onclick = () => action("clear_history");
  refresh();
}

async function action(name) {
  try {
    const response = await fetch("/api/voice", {method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({action: name, session_id: sessionId})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Voice action failed");
    refresh();
  } catch (error) { toast.error(error.message); }
}

async function refresh() {
  clearTimeout(timer);
  controller?.abort();
  if (!container) return;
  const element = container;
  const request = new AbortController();
  controller = request;
  try {
    if (document.hidden) return;
    const response = await fetch("/api/voice", {signal: request.signal});
    if (!response.ok) throw new Error("Voice status unavailable");
    const data = await response.json();
    if (container !== element || controller !== request) return;
    sessionId = data.session_id;
    const elapsed = data.started_at ? ` · ${Math.max(0, (Date.now()/1000-data.started_at)).toFixed(1)}s` : "";
    element.querySelector("#voiceStatus").innerHTML = `
      <strong>${esc(data.ready ? data.state : "Starting / unavailable")}</strong>
      ${data.owner ? ` · ${esc(data.owner)}${elapsed}` : ""}
      <p>${esc(data.model)} · ${esc(data.device)} · ${esc(data.compute)}</p>
      ${data.startup_error ? `<p>${esc(data.startup_error)}</p>` : ""}
      ${data.last_rejection ? `<p>Last blocked request: ${esc(data.last_rejection.owner)} · ${esc(data.last_rejection.reason)}</p>` : ""}
      ${data.state === "cancelling" ? "<p>Result will be discarded when inference finishes.</p>" : ""}`;
    element.querySelector("#voiceFinish").disabled = data.state !== "listening";
    element.querySelector("#voiceCancel").disabled = !data.session_id || data.state === "cancelling";
    element.querySelector("#voiceConsumers").innerHTML = (data.consumers || []).map(c =>
      `<p><strong>${esc(c.tag)}</strong> · ${esc(c.state)} · auto stop ${esc(c.timeout)}s</p>`).join("") || "No projects registered.";
    element.querySelector("#voiceHistory").innerHTML = (data.history || []).map(item => `
      <div class="mb-16"><strong>${esc(item.owner)}</strong> · ${esc(item.outcome)} ·
        ${esc(new Date(item.started_at*1000).toLocaleTimeString())}
        <p>${esc(item.text || (item.outcome === "empty" ? "No speech detected" : ""))}</p>
        ${item.error ? `<p>${esc(item.error)}</p>` : ""}</div>`).join("") || "No voice sessions yet.";
  } catch (error) {
    if (error.name !== "AbortError" && container === element)
      element.querySelector("#voiceStatus").textContent = error.message;
  } finally {
    if (container === element && controller === request)
      timer = setTimeout(refresh, document.hidden ? 3000 : 1000);
  }
}

export function unmount() {
  container = null;
  sessionId = null;
  clearTimeout(timer);
  controller?.abort();
}
