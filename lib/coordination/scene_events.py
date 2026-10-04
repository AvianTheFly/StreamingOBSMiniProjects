"""Hub-owned OBS scene event subscription with reconnect and bounded shutdown."""
import threading

from .scenes import scene_director

_thread = None
_start_lock = threading.Lock()

def join_scene_events(timeout=5):
    thread = _thread
    if thread is not None and thread.is_alive():
        thread.join(timeout=timeout)


def start_scene_events(stop_event):
    def run():
        import obsws_python
        from obs.obs_config import OBS_HOST, OBS_PORT, OBS_PASSWORD
        while not stop_event.is_set():
            client = None
            try:
                client = obsws_python.EventClient(host=OBS_HOST, port=OBS_PORT,
                                                 password=OBS_PASSWORD, timeout=3, subs=4)
                def on_current_program_scene_changed(data):
                    scene_director.observe(data.scene_name)
                client.callback.register(on_current_program_scene_changed)
                scene_director.observing(True)
                scene_director.refresh_observation()
                while client.worker.is_alive() and not stop_event.wait(.5):
                    pass
            except Exception as exc:
                if not stop_event.is_set():
                    print(f'[coordination] Scene events unavailable: {exc}')
            finally:
                scene_director.observing(False, disconnected=not stop_event.is_set())
                if client is not None:
                    try:
                        client.base_client.ws.close()
                    finally:
                        client.worker.join(timeout=2)
            if stop_event.wait(3):
                return
    global _thread
    with _start_lock:
        if _thread is None or not _thread.is_alive():
            _thread = threading.Thread(target=run, name='obs-scene-events', daemon=True)
            _thread.start()
        return _thread
