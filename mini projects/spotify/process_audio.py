"""WASAPI application loopback: include exactly one process tree, never the desktop.

ABI definitions follow Microsoft's IAudioClient/IAudioCaptureClient and
ActivateAudioInterfaceAsync contracts. No drivers, routing or faders are changed.
"""
import ctypes as C
import threading
import time
from contextlib import contextmanager

import comtypes as COM
import numpy as np
import psutil
from comtypes import GUID, HRESULT, IUnknown, STDMETHOD

P = C.POINTER
U32, U64, I64, PTR = C.c_uint32, C.c_uint64, C.c_int64, C.c_void_p


class IAudioClient(IUnknown):
    _iid_ = GUID('{1CB9AD4C-DBFA-4c32-B178-C2F568A703B2}')
    _methods_ = [
        STDMETHOD(HRESULT, 'Initialize', [C.c_int, U32, I64, I64, PTR, PTR]),
        STDMETHOD(HRESULT, 'GetBufferSize', [P(U32)]),
        STDMETHOD(HRESULT, 'GetStreamLatency', [P(I64)]),
        STDMETHOD(HRESULT, 'GetCurrentPadding', [P(U32)]),
        STDMETHOD(HRESULT, 'IsFormatSupported', [C.c_int, PTR, P(PTR)]),
        STDMETHOD(HRESULT, 'GetMixFormat', [P(PTR)]),
        STDMETHOD(HRESULT, 'GetDevicePeriod', [P(I64), P(I64)]),
        STDMETHOD(HRESULT, 'Start'), STDMETHOD(HRESULT, 'Stop'), STDMETHOD(HRESULT, 'Reset'),
        STDMETHOD(HRESULT, 'SetEventHandle', [PTR]),
        STDMETHOD(HRESULT, 'GetService', [P(GUID), P(PTR)]),
    ]


class IAudioCaptureClient(IUnknown):
    _iid_ = GUID('{C8ADBD64-E71E-48a0-A4DE-185C395CD317}')
    _methods_ = [
        STDMETHOD(HRESULT, 'GetBuffer', [P(PTR), P(U32), P(U32), P(U64), P(U64)]),
        STDMETHOD(HRESULT, 'ReleaseBuffer', [U32]),
        STDMETHOD(HRESULT, 'GetNextPacketSize', [P(U32)]),
    ]


class IActivationOperation(IUnknown):
    _iid_ = GUID('{72A22D78-CDE4-431D-B8CC-843A71199B6D}')
    _methods_ = [STDMETHOD(HRESULT, 'GetActivateResult', [P(HRESULT), P(PTR)])]


class ICompletion(IUnknown):
    _iid_ = GUID('{41D949AB-9862-444A-80F6-C261334DA5EB}')
    _methods_ = [STDMETHOD(HRESULT, 'ActivateCompleted', [P(IActivationOperation)])]


class IAgileObject(IUnknown):
    _iid_ = GUID('{94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90}')
    _methods_ = []


class Completion(COM.COMObject):
    _com_interfaces_ = [ICompletion, IAgileObject]

    def __init__(self):
        super().__init__()
        self.ready = threading.Event()
        self.result = HRESULT(-1)
        self.client = PTR()
        self.error = None

    def ActivateCompleted(self, this, operation):
        try:
            check(operation.GetActivateResult(C.byref(self.result), C.byref(self.client)))
        except Exception as exc:
            self.error = exc
        finally:
            self.ready.set()
        return 0


class Activation(C.Structure):
    _fields_ = [('type', U32), ('pid', U32), ('mode', U32)]


class BlobVariant(C.Structure):
    _fields_ = [('vt', C.c_ushort), ('reserved', C.c_ushort * 3), ('size', U32), ('data', PTR)]


class WaveFormat(C.Structure):
    _pack_ = 2
    _fields_ = [('tag', C.c_ushort), ('channels', C.c_ushort), ('rate', U32),
                ('bytes_per_second', U32), ('align', C.c_ushort), ('bits', C.c_ushort),
                ('extra', C.c_ushort)]


def check(result):
    if result < 0:
        raise OSError(f'Application audio capture HRESULT 0x{result & 0xffffffff:08X}')


