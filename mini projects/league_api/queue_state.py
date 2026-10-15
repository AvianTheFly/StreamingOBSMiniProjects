"""One search journey through ready check, bans and automatic dodge requeues.

Called under ClientScenes.lock. Client time seeds a monotonic presentation clock;
no capture, I/O, worker or scene writes belong here.
"""
import math

ROLES = {'TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY', 'FILL'}
THEMES = ('bear', 'turtle', 'ram', 'phoenix')


def bans_finished(session):
    if not isinstance(session, dict):
        return False
    phase = (session.get('timer') or {}).get('phase')
    if phase == 'PLANNING':
        return False
    actions = [a for row in session.get('actions') or [] if isinstance(row, list)
               for a in row if isinstance(a, dict)]
    bans = [a for a in actions if a.get('type') == 'ban']
    if bans:
        return all(a.get('completed') is True for a in bans)
    return phase in {'PICK', 'FINALIZATION'} or any(
        a.get('type') == 'pick' and (a.get('isInProgress') or a.get('completed')) for a in actions)


class QueueState:
    def __init__(self, clock):
        self.clock = clock
        self.started = None
        self.frozen = None
        self.phase = None
        self.roles = []
        self.status = 'NOT IN QUEUE'
        self.interrupted_at = None
        self.serial = 0
        self.active = False
        self.synced = False
        self.extended = False

    def reset(self):
        self.started = self.frozen = self.interrupted_at = None
        self.active = False
        self.synced = False
        self.extended = False
        self.status = 'NOT IN QUEUE'

    def observe(self, phase, session, details):
        now = self.clock()
        details = details if isinstance(details, dict) else {}
        roles = [details.get('primary'), details.get('secondary')]
        if details.get('roles_known') or any(isinstance(role, str) and role in ROLES for role in roles):
            self.roles = [role for role in roles if isinstance(role, str) and role in ROLES]
        old_phase, self.phase = self.phase, phase
        searching = phase in {'Matchmaking', 'ReadyCheck', 'ChampSelect'}
        if phase == 'Lobby' and details.get('search_state') in {'Searching', 'Found'}:
            searching = self.started is not None
        if not searching:
            # Some dodges briefly report Lobby before automatic search resumes.
            # A confirmed cancellation clears immediately; missing optional data
            # gets a bounded two-second bridge, never an indefinite running timer.
            cancelled = details.get('search_state') in {'Canceled', 'Cancelled', 'Idle', 'NotSearching', 'Invalid'}
            if phase == 'Lobby' and self.started is not None and not cancelled and (
                    old_phase == 'ChampSelect' or self.interrupted_at is not None):
                self.interrupted_at = now if self.interrupted_at is None else self.interrupted_at
                if now - self.interrupted_at < 2:
                    self.active = False
                    self.status = 'CHECKING QUEUE'
                    return
            self.reset()
            return
        self.interrupted_at = None
        seconds = details.get('seconds')
        valid = (not isinstance(seconds, bool) and isinstance(seconds, (int, float))
                 and math.isfinite(seconds) and seconds >= 0)
        if self.started is None:
            self.started = now - (seconds if valid else 0)
            self.serial += 1
            self.synced = valid
        elif valid and not self.extended and phase == 'Matchmaking':
            self.started = now - seconds
            self.synced = True
        if phase in {'ReadyCheck', 'ChampSelect'}:
            self.extended = True
        self.active = True
        # The broadcast journey deliberately conceals ready-check/draft progress.
        self.status = 'IN QUEUE'
        if phase == 'ChampSelect' and bans_finished(session):
            if self.frozen is None:
                self.frozen = max(0, now - self.started)
            self.active = False
            self.status = 'PICKS BEGIN'
        else:
            # The prior draft's finished bans must not freeze an automatic requeue.
            self.frozen = None

    def snapshot(self, connected, theme='bear'):
        seconds = self.frozen if self.frozen is not None else (
            max(0, self.clock() - self.started) if self.started is not None else 0)
        mode = theme
        theme = THEMES[(max(1, self.serial)-1) % len(THEMES)] if mode == 'rotate' else theme
        return {'active': self.active and connected, 'seconds': seconds,
                'running': self.active and connected and self.frozen is None,
                'status': self.status if connected else 'CLIENT UNAVAILABLE',
                'roles': list(self.roles), 'theme': theme, 'theme_mode': mode, 'synced': self.synced,
                'journey': self.serial}
