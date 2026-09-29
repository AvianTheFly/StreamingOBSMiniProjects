"""Persistent replay labels and ordered compilations, independent of OBS settings."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import threading
import uuid

LOCK = threading.RLock()
STATE_FILE = Path(__file__).with_name("replay_library.json")
MEDIA_EXTENSIONS = {".mkv", ".mp4", ".mov", ".webm", ".avi", ".flv", ".m4v"}


class Conflict(ValueError):
    pass


def clip_id(path):
    return hashlib.sha256(str(Path(path).resolve()).casefold().encode()).hexdigest()[:24]


def read():
    with LOCK:
        if not STATE_FILE.exists():
            return {"revision": 0, "clips": {}, "groups": []}
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if not isinstance(data.get("clips"), dict) or not isinstance(data.get("groups"), list):
            raise ValueError("Replay library needs recovery; existing data has been left untouched.")
        return data


def _write(data):
    data["revision"] = data.get("revision", 0) + 1
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(STATE_FILE)


def remember_capture(path, *, tag="untagged", saved_at=None):
    """Persist a newly saved cut's selection metadata without touching UI data."""
    path = Path(path).resolve()
    with LOCK:
        data = read()
        meta = data["clips"].setdefault(clip_id(path), {})
        meta.update(path=str(path), tag=str(tag or "untagged"),
                    saved_at=float(saved_at) if saved_at is not None else None,
                    kept=True)
        _write(data)


def archive_capture(source, destination, *, game=""):
    """Move persistent metadata (and any group references) to an archived cut."""
    source, destination = Path(source).resolve(), Path(destination).resolve()
    with LOCK:
        data = read()
        old_key, new_key = clip_id(source), clip_id(destination)
        meta = dict(data["clips"].pop(old_key, {}))
        meta.update(path=str(destination), game=str(game or meta.get("game") or ""), kept=True)
        data["clips"].setdefault(new_key, {}).update(meta)
        for group in data["groups"]:
            group["paths"] = [str(destination) if Path(p).resolve() == source else p
                              for p in group.get("paths", [])]
        _write(data)


def tagged_paths(tag, root):
    """Return all existing archived/current cuts for a tag, oldest first."""
    root = Path(root).resolve()
    rows = []
    with LOCK:
        for meta in read()["clips"].values():
            path = Path(meta.get("path", ""))
            if str(meta.get("tag", "")).casefold() != str(tag).casefold():
                continue
            try:
                resolved = resolve(path, root)
            except ValueError:
                continue
            rows.append((float(meta.get("saved_at") or resolved.stat().st_mtime), str(resolved)))
    return [path for _, path in sorted(rows)]


def game_paths(game_number, root):
    """Return individual cuts belonging to Game N, oldest first."""
    prefix = f"Game {game_number}"
    rows = []
    with LOCK:
        for meta in read()["clips"].values():
            if not str(meta.get("game", "")).startswith(prefix):
                continue
            try:
                resolved = resolve(meta.get("path", ""), root)
            except ValueError:
                continue
            rows.append((float(meta.get("saved_at") or resolved.stat().st_mtime), str(resolved)))
    return [path for _, path in sorted(rows)]


def game_numbers():
    """Return game numbers that have an archived individual-cut pool."""
    numbers = set()
    with LOCK:
        for meta in read()["clips"].values():
            prefix = str(meta.get("game", "")).split(" ")
            if len(prefix) >= 2 and prefix[0] == "Game" and prefix[1].isdigit():
                numbers.add(int(prefix[1]))
    return sorted(numbers)


def resolve(path, root):
    candidate = Path(path).resolve()
    if not candidate.is_relative_to(Path(root).resolve()) or candidate.suffix.lower() not in MEDIA_EXTENSIONS:
        raise ValueError("Choose a clip from the replay library.")
    if not candidate.is_file() or candidate.stat().st_size == 0:
        raise ValueError(f"Clip is missing or empty: {candidate.name}")
    return candidate


