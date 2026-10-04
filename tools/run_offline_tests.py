"""Run the Hub's Python regressions with OBS network access disabled.

Optional arguments are unittest module names. Background-thread exceptions fail
the run rather than getting lost beneath a successful main-thread test result.
"""
import sys
from pathlib import Path
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.paths import ensure_import_paths, load_project_env
from tools.offline_test_resources import configure_test_process, test_run_slot
ensure_import_paths()
load_project_env()


def _run_tests():
    names = sys.argv[1:] or ['tools.' + path.stem for path in sorted((ROOT / 'tools').glob('test_*.py'))]
    if not sys.argv[1:]:
        names.extend('league_api.' + path.stem for path in sorted(
            (ROOT / 'mini projects' / 'league_api').glob('test_*.py')))
        names.extend('footage_manager.' + path.stem for path in sorted(
            (ROOT / 'footage_manager').glob('test_*.py')))
    failures = []
    original = threading.excepthook
    def thread_failed(args):
        failures.append(f'{args.thread.name}: {args.exc_type.__name__}: {args.exc_value}')
        original(args)
    threading.excepthook = thread_failed
    try:
        with patch('obs.client._connect', side_effect=AssertionError('Offline test attempted OBS connection')), \
             patch('obsws_python.EventClient', side_effect=AssertionError('Offline test attempted OBS event connection')):
            suite = unittest.TestLoader().loadTestsFromNames(names)
            result = unittest.TextTestRunner(verbosity=1).run(suite)
        if failures:
            print('Background failures:', '\n'.join(failures), file=sys.stderr)
        return 0 if result.wasSuccessful() and not failures else 1
    finally:
        threading.excepthook = original


def main():
    configure_test_process()
    with test_run_slot(ROOT):
        return _run_tests()


if __name__ == '__main__':
    raise SystemExit(main())
