"""
hub.py
======
Unified entry point: starts mini-project threads AND the browser-based Hub UI.

Usage
-----
    python hub.py [--debug] [--only PROJECT...] [--skip PROJECT...] [--port PORT] [--no-browser]

The Hub UI is served at http://localhost:<port> (default 7420).
Ctrl+C shuts down both the hub and the UI server.

main.py uses the same module runner without the browser UI.
"""
from __future__ import annotations

import argparse
import threading


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OBS Hub + Browser UI")
    parser.add_argument("--debug", action="store_true", help="Enable DEBUG logging")
    parser.add_argument("--only", nargs="+", metavar="PROJECT", help="Run only these projects")
    parser.add_argument("--skip", nargs="+", metavar="PROJECT", help="Skip these projects")
    parser.add_argument("--port", type=int, default=7420, help="Hub UI port (default: 7420)")
    parser.add_argument("--editor-port", type=int, default=8765, help="Hotkey editor port (default: 8765)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser automatically")
    parser.add_argument("--no-editor", action="store_true", help="Don't start the hotkey editor server")
    return parser.parse_args()


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


def main() -> None:
    args = _parse_args()

    print("=" * 62)
    print("  OBS Hub + UI")
    print("=" * 62)

    stop_event = threading.Event()
    # ── Start mini-project threads ─────────────────────────────────────────────
    from main import run_hub, _join_projects, _wait_for_shutdown
    projects = run_hub(
        stop_event,
        only=args.only,
        skip=args.skip,
        debug=args.debug,
    )
    from lib.performance_monitor import start_performance_monitor
    start_performance_monitor(stop_event)

    # ── Start Hotkey Editor server ─────────────────────────────────────────────
    editor_port = None
    if not args.no_editor:
        editor_port = _start_hotkey_editor(args.editor_port, stop_event)

    # ── Start Hub UI server ────────────────────────────────────────────────────
    from hub_ui.server import HubUIServer
    ui_server = HubUIServer(port=args.port, editor_port=editor_port or args.editor_port)
    ui_thread = threading.Thread(
        target=ui_server.serve,
        args=(stop_event,),
        daemon=True,
        name="hub_ui",
    )
    ui_thread.start()

    # Narrow, opt-in Channel Points effects, separate from personalized media.
    from lib.twitch_redemptions import start_viewer_rewards
    start_viewer_rewards(stop_event)

    url = f"http://localhost:{args.port}"
    print(f"\n  Hub UI      : {url}")
    if editor_port:
        print(f"  Hotkey Editor: http://localhost:{editor_port}")
    print("  Shutdown    : Ctrl+C\n")

    if not args.no_browser:
        import webbrowser
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    # ── Wait for shutdown ──────────────────────────────────────────────────────
    _wait_for_shutdown(stop_event)

    print("  Shutting down...")
    stop_event.set()
    _join_projects(projects)
    print("  Goodbye.")


if __name__ == "__main__":
    main()
