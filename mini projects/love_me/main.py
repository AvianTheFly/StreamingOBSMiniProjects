"""Hub assembly: one keyboard subscription, bounded intents, owned cleanup."""
import queue
import threading
from pathlib import Path
from lib.global_hotkeys import key_char, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from lib.runtime_cleanup import run_cleanup
from lib.browser_effects.presentations import register, unregister
from .trigger import SequenceTrigger
from .config import TRIGGER_MAX_INTERVAL
from .player import SequentialPlayer
from .settings import VariationStore
from .service import MoodService
from .assets import browser_files


def run(input_queue, stop_event, done_queue=None, startup_event=None):
    from .interface import _live
    legacy=SequentialPlayer()
    store=VariationStore()
    service=MoodService(legacy,store,stop_event)
    inbox=queue.Queue(maxsize=1)
    triggers=[]
    trigger_lock=threading.Lock()
    def reload():
        rows=store.snapshot()['variations']
        replacement=[('original', SequenceTrigger(list('987'),TRIGGER_MAX_INTERVAL))]
        replacement.extend((row['id'],SequenceTrigger(list(row['hotkey']),TRIGGER_MAX_INTERVAL)) for row in rows if row['hotkey'])
        with trigger_lock:
            triggers[:]=replacement
    def enqueue(identity):
        if stop_event.is_set():
            return
        try:
            inbox.put_nowait(identity)
        except queue.Full:
            try: inbox.get_nowait()
            except queue.Empty: pass
            try: inbox.put_nowait(identity)
            except queue.Full: pass
    def on_press(key):
        char=key_char(key)
        if char is None or stop_event.is_set():
            return
        with trigger_lock:
            matches=[identity for identity,trigger in triggers if trigger.register_key(char)]
        for identity in matches:
            enqueue(identity)
    token=kb_token=None
    _live.update(service=service,store=store,reload=reload,trigger=enqueue,player=legacy)
    try:
        try:
            reload()
        except ValueError as exc:
            triggers[:]=[('original', SequenceTrigger(list('987'),TRIGGER_MAX_INTERVAL))]
            print(f'[love_me] Variations need repair; original 987 remains ready: {exc}',flush=True)
        web=Path(__file__).parent/'web'
        files={name:web/name for name in ('overlay.html','playback.js','timeline.js','art.js','renderer.js','signal.js','montage.js','type-ink.js','preview.html','preview.js')}
        files.update(browser_files())
        token=register('love_me',files)
        legacy.hide_all_sources()
        kb_token=subscribe_global_hotkeys(on_press)
        print('[love_me] Mood cues ready: original 987; variations editable in Hub.',flush=True)
        if startup_event is not None:
            startup_event.set()
        while not stop_event.is_set():
            try:
                identity=inbox.get_nowait()
                service.trigger(identity)
            except queue.Empty:
                pass
            try:
                message=input_queue.get(timeout=.05)
            except queue.Empty:
                continue
            cmd=str(message.get('name','') if isinstance(message,dict) else message).strip().lower()
            if cmd in {'abort','stop'}:
                service.cancel()
            elif cmd=='987':
                enqueue('original')
    finally:
        run_cleanup('love_me',lambda:unsubscribe_global_hotkeys(kb_token) if kb_token is not None else None,
                    service.close,lambda:unregister('love_me',token) if token is not None else None)
        if _live.get('service') is service:
            _live.clear()
