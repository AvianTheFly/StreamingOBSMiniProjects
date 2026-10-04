"""One serial playback owner for original stages and authored mood variations."""
import threading
import time
from coordinator import coordinator
from lib.shared_media.playback_worker import PlaybackWorker
from lib.project_runtime import project_registry
from .presentation import MoodPresentation


class MoodService:
    def __init__(self, legacy, store, stop, *, coordination=coordinator, presentation=None):
        self.legacy, self.store, self.stop_event = legacy, store, stop
        self.coordinator = coordination
        self.presentation = presentation or MoodPresentation(store)
        self.worker = PlaybackWorker('love_me:presentations')
        self.lock = threading.RLock()
        self.generation = 0
        self.active = None
        self.ticket = None
        self.done = None
        self.last_legacy = 0
        self.paused = False
        self.error = None
        self.iteration = 0
        self.records = []

    def snapshot(self):
        with self.lock:
            return dict(active=self.active, busy=self.active is not None, paused=self.paused,
                        iteration=self.iteration, error=self.error)

    def trigger(self, identity, *, toggle=True):
        row = None if identity=='original' else self.store.get(identity)
        with self.lock:
            if self.stop_event.is_set():
                return False
            if identity!='original' and toggle and self.active==identity:
                self.cancel()
                return True
            if identity=='original':
                now = time.monotonic()
                with self.legacy.lock:
                    index = self.legacy.current_index
                    if self.active=='original' and now-self.last_legacy<15:
                        if index==len(self.legacy.items)-1:
                            self.cancel()
                            self.legacy.current_index=0
                            return True
                        index += 1
                    elif now-self.last_legacy>=15 or index>=len(self.legacy.items):
                        index=0
                self.last_legacy=now
            else:
                index=None
            self.generation += 1
            generation=self.generation
            self.active=identity
            self.error=None
            self.iteration=0
            self.worker.cancel()
        def admitted(ticket):
            with self.lock:
                if generation!=self.generation or self.stop_event.is_set():
                    return False
                def run(cancel):
                    started.set()
                    cancelled=lambda: cancel.is_set() or ticket.cancelled.is_set() or self.stop_event.is_set()
                    try:
                        if not ticket.wait_until_allowed(cancelled):
                            return
                        if row is None:
                            with self.legacy.lock:
                                self.legacy.current_index=index
                            self.legacy.play_next_item(cancelled=cancel, allowed=ticket.allowed.is_set,
                                                       cancelled_check=cancelled)
                        else:
                            count=1 if row['mode']=='once' else int(row['repeats'])
                            iteration=0
                            while not cancelled():
                                if not ticket.wait_until_allowed(cancelled):
                                    break
                                iteration += 1
                                with self.lock:
                                    if generation==self.generation:
                                        self.iteration=iteration
                                self.presentation.play(row, cancelled, ticket.allowed.is_set)
                                if row['mode']!='continuous' and iteration>=count:
                                    break
                    except Exception as exc:
                        with self.lock:
                            if generation==self.generation:
                                self.error=str(exc)
                        print(f'[love_me] {exc}', flush=True)
                    finally:
                        ticket.finish()
                        with self.lock:
                            if generation==self.generation:
                                self.active=None
                started=threading.Event()
                self.done=self.worker.submit(run)
                self.records=[record for record in self.records if not record[1].is_set()]
                self.records.append((ticket,self.done,started))
            return True
        pauses=[i.name for i in project_registry.all() if i.produces_audio and i.name!='love_me']
        ticket=self.coordinator.request('love_me',admitted,pause=pauses)
        with self.lock:
            if generation==self.generation:
                self.ticket=ticket
            else:
                ticket.cancelled.set()
        return True

    def cancel(self):
        with self.lock:
            self.generation += 1
            self.active=None
            if self.ticket:
                self.ticket.cancelled.set()
            self.worker.cancel()
            for ticket,done,started in self.records:
                if done.is_set() and not started.is_set():
                    ticket.finish()

    def pause(self, paused):
        with self.lock:
            self.paused=paused
        self.presentation.pause(paused)

    def close(self):
        self.cancel()
        deadline=time.monotonic()+8
        for _,done,_ in self.records:
            if not done.wait(max(0,deadline-time.monotonic())):
                print('[love_me] Playback cleanup still pending at shutdown.', flush=True)
                return
        self.presentation.capture_fader()
        self.presentation.stop()
        self.legacy.abort()
