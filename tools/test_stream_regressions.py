"""Regression checks for countdown cues and streaming track routing."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from league.core.game_state_detector import GameStateDetector
from obs.interaction import ensure_input_on_stream_track
from specific_song.player import SongPlayer
import threading

class RegressionTests(unittest.TestCase):
    def test_pending_stop_retries_start_once_but_not_song_end(self):
        player = SongPlayer.__new__(SongPlayer)
        player._lock = threading.Lock()
        player._abort_flag = False
        player._paused = False
        states = iter(['OBS_MEDIA_STATE_STOPPED'] * 3
                      + ['OBS_MEDIA_STATE_PLAYING'] * 6
                      + ['OBS_MEDIA_STATE_ENDED'] * 3)
        now = [0.0]
        def sleep(_):
            now[0] += .5
        with patch('specific_song.player.obs.get_media_state', side_effect=lambda _: next(states)), \
             patch('specific_song.player.obs.restart_media') as restart, \
             patch('specific_song.player.time.time', side_effect=lambda: now[0]), \
             patch('specific_song.player.time.sleep', side_effect=sleep):
            self.assertTrue(player._poll_until_done('music'))
        restart.assert_called_once_with('music')

    def test_countdown_once_per_death_and_never_after_respawn(self):
        events=Mock(); detector=GameStateDetector(events)
        for dead,timer in [(False,0),(True,20),(True,3.2),(True,2.7),(True,1),(False,0)]:
            detector._detect_death_respawn({'isDead':dead,'respawnTimer':timer})
        self.assertEqual([call.args[0] for call in events.emit.call_args_list],['death','respawn_3s','respawn'])
        detector._detect_death_respawn({'isDead':True,'respawnTimer':2})
        self.assertEqual([call.args[0] for call in events.emit.call_args_list][-2:],['death','respawn_3s'])

    def test_reconnect_and_skipped_countdown(self):
        events=Mock(); detector=GameStateDetector(events)
        detector._detect_death_respawn({'isDead':True,'respawnTimer':3})
        self.assertEqual(events.emit.call_args.args[0],'respawn_3s')
        events.reset_mock(); detector.reset()
        detector._detect_death_respawn({'isDead':True,'respawnTimer':4})
        detector._detect_death_respawn({'isDead':False,'respawnTimer':0})
        self.assertEqual([call.args[0] for call in events.emit.call_args_list],['respawn'])

    def test_stream_track_preserves_other_tracks(self):
        client=Mock()
        client.get_profile_parameter.side_effect=[SimpleNamespace(parameter_value='Advanced'),SimpleNamespace(parameter_value='3')]
        tracks={'1':False,'2':False,'3':False,'4':True,'5':False,'6':True}
        client.get_input_audio_tracks.return_value=SimpleNamespace(input_audio_tracks=tracks)
        with patch('obs.interaction.get_obs',return_value=client): self.assertEqual(ensure_input_on_stream_track('music'),3)
        client.set_input_audio_tracks.assert_called_once_with('music',{**tracks,'3':True})

    def test_simple_output_uses_track_one(self):
        client=Mock(); client.get_profile_parameter.return_value=SimpleNamespace(parameter_value='Simple')
        client.get_input_audio_tracks.return_value=SimpleNamespace(input_audio_tracks={'1':True,'2':False})
        with patch('obs.interaction.get_obs',return_value=client): self.assertEqual(ensure_input_on_stream_track('music'),1)
        client.set_input_audio_tracks.assert_not_called()

if __name__=='__main__': unittest.main()
