"""Song lookup contracts: aliases, threshold boundaries, and stable rankings."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths

ensure_import_paths()
from specific_song.matcher import find_best_match, rank_matches, _score_pair


class SongMatcherTests(unittest.TestCase):
    def setUp(self):
        self.first = {'name': 'Running Up That Hill', 'aliases': ['Kate Bush'], 'source': 'hill'}
        self.tie = {'name': 'Running Up That Hill', 'source': 'cover'}
        self.library = [self.first, self.tie, {'name': 'Run'}, {'name': '', 'aliases': []}]

    def test_alias_and_punctuation_return_original_record(self):
        for query in ('KATE BUSH!', 'running-up that hill'):
            with self.subTest(query=query):
                song, score = find_best_match(query, self.library)
                self.assertIs(song, self.first)
                self.assertEqual(score, 1.0)

    def test_ties_keep_library_order(self):
        ranked = rank_matches('running up that hill', self.library)
        self.assertIs(ranked[0][0], self.first)
        self.assertIs(ranked[1][0], self.tie)
        self.assertEqual(ranked[0][1], ranked[1][1])
        self.assertIs(find_best_match('running up that hill', self.library)[0], self.first)

    def test_threshold_is_inclusive_and_ranking_includes_rejected_matches(self):
        query = 'running hill'
        ranked = rank_matches(query, self.library)
        score = ranked[0][1]
        self.assertEqual(find_best_match(query, self.library, score), ranked[0])
        self.assertIsNone(find_best_match(query, self.library, score + .001))
        self.assertEqual(len(ranked), len(self.library))

    def test_empty_queries_and_slice_limits_keep_existing_behavior(self):
        self.assertIsNone(find_best_match('   ', self.library, threshold=0))
        self.assertIsNone(find_best_match('song', []))
        self.assertEqual(rank_matches('song', []), [])
        ranked = rank_matches('', self.library)
        self.assertTrue(all(score == 0 for _, score in ranked))
        for limit in (0, 1, 2, -1, 100):
            self.assertEqual(rank_matches('', self.library, limit), ranked[:limit])
        self.assertIs(find_best_match('!!!', self.library, threshold=0)[0], self.first)

    def test_short_substring_does_not_beat_full_song_name(self):
        self.assertLess(_score_pair('running up that hill', 'run'), 1.0)
        self.assertEqual(_score_pair('running up that hill', 'running up that hill'), 1.0)

    def test_hub_match_test_scores_once_and_preserves_response(self):
        from lib.paths import load_project_env
        load_project_env()
        from hub_ui.server import _Handler
        from specific_song import config, matcher

        handler = object.__new__(_Handler)
        handler._live_dict = Mock(return_value={})
        handler._json = Mock()
        handler._err = Mock()
        with tempfile.TemporaryDirectory() as directory:
            library_path = Path(directory) / 'songs.json'
            library_path.write_text(json.dumps(self.library), encoding='utf-8')
            with patch.object(config, 'SONGS_JSON', library_path), patch.object(config, 'MATCH_THRESHOLD', .4):
                for query in ('Kate Bush', 'qzxw', '  '):
                    top = rank_matches(query.strip(), self.library) if query.strip() else []
                    best = find_best_match(query.strip(), self.library)
                    with patch.object(matcher, '_score_pair', wraps=matcher._score_pair) as score:
                        handler._ss_post('match_test', {'query': query})
                        # Two candidates for the first song, one each for the next two.
                        self.assertEqual(score.call_count, 4 if query.strip() else 0)
                    handler._json.assert_called_with(200, {
                        'match': {'song': best[0], 'score': round(best[1] * 100)} if best else None,
                        'top': [{'song': song, 'score': round(value * 100)} for song, value in top],
                    })
                library_path.unlink()
                handler._ss_post('match_test', {'query': 'Kate Bush'})
                handler._json.assert_called_with(200, {'match': None, 'top': []})
        handler._err.assert_not_called()


if __name__ == '__main__':
    unittest.main()
