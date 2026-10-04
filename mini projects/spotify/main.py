from __future__ import annotations

import threading

from .service import media_thread, watch_audio
from .presentation_state import PresentationState
from .interface import _live

from .obs_presentation import PORT, SOURCE, SCENE, attach_obs, OBSPresentation


def run(project_queue, stop_event, done_queue=None, startup_event=None):
    state = PresentationState()
    _live['state'] = state
    workers = [threading.Thread(target=media_thread, args=(state, stop_event), daemon=True, name='spotify-media'),
               threading.Thread(target=watch_audio, args=(state, stop_event),
                                daemon=True, name='spotify-spectrum')]
    try:
        for worker in workers:
            worker.start()
        presentation = OBSPresentation()
        try:
            presentation.sync(state)
        except Exception as exc:
            print(f'[spotify] OBS attachment will retry: {exc}')
        if startup_event:
            startup_event.set()
        while not stop_event.wait(5):
            try:
                presentation.sync(state)
            except Exception:
                pass
    finally:
        state.set_media(playing=False, title='', artist='', error='Hub stopped')
        for worker in workers:
            worker.join(3)
        _live.clear()
