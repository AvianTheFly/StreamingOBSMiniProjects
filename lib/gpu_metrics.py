"""Read-only GPU counters on the existing diagnostics worker; no import side effects.

NVML ships with NVIDIA's driver. Its handle belongs to one Collector lifetime.
Older/unavailable drivers retain bounded nvidia-smi fallback, never burst spawns.
API: https://docs.nvidia.com/deploy/nvml-api/latest/api/group__nvmlDeviceQueries.html
"""
import csv
import ctypes as C
import os
from pathlib import Path
import shutil
import subprocess
import time

GPU_FIELDS = ('index', 'utilization.gpu', 'utilization.memory', 'memory.used',
              'memory.total', 'temperature.gpu', 'power.draw', 'power.limit',
              'clocks.gr', 'clocks.mem', 'utilization.encoder', 'utilization.decoder')


def parse_gpu_csv(output):
    return [dict(zip(GPU_FIELDS, (v.strip() for v in row)))
            for row in csv.reader(output.splitlines(), skipinitialspace=True)
            if len(row) == len(GPU_FIELDS)]


class Utilization(C.Structure):
    _fields_ = [('gpu', C.c_uint), ('memory', C.c_uint)]


class Memory(C.Structure):
    _fields_ = [('total', C.c_ulonglong), ('free', C.c_ulonglong), ('used', C.c_ulonglong)]


def load_nvml():
    if os.name != 'nt':
        return C.CDLL('libnvidia-ml.so.1')
    # Absolute installed-driver locations; never search the project directory.
    candidates = [Path(os.environ.get('SystemRoot', 'C:/Windows')) / 'System32/nvml.dll',
                  Path(os.environ.get('ProgramW6432', 'C:/Program Files')) / 'NVIDIA Corporation/NVSMI/nvml.dll']
    for path in candidates:
        try:
            return C.CDLL(str(path))
        except OSError:
            pass
    raise OSError('NVML unavailable')


