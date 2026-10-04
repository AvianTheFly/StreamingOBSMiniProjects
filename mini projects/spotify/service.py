"""Read Spotify's Windows media session; never control or duplicate its audio."""
from __future__ import annotations

import asyncio
import threading
import time

from .audio_worker import relay_audio
from .audio_analysis import AudioAnalysis, quiet_features, spectrum
from .media_notifications import MediaNotifications




class SpotifyState:
    def __init__(self):
        self.lock = threading.Lock()
        self._changed = threading.Condition(self.lock)
        self._revision = 0
        self.media = dict(playing=False, title='', artist='', error='Connecting to Windows media')
        self.updated = 0.0
        self.bands = [0.0] * 48
        self.features = quiet_features()
        self.audio_updated = 0.0
        self.audio_revision = 0
        self.sample_end = 0.
        self.analysis_ms = 0.
        self.timestamp_valid = False
        self.audio_device = ''
        self.audio_error = ''
        self.hidden = False

    def set_media(self, *, observed_at=None, **values):
        with self._changed:
            now = time.monotonic()
            recovered = bool(values.get('playing') and now - self.updated >= 2)
            changed = values != self.media or recovered
            self.media = values
            self.updated = now if observed_at is None else observed_at
            if changed:
                self._revision += 1
                self._changed.notify_all()

    def set_hidden(self, hidden):
        with self._changed:
            if self.hidden != hidden:
                self.hidden = hidden
                self._revision += 1
                self._changed.notify_all()

    def _playing(self):
        return bool(self.media.get('playing') and time.monotonic() - self.updated < 2 and not self.hidden)

    def _snapshot(self):
        audio_fresh = time.monotonic() - self.audio_updated < .5
        return dict(self.media, playing=self._playing(), revision=self._revision,
                    bands=self.bands[:] if audio_fresh else [0.] * 48,
                    **(self.features if audio_fresh else quiet_features()),
                    audio_device=self.audio_device, audio_error=self.audio_error,
                    audio_revision=self.audio_revision, analysis_ms=self.analysis_ms,
                    sample_age_ms=max(0., (time.perf_counter()-self.sample_end)*1000) if audio_fresh and self.sample_end else None,
                    timestamp_valid=self.timestamp_valid,
                    sample_time=self.sample_end if audio_fresh and self.sample_end else None)

    def set_audio_status(self, device, error):
        with self._changed:
            changed = device != self.audio_device or error != self.audio_error
            self.audio_device, self.audio_error = device, error
            if error:
                self.audio_updated = 0.
            if changed:
                self._changed.notify_all()

    def publish_audio(self, bands, features, sample_end, analysis_ms, timestamp_valid=False):
        with self._changed:
            self.bands, self.features = bands, features
            self.audio_updated = time.monotonic()
            self.sample_end, self.analysis_ms = sample_end, analysis_ms
            self.timestamp_valid = timestamp_valid
            self.audio_revision += 1
            self._changed.notify_all()

    def wait_audio(self, after, revision=None, timeout=.25):
        """One bounded latest-sample wait; never queue old audio for a client."""
        with self._changed:
            self._changed.wait_for(lambda: self.audio_revision != after or not self._playing()
                                   or (revision is not None and revision != self._revision),
                                   timeout=min(max(timeout, 0.), .25))
            return self._snapshot()

    def snapshot(self):
        with self.lock:
            return self._snapshot()

    def wait_snapshot(self, after, timeout=1.0):
        """Idle clients sleep until media/control changes; active audio never waits."""
        with self._changed:
            self._changed.wait_for(lambda: self._revision != after or self._playing(),
                                   timeout=min(max(timeout, 0.0), 1.0))
            return self._snapshot()


def select_spotify(sessions, playing_status):
    matches = [s for s in sessions if 'spotify' in s.source_app_user_model_id.lower()]
    return next((s for s in matches if s.get_playback_info().playback_status == playing_status),
                matches[0] if matches else None)


async def watch_media(state, stop):
    from winrt.windows.media.control import (
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    )
    manager = None
    notifications = MediaNotifications(asyncio.get_running_loop())
    try:
        while not stop.is_set():
            notifications.begin()
            try:
                if manager is None:
                    manager = await asyncio.wait_for(Manager.request_async(), 2)
                    notifications.bind_manager(manager)
                session = select_spotify(manager.get_sessions(), Status.PLAYING)
                notifications.bind_session(session)
                if session is None:
                    state.set_media(playing=False, title='', artist='', error='Open Spotify on this computer')
                else:
                    props = await asyncio.wait_for(session.try_get_media_properties_async(), 1)
                    # Read status AFTER metadata so a pause during the read cannot reveal stale content.
                    playing = session.get_playback_info().playback_status == Status.PLAYING
                    state.set_media(playing=playing and bool(props.title), title=props.title,
                                    artist=props.artist, error='')
            except Exception as exc:
                state.set_media(playing=False, title='', artist='', error=f'Windows media: {exc}')
                manager = None
                notifications.reset()
            await notifications.wait()
    finally:
        notifications.close()
    state.set_media(playing=False, title='', artist='', error='Hub stopped')




def watch_audio(state, stop):
    relay_audio(state, stop)


def media_thread(state, stop):
    try:
        asyncio.run(watch_media(state, stop))
    except Exception as exc:
        state.set_media(playing=False, title='', artist='', error=str(exc))
