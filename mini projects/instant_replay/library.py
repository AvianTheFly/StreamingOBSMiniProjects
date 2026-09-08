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
                   kept=meta.get("kept", False))
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
