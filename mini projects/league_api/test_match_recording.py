import tempfile
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from .match_recording import MatchRecording


class FakeOBS:
    def __init__(self, root):
        self.root = root
        self.active = False
        self.paused = False
        self.duration = 0
        self.starts = self.stops = 0

    def get_record_status(self):
        return SimpleNamespace(output_active=self.active, output_paused=self.paused,
                               output_duration=self.duration)

    def get_record_directory(self):
        return SimpleNamespace(record_directory=str(self.root))

    def start_record(self):
        self.active = True
        self.duration = 0
        self.starts += 1

    def stop_record(self):
        self.active = False
        self.stops += 1
        path = self.root / f'game-{self.stops}.mkv'
        path.write_bytes(b'game recording')
        return SimpleNamespace(output_path=str(path))

    def resume_record(self):
        self.paused = False


class RecordingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.obs = FakeOBS(self.root)
        self.now = 0
        self.owner = MatchRecording(self.root, self.root, enabled=True,
                                    obs_factory=lambda: self.obs, clock=lambda: self.now, wall=lambda: 1700000000 + self.now)

    def tick(self, phase, advance=2, **kwargs):
        self.now += advance
        if self.obs.active:
            self.obs.duration += int(advance * 1000)
        self.owner.tick(phase, **kwargs)
        if self.owner.closing:
            for _ in range(2):
                self.now += 1
                self.owner.tick(phase, **kwargs)

    def finish(self):
        self.tick('ChampSelect')
        self.tick('InProgress', live=True)
        self.tick('EndOfGame', ended=True)
        self.tick('Lobby', advance=60)

    def test_full_match_and_exact_deadline(self):
        self.tick('ChampSelect')
        self.tick('InProgress', live=True)
        self.tick('InProgress', ended=True)
        self.tick('Lobby', advance=59)
        self.assertEqual(self.obs.stops, 0)
        self.tick('Lobby', advance=1)
        self.assertEqual((self.obs.starts, self.obs.stops), (1, 1))
        self.assertEqual(self.owner.snapshot()['pending']['decision'], 'pending')

    def test_disconnect_is_not_match_end(self):
        self.tick('InProgress', live=True)
        self.tick(None, advance=100)
        self.assertTrue(self.obs.active)
        self.assertIsNone(self.owner.stop_at)

    def test_manual_recording_is_not_stopped(self):
        self.obs.start_record()
        self.tick('ChampSelect')
        self.tick('EndOfGame')
        self.tick('Lobby', advance=60)
        self.assertEqual(self.obs.stops, 0)
        self.assertFalse(self.owner.owned)

    def test_recheck_restarts_stopped_recording_and_resumes_pause(self):
        self.tick('ChampSelect')
        self.obs.active = False
        self.tick('InProgress', live=True)
        self.assertEqual(self.obs.starts, 2)
        self.obs.paused = True
        self.tick('InProgress', live=True)
        self.assertFalse(self.obs.paused)

    def test_replaced_recording_releases_ownership(self):
        self.tick('ChampSelect')
        self.tick('InProgress', advance=20, live=True)
        self.obs.duration = -3000
        self.tick('EndOfGame')
        self.tick('Lobby', advance=60)
        self.assertEqual(self.obs.stops, 0)

    def test_new_draft_closes_old_tail_without_stopping_new_match_later(self):
        self.tick('ChampSelect')
        self.tick('EndOfGame', ended=True)
        self.tick('ChampSelect', ended=True)
        self.assertEqual((self.obs.starts, self.obs.stops), (2, 1))
        self.tick('GameStart', ended=True)
        self.tick('InProgress', advance=70, live=True)
        self.assertTrue(self.obs.active)
        self.assertEqual(self.obs.stops, 1)

    def test_stale_inprogress_cannot_restart_finished_capture(self):
        self.finish()
        self.tick('InProgress')
        self.assertEqual(self.obs.starts, 1)

    def test_keep_survives_restart_and_delete_targets_completed_file(self):
        self.finish()
        path = Path(self.owner.snapshot()['pending']['path'])
        owner = MatchRecording(self.root, self.root, obs_factory=lambda: self.obs)
        owner.decide('kept')
        kept = self.root / 'Kept Games' / path.name
        self.assertFalse(path.exists())
        self.assertTrue(kept.exists())
        self.assertIsNone(owner.snapshot()['pending'])
        self.tick('ChampSelect')
        self.tick('Lobby')
        self.tick('Lobby', advance=60)
        latest = Path(self.owner.snapshot()['pending']['path'])
        self.owner.decide('deleted')
        self.assertFalse(latest.exists())
        self.assertTrue(kept.exists())

    def test_changed_file_or_active_obs_blocks_delete(self):
        self.finish()
        path = Path(self.owner.snapshot()['pending']['path'])
        self.obs.active = True
        with self.assertRaises(ValueError):
            self.owner.decide('deleted')
        self.obs.active = False
        path.write_bytes(b'replaced file')
        with self.assertRaises(ValueError):
            self.owner.decide('deleted')
        self.assertTrue(path.exists())

    def test_wrong_obs_directory_does_not_start(self):
        self.obs.root = self.root / 'other'
        self.tick('ChampSelect')
        self.assertEqual(self.obs.starts, 0)
        self.assertIn('folder', self.owner.error)

    def test_deciding_latest_never_exposes_older_pending_file(self):
        self.finish()
        older = Path(self.owner.snapshot()['pending']['path'])
        self.tick('ChampSelect')
        self.tick('EndOfGame')
        self.tick('Lobby', advance=60)
        self.owner.decide('kept')
        self.owner.decide('deleted')
        with self.assertRaises(ValueError):
            self.owner.decide('deleted')
        self.assertTrue(older.exists())

    def test_malformed_journal_preserved(self):
        journal = self.root / 'match_recordings.json'
        journal.write_text('broken personal history')
        with self.assertRaises(ValueError):
            MatchRecording(self.root, self.root)
        self.assertEqual(journal.read_text(), 'broken personal history')

    def test_forgotten_games_stay_unreviewed_across_matches_and_restart(self):
        self.finish()
        first = Path(self.owner.snapshot()['pending']['path'])
        self.assertEqual(first.parent, self.root / 'Unreviewed Games')
        self.tick('ChampSelect')
        self.tick('EndOfGame')
        self.tick('Lobby', advance=60)
        second = Path(self.owner.snapshot()['pending']['path'])
        restarted = MatchRecording(self.root, self.root, obs_factory=lambda: self.obs)
        restarted.decide('kept')
        self.assertTrue(first.exists())
        self.assertFalse(second.exists())
        self.assertTrue((self.root / 'Kept Games' / second.name).exists())

    def test_keep_preserves_existing_destination_with_same_name(self):
        self.finish()
        pending = Path(self.owner.snapshot()['pending']['path'])
        kept = self.root / 'Kept Games'
        kept.mkdir()
        existing = kept / pending.name
        existing.write_bytes(b'older kept recording')
        self.owner.decide('kept')
        self.assertEqual(existing.read_bytes(), b'older kept recording')
        self.assertEqual(len(list(kept.glob('*.mkv'))), 2)

    def test_failed_keep_journal_write_rolls_back_move(self):
        self.finish()
        pending = Path(self.owner.snapshot()['pending']['path'])
        with patch.object(self.owner.library, 'update', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.owner.decide('kept')
        self.assertTrue(pending.exists())
        self.assertEqual(self.owner.snapshot()['pending']['path'], str(pending))

    def test_failed_capture_journal_write_preserves_original(self):
        original = self.root / 'game.mkv'
        original.write_bytes(b'completed game')
        with patch.object(self.owner.library, 'update', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.owner._remember(str(original))
        self.assertTrue(original.exists())
    def test_expiry_removes_only_pending_after_three_days(self):
        self.finish()
        first = Path(self.owner.snapshot()['pending']['path'])
        self.tick('ChampSelect')
        self.owner.decide('kept')
        self.tick('EndOfGame')
        self.tick('Lobby', advance=60)
        kept = Path(self.owner.snapshot()['latest']['path'])
        self.now += 3 * 86400 - 100
        self.owner.tick('Lobby')
        self.assertTrue(first.exists())
        self.now += 101
        self.owner.tick('Lobby')
        self.assertFalse(first.exists())
        self.assertTrue(kept.exists())
        self.assertEqual(self.owner.library.records[0]['decision'], 'expired')

    def test_active_keep_and_delete_are_deferred_and_cancellable(self):
        self.tick('ChampSelect')
        self.owner.decide('deleted')
        self.assertTrue(self.obs.active)
        self.owner.decide('kept')
        self.tick('EndOfGame')
        self.tick('Lobby', advance=60)
        self.assertEqual(self.owner.snapshot()['latest']['decision'], 'kept')
        self.tick('ChampSelect')
        self.owner.decide('deleted')
        self.tick('EndOfGame')
        self.tick('Lobby', advance=60)
        self.assertEqual(self.owner.snapshot()['latest']['decision'], 'deleted')
        self.assertFalse(Path(self.owner.snapshot()['latest']['path']).exists())

    def test_replay_marker_attaches_after_recording_closes_and_moves(self):
        self.tick('ChampSelect')
        self.tick('InProgress', advance=40, live=True)
        pressed = 1700000000 + self.now
        self.owner.enqueue_replay({'stage':'requested','id':'clip-1','pressed_at':pressed,'seconds':15})
        self.tick('InProgress', live=True)
        self.tick('EndOfGame')
        self.tick('Lobby', advance=60)
        self.owner.decide('kept')
        self.owner.enqueue_replay({'stage':'saved','id':'clip-1','path':'separate-clip.mp4'})
        self.tick('Lobby')
        marker = self.owner.snapshot()['latest']['markers'][0]
        self.assertEqual(marker['offset_seconds'], 40)
        self.assertEqual(marker['range_start_seconds'], 25)
        self.assertEqual(marker['clip_path'], 'separate-clip.mp4')
        restarted = MatchRecording(self.root, self.root, obs_factory=lambda:self.obs)
        self.assertEqual(restarted.snapshot()['latest']['markers'][0], marker)

    def test_manual_marker_is_not_assigned_to_previous_game(self):
        self.finish()
        with self.assertRaises(ValueError):
            self.owner.mark()

    def test_fresh_live_game_overrides_stale_lobby_phase(self):
        self.tick('ChampSelect')
        self.tick('Lobby', live=True)
        self.assertIsNone(self.owner.stop_at)
        self.assertTrue(self.owner.owned)

    def test_expiry_preserves_modified_or_active_files(self):
        self.finish()
        path = Path(self.owner.snapshot()['latest']['path'])
        self.now += 3 * 86400 + 1
        self.obs.active = True
        self.owner.tick('Lobby')
        self.assertTrue(path.exists())
        self.obs.active = False
        path.write_bytes(b'changed personal video')
        self.tick('Lobby', advance=61)
        self.assertTrue(path.exists())
        self.assertIn('Cleanup deferred', self.owner.snapshot()['cleanup'])

    def test_failed_delete_publication_does_not_unlink(self):
        self.finish()
        path = Path(self.owner.snapshot()['latest']['path'])
        with patch.object(self.owner.library, 'update', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.owner.decide('deleted')
        self.assertTrue(path.exists())

    def test_delete_intent_recovery_after_unlink(self):
        self.finish()
        row = self.owner.snapshot()['latest']
        self.owner.library.amend(row, decision='deleting', delete_outcome='deleted')
        Path(row['path']).unlink()
        restarted = MatchRecording(self.root, self.root, enabled=True, obs_factory=lambda:self.obs)
        restarted.tick('Lobby')
        self.assertEqual(restarted.snapshot()['latest']['decision'], 'deleted')

    def test_legacy_pending_receives_full_grace_window(self):
        self.finish()
        row = self.owner.snapshot()['latest']
        self.owner.library.update(lambda data: data['recordings'][0].pop('expires_at'))
        self.now += 100 * 86400
        self.owner.tick('Lobby')
        self.assertTrue(Path(row['path']).exists())
        self.assertEqual(self.owner.snapshot()['latest']['expires_at'], 1700000000 + self.now + 3*86400)

    def test_finalization_waits_for_stable_file_and_recovers_restart(self):
        self.tick('ChampSelect')
        self.tick('EndOfGame')
        self.now += 60
        self.owner.tick('Lobby')
        self.assertIsNotNone(self.owner.closing)
        self.assertIsNone(self.owner.snapshot()['latest'])
        restarted = MatchRecording(self.root, self.root, enabled=True, obs_factory=lambda:self.obs,
                                   clock=lambda:self.now, wall=lambda:1700000000+self.now)
        restarted.tick('Lobby')
        self.assertIsNone(restarted.snapshot()['latest'])
        self.now += 1
        restarted.tick('Lobby')
        self.assertIsNotNone(restarted.snapshot()['latest'])