class Nvml:
    def __init__(self, library=None):
        self.library = library if library is not None else load_nvml()
        self.started = False
        self.devices = []
        self._functions = {}
        self._bind('nvmlInit_v2', [])
        self._bind('nvmlShutdown', [])
        self._bind('nvmlDeviceGetCount_v2', [C.POINTER(C.c_uint)])
        self._bind('nvmlDeviceGetHandleByIndex_v2', [C.c_uint, C.POINTER(C.c_void_p)])
        queries = {
            'nvmlDeviceGetUtilizationRates': [C.POINTER(Utilization)],
            'nvmlDeviceGetMemoryInfo': [C.POINTER(Memory)],
            'nvmlDeviceGetTemperature': [C.c_uint, C.POINTER(C.c_uint)],
            'nvmlDeviceGetPowerUsage': [C.POINTER(C.c_uint)],
            'nvmlDeviceGetPowerManagementLimit': [C.POINTER(C.c_uint)],
            'nvmlDeviceGetClockInfo': [C.c_uint, C.POINTER(C.c_uint)],
            'nvmlDeviceGetEncoderUtilization': [C.POINTER(C.c_uint), C.POINTER(C.c_uint)],
            'nvmlDeviceGetDecoderUtilization': [C.POINTER(C.c_uint), C.POINTER(C.c_uint)],
        }
        for name, args in queries.items():
            self._bind(name, [C.c_void_p, *args], optional=True)
        try:
            self._required('nvmlInit_v2')
            self.started = True
            count = C.c_uint()
            self._required('nvmlDeviceGetCount_v2', C.byref(count))
            if count.value > 32:
                raise OSError('Invalid NVML device count')
            for index in range(count.value):
                device = C.c_void_p()
                self._required('nvmlDeviceGetHandleByIndex_v2', index, C.byref(device))
                self.devices.append(device)
        except BaseException:
            self.close()
            raise

    def _bind(self, name, args, optional=False):
        fn = getattr(self.library, name, None)
        if fn is None and not optional:
            raise OSError('Missing NVML entry point: ' + name)
        if fn is not None:
            fn.argtypes, fn.restype = args, C.c_int
        self._functions[name] = fn

    def _required(self, name, *args):
        code = self._functions[name](*args)
        if code:
            raise OSError(f'{name}: NVML error {code}')

    def _query(self, name, *args):
        fn = self._functions.get(name)
        if fn is None:
            return False
        code = fn(*args)
        if code in (1, 9, 15, 999):  # Uninitialized, driver lost/not loaded, unknown.
            raise OSError(f'{name}: NVML error {code}')
        return code == 0  # Unsupported counters stay unknown, never zero.

    def sample(self):
        if not self.started:
            raise OSError('NVML is closed')
        rows = []
        for index, device in enumerate(self.devices):
            row = dict.fromkeys(GPU_FIELDS, '[N/A]')
            row['index'] = str(index)
            usage, memory = Utilization(), Memory()
            if self._query('nvmlDeviceGetUtilizationRates', device, C.byref(usage)):
                row.update({'utilization.gpu': str(usage.gpu), 'utilization.memory': str(usage.memory)})
            if self._query('nvmlDeviceGetMemoryInfo', device, C.byref(memory)):
                row.update({'memory.used': str(memory.used // 1048576), 'memory.total': str(memory.total // 1048576)})
            for key, name, prefix, divisor in (
                ('temperature.gpu', 'nvmlDeviceGetTemperature', (0,), 1),
                ('power.draw', 'nvmlDeviceGetPowerUsage', (), 1000),
                ('power.limit', 'nvmlDeviceGetPowerManagementLimit', (), 1000),
                ('clocks.gr', 'nvmlDeviceGetClockInfo', (0,), 1),
                ('clocks.mem', 'nvmlDeviceGetClockInfo', (2,), 1),
            ):
                value = C.c_uint()
                if self._query(name, device, *prefix, C.byref(value)):
                    row[key] = str(value.value) if divisor == 1 else f'{value.value/divisor:.2f}'
            for key, name in (('utilization.encoder', 'nvmlDeviceGetEncoderUtilization'),
                              ('utilization.decoder', 'nvmlDeviceGetDecoderUtilization')):
                value, period = C.c_uint(), C.c_uint()
                if self._query(name, device, C.byref(value), C.byref(period)):
                    row[key] = str(value.value)
            rows.append(row)
        return rows

    def close(self):
        if self.started:
            self.started = False
            self.devices.clear()
            self._required('nvmlShutdown')


class GpuMetrics:
    def __init__(self, *, clock=time.monotonic, factory=Nvml):
        self.clock, self.factory = clock, factory
        self.native = None
        self.retry_at = -float('inf')
        self.smi = shutil.which('nvidia-smi')
        self.fallback_at = -float('inf')
        self.fallback = {}

    def sample(self):
        now = self.clock()
        if now >= self.retry_at:
            try:
                if self.native is None:
                    self.native = self.factory()
                return {'gpu': self.native.sample(), 'gpu_backend': 'nvml'}
            except (OSError, AttributeError):
                self.close()
                self.retry_at = now + 60
        if not self.smi:
            return {'gpu': [], 'gpu_backend': 'unavailable'}
        if now - self.fallback_at >= 5:
            self.fallback_at = now
            try:
                result = subprocess.run([self.smi, '--query-gpu=' + ','.join(GPU_FIELDS),
                                         '--format=csv,noheader,nounits'],
                                        capture_output=True, text=True, timeout=2,
                                        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                self.fallback = {'gpu': parse_gpu_csv(result.stdout) if result.returncode == 0 else []}
                if result.returncode:
                    self.fallback['gpu_error'] = 'nvidia-smi exit ' + str(result.returncode)
            except (OSError, subprocess.SubprocessError) as exc:
                self.fallback = {'gpu': [], 'gpu_error': type(exc).__name__}
        return {**self.fallback, 'gpu_backend': 'nvidia-smi', 'gpu_age_seconds': round(now-self.fallback_at, 3)}

    def close(self):
        native, self.native = self.native, None
        if native is not None:
            try:
                native.close()
            except OSError:
                pass
