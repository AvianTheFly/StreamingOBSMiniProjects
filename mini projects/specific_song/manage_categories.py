#!/usr/bin/env python3
"""
Song Category Manager — specific_song
======================================
Standalone CLI for managing song categories and voice aliases.

Run:
    python "mini projects/specific_song/manage_categories.py"

Categories let you do "random hype" or "random chill" via voice instead of
shuffling everything.  Aliases let you add Whisper-mishear variants so the
matcher catches "give x" → "gvx", "among us impostor" → "among us", etc.
"""
from __future__ import annotations

import difflib
import json
import os
import re
import sys
from pathlib import Path

# ── ANSI colors (Windows-compatible) ─────────────────────────────────────────
if os.name == "nt":
    os.system("")  # enable VT processing

R  = "\033[0m"      # reset
B  = "\033[1m"      # bold
DM = "\033[2m"      # dim
CY = "\033[36m"     # cyan
GN = "\033[32m"     # green
YL = "\033[33m"     # yellow
RD = "\033[31m"     # red
MG = "\033[35m"     # magenta

# ── Paths ─────────────────────────────────────────────────────────────────────
_HERE           = Path(__file__).resolve().parent
SONGS_JSON      = _HERE / "songs.json"
CATEGORIES_JSON = _HERE / "categories.json"

# ── Data I/O ──────────────────────────────────────────────────────────────────

def load_songs() -> list[dict]:
    if not SONGS_JSON.exists():
        print(f"{RD}Error: songs.json not found at {SONGS_JSON}{R}")
        print('Run: python "mini projects/specific_song/full_sync.py" --apply')
        sys.exit(1)
    with open(SONGS_JSON, encoding="utf-8") as f:
        return json.load(f)


def save_songs(songs: list[dict]) -> None:
    with open(SONGS_JSON, "w", encoding="utf-8") as f:
        json.dump(songs, f, indent=2, ensure_ascii=False)


def load_categories() -> dict[str, list[str]]:
    if not CATEGORIES_JSON.exists():
        return {}
    with open(CATEGORIES_JSON, encoding="utf-8") as f:
        return json.load(f)


def save_categories(cats: dict[str, list[str]]) -> None:
    with open(CATEGORIES_JSON, "w", encoding="utf-8") as f:
        json.dump(cats, f, indent=2, ensure_ascii=False)
    print(f"  {GN}✓ Saved.{R}")


# ── UI helpers ────────────────────────────────────────────────────────────────

def clear() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def _header(songs: list[dict], cats: dict[str, list[str]]) -> None:
    all_ids  = {s["id"] for s in songs}
    cat_ids  = {sid for ids in cats.values() for sid in ids}
    uncat_n  = len(all_ids - cat_ids)
    print(f"{B}{CY}╔══════════════════════════════════════════╗{R}")
    print(f"{B}{CY}║   Song Category Manager                  ║{R}")
    print(f"{B}{CY}╚══════════════════════════════════════════╝{R}")
    print(
        f"  Songs: {B}{len(songs)}{R}  │  "
        f"Categories: {B}{len(cats)}{R}  │  "
        f"Uncategorized: {YL}{uncat_n}{R}"
    )
    print()


def _ask(prompt: str) -> str:
    return input(f"{CY}▶{R} {prompt}: ").strip()


def _pause() -> None:
    input(f"\n  {DM}Press Enter to continue…{R}")


def _song_categories(song_id: str, cats: dict[str, list[str]]) -> list[str]:
    return sorted(name for name, ids in cats.items() if song_id in ids)


def _fuzzy_find_songs(query: str, songs: list[dict]) -> list[dict]:
    """Substring search, falling back to fuzzy if nothing found."""
    q = query.lower()
    exact = [s for s in songs if q in s["name"].lower() or q in s["id"].lower()]
    if exact:
        return exact[:15]
    ranked = sorted(
        songs,
        key=lambda s: difflib.SequenceMatcher(None, q, s["name"].lower()).ratio(),
        reverse=True,
    )
    return ranked[:12]


