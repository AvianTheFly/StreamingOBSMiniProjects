from __future__ import annotations

import sys

from lib.paths import ensure_import_paths, load_project_env
from lib.project_registry import EditorProject, discover_editor_projects


def _parse_project_arg(argv: list[str]) -> str | None:
    if not argv:
        return None
    if len(argv) > 1:
        print(f"\n  Too many arguments: {' '.join(argv)}\n")
        sys.exit(1)
    arg = argv[0]
    if arg.startswith("-"):
        print(f"\n  Unknown option: {arg}\n")
        sys.exit(1)
    return arg.lower().replace("-", "_")


def _available(projects: dict[str, EditorProject]) -> list[tuple[str, EditorProject]]:
    return [
        (key, project)
        for key, project in projects.items()
        if not project.error
        and project.asset_dir is not None
        and project.hotkeys_file is not None
        and project.extensions is not None
    ]


def _print_projects(projects: dict[str, EditorProject]) -> list[tuple[str, EditorProject]]:
    available = _available(projects)
    broken = [(key, project) for key, project in projects.items() if project.error]
    print()
    print("  Hotkey Editor")
    print()
    for index, (key, project) in enumerate(available, 1):
        print(f"  [{index}]  {project.display:<24} {key}")
    if broken:
        print()
        for _key, project in broken:
            print(f"  [!]  {project.display:<24} ERROR: {project.error}")
    print()
    return available


def _editor_project_payload(key: str, project: EditorProject) -> dict:
    assert project.asset_dir is not None
    assert project.hotkeys_file is not None
    assert project.extensions is not None
    return {
        "key": key,
        "name": project.display,
        "asset_dir": project.asset_dir,
        "hotkeys_file": project.hotkeys_file,
        "phrases_file": project.phrases_file,
        "extensions": project.extensions,
        "config_defaults": project.config_defaults or {},
        "features": project.features or {},
        "profile_store_file": project.profile_store_file,
        "can_create_profiles": project.can_create_profiles,
    }


def main() -> None:
    ensure_import_paths()
    load_project_env()

    project_arg = _parse_project_arg(sys.argv[1:])
    projects = discover_editor_projects()
    available = _print_projects(projects)

    if not available:
        print("  No editor-compatible projects available. Check config.py and .env.\n")
        sys.exit(1)

    if project_arg:
        key = project_arg
    elif len(available) == 1:
        key, _ = available[0]
        print(f"  Auto-selecting: {available[0][1].display}\n")
    else:
        key, _ = available[0]
        print(f"  Opening '{available[0][1].display}'. Switch projects via the UI selector.\n")

    project = projects.get(key)
    if project is None:
        names = ", ".join(sorted(projects))
        print(f"\n  Unknown project: {key!r}\n  Available: {names}\n")
        sys.exit(1)
    if project.error:
        print(f"\n  Could not load '{project.display}': {project.error}\n")
        sys.exit(1)
    if project.asset_dir is None or project.hotkeys_file is None or project.extensions is None:
        print(f"\n  Project '{project.display}' is missing editor settings in config.py.\n")
        sys.exit(1)

    from lib.hotkey_editor import run_editor

    run_editor(
        asset_dir=project.asset_dir,
        hotkeys_file=project.hotkeys_file,
        valid_extensions=project.extensions,
        project_name=project.display,
        all_projects=[
            _editor_project_payload(project_key, editor_project)
            for project_key, editor_project in _available(projects)
        ],
    )


if __name__ == "__main__":
    main()
