# Shared voice input

Open **Voice** in the Hub sidebar (http://localhost:7420/#voice) to see who
owns the microphone, current inference state, startup errors, registered
projects, and the last 50 transcripts with their destination and outcome.
Finish recording or cancel the current command there. History stays in RAM
and can be cleared. Model and microphone settings are linked from that page.

## Ownership

- `service.py`: one active session across all projects and editor uploads;
  recording deadlines, cancellation, transcript history and consumer delivery.
- `listener.py`: one microphone stream and one faster-whisper model; bounded
  audio capture, session-tagged chunks, and exclusive inference.
- `ptt.py`: hotkey adapter. `shared.VoicePTT` is a compatibility import of it.

Projects create `VoicePTT(timeout, on_transcript, tag="project_name")` and call
`on_trigger()`, `stop()`, or `cancel(reason)`. They keep phrase matching and
playback in their own module. They must not call listener capture primitives,
load another speech model, or create transcription timeout timers.

`on_timed_transcript(text, pressed_at)` receives the capture start wall clock
time, so replay cutoffs exclude transcription delay. Optional `on_complete(text)`
runs even for silence. Consumer delivery runs separately from inference, so
slow playback cannot keep the microphone busy. Cancelled and failed commands
never invoke the command callback; cancelled inference keeps the exclusive
slot until the model actually returns, with its result discarded.

The hotkey editor's recorded phrase training shares the same inference slot
and model. It reports busy while another session owns voice. It no longer
loads OpenAI Whisper or launches a separate Whisper CLI.

Timers and UI controls carry session IDs; stale stop/cancel requests cannot
affect a newer session. Manual playback or shutdown cancellation invalidates
pending delivery for that project. Already executing playback remains under
the project's normal controls.

## Model settings

Whisper and microphone values saved in the Hub Settings page override the root
environment on the next Hub start. Missing values use the environment and then
hub_config.py defaults. A model change requires a Hub restart; the Voice page
reports the currently loaded model, not just the saved choice.

On this machine, three generated short commands took 0.23–0.45 seconds with
small.en/CUDA/int8_float16, compared with about 14 seconds for large-v3/CPU/int8.
The smaller GPU model added about 568 MiB of total GPU memory in that test.
This is a limited recognition check, and does not establish performance while
gaming. Smaller models and quantization reduce work/memory; they do not impose
a GPU utilization cap. Keep the single shared inference owner and model.

The manual tools/profile_voice_inference.py benchmark uses explicit audio files,
cached weights and one worker. It never records the microphone or invokes
project command callbacks. CPU and CUDA measurements are supported.
