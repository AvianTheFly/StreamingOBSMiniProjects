"""Start the existing hotkey editor for supported discovered project metadata."""
import threading

def _start_hotkey_editor(port: int, stop_event: threading.Event) -> int | None:
    """Start the hotkey editor server in a background thread. Returns the port used, or None."""
    try:
        from lib.project_registry import discover_editor_projects
        from lib.hotkey_editor.server import run_editor, _find_free_port

        projects = discover_editor_projects()
        available = [
            (key, p) for key, p in projects.items()
            if not p.error and p.asset_dir and p.hotkeys_file and p.extensions
        ]
        if not available:
            print("  [editor] No editor-compatible projects found — skipping editor server.")
            return None

        _, primary = available[0]

        def _payload(key, p):
            return {
                "key": key, "name": p.display,
                "asset_dir": p.asset_dir, "hotkeys_file": p.hotkeys_file,
                "phrases_file": p.phrases_file, "extensions": p.extensions,
                "config_defaults": p.config_defaults or {},
                "features": p.features or {},
                "profile_store_file": p.profile_store_file,
                "can_create_profiles": p.can_create_profiles,
            }

        actual_port = _find_free_port(port)

        def _run():
            try:
                run_editor(
                    asset_dir=primary.asset_dir,
                    hotkeys_file=primary.hotkeys_file,
                    valid_extensions=primary.extensions,
                    project_name=primary.display,
                    port=actual_port,
                    all_projects=[_payload(k, p) for k, p in available],
                    open_browser=False,
                    stop_event=stop_event,
                )
            except Exception as exc:
                print(f"  [editor] Server error: {exc}")

        t = threading.Thread(target=_run, daemon=True, name="hotkey_editor")
        t.start()
        return actual_port

    except Exception as exc:
        print(f"  [editor] Could not start hotkey editor: {exc}")
        return None

