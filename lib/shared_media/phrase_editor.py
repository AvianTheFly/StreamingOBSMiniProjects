from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
# lib/shared_media/ → lib/ → Streaming Scripts v2/
_HUB_ROOT = SCRIPT_DIR.parent.parent
MINI_PROJECTS_ROOT = _HUB_ROOT / "mini projects"

# Make the hub root importable (for lib.shared_media, obs, etc.)
if str(_HUB_ROOT) not in sys.path:
    sys.path.insert(0, str(_HUB_ROOT))

# Make mini-project packages importable (tik_tok, sound_effects, etc.)
if str(MINI_PROJECTS_ROOT) not in sys.path:
    sys.path.insert(0, str(MINI_PROJECTS_ROOT))

from lib.paths import MINI_PROJECTS_DIR, ensure_import_paths, load_project_env

ensure_import_paths()
load_project_env()
MINI_PROJECTS_ROOT = MINI_PROJECTS_DIR


def list_projects(root: Path) -> list[Path]:
    projects: list[Path] = []
    if not root.is_dir():
        return projects

    for p in root.iterdir():
        if not p.is_dir():
            continue
        if p.name.startswith("__"):
            continue
        if (p / "config.py").is_file():
            projects.append(p)

    return sorted(projects, key=lambda x: x.name.lower())


def load_json_file(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {
            "_comment": (
                "Keys are canonical asset file stems (no extension). "
                "Values are alternate phrases that should trigger that asset."
            )
        }

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except Exception as exc:
        print(f"[phrase_editor] Could not read {path}: {exc}")

    return {
        "_comment": (
            "Keys are canonical asset file stems (no extension). "
            "Values are alternate phrases that should trigger that asset."
        )
    }


def save_json_file(path: Path, data: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def get_asset_stems(asset_dir: Path, valid_extensions: set[str]) -> list[str]:
    if not asset_dir.is_dir():
        return []

    stems: list[str] = []
    for p in asset_dir.iterdir():
        if p.is_file() and p.suffix.lower() in valid_extensions:
            stems.append(p.stem)

    return sorted(stems, key=str.lower)


def ensure_phrase_list(data: dict[str, Any], stem: str) -> list[str]:
    existing = data.get(stem)
    if not isinstance(existing, list):
        existing = []
        data[stem] = existing
    return existing


def normalize_unique(items: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    for item in items:
        s = item.strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)

    return out


def choose_from_list(title: str, items: list[str]) -> str | None:
    if not items:
        return None

    print(f"\n{title}")
    for i, item in enumerate(items, start=1):
        print(f"  {i}. {item}")

    raw = input("\nChoose number (or blank to cancel): ").strip()
    if not raw:
        return None

    try:
        idx = int(raw)
    except ValueError:
        return None

    if 1 <= idx <= len(items):
        return items[idx - 1]

    return None


def edit_project(project_dir: Path) -> None:
    import importlib.util

    config_path = project_dir / "config.py"
    if not config_path.is_file():
        print("[phrase_editor] config.py not found.")
        return

    module_name = f"_phrase_editor_config_{project_dir.name}"
    spec = importlib.util.spec_from_file_location(module_name, config_path)
    if spec is None or spec.loader is None:
        print("[phrase_editor] Could not load config.py")
        return

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    if not hasattr(module, "CONFIG"):
        print("[phrase_editor] CONFIG not found in config.py")
        return

    cfg = module.CONFIG
    phrases_file: Path = cfg.phrases_file
    asset_dir: Path = cfg.asset_dir
    valid_extensions: set[str] = cfg.valid_extensions

    print(f"\nProject: {project_dir.name}")
    print(f"Assets: {asset_dir}")
    print(f"Phrases file: {phrases_file}")

    data = load_json_file(phrases_file)
    stems = get_asset_stems(asset_dir, valid_extensions)

    if not stems:
        print("[phrase_editor] No assets found.")
        return

    while True:
        print("\nOptions")
        print("  1. List assets")
        print("  2. Edit phrases for an asset")
        print("  3. Show current phrases.json")
        print("  4. Save")
        print("  5. Save and exit")
        print("  6. Exit without saving")

        choice = input("\nChoose: ").strip()

        if choice == "1":
            print("\nAssets")
            for stem in stems:
                phrases = data.get(stem, [])
                count = len(phrases) if isinstance(phrases, list) else 0
                print(f"  - {stem} ({count} phrase{'s' if count != 1 else ''})")

        elif choice == "2":
            stem = choose_from_list("Assets", stems)
            if not stem:
                continue

            phrase_list = ensure_phrase_list(data, stem)
            phrase_list[:] = normalize_unique(phrase_list)

            while True:
                print(f"\nEditing: {stem}")
                if phrase_list:
                    for i, phrase in enumerate(phrase_list, start=1):
                        print(f"  {i}. {phrase}")
                else:
                    print("  (no phrases yet)")

                print("\n  a. Add phrase")
                print("  r. Remove phrase")
                print("  b. Back")

                sub = input("\nChoose: ").strip().lower()

                if sub == "a":
                    new_phrase = input("Enter phrase: ").strip()
                    if new_phrase:
                        phrase_list.append(new_phrase)
                        phrase_list[:] = normalize_unique(phrase_list)

                elif sub == "r":
                    if not phrase_list:
                        continue
                    raw = input("Enter number to remove: ").strip()
                    try:
                        idx = int(raw)
                        if 1 <= idx <= len(phrase_list):
                            del phrase_list[idx - 1]
                    except ValueError:
                        pass

                elif sub == "b":
                    break

        elif choice == "3":
            print()
            print(json.dumps(data, indent=2, ensure_ascii=False))

        elif choice == "4":
            save_json_file(phrases_file, data)
            print(f"[phrase_editor] Saved: {phrases_file}")

        elif choice == "5":
            save_json_file(phrases_file, data)
            print(f"[phrase_editor] Saved: {phrases_file}")
            return

        elif choice == "6":
            return


def main() -> None:
    projects = list_projects(MINI_PROJECTS_ROOT)
    if not projects:
        print(f"[phrase_editor] No projects found in: {MINI_PROJECTS_ROOT}")
        return

    selected = choose_from_list(
        "Mini projects",
        [p.name for p in projects],
    )
    if not selected:
        return

    project_dir = MINI_PROJECTS_ROOT / selected
    edit_project(project_dir)


if __name__ == "__main__":
    main()
