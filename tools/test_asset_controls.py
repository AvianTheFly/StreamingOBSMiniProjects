from pathlib import Path
import threading
import unittest
from unittest.mock import Mock
from lib.shared_media.asset_controls import AssetControls
from lib.snapshots import SnapshotMap


class AssetControlsTests(unittest.TestCase):
    def test_named_clip_uses_existing_player_and_rejects_missing_or_stopped_requests(self):
        index = SnapshotMap({'loading screen mastery': (Path('private/Loading Screen Mastery.mp4'), 'tt__player')})
        playback, stop_random = Mock(), Mock()
        stop = threading.Event()
        controls = AssetControls(index, playback, stop, stop_random)
        self.assertEqual(controls.catalog(), [{'source': 'loading screen mastery', 'name': 'Loading Screen Mastery'}])
        self.assertFalse(controls.play('missing')['ok'])
        stop_random.assert_not_called()
        self.assertTrue(controls.play(' Loading Screen Mastery ')['ok'])
        playback.play_asset.assert_called_once_with('loading screen mastery')
        stop_random.assert_called_once()
        index.replace({})
        self.assertFalse(controls.play('loading screen mastery')['ok'])
        stop.set()
        self.assertEqual(controls.catalog(), [])
        self.assertFalse(controls.play('loading screen mastery')['ok'])
        self.assertEqual(playback.play_asset.call_count, 1)
