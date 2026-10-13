"""Runner scope must keep new runtime tests and allow explicit artifact checks."""
from pathlib import Path
import tempfile
import unittest

from tools.run_offline_tests import selected_modules


class OfflineSelectionTests(unittest.TestCase):
    def test_default_discovers_new_runtime_tests_without_standalone_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in ('tools/test_future_feature.py', 'tools/test_channel_trailer.py',
                             'tools/probe_spotify_isolation.py',
                             'mini projects/league_api/test_future_policy.py',
                             'footage_manager/test_future_review.py'):
                file = root / relative
                file.parent.mkdir(parents=True, exist_ok=True)
                # Discovery must not execute tests or start their dependencies.
                file.write_text("raise AssertionError('imported while listing')")
            self.assertCountEqual(selected_modules(root=root), [
                'tools.test_future_feature', 'league_api.test_future_policy',
                'footage_manager.test_future_review'])
            self.assertCountEqual(selected_modules(root=root, include_artifacts=True), [
                'tools.test_future_feature', 'tools.test_channel_trailer',
                'league_api.test_future_policy', 'footage_manager.test_future_review'])

    def test_explicit_selection_keeps_artifact_modules_and_individual_methods(self):
        names = ['tools.test_channel_trailer',
                 'tools.test_song_analysis.AnalysisTests.test_cache_roundtrip_invalidation_and_corruption']
        self.assertEqual(selected_modules(names), names)


if __name__ == '__main__':
    unittest.main()
