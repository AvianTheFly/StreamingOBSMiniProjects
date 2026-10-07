"""Native pool defaults precede feature imports and survive spawned children."""
import json
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
KEYS = ('OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'OMP_NUM_THREADS')


class NativeResourcesTests(unittest.TestCase):
    def run_fresh(self, code, overrides=None):
        env = {k:v for k,v in os.environ.items() if k not in KEYS}
        env.update(overrides or {})
        result = subprocess.run([sys.executable, '-c', code], cwd=ROOT, env=env,
                                capture_output=True, text=True, timeout=20, check=True)
        return json.loads(result.stdout)

    def test_importing_entrypoints_does_not_configure_or_load_native_pools(self):
        result = self.run_fresh(
            "import os,sys,json; import hub,main; "
            f"print(json.dumps([[os.environ.get(k) for k in {KEYS!r}], 'numpy' in sys.modules]))")
        self.assertEqual(result, [[None, None, None], False])

    @unittest.skipUnless(importlib.util.find_spec('threadpoolctl'), 'optional pool inspection')
    def test_defaults_reach_native_pool_and_child(self):
        result = self.run_fresh(
            "import os,json,subprocess,sys; "
            "from lib.hub_runtime.resources import configure_native_threads; "
            "configure_native_threads(); "
            "import numpy; from threadpoolctl import threadpool_info; "
            "child=subprocess.check_output([sys.executable,'-c',"
            "'import os,json;print(json.dumps(os.environ.get(\"OPENBLAS_NUM_THREADS\")))'],text=True); "
            "print(json.dumps([[(p['internal_api'],p['num_threads']) for p in threadpool_info() "
            "if p['user_api']=='blas'],json.loads(child)]))")
        self.assertTrue(result[0])
        self.assertTrue(all(count == 2 for _, count in result[0]))
        self.assertEqual(result[1], '2')

    def test_explicit_overrides_survive_repeated_startup_configuration(self):
        result = self.run_fresh(
            "import os,json; from lib.hub_runtime.resources import configure_native_threads; "
            "configure_native_threads(); configure_native_threads(); "
            f"print(json.dumps([os.environ[k] for k in {KEYS!r}]))",
            {'OPENBLAS_NUM_THREADS':'3','OMP_NUM_THREADS':'4'})
        self.assertEqual(result, ['3','2','4'])


if __name__ == '__main__':
    unittest.main()
