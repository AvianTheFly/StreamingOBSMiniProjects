import { api } from "../api.js";
import { esc } from "../utils.js";
import { toast } from "../toast.js";

const time = value => `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, "0")}`;

// Each preview owns its controls; switching clips disposes its playback and polling.
export function mountTrim(host, video, clip, onSaved, onRevision) {
  let start = 0, end = 0, duration = 0, audition = false, saving = false;
  let disposed = false, frame, timer;
  const $ = selector => host.querySelector(selector);
  host.innerHTML = `<section class="ir-trim" aria-label="Trim replay">
    <div class="ir-heading"><h3>Trim a moment</h3><span id="irTrimLength" class="ir-muted"></span></div>
    <p class="ir-muted">Scrub the preview, then set your start and end. Save the moment as a new clip.</p>
    <fieldset id="irTrimControls" disabled>
      <div class="ir-trim-track" aria-hidden="true"><span id="irTrimRegion"></span><i id="irTrimCursor"></i></div>
      <div class="ir-trim-range"><label for="irTrimStart">Start</label><input id="irTrimStart" type="range" min="0" step="0.1" value="0"><input id="irTrimStartNumber" type="number" min="0" step="0.1" value="0" aria-label="Trim start in seconds"></div>
      <div class="ir-trim-range"><label for="irTrimEnd">End</label><input id="irTrimEnd" type="range" min="0.1" step="0.1"><input id="irTrimEndNumber" type="number" min="0.1" step="0.1" aria-label="Trim end in seconds"></div>
      <div class="ir-actions"><button class="btn btn-secondary btn-sm" id="irTrimSetStart">Start here</button><button class="btn btn-secondary btn-sm" id="irTrimSetEnd">End here</button><span id="irTrimPosition" class="ir-muted"></span></div>
      <div class="ir-actions"><button class="btn btn-secondary btn-sm" data-last="10">Last 10s</button><button class="btn btn-secondary btn-sm" data-last="30">Last 30s</button><button class="btn btn-secondary btn-sm" id="irTrimReset">Full clip</button></div>
      <div class="ir-actions"><button class="btn btn-secondary btn-sm" id="irTrimPreview">Preview selection</button><label class="ir-check ir-muted"><input id="irTrimLoop" type="checkbox"> Loop selection</label></div>
      <label class="ir-trim-name" for="irTrimName">New clip name<input id="irTrimName" maxlength="160" value="${esc((clip.title + " (cut)").slice(0, 160))}"></label>
      <div class="ir-actions"><button class="btn btn-primary btn-sm" id="irTrimSave">Save trimmed copy</button><span class="ir-muted">Original kept · full resolution</span></div>
    </fieldset>
    <p id="irTrimStatus" class="ir-muted" role="status">Loading clip duration…</p>
  </section>`;

  function update() {
    $("#irTrimControls").disabled = saving || !duration;
    for (const [id, value] of [["Start", start], ["End", end]]) {
      for (const suffix of ["", "Number"]) {
        const input = $(`#irTrim${id}${suffix}`);
        input.max = duration.toFixed(1);
        if (suffix !== "Number" || document.activeElement !== input) input.value = value.toFixed(1);
      }
    }
    $("#irTrimLength").textContent = `${time(start)} → ${time(end)} · ${(end - start).toFixed(1)}s selected`;
    $("#irTrimRegion").style.left = `${100 * start / (duration || 1)}%`;
    $("#irTrimRegion").style.width = `${100 * (end - start) / (duration || 1)}%`;
    $("#irTrimPreview").textContent = audition ? "Stop preview" : "Preview selection";
    $("#irTrimSave").disabled = saving || !duration || !$("#irTrimName").value.trim();
    $("#irTrimSave").textContent = saving ? "Saving copy…" : "Save trimmed copy";
    position();
  }
  function stopPreview() {
    audition = false; cancelAnimationFrame(frame);
    video.pause(); update();
  }
  function position() {
    $("#irTrimCursor").style.left = `${100 * Math.min(video.currentTime, duration) / (duration || 1)}%`;
    $("#irTrimPosition").textContent = `At ${time(video.currentTime)}`;
    $("#irTrimSetStart").disabled = saving || video.currentTime > end - 0.1;
    $("#irTrimSetEnd").disabled = saving || video.currentTime < start + 0.1;
  }
  function tick() {
    if (disposed) return;
    cancelAnimationFrame(frame);
    position();
    if (audition && video.currentTime >= end) {
      if ($("#irTrimLoop").checked) {
        video.currentTime = start;
        video.play().catch(() => stopPreview());
      } else {
        stopPreview(); video.currentTime = end;
      }
    }
    if (audition) frame = requestAnimationFrame(tick);
  }
  function loaded() {
    if (!Number.isFinite(video.duration) || video.duration < 0.1) return;
    duration = Math.floor(video.duration * 10) / 10; end = duration;
    $("#irTrimStatus").textContent = "Times are in seconds. Drag either slider or enter an exact time.";
    update();
  }
  function changeRange(which, value) {
    if (!Number.isFinite(value)) { update(); return; }
    stopPreview();
    value = Math.round(value * 10) / 10;
    if (which === "Start") start = Math.max(0, Math.min(value, end - 0.1));
    else end = Math.min(duration, Math.max(value, start + 0.1));
    video.currentTime = which === "Start" ? start : end;
    update();
  }
  for (const which of ["Start", "End"]) {
    $(`#irTrim${which}`).oninput = e => changeRange(which, Number(e.target.value));
    $(`#irTrim${which}Number`).oninput = e => {
      if (Number.isFinite(e.target.valueAsNumber)) changeRange(which, e.target.valueAsNumber);
    };
    $(`#irTrim${which}Number`).onblur = update;
    $(`#irTrimSet${which}`).onclick = () => changeRange(which, video.currentTime);
  }
  function last(seconds) {
    stopPreview(); end = duration; start = Math.max(0, end - seconds);
    video.currentTime = start; update();
  }
  host.querySelectorAll("[data-last]").forEach(b => b.onclick = () => last(Number(b.dataset.last)));
  $("#irTrimReset").onclick = () => last(duration);
  $("#irTrimName").oninput = update;
  $("#irTrimPreview").onclick = async () => {
    if (audition) { stopPreview(); return; }
    video.currentTime = start; audition = true; update();
    try { await video.play(); if (!disposed && audition) tick(); }
    catch { if (!disposed) { stopPreview(); $("#irTrimStatus").textContent = "Preview could not play. Try loading this clip again."; } }
  };
  const paused = () => { if (!video.ended && audition) { audition = false; cancelAnimationFrame(frame); update(); } };
  const ended = () => { if (audition) tick(); };
  const timeUpdated = () => { if (audition) tick(); else position(); };
  const seeked = () => { if (audition && (video.currentTime < start || video.currentTime > end)) stopPreview(); };
  video.addEventListener("loadedmetadata", loaded);
  video.addEventListener("timeupdate", timeUpdated);
  video.addEventListener("pause", paused);
  video.addEventListener("ended", ended);
  video.addEventListener("seeked", seeked);
  if (video.readyState >= 1) loaded();

  $("#irTrimSave").onclick = async () => {
    if (saving) return;
    stopPreview(); saving = true; update();
    $("#irTrimStatus").textContent = "Saving your cut… You can keep browsing; it will appear in the library when ready.";
    $("#irTrimOpen")?.remove();
    try {
      const job = await api.trimReplay({path: clip.path, start, end, title: $("#irTrimName").value});
      if (disposed) return;
      onRevision(job);
      const poll = async () => {
        if (disposed) return;
        try {
          const result = await api.replayTrimStatus(job.job);
          if (disposed) return;
          if (result.status === "saving") { timer = setTimeout(poll, 1000); return; }
          if (result.status === "error") throw Error(result.error);
          onRevision(result);
          saving = false; update();
          $("#irTrimStatus").textContent = `Saved “${result.title}” · ${result.duration.toFixed(1)}s. The original is kept too.`;
          const open = document.createElement("button");
          open.id = "irTrimOpen"; open.className = "btn btn-secondary btn-sm";
          open.textContent = "Open trimmed copy";
          $("#irTrimStatus").after(open);
          await onSaved(result, open);
          toast.success("Trimmed copy added to your library");
        } catch (e) { failed(e); }
      };
      poll();
    } catch (e) { failed(e); }
  };
  function failed(e) {
    if (disposed) return;
    saving = false; update(); $("#irTrimStatus").textContent = e.message; toast.error(e.message);
  }
  return () => {
    disposed = true; audition = false; clearTimeout(timer); cancelAnimationFrame(frame);
    video.removeEventListener("loadedmetadata", loaded);
    video.removeEventListener("timeupdate", timeUpdated);
    video.removeEventListener("pause", paused);
    video.removeEventListener("ended", ended);
    video.removeEventListener("seeked", seeked);
  };
}