def _pick_song(
    songs: list[dict],
    cats: dict[str, list[str]],
    prompt_text: str = "Search song",
) -> dict | None:
    """Interactive search → numbered pick.  Returns None on blank/cancel."""
    while True:
        q = _ask(f"{prompt_text} (partial name, blank = cancel)")
        if not q:
            return None
        results = _fuzzy_find_songs(q, songs)
        if not results:
            print(f"  {RD}No songs found.{R}")
            continue
        print()
        for i, s in enumerate(results, 1):
            scat = _song_categories(s["id"], cats)
            cat_str = f" {DM}[{', '.join(scat)}]{R}" if scat else ""
            aliases  = s.get("aliases", [])
            ali_str  = f" {DM}+{len(aliases)} alias(es){R}" if aliases else ""
            print(f"  {DM}{i:2}.{R} {s['name']}{cat_str}{ali_str}")
        print()
        choice = _ask("Pick number (blank = search again)")
        if not choice:
            continue
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(results):
                return results[idx]
        except ValueError:
            pass
        print(f"  {RD}Invalid.{R}")


def _pick_category(
    cats: dict[str, list[str]],
    prompt_text: str = "Category",
) -> str | None:
    if not cats:
        print(f"  {YL}No categories yet — create one first.{R}")
        return None
    names = sorted(cats)
    print()
    for i, name in enumerate(names, 1):
        print(f"  {DM}{i:2}.{R} {B}{name}{R}  {DM}({len(cats[name])} songs){R}")
    print()
    choice = _ask(f"{prompt_text} (number or name, blank = cancel)")
    if not choice:
        return None
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(names):
            return names[idx]
    except ValueError:
        pass
    for name in cats:
        if name.lower() == choice.lower():
            return name
    print(f"  {RD}Category not found.{R}")
    return None


# ── Menu actions ──────────────────────────────────────────────────────────────

def _act_list_categories(songs: list[dict], cats: dict[str, list[str]]) -> None:
    if not cats:
        print(f"\n  {YL}No categories yet.  Press [n] to create one.{R}")
        _pause()
        return
    song_map = {s["id"]: s for s in songs}
    print(f"\n{B}Categories:{R}\n")
    for name in sorted(cats):
        ids = cats[name]
        print(f"  {B}{CY}{name}{R} — {len(ids)} song(s)")
        for sid in sorted(ids):
            song    = song_map.get(sid)
            display = song["name"] if song else f"{RD}[missing: {sid}]{R}"
            print(f"      {DM}•{R} {display}")
        print()
    _pause()


def _act_show_category(songs: list[dict], cats: dict[str, list[str]]) -> None:
    cat_name = _pick_category(cats, "Show which category")
    if not cat_name:
        return
    ids      = cats[cat_name]
    song_map = {s["id"]: s for s in songs}
    print(f"\n  {B}{CY}{cat_name}{R} — {len(ids)} song(s)\n")
    for sid in sorted(ids):
        song    = song_map.get(sid)
        display = song["name"] if song else f"{RD}[missing: {sid}]{R}"
        print(f"    {DM}•{R} {display}")
    print()
    _pause()


def _act_add_to_category(songs: list[dict], cats: dict[str, list[str]]) -> None:
    # Pick or create category
    cat_options = sorted(cats)
    print(f"\n{B}Add song to category{R}\n")
    if cat_options:
        for i, name in enumerate(cat_options, 1):
            print(f"  {DM}{i:2}.{R} {B}{name}{R}")
        print(f"  {DM} n.{R} {GN}New category{R}")
        print()
    choice = _ask("Category (number, name, or 'n' for new, blank = cancel)")
    if not choice:
        return

    cat_name: str | None = None
    if choice.lower() == "n" or not cat_options:
        cat_name = _ask("New category name")
        if not cat_name:
            return
        if cat_name not in cats:
            cats[cat_name] = []
            print(f"  {GN}Created '{cat_name}'.{R}")
    else:
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(cat_options):
                cat_name = cat_options[idx]
        except ValueError:
            for name in cats:
                if name.lower() == choice.lower():
                    cat_name = name
                    break

    if not cat_name:
        print(f"  {RD}Invalid choice.{R}")
        _pause()
        return

    print(f"\n  Adding songs to: {B}{CY}{cat_name}{R}\n")
    while True:
        song = _pick_song(songs, cats, "Add song")
        if not song:
            break
        sid = song["id"]
        if sid in cats[cat_name]:
            print(f"  {YL}'{song['name']}' is already in '{cat_name}'.{R}")
        else:
            cats[cat_name].append(sid)
            save_categories(cats)
            print(f"  {GN}Added '{song['name']}' → '{cat_name}'.{R}")
        again = _ask("Add another? (y/n)")
        if again.lower() != "y":
            break


