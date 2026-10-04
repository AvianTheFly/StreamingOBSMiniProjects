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
from lib.hub_runtime.editor import _start_hotkey_editor


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


def main() -> None:
    args = _parse_args()
    from pathlib import Path
    from lib.single_instance import hub_instance
    with hub_instance(Path(__file__).parent) as acquired:
        if not acquired:
            print('The Hub is already running for this checkout. Open its existing Hub window.')
            return
        _run(args)


def _run(args) -> None:
    import os
    os.environ['HUB_UI_PORT'] = str(args.port)

    print("=" * 62)
    print("  OBS Hub + UI")
    print("=" * 62)

    stop_event = threading.Event()
    from main import run_hub, _join_projects, _wait_for_shutdown
    from lib.runtime_cleanup import run_cleanup
    from lib.global_hotkeys import shutdown_global_hotkeys
    from coordinator import coordinator
    from lib.coordination.scene_events import join_scene_events
    projects = []
    from lib.twitch_stream_settings import service as twitch_settings
    from lib.chat_overlay.startup import startup as chat_overlay_startup
    performance_thread = preparation_thread = ui_thread = browser_timer = None
    chat_reader = None
    try:
        projects = run_hub(stop_event, only=args.only, skip=args.skip, debug=args.debug)
        from lib import twitch_chat
        chat_reader = twitch_chat.start(stop_event)
        twitch_settings.start(stop_event, port=args.port)
        from lib.performance_monitor import start_performance_monitor
        performance_thread = start_performance_monitor(stop_event)
        from lib.asset_preparation import preparation
        preparation_thread = preparation.start(stop_event)

        editor_port = None
        if not args.no_editor:
            editor_port = _start_hotkey_editor(args.editor_port, stop_event)

        from hub_ui.server import HubUIServer
        ui_server = HubUIServer(port=args.port, editor_port=editor_port or args.editor_port)
        ui_thread = threading.Thread(target=ui_server.serve, args=(stop_event,),
                                     daemon=True, name="hub_ui")
        ui_thread.start()
        chat_overlay_startup.start(stop_event, ui_server.ready, port=args.port)

        from lib.twitch_redemptions import start_viewer_rewards
        start_viewer_rewards(stop_event)

        url = f"http://localhost:{args.port}"
        print(f"\n  Hub UI      : {url}")
        if editor_port:
            print(f"  Hotkey Editor: http://localhost:{editor_port}")
        print("  Shutdown    : Ctrl+C\n")

        if not args.no_browser:
            import webbrowser
            browser_timer = threading.Timer(0.8, lambda: webbrowser.open(url))
            browser_timer.start()

        _wait_for_shutdown(stop_event)
    finally:
        print("  Shutting down...")
        stop_event.set()
        def join_thread(thread, timeout):
            if thread is not None and thread.is_alive():
                thread.join(timeout=timeout)
        run_cleanup('hub', lambda: browser_timer.cancel() if browser_timer is not None else None,
                    lambda: _join_projects(projects),
                    lambda: join_thread(ui_thread, 5),
                    lambda: join_thread(performance_thread, 3), shutdown_global_hotkeys)
        run_cleanup('hub', coordinator.shutdown, join_scene_events)
        run_cleanup('hub', lambda: join_thread(preparation_thread, 4))
        run_cleanup('hub', lambda: chat_reader.join() if chat_reader else None)
        run_cleanup('hub', twitch_settings.join)
        run_cleanup('hub', chat_overlay_startup.join)
    print("  Goodbye.")


if __name__ == "__main__":
    main()
