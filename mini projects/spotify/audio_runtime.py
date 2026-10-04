"""Isolated audio + existing HTTP socket assembly; no fast path through the Hub."""
import multiprocessing
import threading

from .http_server import make_server
from .service import SpotifyState
from .audio_worker import capture_worker


class CaptureSink:
    def __init__(self, state, channel):
        self.state, self.channel = state, channel
        self.pending_status = None

    def set_status(self, pid, error=''):
        self.state.set_audio_status(f'Spotify process tree (PID {pid})' if pid else '', error)
        self.pending_status = (pid, error)
        if self.channel.set_status(pid, error):
            self.pending_status = None

    def publish_audio(self, *args):
        self.state.publish_audio(*args)
        if self.pending_status and self.channel.set_status(*self.pending_status):
            self.pending_status = None
        self.channel.publish_audio(*args)


def run_audio_presentation(channel, stop, *, capture=capture_worker):
    state = SpotifyState()
    server = make_server(state, channel.port.value)
    channel.port.value = server.server_port
    workers = [threading.Thread(target=server.serve_forever, name='spotify-http'),
               threading.Thread(target=capture, args=(CaptureSink(state, channel), stop), name='spotify-wasapi')]
    started = []
    parent = multiprocessing.parent_process()
    try:
        for worker in workers:
            worker.start()
            started.append(worker)
        channel.ready.set()
        control_generation = 0
        while not stop.is_set():
            if parent and not parent.is_alive():
                break
            control = channel.read_control(control_generation)
            if control:
                control_generation, values = control
                state.set_media(observed_at=values['updated'], **values['media'])
                state.set_hidden(values['hidden'])
            stop.wait(.02)
    finally:
        stop.set()
        state.set_media(playing=False, title='', artist='', error='Hub stopped')
        if workers[0] in started:
            server.shutdown()
        server.server_close()
        for worker in started:
            worker.join(1)