def _act_remove_from_category(
    songs: list[dict], cats: dict[str, list[str]]
) -> None:
    cat_name = _pick_category(cats, "Remove from which category")
    if not cat_name:
        return
    ids = cats[cat_name]
    if not ids:
        print(f"  {YL}'{cat_name}' is empty.{R}")
        _pause()
        return

    song_map = {s["id"]: s for s in songs}
    id_list  = sorted(ids)
    print(f"\n  Songs in {B}{CY}{cat_name}{R}:\n")
    for i, sid in enumerate(id_list, 1):
        song    = song_map.get(sid)
        display = song["name"] if song else f"{RD}[missing: {sid}]{R}"
        print(f"  {DM}{i:2}.{R} {display}")
    print()

    choice = _ask("Remove which number (blank = cancel)")
    if not choice:
        return
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(id_list):
            sid  = id_list[idx]
            cats[cat_name].remove(sid)
            save_categories(cats)
            song    = song_map.get(sid)
            display = song["name"] if song else sid
            print(f"  {GN}Removed '{display}' from '{cat_name}'.{R}")
    except (ValueError, IndexError):
        print(f"  {RD}Invalid.{R}")
    _pause()


def _act_new_category(songs: list[dict], cats: dict[str, list[str]]) -> None:
    name = _ask("New category name (blank = cancel)")
    if not name:
        return
    if name in cats:
        print(f"  {YL}Category '{name}' already exists.{R}")
        _pause()
        return
    cats[name] = []
    save_categories(cats)
    print(f"  {GN}Created '{name}'.{R}")
    again = _ask("Add songs now? (y/n)")
    if again.lower() != "y":
        return
    while True:
        song = _pick_song(songs, cats, "Add song")
        if not song:
            break
        sid = song["id"]
        if sid not in cats[name]:
            cats[name].append(sid)
            save_categories(cats)
            print(f"  {GN}Added '{song['name']}' → '{name}'.{R}")
        else:
            print(f"  {YL}Already in '{name}'.{R}")


def _act_rename_category(
    songs: list[dict], cats: dict[str, list[str]]
) -> None:
    cat_name = _pick_category(cats, "Rename which category")
    if not cat_name:
        return
    new_name = _ask(f"New name for '{cat_name}' (blank = cancel)")
    if not new_name:
        return
    if new_name in cats:
        print(f"  {YL}'{new_name}' already exists.{R}")
        _pause()
        return
    cats[new_name] = cats.pop(cat_name)
    save_categories(cats)
    print(f"  {GN}Renamed '{cat_name}' → '{new_name}'.{R}")
    _pause()


def _act_delete_category(
    songs: list[dict], cats: dict[str, list[str]]
) -> None:
    cat_name = _pick_category(cats, "Delete which category")
    if not cat_name:
        return
    confirm = _ask(
        f"Type 'yes' to delete '{cat_name}' ({len(cats[cat_name])} songs inside)"
    )
    if confirm.lower() == "yes":
        del cats[cat_name]
        save_categories(cats)
        print(f"  {GN}Deleted '{cat_name}'.{R}")
    else:
        print("  Cancelled.")
    _pause()


def _act_uncategorized(songs: list[dict], cats: dict[str, list[str]]) -> None:
    cat_ids = {sid for ids in cats.values() for sid in ids}
    uncats  = sorted(
        [s for s in songs if s["id"] not in cat_ids], key=lambda x: x["name"]
    )
    print(f"\n{B}Uncategorized songs ({len(uncats)}):{R}\n")
    if not uncats:
        print(f"  {GN}All songs have at least one category!{R}")
    else:
        for s in uncats:
            print(f"  {DM}•{R} {s['name']}")
    print()
    _pause()


