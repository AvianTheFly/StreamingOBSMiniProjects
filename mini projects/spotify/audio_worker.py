"""Owned Spotify-only capture/DSP process; independent of the Hub's Python GIL."""
import multiprocessing
import time

import numpy as np
import psutil

from .audio_analysis import AudioAnalysis
from .audio_channel import AudioChannel
from .process_audio import capture_process, spotify_pid


def capture_entry(channel, stop):
    from .audio_runtime import run_audio_presentation
    run_audio_presentation(channel, stop)


def capture_worker(channel, stop):
    analysis = AudioAnalysis()
    parent = multiprocessing.parent_process()
    while not stop.is_set():
        if parent and not parent.is_alive():
            return  # An abrupt Hub exit must not leave an orphan capture.
        try:
            pid = spotify_pid()
            if pid is None:
                raise RuntimeError('Waiting for the Spotify desktop process')
            process = psutil.Process(pid)
            with capture_process(pid) as read:
                channel.set_status(pid)
                window = np.empty((0, 2), dtype=np.float32)
                check_at = time.monotonic()+2
                while not stop.is_set():
                    if parent and not parent.is_alive():
                        return
                    packet = read()
                    now = time.monotonic()
                    if now >= check_at:
                        # Process enumeration can take 100+ ms under load. Check
                        # this process identity only; rediscover after it exits.
                        # psutil's identity check also rejects PID reuse.
                        if not process.is_running():
                            break
                        check_at = now+2
                    if packet.size:
                        window = (packet[-2048:].copy() if len(packet) >= 2048 else
                                  np.concatenate((window[-(2048-len(packet)):], packet)))
                    if packet.size and len(window) == 2048:
                        began = time.perf_counter()
                        bands, features = analysis.analyze(window, realtime=True)
                        channel.publish_audio(bands, features, getattr(read, 'sample_end', began),
                                              (time.perf_counter()-began)*1000,
                                              getattr(read, 'timestamp_valid', False))
                    if not packet.size:
                        window = np.empty((0, 2), dtype=np.float32)
        except Exception as exc:
            channel.set_status(None, str(exc))
        stop.wait(2)


def relay_audio(state, stop, *, context=None, port=7447):
    """Own exactly one child and mailbox through bounded shutdown/recovery."""
    context = context or multiprocessing.get_context('spawn')
    while not stop.is_set():
        channel = AudioChannel(context, port)
        child_stop = context.Event()
        child = context.Process(target=capture_entry, args=(channel, child_stop), name='spotify-capture')
        started = False
        try:
            state.connect_audio_channel(channel)
            child.start()
            started = True
            generation = audio_generation = 0
            while not stop.is_set():
                # This relay is only Hub status. IPC event locks must never
                # enter the audio-to-browser path; observe at a bounded cadence.
                stop.wait(1/30)
                message = channel.read(generation)
                if message:
                    generation = message['generation']
                    device = f"Spotify process tree (PID {message['pid']})" if message['pid'] else ''
                    state.set_audio_status(device, message['error'])
                    if not message['error'] and message['audio_generation'] != audio_generation:
                        audio_generation = message['audio_generation']
                        bands, features, sample_end, analysis_ms, valid, published = channel.unpack(message['values'])
                        if time.monotonic()-published < .5:
                            state.publish_audio(bands, features, sample_end, analysis_ms, valid)
                if not child.is_alive():
                    raise RuntimeError(f'Spotify audio worker exited ({child.exitcode})')
        except Exception as exc:
            state.set_audio_status('', str(exc))
        finally:
            state.disconnect_audio_channel(channel)
            child_stop.set()
            if started:
                child.join(1.5)
                if child.is_alive():
                    child.terminate()
                    child.join(.5)
                if child.is_alive():
                    child.kill()
                    child.join(.5)
            child.close()
        if not stop.is_set():
            stop.wait(2)
