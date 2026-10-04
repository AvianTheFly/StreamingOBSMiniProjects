"""Hub-owned media/visibility bridge to the isolated presentation runtime."""
from .service import SpotifyState


class PresentationState(SpotifyState):
    def __init__(self):
        super().__init__()
        self.channel = None

    def _publish_control(self):
        with self.lock:
            channel, media, hidden, updated = self.channel, dict(self.media), self.hidden, self.updated
        if channel:
            channel.publish_control(media, hidden, updated)

    def connect_audio_channel(self, channel):
        with self.lock:
            self.channel = channel
        self._publish_control()

    def disconnect_audio_channel(self, channel):
        with self.lock:
            if self.channel is channel:
                self.channel = None

    def presentation_token(self):
        """Identity of the currently ready HTTP/capture lifetime, or None."""
        with self.lock:
            channel = self.channel
        return channel if channel is not None and channel.ready.is_set() else None

    def set_media(self, **values):
        super().set_media(**values)
        self._publish_control()

    def set_hidden(self, hidden):
        super().set_hidden(hidden)
        self._publish_control()
