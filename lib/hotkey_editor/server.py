# lib/hotkey_editor/server.py
#
# Generic HTTP server that backs the browser-based hotkey editor.
# Called by each project's thin hotkey_editor.py launcher.

from __future__ import annotations

import copy
import http.server
import json
import mimetypes
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from lib.hotkeys import load_hotkeys, save_hotkeys
from lib.shared_media.controls import action_catalog, normalize_file_volume_offsets, normalize_interface_hotkeys
from lib.shared_media.profile_store import create_media_profile

_EDITOR_HTML = Path(__file__).resolve().parent / "editor.html"
_STATE_LOCK  = threading.Lock()
_EDITOR_DIR = Path(__file__).resolve().parent
_VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv", ".ts", ".m4v"}
_MEDIA_PROBE_CACHE: dict[str, tuple[float, dict]] = {}
_PENDING_MOVES_FILE = _PROJECT_ROOT / "pending_moves.json"

_CONFIG_FIELDS = [
    {"section": "Core", "key": "asset_dir", "label": "Asset Folder", "type": "path", "help": "Folder scanned for audio and video files."},
    {"section": "Core", "key": "scene", "label": "OBS Scene", "type": "text", "help": "OBS scene this profile controls."},
    {"section": "Core", "key": "obs_source_prefix", "label": "OBS Source Prefix", "type": "text", "help": "Prefix used when creating/re-linking OBS sources. Keep this stable to preserve existing sources."},
    {"section": "Core", "key": "event_name", "label": "Hub Event", "type": "text", "help": "Optional event name other projects can emit to play media."},
    {"section": "Core", "key": "valid_extensions", "label": "File Types", "type": "text", "help": "Comma-separated extensions, like .mp3, .mp4, .webm."},
    {"section": "Triggers", "key": "trigger_sequences", "label": "Trigger Sequences", "type": "text", "help": "Key sequences that activate this profile, e.g. '/ *'. Separate multiple with ' ; '."},
    {"section": "Triggers", "key": "trigger_max_interval", "label": "Trigger Speed", "type": "number", "step": "0.01", "help": "Seconds allowed between trigger keys."},
    {"section": "Triggers", "key": "manual_trigger_window", "label": "Manual Key Window", "type": "number", "step": "0.1", "help": "Seconds after the trigger sequence to accept direct hotkeys."},
    {"section": "Triggers", "key": "auto_record_timeout", "label": "Voice Auto Stop", "type": "number", "step": "0.1", "help": "Seconds before voice capture auto-transcribes."},
    {"section": "Interface Hotkeys", "key": "interface_hotkeys", "label": "Project Controls", "type": "hotkey_map", "help": "Hotkeys for verbs like start listen, abort listen, stop, random, next, reload, pause, and resume."},
    {"section": "Features", "key": "manual_hotkeys_enabled", "label": "Manual Hotkeys", "type": "boolean", "help": "Allow trigger sequence + direct key media playback."},
    {"section": "Features", "key": "voice_commands_enabled", "label": "Voice Commands", "type": "boolean", "help": "Allow trigger sequence to open voice matching."},
    {"section": "Features", "key": "random_commands_enabled", "label": "Random / Next Commands", "type": "boolean", "help": "Allow voice commands like random, next, stop, and random category."},
    {"section": "Features", "key": "categories_enabled", "label": "Categories", "type": "boolean", "help": "Use category tags for organization and layout filtering."},
    {"section": "Features", "key": "obs_layout_enabled", "label": "OBS Canvas Rules", "type": "boolean", "help": "Use OBS canvas layout rules for video sources."},
    {"section": "Features", "key": "audio_settings_enabled", "label": "Audio Settings", "type": "boolean", "help": "Show and apply monitor, volume, and track routing settings."},
    {"section": "Matching", "key": "matching_strategy", "label": "Scoring System", "type": "select", "options": [["hybrid", "Fuzzy + TF-IDF Tie Break"], ["weighted", "Weighted Fuzzy / Tokens"], ["embedding", "Weighted + Embeddings"]], "help": "Voice matcher scoring method."},
    {"section": "Matching", "key": "fuzzy_scorer", "label": "Fuzzy Scorer", "type": "select", "options": [["WRatio", "WRatio"], ["token_set_ratio", "Token Set"], ["token_sort_ratio", "Token Sort"], ["partial_ratio", "Partial"], ["ratio", "Simple Ratio"]], "help": "RapidFuzz scorer used for fuzzy matching."},
    {"section": "Matching", "key": "fuzzy_threshold", "label": "Match Strictness", "type": "number", "step": "1", "help": "Higher means voice matches must be closer."},
    {"section": "Matching", "key": "semantic_gap", "label": "Tie Break Gap", "type": "number", "step": "1", "help": "How close matches can be before they are treated as ambiguous."},
    {"section": "Matching", "key": "fuzzy_weight", "label": "Fuzzy Weight", "type": "number", "step": "0.05", "help": "Weighted scoring contribution from fuzzy text similarity."},
    {"section": "Matching", "key": "token_weight", "label": "Token Weight", "type": "number", "step": "0.05", "help": "Weighted scoring contribution from shared words."},
    {"section": "Matching", "key": "embedding_weight", "label": "Embedding Weight", "type": "number", "step": "0.05", "help": "Weighted scoring contribution from optional local embeddings."},
    {"section": "Matching", "key": "embedding_model", "label": "Embedding Model", "type": "text", "help": "Optional sentence-transformers model name. Empty uses all-MiniLM-L6-v2 if installed."},
    {"section": "Playback", "key": "media_start_timeout", "label": "Media Start Timeout", "type": "number", "step": "0.1", "help": "Seconds to wait for OBS media playback to start."},
    {"section": "Playback", "key": "media_total_timeout", "label": "Media Total Timeout", "type": "number", "step": "1", "help": "Maximum seconds to wait for media playback to finish."},
    {"section": "Audio", "key": "monitor", "label": "Audio Monitor", "type": "select", "options": [["OBS_MONITORING_TYPE_MONITOR_ONLY", "Monitor Only"], ["OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT", "Monitor and Output"], ["OBS_MONITORING_TYPE_NONE", "No Monitor"]], "help": "OBS monitor mode applied during source sync."},
    {"section": "Audio", "key": "default_volume_db", "label": "New Source Volume dB", "type": "number", "step": "0.5", "help": "Volume applied to newly-created OBS media sources."},
    {"section": "Audio", "key": "project_volume_db", "label": "Mini Project Volume dB", "type": "number", "step": "0.5", "help": "Global additive volume layer for this mini project/profile."},
    {"section": "Audio", "key": "profile_volume_db", "label": "Active Profile Volume dB", "type": "number", "step": "0.5", "help": "Additive volume layer for the current editor profile. File offsets stay relative."},
    {"section": "Audio", "key": "audio_tracks", "label": "Audio Tracks", "type": "text", "help": "Optional OBS output tracks, e.g. 2,3,4,5,6. Empty leaves routing unchanged."},
    {"section": "Debug", "key": "verbose_matcher", "label": "Verbose Voice Logs", "type": "boolean", "help": "Print voice matching diagnostics in the hub console."},
]


def _load_pending_moves() -> list:
    if not _PENDING_MOVES_FILE.is_file():
        return []
    try:
        raw = json.loads(_PENDING_MOVES_FILE.read_text(encoding="utf-8"))
        return raw if isinstance(raw, list) else []
    except Exception:
        return []


