"""Hub assembly: one keyboard subscription, bounded intents, owned cleanup."""
import queue
from pathlib import Path
from lib.global_hotkeys import key_token, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from lib.runtime_cleanup import run_cleanup
from lib.browser_effects.presentations import register, unregister
from .hotkeys import MoodHotkeys
from .config import LISTENER_HOTKEY, LISTENER_SECONDS
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
    hotkeys=MoodHotkeys(stop_event)
    def reload():
        rows=store.snapshot()['variations']
        hotkeys.reload(rows)
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
        identity=hotkeys.press(key_token(key))
        if identity is not None:
            enqueue(identity)
    token=kb_token=None
    _live.update(service=service,store=store,reload=reload,trigger=enqueue,player=legacy,hotkeys=hotkeys)
    try:
        try:
            reload()
        except ValueError as exc:
            hotkeys.reload([])
            print(f'[love_me] Variations need repair; 987 then 1 still selects original Love Me: {exc}',flush=True)
        web=Path(__file__).parent/'web'
        files={name:web/name for name in ('overlay.html','playback.js','timeline.js','art.js','renderer.js','signal.js','montage.js','type-ink.js','preview.html','preview.js')}
        files.update(browser_files())
        token=register('love_me',files)
        legacy.hide_all_sources()
        kb_token=subscribe_global_hotkeys(on_press)
        print(f'[love_me] Mood cues ready: {LISTENER_HOTKEY} opens the {LISTENER_SECONDS:g}s hotkey listener; 1 = Love Me, 2 = Where Have You Been. Keys editable in Hub.',flush=True)
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
            elif cmd==LISTENER_HOTKEY:
                hotkeys.open()
    finally:
        run_cleanup('love_me',lambda:unsubscribe_global_hotkeys(kb_token) if kb_token is not None else None, hotkeys.close,
                    service.close,lambda:unregister('love_me',token) if token is not None else None)
        if _live.get('service') is service:
            _live.clear()
