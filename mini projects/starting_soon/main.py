"""Feature assembly; all workers and providers belong to the Hub lifetime."""
import queue
from .service import StartingSoon
from .interface import register


def run(input_queue, stop_event, *, startup_event=None):
    import os
    service = StartingSoon(input_queue, int(os.environ.get('HUB_UI_PORT', '7420')))
    register(service)
    try:
        if startup_event:
            startup_event.set()
        while not stop_event.is_set():
            try:
                action, body = input_queue.get(timeout=.25)
            except queue.Empty:
                action, body = None, {}
            try:
                if action:
                    service.execute(action, body)
                service.tick()
            except Exception as exc:
                service.publish(error=str(exc))
    finally:
        try:
            service.close()
        finally:
            register(None)