def spotify_pid():
    processes = {p.info['pid']: p.info['ppid'] for p in psutil.process_iter(['pid', 'ppid', 'name'])
                 if (p.info['name'] or '').lower() == 'spotify.exe'}
    roots = sorted(pid for pid, parent in processes.items() if parent not in processes)
    return roots[0] if roots else None


@contextmanager
def capture_process(pid):
    """Yield a packet reader (stereo float samples at 44100 Hz). Use on one MTA thread."""
    COM.CoInitializeEx(COM.COINIT_MULTITHREADED)
    client = capture = operation = None
    event = None
    kernel = C.WinDLL('kernel32', use_last_error=True)
    kernel.CreateEventW.argtypes = [PTR, C.c_bool, C.c_bool, C.c_wchar_p]
    kernel.CreateEventW.restype = PTR
    kernel.WaitForSingleObject.argtypes = [PTR, U32]
    kernel.CloseHandle.argtypes = [PTR]
    try:
        parameters = Activation(1, pid, 0)  # PROCESS_LOOPBACK, INCLUDE_TARGET_PROCESS_TREE
        variant = BlobVariant(65, (C.c_ushort * 3)(), C.sizeof(parameters), C.cast(C.pointer(parameters), PTR))
        completion = Completion()
        activate = C.WinDLL('Mmdevapi').ActivateAudioInterfaceAsync
        activate.argtypes = [C.c_wchar_p, P(GUID), P(BlobVariant), P(ICompletion), P(P(IActivationOperation))]
        activate.restype = HRESULT
        operation = P(IActivationOperation)()
        check(activate('VAD\\Process_Loopback', C.byref(IAudioClient._iid_), C.byref(variant),
                       completion.QueryInterface(ICompletion), C.byref(operation)))
        if not completion.ready.wait(3):
            raise TimeoutError('Windows did not activate Spotify application capture')
        if completion.error:
            raise completion.error
        check(completion.result.value)
        client = C.cast(completion.client, P(IAudioClient))
        fmt = WaveFormat(1, 2, 44100, 176400, 4, 16, 0)
        check(client.Initialize(0, 0x80060000, 0, 0, C.byref(fmt), None))
        event = kernel.CreateEventW(None, False, False, None)
        if not event:
            raise C.WinError(C.get_last_error())
        check(client.SetEventHandle(event))
        capture_pointer = PTR()
        check(client.GetService(C.byref(IAudioCaptureClient._iid_), C.byref(capture_pointer)))
        capture = C.cast(capture_pointer, P(IAudioCaptureClient))
        check(client.Start())

        def packets():
            wait = kernel.WaitForSingleObject(event, 100)
            if wait == 0xffffffff:
                raise C.WinError(C.get_last_error())
            chunks = []
            count = U32()
            check(capture.GetNextPacketSize(C.byref(count)))
            while count.value:
                data, frames, flags, position, clock = PTR(), U32(), U32(), U64(), U64()
                check(capture.GetBuffer(C.byref(data), C.byref(frames), C.byref(flags), C.byref(position), C.byref(clock)))
                try:
                    samples = np.zeros((frames.value, 2), dtype=np.float32) if flags.value & 2 else (
                        np.frombuffer(C.string_at(data, frames.value * 4), dtype=np.int16)
                        .reshape(-1, 2).astype(np.float32) / 32768.)
                    chunks.append(samples)
                    # WASAPI QPC time is in 100-ns units and identifies the
                    # first frame. Track the newest packet end, not queued data.
                    stamp = clock.value/10_000_000 + frames.value/44100
                    now = time.perf_counter()
                    valid = not flags.value & 4 and abs(now-stamp) < 2
                    packets.sample_end = stamp if valid else now
                    packets.timestamp_valid = valid
                finally:
                    check(capture.ReleaseBuffer(frames.value))
                check(capture.GetNextPacketSize(C.byref(count)))
            return np.concatenate(chunks) if chunks else np.empty((0, 2), dtype=np.float32)
        packets.sample_end = 0.
        packets.timestamp_valid = False
        yield packets
    finally:
        if client:
            client.Stop()
        # Release on the owning apartment before closing the event.
        capture = client = operation = None
        if event:
            kernel.CloseHandle(event)
        COM.CoUninitialize()