def _act_all_songs(songs: list[dict], cats: dict[str, list[str]]) -> None:
    print(f"\n{B}All songs:{R}\n")
    for s in sorted(songs, key=lambda x: x["name"]):
        scats    = _song_categories(s["id"], cats)
        cat_str  = f" {DM}[{', '.join(scats)}]{R}" if scats else f" {YL}(uncategorized){R}"
        aliases  = s.get("aliases", [])
        ali_str  = f"  {DM}aliases: {', '.join(aliases)}{R}" if aliases else ""
        print(f"  {DM}•{R} {s['name']}{cat_str}{ali_str}")
    print()
    _pause()


# ── Alias management ──────────────────────────────────────────────────────────

def _act_manage_aliases(songs: list[dict], cats: dict[str, list[str]]) -> None:
    """Sub-menu: add/remove/view Whisper-mishear aliases for song names."""
    ALIAS_MENU = [
        ("a", "Add alias to a song"),
        ("r", "Remove alias from a song"),
        ("v", "View all songs with aliases"),
        ("b", "Back"),
    ]
    while True:
        clear()
        print(f"{B}{CY}── Alias Manager ─────────────────────────────{R}\n")
        print(
            "  Aliases let the voice matcher catch Whisper mishears:\n"
            f"  e.g. 'gvx' might be heard as 'give x' → add 'give x' as alias.\n"
        )
        for key, label in ALIAS_MENU:
            print(f"  {B}{CY}[{key}]{R} {label}")
        print()
        choice = _ask("Command").lower()

        if choice == "b":
            return
        elif choice == "a":
            _alias_add(songs, cats)
        elif choice == "r":
            _alias_remove(songs, cats)
        elif choice == "v":
            _alias_view(songs)
        else:
            print(f"  {RD}Unknown.{R}")
            _pause()


def _alias_add(songs: list[dict], cats: dict[str, list[str]]) -> None:
    song = _pick_song(songs, cats, "Add alias to which song")
    if not song:
        return
    # Find the live dict reference in songs list
    idx  = next(i for i, s in enumerate(songs) if s["id"] == song["id"])
    live = songs[idx]

    existing = live.setdefault("aliases", [])
    if existing:
        print(f"\n  Current aliases for '{live['name']}':")
        for a in existing:
            print(f"    {DM}•{R} {a}")
    else:
        print(f"\n  No aliases yet for '{live['name']}'.")

    while True:
        alias = _ask("New alias (blank = done)")
        if not alias:
            break
        if alias in existing:
            print(f"  {YL}Already exists.{R}")
        else:
            existing.append(alias)
            save_songs(songs)
            print(f"  {GN}Added alias '{alias}' → '{live['name']}'.{R}")


def _alias_remove(songs: list[dict], cats: dict[str, list[str]]) -> None:
    song = _pick_song(songs, cats, "Remove alias from which song")
    if not song:
        return
    idx     = next(i for i, s in enumerate(songs) if s["id"] == song["id"])
    live    = songs[idx]
    aliases = live.get("aliases", [])
    if not aliases:
        print(f"  {YL}'{live['name']}' has no aliases.{R}")
        _pause()
        return
    print(f"\n  Aliases for '{live['name']}':\n")
    for i, a in enumerate(aliases, 1):
        print(f"  {DM}{i:2}.{R} {a}")
    print()
    choice = _ask("Remove which number (blank = cancel)")
    if not choice:
        return
    try:
        idx2 = int(choice) - 1
        if 0 <= idx2 < len(aliases):
            removed = aliases.pop(idx2)
            save_songs(songs)
            print(f"  {GN}Removed alias '{removed}'.{R}")
    except (ValueError, IndexError):
        print(f"  {RD}Invalid.{R}")
    _pause()


