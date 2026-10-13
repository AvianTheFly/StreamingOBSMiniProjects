"""Run the Hub's Python regressions with OBS network access disabled.

Optional arguments are unittest module names. Background-thread exceptions fail
the run rather than getting lost beneath a successful main-thread test result.
Standalone film/artifact checks are opt-in with --include-artifacts or by name.
"""
import argparse
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


# These exercise standalone exports in stream_brand, not the running Hub.
# Keep their public module paths for the artifact exporters/review archives.
ARTIFACT_MODULES = frozenset('tools.test_' + name for name in (
    'channel_trailer', 'cinematic_art', 'cinematic_sketch', 'illustrated_sketch',
    'intro_renderer', 'motion_audio', 'motion_sketch', 'sanctuary_sketch',
    'sketch_journey', 'spirit_slideshow',
))


def selected_modules(names=(), *, include_artifacts=False, root=ROOT):
    if names:
        return list(names)
    discovered = ['tools.' + path.stem for path in sorted((root / 'tools').glob('test_*.py'))]
    discovered.extend('league_api.' + path.stem for path in sorted(
        (root / 'mini projects' / 'league_api').glob('test_*.py')))
    discovered.extend('footage_manager.' + path.stem for path in sorted(
        (root / 'footage_manager').glob('test_*.py')))
    return [name for name in discovered if include_artifacts or name not in ARTIFACT_MODULES]


def _run_tests(names):
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('modules', nargs='*', help='unittest module, class or method names')
    parser.add_argument('--include-artifacts', action='store_true',
                        help='also run standalone film/storyboard export checks')
    parser.add_argument('--list', action='store_true', help='list selected modules without importing them')
    args = parser.parse_args()
    names = selected_modules(args.modules, include_artifacts=args.include_artifacts)
    if args.list:
        print('\n'.join(names))
        return 0
    configure_test_process()
    with test_run_slot(ROOT):
        return _run_tests(names)


if __name__ == '__main__':
    raise SystemExit(main())
