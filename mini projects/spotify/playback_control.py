"""Spotify-only pause leases reconciled by the existing Windows media observer.

Workers only publish claims and wait briefly for admission. Native async calls,
session identity, reference counting and restoration stay on the media loop.
"""
import asyncio
import threading
import time


class PlaybackControl:
    def __init__(self, wake):
        self.wake = wake
        self.lock = threading.Lock()
        self.claims = {}
        self.closed = False
        self.attempted = False
        self.owned = None

    def acquire(self, cancelled):
        token, ready = object(), threading.Event()
        with self.lock:
            if self.closed or cancelled():
                return lambda: None
            self.claims[token] = ready
        self.wake()

        def release():
            with self.lock:
                self.claims.pop(token, None)
            self.wake()

        deadline = time.monotonic() + 2.5
        while not ready.wait(.05):
            if cancelled() or time.monotonic() >= deadline:
                # A delayed observer must not pause music for an already-playing
                # or cancelled clip after this bounded admission window.
                release()
                break
        if cancelled():
            release()
        return release

    def close(self):
        with self.lock:
            self.closed = True
            for ready in self.claims.values():
                ready.set()
            self.claims.clear()

    async def _restore(self, sessions, paused_status):
        owned, self.owned = self.owned, None
        if owned is None:
            return
        session, track = owned
        # A closed/replaced session or a user track/transport change revokes
        # restoration. Never play a different app or toggle an unknown state.
        if session not in sessions or session.get_playback_info().playback_status != paused_status:
            return
        props = await asyncio.wait_for(session.try_get_media_properties_async(), 1)
        if (props.title, props.artist) != track:
            return
        with self.lock:
            if self.claims:
                self.owned = owned
                return
        if session.get_playback_info().playback_status != paused_status:
            return
        await asyncio.wait_for(session.try_play_async(), 1)

    async def reconcile(self, sessions, session, playing_status, paused_status):
        with self.lock:
            active = bool(self.claims)
            admitted = list(self.claims.values())
        try:
            if not active:
                await self._restore(sessions, paused_status)
                if self.owned is None:
                    self.attempted = False
                return
            if self.owned is not None:
                previous, _ = self.owned
                if previous not in sessions or previous.get_playback_info().playback_status == playing_status:
                    self.owned = None  # User resumed or Spotify was replaced.
            if not self.attempted:
                self.attempted = True
                if session is not None and session.get_playback_info().playback_status == playing_status:
                    props = await asyncio.wait_for(session.try_get_media_properties_async(), 1)
                    with self.lock:
                        active = bool(self.claims)
                    if active and session.get_playback_info().playback_status == playing_status:
                        track = (props.title, props.artist)
                        # Remember intent before awaiting: timeout/cancellation
                        # can race a successful native pause. Only PAUSED is
                        # eligible for later restoration.
                        self.owned = session, track
                        accepted = await asyncio.wait_for(session.try_pause_async(), 1)
                        if not accepted:
                            self.owned = None
        except Exception as exc:
            print(f'[spotify] Audio interruption: {exc}')
        finally:
            for ready in admitted:
                ready.set()
