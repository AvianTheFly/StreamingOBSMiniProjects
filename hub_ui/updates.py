"""Bounded browser event queues and periodic status/audio reconciliation.

This is an adapter for events.py, not a second application event bus. Importing
it does not start the poller or subscribe to domain events.
"""
from __future__ import annotations

import json
import queue
import threading
import time
from contextlib import contextmanager
from . import audio as audio_service
from . import project_status

_sse_clients: list[queue.Queue] = []
_sse_lock = threading.Lock()

DOMAIN_EVENTS = (
    "coordinator.project_paused", "coordinator.play_cleared",
    "coordinator.project_resumed", "game.connected", "game.disconnected", "sfx.play",
)


@contextmanager
def forward_domain_events():
    """Forward domain events only for the lifetime of the UI server."""
    import events
    handlers = {}
    try:
        for event_name in DOMAIN_EVENTS:
            def forward(data, name=event_name):
                broadcast("hub_event", {"event": name, "data": data})
            events.subscribe(event_name, forward)
            handlers[event_name] = forward
        yield
    finally:
        for event_name, callback in handlers.items():
            events.unsubscribe(event_name, callback)


@contextmanager
def subscription():
    """One bounded queue per browser; slow clients never block producers."""
    inbox = queue.Queue(maxsize=200)
    with _sse_lock:
        _sse_clients.append(inbox)
    try:
        yield inbox
    finally:
        with _sse_lock:
            _sse_clients.remove(inbox)

def broadcast(event_type: str, payload: dict) -> None:
    if event_type in {'hub_action', 'project_action', 'rules_updated', 'settings_updated'}:
        import events
        events.inspect_event(event_type, owner='hub', phase='accepted' if payload.get('result',{}).get('ok',True) else 'failed', **payload)
    with _sse_lock:
        if not _sse_clients:
            return
        msg = f"data: {json.dumps({'type': event_type, 'payload': payload})}\n\n"
        encoded = msg.encode("utf-8")
        for q in list(_sse_clients):
            try:
                q.put_nowait(encoded)
            except queue.Full:
                pass


def poll_loop(stop: threading.Event) -> None:
    while not stop.is_set():
        try:
            # Remember module fader edits even when the Audio page is closed.
            # UI writes and this pass share the audio settings transaction lock.
            changed = audio_service.sync_audio_memory_from_obs()
            for project in changed:
                broadcast("audio_updated", {"project": project})
            with _sse_lock:
                has_clients = bool(_sse_clients)
            from .workflow_map import journal, sample
            if has_clients or journal.recording:
                statuses = project_status.all_statuses()
                if journal.recording: sample(statuses)
                if has_clients: broadcast("status_update", {"projects": statuses})
        except Exception:
            pass
        stop.wait(2.0)


def stream(handler):
    handler.send_response(200)
    handler.send_header("Content-Type", "text/event-stream; charset=utf-8")
    handler.send_header("Cache-Control", "no-cache")
    handler.send_header("X-Accel-Buffering", "no")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()

    stop = getattr(handler.server, "stop_event", None)
    with subscription() as inbox:
        init = json.dumps({
            "type": "status_update",
            "payload": {"projects": project_status.all_statuses()},
        })
        try:
            handler.wfile.write(f"data: {init}\n\n".encode("utf-8"))
            handler.wfile.flush()
            last_ping = time.monotonic()
            while stop is None or not stop.is_set():
                try:
                    data = inbox.get(timeout=1)
                except queue.Empty:
                    if time.monotonic() - last_ping < 15:
                        continue
                    data = b": ping\n\n"
                    last_ping = time.monotonic()
                handler.wfile.write(data)
                handler.wfile.flush()
        except (OSError, ValueError):
            # Browser disconnected; the subscription context releases its queue.
            pass
