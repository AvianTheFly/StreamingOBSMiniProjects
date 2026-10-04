"""Public song-library commands, independent of the Hub HTTP transport."""
import json
import threading
from pathlib import Path
from lib.json_store import write_json
from lib.settings_backups import SettingsBackups
from .interface import _live
from .config import SONGS_JSON

def _error(status, message):
    return status, {"error": message}

def library():
    path = Path(SONGS_JSON)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []

def categories():
    path = Path(SONGS_JSON).parent / "categories.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

def command(action: str, body: dict):
    live = _live.copy()
    if action == "play":
        source = body.get("source", "")
        player = live.get("player")
        if not (player and source):
            return _error(400, "source required / player not ready")
        stop_random = live.get("stop_random")
        if stop_random:
            stop_random()
        player.play_async(source)
        return (200, {"ok": True})

    elif action == "stop":
        player     = live.get("player")
        stop_random = live.get("stop_random")
        if stop_random:
            stop_random()
        if player:
            player.abort()
        return (200, {"ok": True})

    elif action == "random":
        category = (body.get("category") or "").strip() or None
        start_random = live.get("start_random")
        if not start_random:
            return _error(503, "specific_song not running")
        threading.Thread(target=start_random, args=(category,), daemon=True).start()
        return (200, {"ok": True})

    elif action == "next":
        player = live.get("player")
        rand_active = live.get("rand_active", [False])
        if rand_active[0] and player:
            player.abort()
        return (200, {"ok": True})

    elif action == "save_library":
        try:
            from .config import SONGS_JSON
            songs = body.get("songs", [])
            SettingsBackups().snapshot()
            write_json(Path(SONGS_JSON), songs)
            reload_fn = live.get("reload")
            if reload_fn:
                threading.Thread(target=reload_fn, daemon=True).start()
            return (200, {"ok": True})
        except Exception as exc:
            return _error(500, str(exc))

    elif action == "save_categories":
        try:
            from .config import SONGS_JSON
            cats = body.get("categories", {})
            cats_path = Path(SONGS_JSON).parent / "categories.json"
            SettingsBackups().snapshot()
            write_json(cats_path, cats)
            return (200, {"ok": True})
        except Exception as exc:
            return _error(500, str(exc))

    elif action == "match_test":
        try:
            query = (body.get("query") or "").strip()
            if not query:
                return (200, {"match": None, "top": []})
            from .config import SONGS_JSON, MATCH_THRESHOLD
            from .matcher import rank_matches
            if not Path(SONGS_JSON).exists():
                return (200, {"match": None, "top": []})
            songs = json.loads(Path(SONGS_JSON).read_text(encoding="utf-8"))
            top = rank_matches(query, songs, top_n=5)
            best = top[0] if top and top[0][1] >= MATCH_THRESHOLD else None
            return (200, {
                "match": {"song": best[0], "score": round(best[1] * 100)} if best else None,
                "top":   [{"song": s, "score": round(sc * 100)} for s, sc in top],
            })
        except Exception as exc:
            return _error(500, str(exc))

    else:
        return _error(404, f"Unknown specific_song action: {action}")
