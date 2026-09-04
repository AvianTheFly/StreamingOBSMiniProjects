from __future__ import annotations

import importlib.util
import shutil
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from lib.paths import ENV_FILE, MINI_PROJECTS_DIR, ensure_import_paths, load_project_env
from lib.project_registry import discover_editor_projects, discover_runnable_projects


REQUIRED_PACKAGES = [
    "dotenv",
    "numpy",
    "pynput",
    "sounddevice",
    "faster_whisper",
    "rapidfuzz",
    "obsws_python",
    "pydub",
    "requests",
]

OPTIONAL_PACKAGES = ["psutil"]

REQUIRED_COMMANDS = ["ffmpeg", "ffprobe"]

EXPECTED_RUNTIME_PROJECTS = {
    "instant_replay",
    "league",
    "love_me",
    "scene_voice_switcher",
    "sound_effects",
    "soundboard",
    "specific_song",
    "tik_tok",
}


def _package_status(name: str) -> str:
    return "OK" if importlib.util.find_spec(name) else "missing"


def main() -> int:
    ensure_import_paths()
    load_project_env()

    print("Streaming Scripts Doctor")
    print("=" * 32)
    print(f"Root          : {PROJECT_ROOT}")
    print(f"Mini projects : {MINI_PROJECTS_DIR} ({'OK' if MINI_PROJECTS_DIR.is_dir() else 'missing'})")
    print(f".env          : {ENV_FILE} ({'OK' if ENV_FILE.is_file() else 'missing'})")
    print()

    print("External Commands")
    missing_commands = []
    for command in REQUIRED_COMMANDS:
        status = "OK" if shutil.which(command) else "missing"
        print(f"  {command:<16} {status}")
        if status != "OK":
            missing_commands.append(command)
    print()

    print("Python Packages")
    missing_packages = []
    for package in REQUIRED_PACKAGES:
        status = _package_status(package)
        print(f"  {package:<16} {status}")
        if status != "OK":
            missing_packages.append(package)
    for package in OPTIONAL_PACKAGES:
        status = _package_status(package)
        suffix = " (optional)" if status != "OK" else ""
        print(f"  {package:<16} {status}{suffix}")
    print()

    runnable = discover_runnable_projects()
    print(f"Runnable Projects ({len(runnable)})")
    for project in runnable:
        print(f"  - {project.name}")
    discovered_names = {project.name for project in runnable}
    missing_projects = EXPECTED_RUNTIME_PROJECTS - discovered_names
    unexpected_projects = discovered_names - EXPECTED_RUNTIME_PROJECTS
    print()

    editor_projects = discover_editor_projects()
    print(f"Hotkey Editor Projects ({len(editor_projects)})")
    for key, project in editor_projects.items():
        status = f"ERROR: {project.error}" if project.error else "OK"
        print(f"  - {key:<16} {status}")

    editor_errors = {
        key: project.error
        for key, project in editor_projects.items()
        if project.error
    }
    problems = []
    if missing_packages:
        problems.append(f"missing packages: {', '.join(missing_packages)}")
    if missing_commands:
        problems.append(f"missing commands: {', '.join(missing_commands)}")
    if missing_projects:
        problems.append(f"missing projects: {', '.join(sorted(missing_projects))}")
    if unexpected_projects:
        problems.append(f"unexpected projects: {', '.join(sorted(unexpected_projects))}")
    if editor_errors:
        problems.append(f"editor errors: {', '.join(sorted(editor_errors))}")

    print()
    if problems:
        print("RESULT: FAILED")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    print("RESULT: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
