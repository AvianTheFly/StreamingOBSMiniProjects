"""Owned WinRT media event bindings; wake the existing media loop promptly."""
import asyncio


class MediaNotifications:
    def __init__(self, loop):
        self.loop = loop
        self.changed = asyncio.Event()
        self.manager_bindings = []
        self.session_bindings = []
        self.session_key = None
        self.rebind = True
        self.closed = False
        self.metadata_revision = 0

    def _wake(self, sessions=False):
        if self.closed:
            return
        self.rebind |= sessions
        self.changed.set()

    def _metadata_changed(self, *args):
        def wake():
            if not self.closed:
                self.metadata_revision += 1
                self._wake()
        try:
            self.loop.call_soon_threadsafe(wake)
        except RuntimeError:
            pass

    def _notify(self, *args):
        try:
            self.loop.call_soon_threadsafe(self._wake)
        except RuntimeError:
            pass

    def _sessions_changed(self, *args):
        try:
            self.loop.call_soon_threadsafe(self._wake, True)
        except RuntimeError:
            pass

    @staticmethod
    def _release(bindings):
        for owner, remove, token in bindings:
            try:
                getattr(owner, remove)(token)
            except Exception:
                pass  # A closed Windows session can revoke its own event token.
        bindings.clear()

    def bind_manager(self, manager):
        self._release(self.manager_bindings)
        token = manager.add_sessions_changed(self._sessions_changed)
        self.manager_bindings.append((manager, 'remove_sessions_changed', token))
        self.rebind = True

    def bind_session(self, session):
        key = session.source_app_user_model_id if session else None
        if key == self.session_key and not self.rebind:
            return
        self._release(self.session_bindings)
        self.session_key, self.rebind = key, False
        self.metadata_revision += 1
        if session:
            for name in ('playback_info_changed', 'media_properties_changed'):
                callback = self._metadata_changed if name == 'media_properties_changed' else self._notify
                token = getattr(session, 'add_'+name)(callback)
                self.session_bindings.append((session, 'remove_'+name, token))

    def begin(self):
        self.changed.clear()

    async def wait(self):
        try:
            await asyncio.wait_for(self.changed.wait(), .5)
        except asyncio.TimeoutError:
            pass  # Existing freshness heartbeat and bounded stop observation.

    def reset(self):
        self._release(self.session_bindings)
        self._release(self.manager_bindings)
        self.session_key, self.rebind = None, True

    def close(self):
        self.closed = True
        self.reset()