def _alias_view(songs: list[dict]) -> None:
    with_aliases = [(s["name"], s.get("aliases", [])) for s in songs if s.get("aliases")]
    if not with_aliases:
        print(f"\n  {YL}No song has aliases yet.{R}")
    else:
        print(f"\n{B}Songs with aliases:{R}\n")
        for name, aliases in sorted(with_aliases):
            print(f"  {B}{name}{R}")
            for a in aliases:
                print(f"      {DM}↳{R} {a}")
            print()
    _pause()


# ── Bulk operations ───────────────────────────────────────────────────────────

def _act_bulk_add(songs: list[dict], cats: dict[str, list[str]]) -> None:
    """Add multiple songs to a category at once by typing numbers."""
    cat_name = _pick_category(cats, "Add songs to which category")
    if cat_name is None:
        new = _ask("Create new category instead (blank = cancel)")
        if not new:
            return
        cats[new] = []
        cat_name  = new
        save_categories(cats)
        print(f"  {GN}Created '{cat_name}'.{R}")

    already = set(cats[cat_name])
    eligible = [s for s in sorted(songs, key=lambda x: x["name"])
                if s["id"] not in already]

    if not eligible:
        print(f"  {YL}All songs are already in '{cat_name}'.{R}")
        _pause()
        return

    print(f"\n  {B}Songs not yet in '{cat_name}':{R}\n")
    for i, s in enumerate(eligible, 1):
        scat    = _song_categories(s["id"], cats)
        cat_str = f" {DM}[{', '.join(scat)}]{R}" if scat else ""
        print(f"  {DM}{i:3}.{R} {s['name']}{cat_str}")
    print()
    print(f"  {DM}Enter comma-separated numbers (e.g. 1,3,5) or 'all'{R}")
    choice = _ask("Selection (blank = cancel)")
    if not choice:
        return

    if choice.strip().lower() == "all":
        selected = eligible
    else:
        idxs = []
        for part in re.split(r"[,\s]+", choice):
            try:
                n = int(part.strip()) - 1
                if 0 <= n < len(eligible):
                    idxs.append(n)
            except ValueError:
                pass
        selected = [eligible[i] for i in idxs]

    added = 0
    for s in selected:
        sid = s["id"]
        if sid not in cats[cat_name]:
            cats[cat_name].append(sid)
            added += 1
    if added:
        save_categories(cats)
        print(f"  {GN}Added {added} song(s) to '{cat_name}'.{R}")
    else:
        print(f"  {YL}Nothing added.{R}")
    _pause()


# ── Main ──────────────────────────────────────────────────────────────────────

MENU = [
    ("l",  "List all categories",                _act_list_categories),
    ("s",  "Show songs in a category",           _act_show_category),
    ("a",  "Add song to category",               _act_add_to_category),
    ("b",  "Bulk-add songs to category",         _act_bulk_add),
    ("r",  "Remove song from category",          _act_remove_from_category),
    ("n",  "New category",                       _act_new_category),
    ("e",  "Rename category",                    _act_rename_category),
    ("d",  "Delete category",                    _act_delete_category),
    ("u",  "Show uncategorized songs",           _act_uncategorized),
    ("v",  "View all songs",                     _act_all_songs),
    ("x",  "Manage voice aliases (Whisper)",     _act_manage_aliases),
    ("q",  "Quit",                               None),
]


def main() -> None:
    songs = load_songs()

    while True:
        cats = load_categories()  # reload each loop to pick up saved changes

        clear()
        _header(songs, cats)
        print(f"{B}Menu:{R}\n")
        for key, label, _ in MENU:
            sep = "  " if key != "q" else "\n  "
            print(f"{sep}{B}{CY}[{key}]{R} {label}")
        print()

        choice = _ask("Command").lower()

        for key, label, fn in MENU:
            if choice == key:
                if fn is None:
                    print(f"\n  {GN}Goodbye!{R}\n")
                    return
                clear()
                cats = load_categories()
                _header(songs, cats)
                fn(songs, cats)
                break
        else:
            print(f"  {RD}Unknown command '{choice}'.{R}")
            _pause()


if __name__ == "__main__":
    main()