def _save_pending_moves_file(moves: list) -> None:
    _PENDING_MOVES_FILE.write_text(
        json.dumps(moves, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _commit_pending_moves(moves: list, all_projects: list[dict]) -> dict:
    applied: list[dict] = []
    failed: list[dict] = []
    for move in moves:
        stem        = move.get("stem", "")
        filename    = move.get("filename", "")
        from_dir    = move.get("fromDir", "")
        to_proj_key = move.get("toProject", "")
        if not all([stem, filename, from_dir, to_proj_key]):
            failed.append({"move": move, "error": "Missing required fields"})
            continue
        dest = next((p for p in all_projects if p["key"] == to_proj_key), None)
        if dest is None:
            failed.append({"move": move, "error": f"Unknown destination project: {to_proj_key}"})
            continue
        from_path = Path(from_dir) / filename
        to_dir    = dest["asset_dir"]
        to_path   = to_dir / filename
        if not from_path.exists():
            failed.append({"move": move, "error": f"Source not found: {from_path}"})
            continue
        if to_path.exists():
            failed.append({"move": move, "error": f"Destination already exists: {to_path}"})
            continue
        try:
            to_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(from_path), str(to_path))
            applied.append({**move, "toDir": str(to_dir)})
        except Exception as exc:
            failed.append({"move": move, "error": str(exc)})
    return {"applied": applied, "failed": failed}


def _config_file(proj: dict) -> Path:
    return proj["hotkeys_file"].parent / "editor_config_overrides.json"


def _layout_rules_file(proj: dict) -> Path:
    return proj["hotkeys_file"].parent / "obs_layout_rules.json"


def _phrases_file(proj: dict) -> Path:
    return Path(proj.get("phrases_file") or proj["hotkeys_file"].parent / "phrases.json")


def _load_config_overrides(proj: dict) -> dict:
    path = _config_file(proj)
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _save_config_overrides(proj: dict, settings: dict) -> None:
    allowed = {field["key"] for field in _CONFIG_FIELDS}
    clean = {key: value for key, value in settings.items() if key in allowed}
    if "interface_hotkeys" in clean:
        clean["interface_hotkeys"] = normalize_interface_hotkeys(clean["interface_hotkeys"])
    _config_file(proj).write_text(
        json.dumps(clean, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


_VOICE_COMMANDS_FIELD = {
    "section": "Voice Commands",
    "key": "voice_commands",
    "label": "Built-in Commands",
    "type": "info",
    "help": "Say these after the trigger sequence. 'random [category]' shuffles from that category.",
}


def _config_fields_for_proj(proj: dict) -> list[dict]:
    fields = list(_CONFIG_FIELDS)
    if "voice_commands" in (proj.get("config_defaults") or {}):
        fields.append(_VOICE_COMMANDS_FIELD)
    return fields


def _config_response(proj: dict) -> dict:
    defaults = dict(proj.get("config_defaults") or {})
    defaults.setdefault("asset_dir", str(proj["asset_dir"]))
    defaults.setdefault("valid_extensions", sorted(proj["extensions"]))
    overrides = _load_config_overrides(proj)
    current = {**defaults, **overrides}
    if "interface_hotkeys" in current:
        current["interface_hotkeys"] = normalize_interface_hotkeys(current["interface_hotkeys"])
    return {
        "fields": _config_fields_for_proj(proj),
        "interface_actions": action_catalog(),
        "defaults": defaults,
        "overrides": overrides,
        "current": current,
        "file": str(_config_file(proj)),
    }


def _load_layout_rules(proj: dict) -> dict:
    path = _layout_rules_file(proj)
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _save_layout_rules(proj: dict, rules: dict) -> None:
    _layout_rules_file(proj).write_text(
        json.dumps(rules, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _scene_name(proj: dict) -> str:
    current = _config_response(proj).get("current", {})
    return str(current.get("scene") or proj["name"])


def _source_prefix(proj: dict) -> str:
    current = _config_response(proj).get("current", {})
    return str(current.get("obs_source_prefix") or "")


def _single_source_name(proj: dict) -> str | None:
    """Return the single shared OBS source name if the project uses single-source mode."""
    current = _config_response(proj).get("current", {})
    if current.get("single_source_mode"):
        prefix = _source_prefix(proj)
        return f"{prefix}player" if prefix else None
    return None


def _load_phrases(proj: dict) -> dict:
    path = _phrases_file(proj)
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(raw, dict):
        return {}
    return {
        str(key): [str(item) for item in value if str(item).strip()]
        for key, value in raw.items()
        if not str(key).startswith("_") and isinstance(value, list)
    }


def _save_phrases(proj: dict, phrases: dict) -> None:
    clean = {
        str(key): _unique_strings(value)
        for key, value in (phrases or {}).items()
        if str(key).strip()
    }
    payload = {
        "_comment": (
            "Keys are canonical asset file stems without extensions. "
            "Values are alternate phrases that should trigger that asset."
        ),
        **{key: value for key, value in sorted(clean.items()) if value},
    }
    _phrases_file(proj).write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _unique_strings(raw: object) -> list[str]:
    if isinstance(raw, str):
        items = raw.splitlines()
    elif isinstance(raw, list):
        items = raw
    else:
        items = []
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        text = str(item).strip()
        folded = text.lower()
        if text and folded not in seen:
            seen.add(folded)
            result.append(text)
    return result


def _transcribe_audio(audio_bytes: bytes, content_type: str = "") -> str:
    import os, tempfile
    ext = ".webm"
    if "wav" in content_type:
        ext = ".wav"
    elif "mp3" in content_type or "mpeg" in content_type:
        ext = ".mp3"
    elif "ogg" in content_type:
        ext = ".ogg"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        import whisper
        model = whisper.load_model("base")
        result = model.transcribe(tmp_path)
        return str(result.get("text", "")).strip()
    except ImportError:
        pass
    try:
        proc = subprocess.run(
            ["whisper", tmp_path, "--output_format", "txt", "--model", "base", "--output_dir", str(Path(tmp_path).parent)],
            capture_output=True, text=True, timeout=60,
        )
        txt_path = Path(tmp_path).with_suffix(".txt")
        if txt_path.exists():
            return txt_path.read_text(encoding="utf-8").strip()
        if proc.returncode == 0 and proc.stdout:
            return proc.stdout.strip()
        raise RuntimeError("Whisper CLI produced no output")
    except FileNotFoundError:
        raise RuntimeError("Whisper is not installed. Run: pip install openai-whisper")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        for clean_ext in (".txt", ".srt", ".vtt"):
            try:
                Path(tmp_path).with_suffix(clean_ext).unlink(missing_ok=True)
            except Exception:
                pass


def _score_phrase(
    phrase: str,
    stems: list[str],
    phrases_file: Path | None = None,
    *,
    strategy: str | None = None,
) -> list[dict]:
    """Return stems ranked by fuzzy score for the given phrase."""
    if not phrase or not stems:
        return []
    phrase_lower = phrase.lower().strip()
    phrases: dict[str, list[str]] = {}
    if phrases_file and phrases_file.is_file():
        try:
            from lib.shared_media.media_phrase_matcher import load_phrases
            phrases = load_phrases(phrases_file)
        except Exception:
            pass
    # Build candidate map: phrase/alias -> stem
    candidate_map: dict[str, str] = {}
    for stem in stems:
        sl = stem.lower().strip()
        candidate_map[sl] = stem
        for alias in phrases.get(sl, []):
            key = alias.lower().strip()
            if key:
                candidate_map[key] = stem

    if strategy == "coverage_difflib":
        # Same 55/45 word-coverage + difflib blend used by specific_song/matcher.py
        import re as _re
        import difflib as _difflib
        def _norm(t: str) -> str:
            return _re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()
        def _cov_score(q: str, c: str) -> float:
            if not c:
                return 0.0
            if c in q or q in c:
                shorter, longer = min(len(c), len(q)), max(len(c), len(q))
                if longer == 0 or shorter / longer >= 0.6:
                    return 1.0
            q_w = set(q.split()); c_w = set(c.split())
            coverage = len(c_w & q_w) / len(c_w) if c_w else 0.0
            ratio = _difflib.SequenceMatcher(None, q, c).ratio()
            return coverage * 0.55 + ratio * 0.45
        q_norm = _norm(phrase_lower)
        stem_scores: dict[str, float] = {}
        for cand, stem in candidate_map.items():
            sc = _cov_score(q_norm, _norm(cand))
            stem_scores[stem] = max(stem_scores.get(stem, 0.0), sc)
        return sorted(
            [{"stem": s, "score": round(v, 3)} for s, v in stem_scores.items()],
            key=lambda x: x["score"], reverse=True,
        )

    try:
        from rapidfuzz import fuzz, process as rfprocess
        raw = rfprocess.extract(phrase_lower, list(candidate_map.keys()), scorer=fuzz.WRatio, limit=None)
        stem_scores: dict[str, float] = {}
        for cand, score, _ in raw:
            stem = candidate_map[cand]
            stem_scores[stem] = max(stem_scores.get(stem, 0.0), score)
        return sorted(
            [{"stem": s, "score": round(v / 100, 3)} for s, v in stem_scores.items()],
            key=lambda x: x["score"], reverse=True,
        )
    except ImportError:
        from difflib import SequenceMatcher
        stem_scores = {}
        for cand, stem in candidate_map.items():
            r = SequenceMatcher(None, phrase_lower, cand).ratio()
            stem_scores[stem] = max(stem_scores.get(stem, 0.0), r)
        return sorted(
            [{"stem": s, "score": round(v, 3)} for s, v in stem_scores.items()],
            key=lambda x: x["score"], reverse=True,
        )


def _safe_transform(raw: dict) -> dict:
    allowed = {
        "positionX", "positionY", "rotation", "scaleX", "scaleY",
        "boundsType", "boundsWidth", "boundsHeight", "alignment", "boundsAlignment",
        "cropLeft", "cropTop", "cropRight", "cropBottom",
    }
    clean = {}
    for key, value in (raw or {}).items():
        if key not in allowed:
            continue
        if key == "boundsType":
            clean[key] = str(value)
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        clean[key] = int(number) if key in {"alignment", "boundsAlignment"} else number
    clean.setdefault("alignment", 5)
    clean.setdefault("boundsAlignment", 0)
    clean.setdefault("boundsType", "OBS_BOUNDS_SCALE_INNER")
    return clean


def _obs_transform_from_rule(rule: dict) -> dict:
    clean = _safe_transform(rule)
    crop_left = float(clean.get("cropLeft") or 0)
    crop_top = float(clean.get("cropTop") or 0)
    scale_x = float(clean.get("scaleX") or 1)
    scale_y = float(clean.get("scaleY") or 1)
    # The editor stores position as the un-cropped source box. OBS positions
    # the visible cropped scene item, so offset by the crop amount when applying.
    clean["positionX"] = float(clean.get("positionX") or 0) + crop_left * scale_x
    clean["positionY"] = float(clean.get("positionY") or 0) + crop_top * scale_y
    return clean
# ── Port helpers ─────────────────────────────────────────────────────────────

def _find_free_port(start: int, count: int = 10) -> int:
    for p in range(start, start + count):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("localhost", p))
                return p
            except OSError:
                continue
    raise RuntimeError(f"No free port found in range {start}–{start + count - 1}")


# ── Asset scanning ────────────────────────────────────────────────────────────

def _scan_sounds(asset_dir: Path, valid_extensions: set[str]) -> list[dict]:
    if not asset_dir.is_dir():
        return []
    results = []
    for p in asset_dir.iterdir():
        if p.is_file() and p.suffix.lower() in valid_extensions:
            stat = p.stat()
            results.append({
                "stem": p.stem,
                "ext": p.suffix.lower(),
                "filename": p.name,
                "size": stat.st_size,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "mtime": stat.st_mtime,
                "ctime": stat.st_ctime,
                **_probe_media_dimensions(p),
            })
    return sorted(results, key=lambda x: x["stem"].lower())


def _probe_media_dimensions(path: Path) -> dict:
    if path.suffix.lower() not in _VIDEO_EXTS:
        return {}
    try:
        stat = path.stat()
        cache_key = str(path.resolve())
        cached = _MEDIA_PROBE_CACHE.get(cache_key)
        if cached and cached[0] == stat.st_mtime:
            return dict(cached[1])
        proc = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.returncode != 0:
            return {}
        raw = json.loads(proc.stdout or "{}")
        stream = (raw.get("streams") or [{}])[0]
        width = int(stream.get("width") or 0)
        height = int(stream.get("height") or 0)
        data = {"width": width, "height": height, "dimension_key": f"{width}x{height}"} if width and height else {}
        _MEDIA_PROBE_CACHE[cache_key] = (stat.st_mtime, data)
        return dict(data)
    except Exception:
        return {}


def _layout_response(proj: dict, *, include_obs: bool = True) -> dict:
    sounds = _scan_sounds(proj["asset_dir"], proj["extensions"])
    videos = [sound for sound in sounds if sound.get("ext") in _VIDEO_EXTS]
    state = _load_editor_state(proj)
    active = state.get("active_profile", "default")
    profile = state.get("profiles", {}).get(active, {})
    sound_categories = profile.get("sound_categories", {}) if isinstance(profile, dict) else {}
    groups: dict[str, dict] = {}
    for sound in videos:
        dimension_key = sound.get("dimension_key") or "unknown"
        categories = sound_categories.get(sound["stem"])
        if not isinstance(categories, list) or not categories:
            categories = ["Uncategorized"]
        for category in categories:
            category = str(category).strip() or "Uncategorized"
            key = f"{dimension_key}::{category}"
            group = groups.setdefault(key, {
                "key": key,
                "dimension_key": dimension_key,
                "category": category,
                "width": sound.get("width"),
                "height": sound.get("height"),
                "sounds": [],
            })
            grouped_sound = {**sound, "layout_category": category}
            group["sounds"].append(grouped_sound)

    canvas = {"baseWidth": 1920, "baseHeight": 1080, "outputWidth": 1920, "outputHeight": 1080}
    transforms = {}
    sources = []
    obs_error = ""
    if include_obs:
        try:
            import obs
            canvas = obs.get_canvas_size()
            transforms = obs.get_scene_source_transforms(_scene_name(proj), _source_prefix(proj))
            sources, source_error = _scene_sources_response(proj)
            if source_error:
                obs_error = source_error
        except Exception as exc:
            obs_error = str(exc)

    saved = _load_layout_rules(proj)
    return {
        "scene": _scene_name(proj),
        "prefix": _source_prefix(proj),
        "singleSourceName": _single_source_name(proj),
        "canvas": canvas,
        "groups": sorted(groups.values(), key=lambda g: (g.get("height") or 0, g.get("width") or 0, g.get("category") or "", g["key"])),
        "rules": saved.get("rules", {}),
        "overrides": saved.get("overrides", {}),
        "transforms": transforms,
        "sources": sources,
        "obs_error": obs_error,
        "file": str(_layout_rules_file(proj)),
    }


def _apply_layout_rules(proj: dict, rules: dict, overrides: dict | None = None) -> dict:
    import obs

    overrides = overrides or {}
    if _single_source_name(proj):
        # Single-source projects reuse one shared OBS source for every asset,
        # so applying per-file canvas transforms here would just try to hit
        # non-existent sources like prefix+stem. Their layout rules are still
        # saved and are applied at playback time by the runtime project code.
        return {"applied": [], "failed": []}

    sounds = _scan_sounds(proj["asset_dir"], proj["extensions"])
    state = _load_editor_state(proj)
    active = state.get("active_profile", "default")
    profile = state.get("profiles", {}).get(active, {})
    sound_categories = profile.get("sound_categories", {}) if isinstance(profile, dict) else {}
    scene = _scene_name(proj)
    prefix = _source_prefix(proj)
    applied = []
    failed = []
    for sound in sounds:
        if sound.get("ext") not in _VIDEO_EXTS:
            continue
        categories = sound_categories.get(sound["stem"])
        if not isinstance(categories, list) or not categories:
            categories = ["Uncategorized"]
        dimension_key = sound.get("dimension_key") or "unknown"
        rule = overrides.get(sound["stem"]) or next(
            (
                rules.get(f"{dimension_key}::{str(category).strip() or 'Uncategorized'}")
                for category in categories
                if rules.get(f"{dimension_key}::{str(category).strip() or 'Uncategorized'}")
            ),
            None,
        ) or rules.get(dimension_key)
        if not rule:
            continue
        source = f"{prefix}{sound['stem']}"
        try:
            obs.set_source_transform(scene, source, _obs_transform_from_rule(rule))
            applied.append(source)
        except Exception as exc:
            failed.append({"source": source, "error": str(exc)})
    return {"applied": applied, "failed": failed}


def _sound_categories_for_project(proj: dict) -> dict:
    state = _load_editor_state(proj)
    active = state.get("active_profile", "default")
    profile = state.get("profiles", {}).get(active, {})
    return profile.get("sound_categories", {}) if isinstance(profile, dict) else {}


def _source_records(proj: dict) -> list[dict]:
    prefix = _source_prefix(proj)
    sound_categories = _sound_categories_for_project(proj)
    records = []
    for sound in _scan_sounds(proj["asset_dir"], proj["extensions"]):
        categories = sound_categories.get(sound["stem"])
        if not isinstance(categories, list) or not categories:
            categories = ["Uncategorized"]
        source = f"{prefix}{sound['stem']}"
        records.append({
            **sound,
            "source": source,
            "categories": [str(c).strip() or "Uncategorized" for c in categories],
            "dimension_key": sound.get("dimension_key") or "unknown",
        })
    return records


def _scene_sources_response(proj: dict) -> tuple[list[dict], str]:
    scene = _scene_name(proj)
    records = {item["source"]: item for item in _source_records(proj)}
    try:
        import obs
        scene_sources = obs.get_scene_sources(scene)
    except Exception as exc:
        return [], str(exc)

    result = []
    for item in scene_sources:
        source = item.get("source", "")
        record = records.get(source, {})
        result.append({
            **item,
            "profile_source": bool(record),
            "stem": record.get("stem") or source,
            "ext": record.get("ext", ""),
            "categories": record.get("categories", []),
            "dimension_key": record.get("dimension_key", ""),
            "size_mb": record.get("size_mb"),
        })
    return result, ""


def _tracks_payload(value) -> dict | None:
    if value is None or value == "":
        return None
    if isinstance(value, dict):
        return {str(i): bool(value.get(str(i)) or value.get(i)) for i in range(1, 7)}
    if isinstance(value, list):
        enabled = {str(v).strip() for v in value}
    else:
        enabled = {part.strip() for part in str(value).split(",")}
    return {str(i): str(i) in enabled for i in range(1, 7)}


def _sources_for_property_scope(proj: dict, data: dict) -> list[dict]:
    scope_type = str(data.get("scope_type") or data.get("scopeType") or "group")
    scope_key = str(data.get("scope_key") or data.get("scopeKey") or "")
    records = _source_records(proj)
    if scope_type == "all":
        return records
    if scope_type == "groups":
        keys = data.get("scope_keys") or data.get("scopeKeys") or []
        if not isinstance(keys, list):
            keys = []
        wanted = {str(key) for key in keys if str(key)}
        if scope_key:
            wanted.add(scope_key)
        matched: list[dict] = []
        seen: set[str] = set()
        for key in wanted:
            for item in _sources_for_property_scope(proj, {"scope_type": "group", "scope_key": key}):
                source = str(item.get("source") or "")
                if source and source not in seen:
                    seen.add(source)
                    matched.append(item)
        return matched
    if scope_type == "category":
        return [item for item in records if scope_key in item.get("categories", [])]
    if scope_type == "dimension":
        return [item for item in records if item.get("dimension_key") == scope_key]
    if scope_type == "source":
        return [item for item in records if item.get("source") == scope_key or item.get("stem") == scope_key]
    # Default group key format: dimension::category.
    if "::" in scope_key:
        dimension, category = scope_key.split("::", 1)
        return [
            item for item in records
            if item.get("dimension_key") == dimension and category in item.get("categories", [])
        ]
    return [item for item in records if item.get("dimension_key") == scope_key]


def _apply_source_properties(proj: dict, data: dict) -> dict:
    import obs

    media_props = data.get("media_properties") or data.get("mediaProperties") or {}
    if not isinstance(media_props, dict):
        media_props = {}
    monitor = data.get("monitor")
    tracks = _tracks_payload(data.get("audio_tracks", data.get("audioTracks")))
    volume_db = data.get("volume_db")
    if volume_db is not None:
        try:
            volume_db = float(volume_db)
        except (TypeError, ValueError):
            volume_db = None
    targets = _sources_for_property_scope(proj, data)
    applied = []
    failed = []
    for item in targets:
        source = item["source"]
        try:
            if media_props:
                kwargs = {}
                for key in ("restart_on_activate", "close_when_inactive", "looping", "hw_decode", "clear_on_media_end"):
                    if key in media_props:
                        kwargs[key] = bool(media_props[key])
                if media_props.get("speed_percent") not in (None, ""):
                    kwargs["speed_percent"] = float(media_props["speed_percent"])
                if kwargs:
                    obs.configure_media_source_properties(source, **kwargs)
            if monitor:
                obs.set_input_audio_monitor_type(source, str(monitor))
            if tracks is not None:
                obs.set_input_audio_tracks(source, tracks)
            if volume_db is not None:
                obs.set_input_volume_db(source, float(volume_db))
            applied.append(source)
        except Exception as exc:
            failed.append({"source": source, "error": str(exc)})
    return {"applied": applied, "failed": failed}


def _extension_for_media(content_type: str, fallback_name: str) -> str:
    suffix = Path(fallback_name).suffix.lower()
    if suffix:
        return suffix
    media_type = (content_type or "").split(";", 1)[0].strip().lower()
    return {
        "video/webm": ".webm",
        "audio/webm": ".webm",
        "audio/wav": ".wav",
        "audio/wave": ".wav",
        "audio/x-wav": ".wav",
        "video/mp4": ".mp4",
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
    }.get(media_type, ".webm")


def _unique_archive_path(folder: Path, filename: str) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    src = Path(filename)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    candidate = folder / f"{src.stem}-{stamp}{src.suffix}"
    counter = 2
    while candidate.exists():
        candidate = folder / f"{src.stem}-{stamp}-{counter}{src.suffix}"
        counter += 1
    return candidate


# ── Editor-state helpers ──────────────────────────────────────────────────────

def _default_profile() -> dict:
    return {
        "trigger_sequences": "",
        "hotkeys": {},
        "interface_hotkeys": {},
        "project_volume_db": 0.0,
        "profile_volume_db": 0.0,
        "category_volume_db": {},
        "file_volume_offsets": {},
        "group_names": {},
        "display_names": {},
        "categories": [],
        "sound_categories": {},
        "empty_groups": [],
        "unbound_groups": [],
    }


def _default_editor_state() -> dict:
    return {
        "live_profile":   "default",
        "active_profile": "default",
        "profiles":       {"default": _default_profile()},
    }


def _load_editor_state(proj: dict) -> dict:
    state_file: Path = proj["state_file"]
    hotkeys_file: Path = proj["hotkeys_file"]

    with _STATE_LOCK:
        if not state_file.is_file():
            state = _default_editor_state()
            # Migrate existing hotkeys.json on first run
            if hotkeys_file.is_file():
                existing = load_hotkeys(hotkeys_file)
                if existing:
                    state["profiles"]["default"]["hotkeys"] = dict(existing)
            return state
        try:
            raw = json.loads(state_file.read_text(encoding="utf-8"))
        except Exception:
            return _default_editor_state()

    if not isinstance(raw, dict):
        return _default_editor_state()

    state = _default_editor_state()
    state.update(raw)

    if not isinstance(state.get("profiles"), dict) or not state["profiles"]:
        state["profiles"] = {"default": _default_profile()}

    # Ensure each profile has all required keys
    for profile in state["profiles"].values():
        for k, v in _default_profile().items():
            if k not in profile:
                profile[k] = copy.deepcopy(v)

    names = list(state["profiles"].keys())
    if state.get("live_profile") not in names:
        state["live_profile"] = names[0]
    if state.get("active_profile") not in names:
        state["active_profile"] = state["live_profile"]
    return state


def _save_editor_state(proj: dict, state: dict) -> None:
    with _STATE_LOCK:
        proj["state_file"].write_text(
            json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8"
        )


def _sync_hotkeys_file(proj: dict, profile: dict) -> None:
    """Write only the bound hotkeys to hotkeys.json for mini-project consumption."""
    save_hotkeys(proj["hotkeys_file"], profile.get("hotkeys", {}))


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _profile_response_fields(profile: dict) -> dict:
    return {
        "profile_trigger_sequences": profile.get("trigger_sequences", ""),
        "hotkeys":        profile.get("hotkeys", {}),
        "interface_hotkeys": normalize_interface_hotkeys(profile.get("interface_hotkeys", {})),
        "project_volume_db": _safe_float(profile.get("project_volume_db"), 0.0),
        "profile_volume_db": _safe_float(profile.get("profile_volume_db"), 0.0),
        "category_volume_db": normalize_file_volume_offsets(profile.get("category_volume_db", {})),
        "file_volume_offsets": normalize_file_volume_offsets(profile.get("file_volume_offsets", {})),
        "group_names":    profile.get("group_names", {}),
        "display_names":  profile.get("display_names", {}),
        "categories":     profile.get("categories", []),
        "sound_categories": profile.get("sound_categories", {}),
        "empty_groups":   profile.get("empty_groups", []),
        "unbound_groups": profile.get("unbound_groups", []),
    }


def _build_api_data(proj: dict, state: dict, all_projects: list[dict], current_proj: dict) -> dict:
    active  = state.get("active_profile", "default")
    profile = state["profiles"].get(active, _default_profile())
    return {
        "project_name":   proj["name"],
        "asset_dir":      str(proj["asset_dir"]),
        "sounds":         _scan_sounds(proj["asset_dir"], proj["extensions"]),
        "active_profile": active,
        "live_profile":   state.get("live_profile", "default"),
        "profile_names":  sorted(state["profiles"].keys()),
        "projects": [
            {"key": p["key"], "name": p["name"], "active": p is current_proj}
            for p in all_projects
        ],
        "config_settings": _config_response(proj),
        "features": proj.get("features", {}),
        "can_create_profiles": bool(proj.get("can_create_profiles")),
        "phrases": _load_phrases(proj),
        "phrases_file": str(_phrases_file(proj)),
        **_profile_response_fields(profile),
    }


# ── Request handler ───────────────────────────────────────────────────────────

def _make_handler(*, current: dict, all_projects: list[dict], server_ref: list):
    """
    current["proj"] is a mutable reference to the active project dict.
    all_projects is the full list of project dicts.
    """

    class _Handler(http.server.BaseHTTPRequestHandler):

        def log_message(self, fmt, *args):
            pass  # suppress per-request noise

        # ── GET ───────────────────────────────────────────────────────────────
        # inside do_GET(self)
        def do_GET(self):
            path = self.path.split("?")[0]

            if path in ("/", "/editor.html"):
                self._serve_editor_file(_EDITOR_DIR / "editor.html")
            elif path == "/api/data":
                proj  = current["proj"]
                state = _load_editor_state(proj)
                self._json_ok(_build_api_data(proj, state, all_projects, current["proj"]))
            elif path == "/api/assets":
                qs = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                proj_key = qs.get("project", [""])[0].strip()
                found = next((p for p in all_projects if p["key"] == proj_key), None)
                if not found:
                    self._json_err(f"Project '{proj_key}' not found")
                else:
                    files = _scan_sounds(found["asset_dir"], found["extensions"])
                    self._json_ok({"ok": True, "files": files, "asset_dir": str(found["asset_dir"]), "project_key": proj_key})
            elif path == "/api/pending-moves":
                self._json_ok({"ok": True, "moves": _load_pending_moves(), "file": str(_PENDING_MOVES_FILE)})
            elif path == "/api/layout/data":
                self._json_ok({"ok": True, "layout": _layout_response(current["proj"])})
            elif path.startswith("/api/layout/volume"):
                from urllib.parse import parse_qs, urlparse
                qs = parse_qs(urlparse(self.path).query)
                scope_type = qs.get("scope_type", ["group"])[0]
                scope_key = qs.get("scope_key", [""])[0]
                proj = current["proj"]
                targets = _sources_for_property_scope(proj, {"scope_type": scope_type, "scope_key": scope_key})
                if not targets:
                    self._json_ok({"ok": True, "db": None, "mul": None, "sources": []})
                else:
                    try:
                        import obs
                        vols = []
                        for item in targets:
                            try:
                                v = obs.get_input_volume(item["source"])
                                if isinstance(v, dict):
                                    vols.append(v.get("db", 0))
                            except Exception:
                                pass
                        avg_db = sum(vols) / len(vols) if vols else None
                        self._json_ok({"ok": True, "db": avg_db, "sources": [t["source"] for t in targets]})
                    except Exception as exc:
                        self._json_err(str(exc))
            elif path.startswith("/assets/"):
                # first try editor static assets like assets/js/app.js, assets/css/styles.css
                editor_asset = (_EDITOR_DIR / path.lstrip("/")).resolve()
                if _EDITOR_DIR.resolve() in editor_asset.parents and editor_asset.is_file():
                    self._serve_file(editor_asset)
                    return

                # fallback: original media asset behavior
                self._serve_asset(self.path[len("/assets/"):])
            elif path.startswith("/components/"):
                comp = (_EDITOR_DIR / path.lstrip("/")).resolve()
                if _EDITOR_DIR.resolve() in comp.parents and comp.is_file():
                    self._serve_file(comp)
                else:
                    self.send_error(404)
            else:
                # optional: allow any static file under editor dir
                file_path = (_EDITOR_DIR / path.lstrip("/")).resolve()
                if _EDITOR_DIR.resolve() in file_path.parents and file_path.is_file():
                    self._serve_file(file_path)
                else:
                    self.send_error(404)

        def _serve_editor_file(self, path: Path):
            if not path.is_file():
                self.send_error(500, f"{path.name} not found")
                return
            self._serve_file(path)

        def _serve_asset(self, encoded_path: str):
            proj = current["proj"]
            filename  = urllib.parse.unquote(encoded_path)
            file_path = (proj["asset_dir"] / filename).resolve()
            if (proj["asset_dir"].resolve() in file_path.parents
                    and file_path.is_file()
                    and file_path.suffix.lower() in proj["extensions"]):
                self._serve_file(file_path)
            else:
                self.send_error(404)

        def _serve_file(self, path: Path):
            data = path.read_bytes()
            mime, _ = mimetypes.guess_type(str(path))
            self.send_response(200)
            self.send_header("Content-Type", mime or "application/octet-stream")
            self.send_header("Content-Length", len(data))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)

        # ── POST ──────────────────────────────────────────────────────────────

        def do_POST(self):
            path   = self.path.split("?")[0]
            length = int(self.headers.get("Content-Length", 0))
            body   = self.rfile.read(length)

            if path == "/api/media/replace":
                self._handle_media_replace(body)
                return

            if path == "/api/voice/transcribe":
                self._handle_voice_transcribe(body)
                return

            try:
                data = json.loads(body) if length else {}
            except json.JSONDecodeError:
                self._json_err("Invalid JSON")
                return

            routes = {
                "/api/save":                  self._handle_save,
                "/api/profile/create":        self._handle_profile_create,
                "/api/profile/duplicate":     self._handle_profile_duplicate,
                "/api/profile/delete":        self._handle_profile_delete,
                "/api/profile/rename":        self._handle_profile_rename,
                "/api/profile/set_live":      self._handle_profile_set_live,
                "/api/profile/switch":        self._handle_profile_switch,
                "/api/config/save":           self._handle_config_save,
                "/api/phrases/save":          self._handle_phrases_save,
                "/api/voice/score":           self._handle_voice_score,
                "/api/media-profile/create":  self._handle_media_profile_create,
                "/api/layout/save":           self._handle_layout_save,
                "/api/layout/properties/apply": self._handle_layout_properties_apply,
                "/api/layout/source-visibility": self._handle_layout_source_visibility,
                "/api/switch":                self._handle_project_switch,
                "/api/pending-moves/save":    self._handle_pending_moves_save,
                "/api/pending-moves/commit":  self._handle_pending_moves_commit,
                "/api/shutdown":              self._handle_shutdown,
            }
            fn = routes.get(path)
            if fn:
                fn(data)
            else:
                self.send_error(404)

        # ── Save ──────────────────────────────────────────────────────────────

        def _handle_media_replace(self, body: bytes):
            if not body:
                return self._json_err("No media data received")

            proj = current["proj"]
            asset_dir = proj["asset_dir"].resolve()
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            stem = query.get("stem", [""])[0].strip()
            requested_name = query.get("filename", [""])[0].strip()
            original_name = query.get("original", [""])[0].strip()

            if not stem or stem != Path(stem).name or any(ch in stem for ch in ("/", "\\", ":")):
                return self._json_err("Invalid media stem")

            if not asset_dir.is_dir():
                return self._json_err("Asset directory does not exist")

            original_path = None
            if original_name:
                candidate = (asset_dir / Path(original_name).name).resolve()
                if asset_dir in candidate.parents and candidate.is_file() and candidate.stem == stem:
                    original_path = candidate

            if original_path is None:
                matches = [
                    p for p in asset_dir.iterdir()
                    if p.is_file() and p.stem == stem and p.suffix.lower() in proj["extensions"]
                ]
                if matches:
                    original_path = matches[0]

            if original_path is None:
                return self._json_err(f"Original file for '{stem}' was not found")

            content_type = self.headers.get("Content-Type", "application/octet-stream")
            new_ext = _extension_for_media(content_type, requested_name)
            generated_exts = {".webm", ".wav", ".mp4", ".mp3", ".ogg", ".m4a"}
            if new_ext not in proj["extensions"] and new_ext not in generated_exts:
                return self._json_err(f"Unsupported replacement extension: {new_ext}")

            proj["extensions"].add(new_ext)
            target_path = (asset_dir / f"{stem}{new_ext}").resolve()
            if asset_dir not in target_path.parents:
                return self._json_err("Invalid replacement path")

            archive_dir = asset_dir / "originals_to_be_deleted"
            moved = []
            for path in sorted({original_path, target_path}):
                if path.exists():
                    archive_path = _unique_archive_path(archive_dir, path.name)
                    path.replace(archive_path)
                    moved.append(str(archive_path))

            target_path.write_bytes(body)

            state = _load_editor_state(proj)
            self._json_ok({
                "ok": True,
                "sound": {"stem": stem, "ext": new_ext, "filename": target_path.name},
                "moved_originals": moved,
                "sounds": _scan_sounds(proj["asset_dir"], proj["extensions"]),
                "data": _build_api_data(proj, state, all_projects, current["proj"]),
            })

        def _handle_save(self, data):
            proj  = current["proj"]
            state = _load_editor_state(proj)
            active = state.get("active_profile", "default")
            if active not in state["profiles"]:
                state["profiles"][active] = _default_profile()
            profile = state["profiles"][active]
            for key in ("hotkeys", "interface_hotkeys", "project_volume_db", "profile_volume_db", "category_volume_db", "file_volume_offsets", "group_names", "display_names", "categories", "sound_categories", "empty_groups", "unbound_groups"):
                if key in data:
                    if key == "interface_hotkeys":
                        profile[key] = normalize_interface_hotkeys(data[key])
                    elif key in {"file_volume_offsets", "category_volume_db"}:
                        profile[key] = normalize_file_volume_offsets(data[key])
                    elif key in {"project_volume_db", "profile_volume_db"}:
                        try:
                            profile[key] = float(data[key])
                        except (TypeError, ValueError):
                            profile[key] = 0.0
                    else:
                        profile[key] = data[key]
            if "profile_trigger_sequences" in data:
                profile["trigger_sequences"] = str(data.get("profile_trigger_sequences") or "")
            if "phrases" in data:
                _save_phrases(proj, data.get("phrases") or {})
            _save_editor_state(proj, state)
            if active == state.get("live_profile"):
                _sync_hotkeys_file(proj, profile)
                count = len(profile.get("hotkeys", {}))
                print(f"[hotkey_editor] Saved {count} hotkey(s) → {proj['hotkeys_file']}")
            self._json_ok({"ok": True})

        def _handle_config_save(self, data):
            proj = current["proj"]
            settings = data.get("settings", {})
            if not isinstance(settings, dict):
                return self._json_err("settings must be an object")
            _save_config_overrides(proj, settings)
            refreshed = _config_response(proj)
            current_settings = refreshed.get("current", {})
            if current_settings.get("asset_dir"):
                proj["asset_dir"] = Path(str(current_settings["asset_dir"]))
            extensions = current_settings.get("valid_extensions")
            if isinstance(extensions, list):
                proj["extensions"] = {str(ext).strip().lower() for ext in extensions if str(ext).strip()}
            elif isinstance(extensions, str):
                proj["extensions"] = {
                    item.strip().lower()
                    for item in extensions.split(",")
                    if item.strip()
                }
            self._json_ok({
                "ok": True,
                "config_settings": refreshed,
                "sounds": _scan_sounds(proj["asset_dir"], proj["extensions"]),
            })

        def _handle_phrases_save(self, data):
            proj = current["proj"]
            phrases = data.get("phrases", {})
            if not isinstance(phrases, dict):
                return self._json_err("phrases must be an object")
            _save_phrases(proj, phrases)
            self._json_ok({
                "ok": True,
                "phrases": _load_phrases(proj),
                "phrases_file": str(_phrases_file(proj)),
            })

        # ── Profile management ────────────────────────────────────────────────

        def _handle_media_profile_create(self, data):
            proj = current["proj"]
            store_file = proj.get("profile_store_file")
            if not store_file:
                store_file = next((p.get("profile_store_file") for p in all_projects if p.get("profile_store_file")), None)
            if not store_file:
                return self._json_err("This editor session is not backed by a media profile store")
            try:
                created = create_media_profile(Path(store_file), data)
            except Exception as exc:
                return self._json_err(str(exc))

            hf = Path(created["hotkeys_file"])
            new_proj = {
                "key": created["key"],
                "name": created["name"],
                "asset_dir": Path(created["asset_dir"]),
                "hotkeys_file": hf,
                "extensions": set(created.get("extensions", set())),
                "config_defaults": created.get("config_defaults", {}),
                "state_file": hf.parent / f"{hf.stem}_editor.json",
                "features": created.get("features", {}),
                "profile_store_file": Path(created["profile_store_file"]) if created.get("profile_store_file") else None,
                "can_create_profiles": bool(created.get("can_create_profiles")),
                "phrases_file": Path(created.get("phrases_file") or hf.parent / "phrases.json"),
            }
            all_projects.append(new_proj)
            current["proj"] = new_proj
            state = _load_editor_state(new_proj)
            self._json_ok({"ok": True, **_build_api_data(new_proj, state, all_projects, current["proj"])})

        def _handle_layout_save(self, data):
            proj = current["proj"]
            rules = data.get("rules", {})
            if not isinstance(rules, dict):
                return self._json_err("rules must be an object")
            overrides = data.get("overrides", {})
            if not isinstance(overrides, dict):
                return self._json_err("overrides must be an object")

            clean_rules = {
                str(key): _safe_transform(value)
                for key, value in rules.items()
                if isinstance(value, dict)
            }
            clean_overrides = {
                str(key): _safe_transform(value)
                for key, value in overrides.items()
                if isinstance(value, dict)
            }
            _save_layout_rules(proj, {
                "scene": _scene_name(proj),
                "prefix": _source_prefix(proj),
                "rules": clean_rules,
                "overrides": clean_overrides,
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            })

            result = {"applied": [], "failed": []}
            if data.get("apply", True):
                try:
                    apply_rules = data.get("apply_rules")
                    apply_overrides = data.get("apply_overrides")
                    clean_apply_rules = (
                        {
                            str(key): _safe_transform(value)
                            for key, value in apply_rules.items()
                            if isinstance(value, dict)
                        }
                        if isinstance(apply_rules, dict)
                        else clean_rules
                    )
                    clean_apply_overrides = (
                        {
                            str(key): _safe_transform(value)
                            for key, value in apply_overrides.items()
                            if isinstance(value, dict)
                        }
                        if isinstance(apply_overrides, dict)
                        else clean_overrides
                    )
                    result = _apply_layout_rules(proj, clean_apply_rules, clean_apply_overrides)
                except Exception as exc:
                    result = {"applied": [], "failed": [{"source": "(OBS)", "error": str(exc)}]}

            self._json_ok({
                "ok": True,
                "layout": _layout_response(proj),
                "apply_result": result,
            })

        def _handle_layout_properties_apply(self, data):
            proj = current["proj"]
            try:
                result = _apply_source_properties(proj, data if isinstance(data, dict) else {})
                self._json_ok({
                    "ok": True,
                    "result": result,
                    "layout": _layout_response(proj),
                })
            except Exception as exc:
                self._json_err(str(exc))

        def _handle_layout_source_visibility(self, data):
            proj = current["proj"]
            source = str(data.get("source", "")).strip()
            if not source:
                return self._json_err("source required")
            visible = bool(data.get("visible"))
            try:
                import obs
                obs.set_scene_source_visible(_scene_name(proj), source, visible)
                self._json_ok({
                    "ok": True,
                    "layout": _layout_response(proj),
                })
            except Exception as exc:
                self._json_err(str(exc))

        def _handle_profile_create(self, data):
            name = str(data.get("name", "")).strip()
            if not name:
                return self._json_err("Name required")
            proj  = current["proj"]
            state = _load_editor_state(proj)
            if name in state["profiles"]:
                return self._json_err(f"Profile '{name}' already exists")
            active = state.get("active_profile", "default")
            state["profiles"][name] = copy.deepcopy(
                state["profiles"].get(active, _default_profile())
            )
            state["active_profile"] = name
            _save_editor_state(proj, state)
            profile = state["profiles"][name]
            self._json_ok({
                "ok": True,
                "profile_names":  sorted(state["profiles"].keys()),
                "active_profile": name,
                "live_profile":   state.get("live_profile", "default"),
                **_profile_response_fields(profile),
            })

        def _handle_profile_duplicate(self, data):
            name = str(data.get("name", "")).strip()
            source_name = str(data.get("source", "")).strip()
            if not name:
                return self._json_err("Name required")
            proj  = current["proj"]
            state = _load_editor_state(proj)
            if name in state["profiles"]:
                return self._json_err(f"Profile '{name}' already exists")
            source_name = source_name or state.get("active_profile", "default")
            if source_name not in state["profiles"]:
                return self._json_err(f"Profile '{source_name}' not found")
            state["profiles"][name] = copy.deepcopy(state["profiles"][source_name])
            state["active_profile"] = name
            _save_editor_state(proj, state)
            profile = state["profiles"][name]
            self._json_ok({
                "ok": True,
                "profile_names":  sorted(state["profiles"].keys()),
                "active_profile": name,
                "live_profile":   state.get("live_profile", "default"),
                **_profile_response_fields(profile),
            })

        def _handle_profile_delete(self, data):
            name = str(data.get("name", "")).strip()
            proj  = current["proj"]
            state = _load_editor_state(proj)
            if name not in state["profiles"]:
                return self._json_err(f"Profile '{name}' not found")
            if len(state["profiles"]) <= 1:
                return self._json_err("Cannot delete the last profile")
            del state["profiles"][name]
            if state.get("live_profile") == name:
                new_live = next(iter(state["profiles"]))
                state["live_profile"] = new_live
                _sync_hotkeys_file(proj, state["profiles"][new_live])
            if state.get("active_profile") == name:
                state["active_profile"] = state["live_profile"]
            _save_editor_state(proj, state)
            active  = state["active_profile"]
            profile = state["profiles"].get(active, _default_profile())
            self._json_ok({
                "ok": True,
                "profile_names":  sorted(state["profiles"].keys()),
                "active_profile": active,
                "live_profile":   state.get("live_profile", "default"),
                **_profile_response_fields(profile),
            })

        def _handle_profile_rename(self, data):
            from_name = str(data.get("from", "")).strip()
            to_name   = str(data.get("to", "")).strip()
            if not from_name or not to_name:
                return self._json_err("from and to required")
            proj  = current["proj"]
            state = _load_editor_state(proj)
            if from_name not in state["profiles"]:
                return self._json_err(f"Profile '{from_name}' not found")
            if to_name in state["profiles"]:
                return self._json_err(f"Profile '{to_name}' already exists")
            state["profiles"][to_name] = state["profiles"].pop(from_name)
            if state.get("live_profile")   == from_name: state["live_profile"]   = to_name
            if state.get("active_profile") == from_name: state["active_profile"] = to_name
            _save_editor_state(proj, state)
            self._json_ok({
                "ok": True,
                "profile_names":  sorted(state["profiles"].keys()),
                "active_profile": state["active_profile"],
                "live_profile":   state.get("live_profile", "default"),
            })

        def _handle_profile_set_live(self, data):
            name = str(data.get("name", "")).strip()
            proj  = current["proj"]
            state = _load_editor_state(proj)
            if name not in state["profiles"]:
                return self._json_err(f"Profile '{name}' not found")
            state["live_profile"] = name
            _save_editor_state(proj, state)
            _sync_hotkeys_file(proj, state["profiles"][name])
            count = len(state["profiles"][name].get("hotkeys", {}))
            print(f"[hotkey_editor] Live profile → '{name}'  ({count} hotkeys → {proj['hotkeys_file']})")
            self._json_ok({"ok": True, "live_profile": name})

        def _handle_profile_switch(self, data):
            name = str(data.get("name", "")).strip()
            proj  = current["proj"]
            state = _load_editor_state(proj)
            if name not in state["profiles"]:
                return self._json_err(f"Profile '{name}' not found")
            state["active_profile"] = name
            _save_editor_state(proj, state)
            profile = state["profiles"][name]
            self._json_ok({
                "ok": True,
                "profile_names":  sorted(state["profiles"].keys()),
                "active_profile": name,
                "live_profile":   state.get("live_profile", "default"),
                **_profile_response_fields(profile),
            })

        # ── Pending moves ─────────────────────────────────────────────────────

        def _handle_pending_moves_save(self, data):
            moves = data.get("moves", [])
            if not isinstance(moves, list):
                return self._json_err("moves must be a list")
            _save_pending_moves_file(moves)
            self._json_ok({"ok": True, "count": len(moves), "file": str(_PENDING_MOVES_FILE)})

        def _handle_pending_moves_commit(self, data):
            moves = data.get("moves", [])
            if not isinstance(moves, list):
                return self._json_err("moves must be a list")
            result = _commit_pending_moves(moves, all_projects)
            applied_keys = {(a["stem"], a.get("fromProject", "")) for a in result["applied"]}
            remaining = [m for m in _load_pending_moves()
                         if (m.get("stem"), m.get("fromProject", "")) not in applied_keys]
            _save_pending_moves_file(remaining)
            self._json_ok({"ok": True, **result})

        # ── Project switch ────────────────────────────────────────────────────

        def _handle_project_switch(self, data):
            key   = str(data.get("key", "")).strip()
            found = next((p for p in all_projects if p["key"] == key), None)
            if not found:
                return self._json_err(f"Project '{key}' not found")
            current["proj"] = found
            proj  = current["proj"]
            state = _load_editor_state(proj)
            self._json_ok({"ok": True, **_build_api_data(proj, state, all_projects, current["proj"])})

        # ── Shutdown ──────────────────────────────────────────────────────────

        def _handle_shutdown(self, data):
            self._json_ok({"ok": True})
            srv = server_ref[0]
            if srv:
                threading.Thread(target=srv.shutdown, daemon=True).start()

        # ── Voice ─────────────────────────────────────────────────────────────

        def _handle_voice_transcribe(self, body: bytes):
            if not body:
                return self._json_err("No audio data received")
            content_type = self.headers.get("Content-Type", "audio/webm")
            try:
                text = _transcribe_audio(body, content_type)
                self._json_ok({"ok": True, "text": text})
            except Exception as exc:
                self._json_err(str(exc))

        def _handle_voice_score(self, data):
            phrase = str(data.get("phrase", "")).strip()
            stems = data.get("stems", [])
            if not isinstance(stems, list):
                stems = []
            proj = current["proj"]
            phrases_file = _phrases_file(proj)
            strategy = (proj.get("config_defaults") or {}).get("phrase_scorer")
            try:
                results = _score_phrase(phrase, stems, phrases_file, strategy=strategy)
                self._json_ok({"ok": True, "results": results})
            except Exception as exc:
                self._json_err(str(exc))

        # ── JSON helpers ──────────────────────────────────────────────────────

        def _json_ok(self, obj):
            self._send_json(200, obj)

        def _json_err(self, msg, status=400):
            self._send_json(status, {"ok": False, "error": msg})

        def _send_json(self, status: int, obj):
            body = json.dumps(obj).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", len(body))
            self.end_headers()
            self.wfile.write(body)

    return _Handler


# ── Public entry point ────────────────────────────────────────────────────────

def run_editor(
    *,
    asset_dir:        Path,
    hotkeys_file:     Path,
    valid_extensions: set[str],
    project_name:     str,
    port:             int = 8765,
    all_projects:     list[dict] | None = None,
) -> None:
    """Start the hotkey editor server and open the browser. Blocks until Ctrl+C.

    If *all_projects* is provided, the UI will show a project switcher.
    Each entry must have keys: key, name, asset_dir, hotkeys_file, extensions.
    """

    def _norm(p: dict) -> dict:
        hf = Path(p["hotkeys_file"])
        return {
            "key":          p.get("key", p["name"].lower().replace(" ", "_")),
            "name":         p["name"],
            "asset_dir":    Path(p["asset_dir"]),
            "hotkeys_file": hf,
            "extensions":   set(p.get("extensions", p.get("valid_extensions", set()))),
            "config_defaults": p.get("config_defaults", {}),
            "features":     p.get("features", {}),
            "profile_store_file": Path(p["profile_store_file"]) if p.get("profile_store_file") else None,
            "can_create_profiles": bool(p.get("can_create_profiles")),
            "phrases_file": Path(p.get("phrases_file") or hf.parent / "phrases.json"),
            "state_file":   hf.parent / f"{hf.stem}_editor.json",
        }

    primary = {
        "key":          project_name.lower().replace(" ", "_"),
        "name":         project_name,
        "asset_dir":    asset_dir,
        "hotkeys_file": hotkeys_file,
        "extensions":   valid_extensions,
        "config_defaults": {},
        "features": {},
        "profile_store_file": None,
        "can_create_profiles": False,
        "phrases_file": hotkeys_file.parent / "phrases.json",
        "state_file":   hotkeys_file.parent / f"{hotkeys_file.stem}_editor.json",
    }

    if all_projects:
        normalized = [_norm(p) for p in all_projects]
        keys = [p["key"] for p in normalized]
        if primary["key"] not in keys:
            normalized.insert(0, primary)
        else:
            primary = next(p for p in normalized if p["key"] == primary["key"])
        projects_list = normalized
    else:
        projects_list = [primary]

    current    = {"proj": primary}
    server_ref: list = [None]
    handler    = _make_handler(
        current=current, all_projects=projects_list, server_ref=server_ref
    )

    def _maybe_start_replay_buffer() -> None:
        try:
            import obs
        except Exception as exc:
            print(f"[hotkey_editor] Replay buffer auto-start skipped: {exc}")
            return

        try:
            client = obs.get_obs()
            status = None
            try:
                status = client.get_replay_buffer_status()
            except Exception:
                status = None

            is_active = bool(
                getattr(status, "output_active", False)
                or getattr(status, "outputActive", False)
            )
            if is_active:
                print("[hotkey_editor] Replay buffer already running.")
                return

            client.start_replay_buffer()
            print("[hotkey_editor] Replay buffer started.")
        except Exception as exc:
            print(f"[hotkey_editor] Replay buffer auto-start failed: {exc}")

    _maybe_start_replay_buffer()

    actual_port = _find_free_port(port)
    server      = http.server.HTTPServer(("localhost", actual_port), handler)
    server_ref[0] = server

    url = f"http://localhost:{actual_port}"
    bar = "=" * 56
    print(bar)
    print(f"  {project_name} — Hotkey Editor")
    print(bar)
    print(f"  URL        : {url}")
    print(f"  Asset dir  : {asset_dir}")
    print(f"  Hotkeys    : {hotkeys_file}")
    if actual_port != port:
        print(f"  [NOTE] Port {port} was in use — using {actual_port} instead.")
    if not asset_dir.is_dir():
        print("  [WARN] Asset directory not found — sounds list will be empty.")
    print("\n  Opening browser… Ctrl+C to stop.\n")

    threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[hotkey_editor] Stopped.")
