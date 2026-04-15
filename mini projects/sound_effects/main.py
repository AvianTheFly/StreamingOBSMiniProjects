# sound_effects/main.py
"""
Sound Effects mini-project.

Hotkeys
-------
  989  (or (, *, ()  in under 150 ms)
    → After typing, press a manual key (see MANUAL_TRIGGER_SFXS in config.py)
      within MANUAL_TRIGGER_WINDOW seconds to play an SFX instantly.
    → Or wait — voice PTT opens automatically after the window expires.
      Say the SFX name; press 989 again (or wait 2 s) to transcribe.

Hub event: "sfx.play"
---------------------
  Other projects (e.g. league) can request an SFX without touching this
  scene directly:
      import events
      events.emit("sfx.play", source="halo respawn sound effect")

  The source value must be the lowercase file stem of an asset in SOUND_EFFECTS_DIR.
"""

from __future__ import annotations

import atexit
import json
import queue
import threading
from pathlib import Path

from pynput import keyboard

import obs
import events as hub_events
from shared import SequenceTrigger, VoicePTT
from .config import (
    SCENE,
    SOUND_EFFECTS_DIR,
    TRIGGER_SEQUENCES,
    TRIGGER_MAX_INTERVAL,
    AUTO_RECORD_TIMEOUT,
    VALID_EXTENSIONS,
    MANUAL_TRIGGER_SFXS,
    MANUAL_TRIGGER_WINDOW,
)

MISHEARS_FILE = Path(__file__).resolve().parent / "mishears.json"

# Track which sources are currently visible so crash handlers can hide them.
_visible_sources: set[str] = set()
_visible_lock = threading.Lock()


def _build_name_index() -> dict[str, tuple[Path, str]]:
    """
    Scan SOUND_EFFECTS_DIR and return {lower_stem: (filepath, original_stem)}.
    """
    index: dict[str, tuple[Path, str]] = {}
    if not SOUND_EFFECTS_DIR.is_dir():
        print(f"[sound_effects] Assets dir not found: {SOUND_EFFECTS_DIR}")
        return index
    for p in SOUND_EFFECTS_DIR.iterdir():
        if p.is_file() and p.suffix.lower() in VALID_EXTENSIONS:
            index[p.stem.lower()] = (p, p.stem)
    return index


