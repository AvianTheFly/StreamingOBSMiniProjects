"""Driver ABI, lifetime and fallback limits without accessing the real GPU."""
import ctypes as C
import subprocess
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from lib.gpu_metrics import GpuMetrics, Nvml, Memory, Utilization, GPU_FIELDS


def library():
    lib = SimpleNamespace()
    def bind(name, callback=None):
        fn = Mock(side_effect=callback) if callback else Mock(return_value=0)
        setattr(lib, name, fn)
        return fn
    bind('nvmlInit_v2'); bind('nvmlShutdown')
    def count(out): out._obj.value = 2; return 0
    def handle(index, out): out._obj.value = index + 100; return 0
    def utilization(device, out):
        out._obj.gpu, out._obj.memory = 65, 12
        return 0
    def memory(device, out):
        out._obj.total, out._obj.free, out._obj.used = 8192*1048576, 7000*1048576, 1192*1048576
        return 0
    def scalar(*args): args[-1]._obj.value = 150000; return 0
    def encoder(device, out, period): out._obj.value = 23; period._obj.value = 1000000; return 0
    bind('nvmlDeviceGetCount_v2', count); bind('nvmlDeviceGetHandleByIndex_v2', handle)
    bind('nvmlDeviceGetUtilizationRates', utilization); bind('nvmlDeviceGetMemoryInfo', memory)
    bind('nvmlDeviceGetPowerUsage', scalar); bind('nvmlDeviceGetEncoderUtilization', encoder)
    return lib


class NativeTests(unittest.TestCase):
    def test_abi_and_all_adapters_preserve_units_and_unknowns(self):
        lib = library(); native = Nvml(lib)
        self.assertEqual(C.sizeof(Memory), 24)
        self.assertEqual(C.sizeof(Utilization), 8)
        self.assertIs(lib.nvmlDeviceGetHandleByIndex_v2.argtypes[1]._type_, C.c_void_p)
        rows = native.sample()
        self.assertEqual([row['index'] for row in rows], ['0', '1'])
        for row in rows:
            self.assertEqual(set(row), set(GPU_FIELDS))
            self.assertEqual(row['memory.total'], '8192')
            self.assertEqual(row['memory.used'], '1192')
            self.assertEqual(row['power.draw'], '150.00')
            self.assertEqual(row['utilization.encoder'], '23')
            self.assertEqual(row['utilization.decoder'], '[N/A]')
        native.sample();lib.nvmlInit_v2.assert_called_once()
        native.close();native.close();lib.nvmlShutdown.assert_called_once()

    def test_partial_initialization_releases_native_lifetime(self):
        lib = library();lib.nvmlDeviceGetHandleByIndex_v2.side_effect = None
        lib.nvmlDeviceGetHandleByIndex_v2.return_value = 9
        with self.assertRaises(OSError): Nvml(lib)
        lib.nvmlShutdown.assert_called_once()

    def test_unsupported_counter_is_unknown_but_lost_driver_retries(self):
        lib = library(); native = Nvml(lib)
        lib.nvmlDeviceGetUtilizationRates.side_effect = None
        lib.nvmlDeviceGetUtilizationRates.return_value = 3
        self.assertEqual(native.sample()[0]['utilization.gpu'], '[N/A]')
        lib.nvmlDeviceGetUtilizationRates.return_value = 15
        with self.assertRaises(OSError): native.sample()
        native.close()


class SamplerTests(unittest.TestCase):
    def test_success_reuses_handle_and_never_launches_processes(self):
        native = Mock(sample=Mock(return_value=[{'index':'0'}]))
        factory = Mock(return_value=native)
        sampler = GpuMetrics(factory=factory)
        factory.assert_not_called()
        with patch('lib.gpu_metrics.subprocess.run') as run:
            for _ in range(12):
                self.assertEqual(sampler.sample()['gpu_backend'], 'nvml')
        run.assert_not_called(); factory.assert_called_once()
        sampler.close();sampler.close();native.close.assert_called_once()

    def test_failed_native_and_fallback_spawns_have_independent_bounds(self):
        now = [0];factory = Mock(side_effect=OSError('no driver'))
        sampler = GpuMetrics(factory=factory, clock=lambda: now[0]);sampler.smi = 'smi'
        with patch('lib.gpu_metrics.subprocess.run', return_value=Mock(returncode=0, stdout=', '.join(['1']*12))) as run:
            for i in range(20):
                now[0] = i/2;row = sampler.sample()
            self.assertEqual(run.call_count, 2)
            self.assertEqual(row['gpu_age_seconds'], 4.5)
            factory.assert_called_once()
            now[0] = 60;sampler.sample();self.assertEqual(factory.call_count, 2)

    def test_failed_sample_closes_handle_and_clears_old_values(self):
        native = Mock(sample=Mock(side_effect=OSError('device lost')))
        sampler = GpuMetrics(factory=lambda: native);sampler.smi = 'smi'
        with patch('lib.gpu_metrics.subprocess.run', side_effect=subprocess.TimeoutExpired('smi', 2)):
            result = sampler.sample()
        self.assertEqual(result['gpu'], [])
        self.assertEqual(result['gpu_error'], 'TimeoutExpired')
        native.close.assert_called_once();self.assertIsNone(sampler.native)


if __name__ == '__main__': unittest.main()
