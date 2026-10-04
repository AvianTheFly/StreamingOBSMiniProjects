"""Serialize cross-project pauses and give each playback request its own ticket."""
import threading

from lib.project_runtime import project_registry
from .pauses import PauseLedger, PauseClaim
from .rules import CoordinationRule
from .serial_actions import SerialActions


class PlaybackTicket:
    def __init__(self, coordinator, requester):
        self.requester = requester
        self.cancelled = threading.Event()
        self.ready = threading.Event()
        self.done = threading.Event()
        self.allowed = threading.Event()
        self.error = None
        self._coordinator = coordinator

    def finish(self):
        """Release only this request; safe from callbacks holding player locks."""
        return self._coordinator.finish(self)

    def wait_until_allowed(self, cancelled=lambda: False):
        """Source workers wait here when a newer request or scene handoff pauses them."""
        while not self.cancelled.is_set() and not cancelled():
            if self.allowed.wait(.05):
                return True
        return False


class PlayCoordinator:
    def __init__(self, registry=project_registry):
        self.registry = registry
        self._rules = []
        self._lock = threading.Lock()
        self._actions = SerialActions('hub-coordination')
        self._pauses = PauseLedger(registry)
        self._latest = {}
        self._pending = {}
        self._scheduled = set()
        self._held = {}
        self._stop = threading.Event()
        self._sequence = 0
        self._permissions = {}

    def bind(self, stop_event):
        self._stop = stop_event

    def add_rule(self, rule):
        with self._lock:
            self._rules.append(CoordinationRule(rule.requester, list(rule.pause), rule.resume_on_finish))

    def replace_rules(self, rules):
        with self._lock:
            self._rules = [CoordinationRule(r.requester, list(r.pause), r.resume_on_finish) for r in rules]

    def get_rules(self):
        with self._lock:
            return [CoordinationRule(r.requester, list(r.pause), r.resume_on_finish) for r in self._rules]

    def clear_rules(self):
        self.replace_rules([])

    def request(self, requester, on_ready, *, pause=()):
        """Latest pending intent per project; callback receives its ownership ticket.

        Return promptly. Callback must schedule playback and return promptly too;
        return False to decline, or finish the ticket when source cleanup ends.
        """
        ticket = PlaybackTicket(self, requester)
        ticket.pause_projects = tuple(dict.fromkeys(str(name) for name in pause if name != requester))
        with self._lock:
            self._sequence += 1
            ticket.sequence = self._sequence
            previous = self._latest.get(requester)
            if previous is not None:
                previous.cancelled.set()
            pending = self._pending.get(requester)
            if pending is not None:
                pending[0].done.set()
            self._latest[requester] = ticket
            self._pending[requester] = (ticket, on_ready)
            if requester not in self._scheduled:
                self._scheduled.add(requester)
                self._actions.submit(lambda: self._dispatch(requester))
        return ticket

    def _dispatch(self, requester):
        import events
        with self._lock:
            ticket, on_ready = self._pending.pop(requester)
            self._scheduled.discard(requester)
        if ticket.cancelled.is_set() or self._stop.is_set():
            self._finish(ticket)
            return
        old = self._held.get(requester)
        try:
            rules = [r for r in self.get_rules() if r.requester == requester]
            # Acquire before releasing the old claim: replacement never creates
            # an audible resume/pause gap in a shared music source.
            for rule in rules:
                self._pauses.acquire(ticket, [n for n in rule.pause if n != requester],
                                     resume=rule.resume_on_finish)
            if ticket.pause_projects:
                self._pauses.acquire(ticket, ticket.pause_projects)
            self._held[requester] = ticket
            if old is not None:
                self._finish(old)
            if ticket.cancelled.is_set() or self._stop.is_set():
                self._finish(ticket)
                return
            paused = sorted(self._pauses._claims.get(ticket, ()))
            for name in paused:
                events.emit('coordinator.project_paused', paused=name, requester=requester)
            ticket.ready.set()
            self._update_gates()
            events.emit('coordinator.play_cleared', requester=requester, paused=paused)
            if on_ready(ticket) is False:
                self._finish(ticket)
        except Exception as exc:
            ticket.error = str(exc)
            self._finish(ticket)
            if old is not None:
                self._finish(old)
            events.emit('coordinator.play_failed', requester=requester, error=str(exc))
            print(f'[coordination] {requester}: {exc}')

    def finish(self, ticket):
        ticket.cancelled.set()
        return self._actions.submit(lambda: self._finish(ticket))

    def _finish(self, ticket):
        import events
        for name in self._pauses.release(ticket, resume=not self._stop.is_set()):
            events.emit('coordinator.project_resumed', resumed=name, requester=ticket.requester)
        if self._held.get(ticket.requester) is ticket:
            self._held.pop(ticket.requester, None)
        with self._lock:
            if self._latest.get(ticket.requester) is ticket:
                self._latest.pop(ticket.requester, None)
        ticket.done.set()
        self._update_gates()

    def permission(self, requester):
        """A module gate for layered work that makes no cross-project pause claim.

        Register during assembly, before holding any source/player lock.
        """
        def register():
            gate = self._permissions.setdefault(requester, threading.Event())
            self._update_gates()
            return gate
        return self._actions.call(register)

    def _update_gates(self):
        for name, gate in self._permissions.items():
            blocked = self._stop.is_set() or name in self._pauses._suspended
            gate.clear() if blocked else gate.set()
        # A newer requester can preempt an older request. Older pause claims
        # cannot block that requester and create a symmetric-rule deadlock.
        for ticket in self._held.values():
            blocked = self._stop.is_set() or not self._pauses.can_start(ticket)
            ticket.allowed.clear() if blocked else ticket.allowed.set()

    def request_to_play(self, requester, on_ready):
        """Compatibility API; new callers use request() and finish their ticket."""
        return self.request(requester, lambda ticket: on_ready())

    def announce_finished(self, requester):
        """Compatibility API for name-based completion; ticket.finish is safer."""
        with self._lock:
            ticket = self._latest.get(requester)
        if ticket is not None:
            return ticket.finish()

    def cancel(self, requester):
        """Stop the current intent by name; normal completion uses its ticket."""
        return self.announce_finished(requester)

    def pause_projects(self, requester, names=None):
        owner = PauseClaim(requester)
        if names is None:
            names = [i.name for i in self.registry.all() if i.name != requester]
        def acquire():
            self._pauses.acquire(owner, names)
            self._update_gates()
        self._actions.call(acquire)
        return owner

    def release_pauses(self, owner, *, resume=True, wait=False):
        def action():
            result = self._pauses.release(owner, resume=resume and not self._stop.is_set())
            self._update_gates()
            return result
        return self._actions.call(action) if wait else self._actions.submit(action)

    def manual_action(self, name, action):
        method = self._pauses.manual_pause if action == 'pause' else self._pauses.manual_resume
        def apply():
            method(name)
            self._update_gates()
        self._actions.call(apply)

    def scene_session(self, requester, scene, fallback, *, transition=None):
        from .scene_session import SceneSession
        return SceneSession(requester, scene, fallback, coordinator=self, transition=transition)

    def snapshot(self):
        def read():
            return {'playback': {name: {'ready': t.ready.is_set(), 'cancelled': t.cancelled.is_set(),
                                      'allowed': t.allowed.is_set()}
                                 for name, t in self._held.items()}, 'pauses': self._pauses.snapshot()}
        return self._actions.call(read)

    def shutdown(self):
        self._stop.set()
        def release():
            for ticket in list(self._held.values()):
                self._finish(ticket)
            for owner in list(self._pauses._claims):
                self._pauses.release(owner, resume=False)
            self._update_gates()
        self._actions.call(release)


coordinator = PlayCoordinator()