def _load_mishears() -> dict[str, list[str]]:
    if not MISHEARS_FILE.is_file():
        return {}
    try:
        return json.loads(MISHEARS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[sound_effects] Could not load mishears.json: {exc}")
        return {}


def _match_voice_text(text: str, name_index: dict) -> str | None:
    lowered  = text.lower().strip()
    if lowered in name_index:
        return lowered
    mishears = _load_mishears()
    for canonical, variations in mishears.items():
        if lowered in variations:
            return canonical.lower() if canonical.lower() in name_index else None
    for name in name_index:
        if name in lowered or lowered in name:
            return name
    return None


# ── OBS source sync ─────────────────────────────────────────────────────────

def _sync_sources_to_files() -> set[str]:
    if not SOUND_EFFECTS_DIR.is_dir():
        return set()
    expected: dict[str, Path] = {
        p.stem: p
        for p in SOUND_EFFECTS_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in VALID_EXTENSIONS
    }
    existing = obs.list_sources(SCENE)
    for name, filepath in expected.items():
        if name in existing:
            try:
                obs.set_media_source_file(name, filepath)
            except Exception as e:
                print(f"[sound_effects] Could not update source '{name}': {e}")
        else:
            try:
                obs.create_media_source(SCENE, name, filepath, hidden=True)
                print(f"[sound_effects] + Created source '{name}'")
            except Exception as e:
                print(f"[sound_effects] Could not create source '{name}': {e}")
        # Configure properties right after create/update — source is guaranteed to exist here
        try:
            obs.configure_media_source_properties(name, restart_on_activate=False, hw_decode=True)
        except Exception as e:
            print(f"[sound_effects] Could not configure source '{name}': {e}")
    for name in existing:
        if name not in expected:
            try:
                obs.delete_source(SCENE, name)
                print(f"[sound_effects] − Removed stale source '{name}'")
            except Exception as e:
                print(f"[sound_effects] Could not remove source '{name}': {e}")
    return set(expected.keys())


# ── Hub entry point ─────────────────────────────────────────────────────────

def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    triggers    = [SequenceTrigger(seq, TRIGGER_MAX_INTERVAL) for seq in TRIGGER_SEQUENCES]
    _lock       = threading.Lock()
    _currently_playing: list[str | None] = [None]

    print("[sound_effects] Syncing sources to files…")
    _sync_sources_to_files()
    _name_index = _build_name_index()
    print(f"[sound_effects] {len(_name_index)} sound effect(s) loaded.")

    # ── Crash-safe visibility tracking ────────────────────────────────────

    def _hide_all_sfx() -> None:
        with _visible_lock:
            to_hide = set(_visible_sources)
            _visible_sources.clear()
        for name in to_hide:
            try:
                obs.hide_source(SCENE, name)
            except Exception:
                pass

    atexit.register(_hide_all_sfx)

    from .interface import _live
    _live["visible_sources"] = _visible_sources
    _live["hide_all"]        = _hide_all_sfx

    # ── Playback ──────────────────────────────────────────────────────────

    def _play_sfx(name: str) -> None:
        entry = _name_index.get(name)
        if entry is None:
            known = list(_name_index.keys())
            print(
                f"[sound_effects] No match for '{name}'. "
                f"Known: {', '.join(known) or '(none)'}"
            )
            return
        filepath, source_name = entry

        with _lock:
            prev = _currently_playing[0]
            if prev and prev in _name_index:
                old_src = _name_index[prev][1]
                obs.stop_media(old_src)
            _currently_playing[0] = name

        print(f"[sound_effects] Playing: '{source_name}'")
        with _visible_lock:
            _visible_sources.add(source_name)
        try:
            obs.set_media_source_file(source_name, filepath)
            obs.show_source(SCENE, source_name)
            obs.restart_media(source_name)
            obs.wait_for_media_end(source_name, start_timeout=5.0, total_timeout=300.0)
        except Exception as e:
            print(f"[sound_effects] Playback failed for '{source_name}': {e}")
        finally:
            with _lock:
                still_current = (_currently_playing[0] == name)
            if still_current:
                obs.hide_source(SCENE, source_name)
                with _visible_lock:
                    _visible_sources.discard(source_name)
            with _lock:
                if _currently_playing[0] == name:
                    _currently_playing[0] = None

    # ── Concurrent playback (for sounds that must not interrupt current SFX) ──
    # Plays a source independently, skipping the stop-previous logic entirely.
    # Used for the Halo Respawn SFX which must layer over ongoing audio.

    def _play_sfx_concurrent(name: str) -> None:
        entry = _name_index.get(name)
        if entry is None:
            print(f"[sound_effects] Concurrent: no match for '{name}'.")
            return
        filepath, source_name = entry
        print(f"[sound_effects] Playing (concurrent): '{source_name}'")
        with _visible_lock:
            _visible_sources.add(source_name)
        try:
            obs.set_media_source_file(source_name, filepath)
            obs.show_source(SCENE, source_name)
            obs.restart_media(source_name)
            obs.wait_for_media_end(source_name, start_timeout=5.0, total_timeout=300.0)
        except Exception as e:
            print(f"[sound_effects] Concurrent playback failed for '{source_name}': {e}")
        finally:
            obs.hide_source(SCENE, source_name)
            with _visible_lock:
                _visible_sources.discard(source_name)

    # ── Hub event: "sfx.play" ─────────────────────────────────────────────
    # Other projects (e.g. league) can request SFX without touching this scene.
    # Pass  concurrent=True  to play alongside whatever is currently playing
    # (used for the Halo Respawn SFX so it never cancels other active audio).

    def _on_sfx_play_event(data: dict) -> None:
        source = data.get("source", "").lower().strip()
        if not source:
            return
        if data.get("concurrent", False):
            threading.Thread(
                target=_play_sfx_concurrent, args=(source,), daemon=True,
                name=f"sfx_concurrent:{source}"
            ).start()
        else:
            threading.Thread(
                target=_play_sfx, args=(source,), daemon=True,
                name=f"sfx:{source}"
            ).start()

    hub_events.subscribe("sfx.play", _on_sfx_play_event)

    # ── Voice transcript handler ──────────────────────────────────────────

    def _on_transcript(text: str) -> None:
        if not text or not text.strip():
            print("[sound_effects] Empty transcription.")
            return
        matched = _match_voice_text(text, _name_index)
        if matched is None:
            known = list(_name_index.keys())
            print(
                f"[sound_effects] No match for '{text.strip()}'. "
                f"Known: {', '.join(known) or '(none — add files to assets folder)'}"
            )
            return
        print(f"[sound_effects] Matched '{text.strip()}' → '{matched}'")
        _play_sfx(matched)

    ptt = VoicePTT(
        timeout=AUTO_RECORD_TIMEOUT,
        on_transcript=_on_transcript,
        tag="sound_effects",
    )

    # ── Manual trigger window state ───────────────────────────────────────

    _manual_lock              = threading.Lock()
    _in_manual_window         = [False]
    _pending_voice_timer: list[threading.Timer | None] = [None]

    def _end_manual_window() -> None:
        """Called when MANUAL_TRIGGER_WINDOW expires — closes the window; recording continues."""
        with _manual_lock:
            _in_manual_window[0]    = False
            _pending_voice_timer[0] = None

    # ── Keyboard listener ─────────────────────────────────────────────────

    def on_press(key):
        try:
            char = key.char
        except AttributeError:
            return
        if not char:
            return

        with _manual_lock:
            if _in_manual_window[0] and char in MANUAL_TRIGGER_SFXS:
                _in_manual_window[0] = False
                if _pending_voice_timer[0] is not None:
                    _pending_voice_timer[0].cancel()
                    _pending_voice_timer[0] = None
                sfx_name = MANUAL_TRIGGER_SFXS[char]
                # Cancel the voice recording that started immediately on 989.
                ptt.cancel("manual sfx key pressed")
                if sfx_name:
                    threading.Thread(
                        target=_play_sfx, args=(sfx_name.lower(),), daemon=True
                    ).start()
                else:
                    print(f"[sound_effects] 989{char} is not configured — set it in config.py.")
                return

        if any(t.register_key(char) for t in triggers):
            if ptt.is_recording:
                ptt.on_trigger()  # double-trigger: stop + transcribe
                return

            # If a non-concurrent SFX is currently playing, stop it instead of
            # opening the mic.  Concurrent (e.g. Halo Respawn) SFX are not tracked
            # in _currently_playing so they are unaffected.
            with _lock:
                current = _currently_playing[0]
            if current is not None and current in _name_index:
                stop_src = _name_index[current][1]
                print(f"[sound_effects] Trigger while playing — stopping '{stop_src}'.")
                obs.stop_media(stop_src)
                obs.hide_source(SCENE, stop_src)
                with _lock:
                    if _currently_playing[0] == current:
                        _currently_playing[0] = None
                with _visible_lock:
                    _visible_sources.discard(stop_src)
                return

            with _manual_lock:
                _in_manual_window[0] = True
                if _pending_voice_timer[0] is not None:
                    _pending_voice_timer[0].cancel()
                t = threading.Timer(MANUAL_TRIGGER_WINDOW, _end_manual_window)
                _pending_voice_timer[0] = t
                t.start()
            ptt.on_trigger()  # start recording immediately — no delay

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    manual_keys    = "".join(MANUAL_TRIGGER_SFXS.keys())
    trigger_labels = " / ".join("".join(seq) for seq in TRIGGER_SEQUENCES)
    print(
        f"[sound_effects] Armed — press {trigger_labels} quickly, "
        f"then speak or press [{manual_keys}] for a direct SFX."
    )

    while not stop_event.is_set():
        try:
            input_queue.get(timeout=0.5)
        except queue.Empty:
            continue

    with _manual_lock:
        if _pending_voice_timer[0] is not None:
            _pending_voice_timer[0].cancel()
            _pending_voice_timer[0] = None
    hub_events.unsubscribe("sfx.play", _on_sfx_play_event)
    ptt.cancel("shutdown")
    kb.stop()
    print("[sound_effects] Stopped.")