def decorate(rows):
    data = read()
    for row in rows:
        key = clip_id(row["path"])
        meta = data["clips"].get(key, {})
        row.update(id=key, title=meta.get("title") or row["name"],
                   notes=meta.get("notes", ""), favorite=meta.get("favorite", False),
                   kept=meta.get("kept", False), tag=meta.get("tag", row.get("tag", "")),
                   game=meta.get("game", ""))
    return {"clips": rows, "groups": data["groups"], "revision": data["revision"]}


def disk_rows(root):
    """Library management also works before the OBS-dependent module starts."""
    rows = []
    root = Path(root).resolve()
    for path in root.rglob("*"):
        try:
            if not path.is_file() or path.suffix.lower() not in MEDIA_EXTENSIONS:
                continue
            stat = path.stat()
            if stat.st_size <= 0:
                continue
            rows.append({"name": path.name, "path": str(path.resolve()), "tag": "",
                         "saved_at": stat.st_mtime, "size_bytes": stat.st_size,
                         "scope": "highlight reel" if path.is_relative_to(root / "edited") else "saved"})
        except OSError:
            continue  # a buffer file can disappear while the directory is scanned
    return sorted(rows, key=lambda r: r["saved_at"], reverse=True)


def mutate(body, root):
    with LOCK:
        data = read()
        if body.get("revision") != data["revision"]:
            raise Conflict("Library changed in another window. Refresh, then retry your edit.")
        action = body.get("action")
        if action == "clip":
            path = resolve(str(body.get("path", "")), root)
            key = clip_id(path)
            meta = data["clips"].setdefault(key, {})
            meta.update(path=str(path), title=str(body.get("title", "")).strip()[:160],
                        notes=str(body.get("notes", ""))[:4000],
                        favorite=bool(body.get("favorite")), kept=True)
        elif action == "group":
            name = str(body.get("name", "")).strip()
            if not name or len(name) > 100:
                raise ValueError("Give the compilation a name (up to 100 characters).")
            gid = body.get("id") or uuid.uuid4().hex
            existing = next((g for g in data["groups"] if g["id"] == gid), None)
            if body.get("id") and existing is None:
                raise ValueError("This compilation no longer exists.")
            if any(g["name"].casefold() == name.casefold() and g["id"] != gid for g in data["groups"]):
                raise ValueError("A compilation already uses that name.")
            paths = body.get("paths", [])
            if not isinstance(paths, list):
                raise ValueError("Compilation clips must be a list.")
            known = {p for g in data["groups"] for p in g["paths"]}
            validated = []
            for value in paths:
                # Existing missing references remain editable/removable in the UI.
                path = Path(str(value)).resolve()
                if str(path) not in known:
                    path = resolve(str(path), root)
                validated.append(str(path))
                data["clips"].setdefault(clip_id(path), {}).update(path=str(path), kept=True)
            group = {"id": gid, "name": name, "paths": validated}
            if existing is not None:
                data["groups"][data["groups"].index(existing)] = group
            else:
                data["groups"].append(group)
        elif action == "delete_group":
            data["groups"] = [g for g in data["groups"] if g["id"] != body.get("id")]
        else:
            raise ValueError("Unknown replay library action.")
        _write(data)
        return data


def volume_source(path, labels, levels):
    """Use a cut's source level until the cut gets its own fader adjustment."""
    seen = set()
    while path and clip_id(path) not in seen:
        seen.add(clip_id(path))
        if str(Path(path).resolve()).casefold() in levels:
            return path
        path = labels.get(clip_id(path), {}).get("trim_source")
    return None


def group_paths(identifier, root, *, by_name=False):
    groups = read()["groups"]
    group = next((g for g in groups if
                  (g["name"].casefold() == identifier.casefold() if by_name else g["id"] == identifier)), None)
    if group is None:
        raise ValueError("Compilation not found.")
    if not group["paths"]:
        raise ValueError("Add clips to this compilation first.")
    return [str(resolve(path, root)) for path in group["paths"]]


def retain_after_merge(path):
    """Keep curated source clips; mark them so later cleanup won't merge twice."""
    with LOCK:
        data = read()
        meta = data["clips"].get(clip_id(path), {})
        if not meta.get("kept"):
            return False
        if not meta.get("merged"):
            meta["merged"] = True
            _write(data)
        return True
