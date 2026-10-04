"""Reference-counted project suspension, used only on the coordination worker.

Every claim remembers the actual interface it paused. Rules changing, another
claim finishing, or an interface being replaced cannot resume somebody else's
playback. A preexisting pause remains paused when the last claim releases.
"""
from dataclasses import dataclass, field


@dataclass(eq=False)
class PauseClaim:
    requester: str


@dataclass
class _Suspension:
    interface: object
    owners: set = field(default_factory=set)
    resume: bool = True


class PauseLedger:
    def __init__(self, registry):
        self.registry = registry
        self._suspended = {}
        self._claims = {}

    def acquire(self, owner, names, *, resume=True):
        held = self._claims.setdefault(owner, set())
        try:
            for name in dict.fromkeys(names):
                if name in held:
                    continue
                entry = self._suspended.get(name)
                if entry is None:
                    interface = self.registry.get(name)
                    if interface is None:
                        continue
                    already_paused = bool(interface.get_status().is_paused)
                    if not already_paused:
                        interface.pause()
                    entry = self._suspended[name] = _Suspension(interface, resume=not already_paused)
                entry.owners.add(owner)
                entry.resume = entry.resume and resume
                held.add(name)
        except BaseException:
            self.release(owner)
            raise
        return sorted(held)

    def release(self, owner, *, resume=True):
        resumed = []
        for name in self._claims.pop(owner, set()):
            entry = self._suspended[name]
            entry.owners.discard(owner)
            entry.resume = entry.resume and resume
            if entry.owners:
                continue
            del self._suspended[name]
            if entry.resume and self.registry.get(name) is entry.interface:
                try:
                    entry.interface.resume()
                    resumed.append(name)
                except Exception as exc:
                    print(f'[coordination] Could not resume {name}: {exc}')
        return resumed

    def manual_pause(self, name):
        self.acquire(('manual', name), [name])

    def manual_resume(self, name):
        owner = ('manual', name)
        if owner in self._claims:
            self.release(owner)
        elif name not in self._suspended:
            interface = self.registry.get(name)
            if interface is not None:
                interface.resume()

    def snapshot(self):
        def describe(owner):
            if isinstance(owner, tuple):
                return {'owner': owner[1], 'kind': owner[0]}
            sequence = getattr(owner, 'sequence', None)
            return {'owner': getattr(owner, 'requester', 'unknown'),
                    'kind': 'playback' if sequence is not None else 'scope',
                    **({'sequence': sequence} if sequence is not None else {})}
        return {name: {'claims': len(entry.owners), 'resume_on_release': entry.resume,
                       'owners': sorted((describe(o) for o in entry.owners),
                                        key=lambda o: (o['owner'], o.get('sequence', 0)))}
                for name, entry in self._suspended.items()}

    def can_start(self, ticket):
        entry = self._suspended.get(ticket.requester)
        if entry is None:
            return True
        for owner in entry.owners:
            sequence = getattr(owner, 'sequence', None)
            if sequence is None or sequence > ticket.sequence:
                return False
        return True
