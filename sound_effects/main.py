# sound_effects/main.py
"""
Sound Effects mini-project.

Press 9-8-9 in under 150 ms to start voice recording.
Speak the name of the sound effect, then press 9-8-9 again to end recording
(or wait 2 seconds for auto-stop).  The transcribed text is matched against
SFX files in the assets folder and the matching OBS source in the
"Sound Effects" scene is restarted.

A mishears.json file provides common speech-to-text variations so that
"ooray" or "hoar ray" still match "hooray.mp4".
"""

from __future__ import annotations

import atexit
import json
import queue
import signal
import sys
import threading
import time
from pathlib import Path

from pynput import keyboard

import obs
from .config import (
    SCENE,
    SOUND_EFFECTS_DIR,
    TRIGGER_SEQUENCE,
    TRIGGER_MAX_INTERVAL,
    AUTO_RECORD_TIMEOUT,
    VALID_EXTENSIONS,
)
from .trigger import SequenceTrigger

MISHEARS_FILE = Path(__file__).resolve().parent / "mishears.json"

# Track which sources are currently visible so crash handlers can hide them.
_visible_sources: set[str] = set()
_visible_lock = threading.Lock()


def _build_name_index() -> dict[str, tuple[Path, str]]:
    """
    Scan SOUND_EFFECTS_DIR for media files and return {lower_name: (filepath, source_name)}.
    source_name is the original file stem (preserves casing for OBS).
    """
    index: dict[str, tuple[Path, str]] = {}
    if not SOUND_EFFECTS_DIR.is_dir():
        print(f"[sound_effects] ⚠  Assets dir does not exist: {SOUND_EFFECTS_DIR}")
        return index

    for p in SOUND_EFFECTS_DIR.iterdir():
        if p.is_file() and p.suffix.lower() in VALID_EXTENSIONS:
            index[p.stem.lower()] = (p, p.stem)

    return index


