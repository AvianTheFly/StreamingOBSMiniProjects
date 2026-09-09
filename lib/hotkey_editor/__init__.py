# lib/hotkey_editor/__init__.py
#
# Browser-based hotkey assignment tool for any media mini-project.
#
# Usage — in each project's hotkey_editor.py launcher:
#
#   from lib.hotkey_editor import run_editor
#   from myproject.config import ASSET_DIR, HOTKEYS_FILE, CONFIG
#
#   if __name__ == "__main__":
#       run_editor(
#           asset_dir        = ASSET_DIR,
#           hotkeys_file     = HOTKEYS_FILE,
#           valid_extensions = CONFIG.valid_extensions,
#           project_name     = "My Project",
#       )

def __getattr__(name):
    # Importing form metadata must not pull in OBS, media or HTTP dependencies.
    # Existing `from lib.hotkey_editor import run_editor` callers keep the same API.
    if name == "run_editor":
        from .server import run_editor
        globals()[name] = run_editor
        return run_editor
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["run_editor"]
