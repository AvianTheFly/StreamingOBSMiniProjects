"""Live WASAPI isolation test: target 800 Hz, unrelated process 3000 Hz.

Plays two short quiet tones through the default output. Does not control Spotify.
The result must contain the target and exclude the other process, even when both
render to the same physical speakers. Also tests a child in the target tree.
"""
import subprocess
import sys
import threading
import time
from pathlib import Path
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.process_audio import capture_process, spotify_pid

TONE = """
import numpy as np, sounddevice as sd, sys, time
rate=44100; f=float(sys.argv[1]); phase=0
def callback(out,frames,timing,status):
 global phase
 x=.015*np.sin(2*np.pi*f*(np.arange(frames)+phase)/rate)
 out[:]=x[:,None];phase+=frames
with sd.OutputStream(samplerate=rate,channels=2,callback=callback):
 print('ready',flush=True);time.sleep(15)
"""


def record(pid, duration=1.2):
    result, errors = [], []
    def worker():
        try:
            with capture_process(pid) as read:
                end=time.monotonic()+duration
                while time.monotonic()<end:
                    packet=read()
                    if packet.size:result.append(packet)
        except BaseException as exc:errors.append(exc)
    thread=threading.Thread(target=worker);thread.start();thread.join(7)
    assert not thread.is_alive(),'capture did not shut down'
    if errors:raise errors[0]
    return np.concatenate(result).mean(axis=1) if result else np.zeros(1)


def amplitude(x,f):
    t=np.arange(len(x))/44100
    return abs(np.sum(x*np.exp(-2j*np.pi*f*t)))*2/len(x)


if __name__=='__main__':
    children=[]
    try:
        for frequency in (800,3000):
            child=subprocess.Popen([sys.executable,'-u','-c',TONE,str(frequency)],stdout=subprocess.PIPE,
                                   creationflags=subprocess.CREATE_NO_WINDOW)
            children.append(child)
            assert child.stdout.readline().strip()==b'ready'
        x=record(children[0].pid)
        target,other=amplitude(x,800),amplitude(x,3000)
        print(f'target={target:.6f}; unrelated={other:.8f}; isolation={20*np.log10(max(target,1e-9)/max(other,1e-9)):.1f} dB')
        assert target>.005,'target audio was not captured'
        assert other<target*.01,'unrelated process leaked into capture'
        # Our own process tree includes both fixture children, confirming tree mode.
        x=record(__import__('os').getpid())
        assert amplitude(x,800)>.005 and amplitude(x,3000)>.005,'child processes were omitted'
        print('PASS: process isolation, target child inclusion and capture cleanup')
    finally:
        for child in children:
            child.terminate();child.wait(timeout=3)