def _load_mishears() -> dict[str, list[str]]:
    """
    Return the current mishears dict from disk, or {} if missing / corrupt.
    """
    if not MISHEARS_FILE.is_file():
        return {}
    try:
        return json.loads(MISHEARS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[sound_effects] ⚠  Could not load mishears.json: {exc}")
        return {}


def _match_voice_text(text: str, name_index: dict[str, Path]) -> str | None:
    """
    Given transcribed text, return the file stem that best matches, or None.
    """
    lowered = text.lower().strip()

    # Direct match against known names
    if lowered in name_index:
        return lowered

    # Build a reverse lookup: variation -> canonical name
    mishears = _load_mishears()
    for canonical, variations in mishears.items():
        if lowered in variations:
            return canonical.lower() if canonical.lower() in name_index else None

    # Fuzzy containment: does the transcript contain a known name?
    for name in name_index:
        if name in lowered or lowered in name:
            return name

    return None


# ── OBS source sync ─────────────────────────────────────────────────────────

def _sync_sources_to_files() -> set[str]:
    """
    Ensure the OBS scene has exactly one media source per file in
    SOUND_EFFECTS_DIR.  Creates missing sources, removes extras.
    Returns the set of valid source names after sync.
    """
    # Collect expected source names
    if not SOUND_EFFECTS_DIR.is_dir():
        return set()

    expected: dict[str, Path] = {}
    for p in SOUND_EFFECTS_DIR.iterdir():
        if p.is_file() and p.suffix.lower() in VALID_EXTENSIONS:
            expected[p.stem] = p  # source name = file stem

    # What currently exists in the scene
    existing = obs.list_sources(SCENE)

    # Sync existing media sources: update file path for each expected source
    for name, filepath in expected.items():
        if name in existing:
            # Source exists — just make sure the file path is correct
            try:
                obs.set_media_source_file(name, filepath)
            except Exception as e:
                print(f"[sound_effects] ⚠  Could not update source '{name}': {e}")
        else:
            # Create new media source, hidden by default
            try:
                obs.create_media_source(SCENE, name, filepath, hidden=True)
                print(f"[sound_effects] + Created source '{name}'")
            except Exception as e:
                print(f"[sound_effects] ⚠  Could not create source '{name}': {e}")

    # Remove sources that no longer have a backing file
    for name in existing:
        if name not in expected:
            try:
                obs.delete_source(SCENE, name)
                print(f"[sound_effects] − Removed stale source '{name}'")
            except Exception as e:
                print(f"[sound_effects] ⚠  Could not remove source '{name}': {e}")

    return set(expected.keys())


# ── Hub entry point ─────────────────────────────────────────────────────────

def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    """Called by the hub in a daemon thread."""

    trigger = SequenceTrigger(TRIGGER_SEQUENCE, TRIGGER_MAX_INTERVAL)

    # Recording state
    _recording = [False]
    _timeout_timer: list[threading.Timer | None] = [None]
    _currently_playing = False   # prevents concurrent SFX playback
    _lock = threading.Lock()

    # Voice module — looked up lazily at trigger time so the hub has had
    # time to start the voice listener (it starts after all projects).

    # Sync sources on startup
    print("[sound_effects] Syncing sources to files…")
    _sync_sources_to_files()
    _name_index = _build_name_index()
    print(f"[sound_effects] Loaded {len(_name_index)} sound effect(s).")

    # ── Crash-safe visibility tracking ────────────────────────────────────

    def _hide_all_sfx() -> None:
        with _visible_lock:
            to_hide = set(_visible_sources)
            _visible_sources.clear()
        for name in to_hide:
            try:
                obs.hide_source(SCENE, name)
                print(f"[sound_effects] 🔒 Hid stale source: {name}")
            except Exception:
                pass

    atexit.register(_hide_all_sfx)

    # ── Playback ──────────────────────────────────────────────────────────

    def _play_sfx(name: str) -> None:
        """
        Show the source, wait for media to finish, then hide it.
        Blocks so only one SFX plays at a time.
        """
        nonlocal _currently_playing
        entry = _name_index.get(name)
        if entry is None:
            print(f"[sound_effects] ⚠  No known SFX matches '{name}'.")
            return
        filepath, source_name = entry

        # Prevent concurrent playback
        with _lock:
            if _currently_playing:
                print(f"[sound_effects] ⚠  '{name}' skipped — another SFX is already playing.")
                return
            _currently_playing = True

        print(f"[sound_effects] ▶  Playing: {source_name}")
        with _visible_lock:
            _visible_sources.add(source_name)
        try:
            obs.set_media_source_file(source_name, filepath)
            # Unhide the source so it's visible
            client = obs.get_obs()
            item_id = client.get_scene_item_id(SCENE, source_name).scene_item_id
            client.set_scene_item_enabled(SCENE, item_id, True)
            # Start playback
            obs.restart_media(source_name)
            # Wait for the media to finish
            obs.wait_for_media_end(source_name, start_timeout=5.0, total_timeout=300.0)
        except Exception as e:
            print(f"[sound_effects] ⚠  Playback failed for '{source_name}': {e}")
        finally:
            obs.hide_source(SCENE, source_name)
            with _visible_lock:
                _visible_sources.discard(source_name)
            with _lock:
                _currently_playing = False

    # ── Voice pipeline ────────────────────────────────────────────────────

    def _cancel_recording(reason: str) -> None:
        """Stop recording and discard audio — no transcription."""
        with _lock:
            if not _recording[0]:
                return
            _recording[0] = False
            t = _timeout_timer[0]
            _timeout_timer[0] = None
        if t:
            t.cancel()
        vm = sys.modules.get("voice.listener")
        if vm:
            vm.stop_and_transcribe(lambda _: None)
        print(f"[sound_effects] 🚫 Recording cancelled ({reason}).")

    def _end_recording_and_match() -> None:
        """Stop recording, transcribe, match to SFX, and play it."""
        with _lock:
            if not _recording[0]:
                return
            _recording[0] = False
            t = _timeout_timer[0]
            _timeout_timer[0] = None
        if t:
            t.cancel()

        vm = sys.modules.get("voice.listener")
        if vm is None:
            print("[sound_effects] ⚠  No voice module.")
            return

        def _on_transcript(text: str) -> None:
            if not text or not text.strip():
                print("[sound_effects] ⚠  Empty transcription.")
                return

            matched = _match_voice_text(text, _name_index)
            if matched is None:
                stripped = text.lower().strip()
                known = list(_name_index.keys())
                print(
                    f"[sound_effects] ⚠  No match for '{text.strip()}'. "
                    f"Known SFX: {', '.join(known) or '(none — add files to the assets folder)'}"
                )
                return

            print(f"[sound_effects] Matched '{text.strip()}' → '{matched}'")
            _play_sfx(matched)

        vm.stop_and_transcribe(_on_transcript)

    # ── Keyboard listener ─────────────────────────────────────────────────

    def on_press(key):
        try:
            char = key.char
        except AttributeError:
            return
        if not char:
            return

        # Check for trigger sequence
        if trigger.register_key(char):
            vm = sys.modules.get("voice.listener")
            if vm is None:
                print("[sound_effects] ⚠  Voice unavailable.")
                return

            with _lock:
                is_recording = _recording[0]

            if not is_recording:
                # First trigger → start recording
                with _lock:
                    _recording[0] = True
                    t = threading.Timer(
                        AUTO_RECORD_TIMEOUT,
                        lambda: _cancel_recording("auto-timeout"),
                    )
                    _timeout_timer[0] = t
                t.start()
                vm.start_recording()
                print(f"[sound_effects] 🎤  Listening… (say the SFX name, or press {TRIGGER_SEQUENCE} again)")
            else:
                # Second trigger → transcribe + match + play
                print("[sound_effects] Recording ended by trigger.")
                _end_recording_and_match()

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    print(f"[sound_effects] ⌨  Armed — press {TRIGGER_SEQUENCE} quickly to begin recording.")

    # ── Main loop ─────────────────────────────────────────────────────────

    while not stop_event.is_set():
        try:
            input_queue.get(timeout=0.5)
        except queue.Empty:
            continue

    # ── Cleanup ───────────────────────────────────────────────────────────
    _cancel_recording("shutdown")
    kb.stop()
    print("[sound_effects] Stopped.")
