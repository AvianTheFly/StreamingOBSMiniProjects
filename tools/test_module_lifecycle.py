"""Module playback, random replacement and shutdown without real OBS or keys."""
import json
import queue
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths()
load_project_env()
from lib.runtime_cleanup import run_cleanup
from lib.shared_media.random_mode import RandomMode
from love_me.player import SequentialPlayer
from love_me import main as love_main
from specific_song import main as song_main
from obs import media as interaction


class SequentialPlaybackTests(unittest.TestCase):
    def test_items_advance_naturally_and_stop_at_end(self):
        with patch('love_me.player.obs') as obs:
            obs.wait_for_media_end.return_value = True
            player = SequentialPlayer()
            for index in range(len(player.items)):
                player.play_next_item()
                self.assertEqual(player.current_index, index + 1)
            player.play_next_item()
            self.assertEqual(obs.show_source.call_count, len(player.items))
            self.assertFalse(player.is_busy)

    def test_skip_waits_for_old_cleanup_and_only_new_item_resumes_music(self):
        entered, cleaning, release = threading.Event(), threading.Event(), threading.Event()
        old_callback, new_callback = Mock(), Mock()
        with patch('love_me.player.obs') as obs:
            player = SequentialPlayer()
            first = player.items[0]['monitor_name']
            display = player.items[0]['display_name']
            def wait(source, cancelled, **kwargs):
                if source == first:
                    entered.set()
                    deadline = time.monotonic() + 2
                    while not cancelled() and time.monotonic() < deadline:
                        time.sleep(.01)
                    return False
                return True
            def hide(scene, name):
                if name == display:
                    cleaning.set()
                    self.assertTrue(release.wait(2))
            obs.wait_for_media_end.side_effect = wait
            obs.hide_source.side_effect = hide
            old = player.play_next_async(old_callback)
            self.assertTrue(entered.wait(2))
            latest = player.abort_and_advance(new_callback)
            try:
                self.assertTrue(cleaning.wait(2))
                self.assertEqual(obs.show_source.call_count, 1)
                old_callback.assert_not_called()
                new_callback.assert_not_called()
            finally:
                release.set()
            self.assertTrue(old.wait(2))
            self.assertTrue(latest.wait(2))
            old_callback.assert_not_called()
            new_callback.assert_called_once()
            self.assertEqual(player.current_index, 2)

    def test_abort_resets_and_resumes_once(self):
        entered, release = threading.Event(), threading.Event()
        callback = Mock()
        with patch('love_me.player.obs') as obs:
            def wait(cancelled, **kwargs):
                entered.set()
                self.assertTrue(release.wait(2))
                self.assertTrue(cancelled())
                return False
            obs.wait_for_media_end.side_effect = wait
            player = SequentialPlayer()
            done = player.play_next_async(callback)
            self.assertTrue(entered.wait(2))
            try:
                player.abort()
                callback.assert_called_once()
                self.assertEqual(player.current_index, 0)
            finally:
                release.set()
            self.assertTrue(done.wait(2))
            callback.assert_called_once()
            self.assertFalse(player.is_busy)

    def test_playback_error_hides_source_and_releases_busy(self):
        with patch('love_me.player.obs') as obs:
            obs.show_source.side_effect = RuntimeError('OBS disconnected')
            player = SequentialPlayer()
            callback = Mock()
            self.assertTrue(player.play_next_async(callback).wait(2))
            obs.hide_source.assert_called_once()
            callback.assert_called_once()
            self.assertFalse(player.is_busy)

    def test_media_wait_cancels_before_any_obs_request(self):
        with patch.object(interaction, 'get_media_state') as state:
            self.assertFalse(interaction.wait_for_media_end('test', cancelled=lambda: True))
        state.assert_not_called()

    def test_module_exception_unsubscribes_and_aborts(self):
        player = Mock(lock=threading.RLock())
        inbox = Mock()
        inbox.get.side_effect = RuntimeError('queue failed')
        with patch.object(love_main, 'SequentialPlayer', return_value=player), \
             patch.object(love_main, 'subscribe_global_hotkeys', return_value=123), \
             patch.object(love_main, 'unsubscribe_global_hotkeys') as unsubscribe:
            with self.assertRaises(RuntimeError):
                love_main.run(inbox, threading.Event())
        unsubscribe.assert_called_once_with(123)
        player.abort.assert_called_once()


class RandomLifecycleTests(unittest.TestCase):
    def test_stopped_old_session_cannot_clear_new_active_state(self):
        entered, release, new_entered = threading.Event(), threading.Event(), threading.Event()
        stop_playback = Mock()
        mode = RandomMode('test', threading.Event(), stop_playback, join_timeout=.01)
        old_events = []
        def old(*, cancelled):
            old_events.append(cancelled)
            entered.set()
            release.wait(2)
        def new(*, cancelled):
            new_entered.set()
            cancelled.wait(2)
        mode.start(old)
        self.assertTrue(entered.wait(2))
        old_thread = mode._thread
        mode.start(new)
        try:
            self.assertTrue(new_entered.wait(2))
            self.assertTrue(old_events[0].is_set())
            release.set()
            old_thread.join(2)
            self.assertTrue(mode.active[0])
        finally:
            release.set()
            mode.stop()
        self.assertFalse(mode.active[0])

    def test_stop_before_thread_runs_prevents_playback(self):
        mode = RandomMode('test', threading.Event(), Mock())
        pending = []
        def thread(**kwargs):
            pending.append(kwargs['target'])
            return Mock(is_alive=Mock(return_value=False))
        target = Mock()
        with patch('lib.shared_media.random_mode.threading.Thread', side_effect=thread):
            mode.start(target)
            mode.stop()
            pending[0]()
        target.assert_not_called()
        self.assertFalse(mode.active[0])

    def test_failed_start_does_not_leave_mode_active(self):
        mode = RandomMode('test', threading.Event(), Mock())
        with patch('lib.shared_media.random_mode.threading.Thread') as thread:
            thread.return_value.start.side_effect = RuntimeError('no thread')
            with self.assertRaises(RuntimeError):
                mode.start(Mock())
        self.assertFalse(mode.active[0])
        self.assertTrue(mode._cancelled.is_set())

    def test_one_cleanup_error_does_not_skip_other_resources(self):
        failed, remaining = Mock(side_effect=RuntimeError('OBS unavailable')), Mock()
        run_cleanup('test', failed, remaining)
        remaining.assert_called_once()

    def test_music_random_waits_for_completion_even_before_player_reports_busy(self):
        from specific_song.interface import _live
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            songs = root / 'songs.json'
            songs.write_text(json.dumps([{'id': 'a', 'name': 'A', 'source': 'a'}]))
            stop, ready, started = threading.Event(), threading.Event(), threading.Event()
            first, second = threading.Event(), threading.Event()
            player = Mock(is_busy=False)
            def play(source):
                started.set()
                return first if player.play_async.call_count == 1 else second
            player.play_async.side_effect = play
            with patch.dict(_live, {}, clear=True), \
                 patch.object(song_main, '_HERE', root), patch.object(song_main, 'SONGS_JSON', songs), \
                 patch.object(song_main, '_sync_assets_to_library'), \
                 patch.object(song_main, 'SongPlayer', return_value=player), \
                 patch.object(song_main.music_service, 'register'), \
                 patch.object(song_main, 'subscribe_global_hotkeys', return_value=1), \
                 patch.object(song_main, 'unsubscribe_global_hotkeys') as unsubscribe:
                worker = threading.Thread(target=song_main.run, args=(queue.Queue(), stop),
                                          kwargs={'startup_event': ready}, daemon=True)
                worker.start()
                try:
                    self.assertTrue(ready.wait(2))
                    _live['start_random']()
                    self.assertTrue(started.wait(2))
                    time.sleep(.35)
                    self.assertEqual(player.play_async.call_count, 1)
                    first.set()
                    deadline = time.monotonic() + 2
                    while player.play_async.call_count < 2 and time.monotonic() < deadline:
                        time.sleep(.01)
                    self.assertEqual(player.play_async.call_count, 2)
                    _live['stop_random']()
                    self.assertFalse(_live['rand_active'][0])
                finally:
                    stop.set()
                    worker.join(3)
                self.assertFalse(worker.is_alive())
                unsubscribe.assert_called_once_with(1)
                player.stop.assert_called_once()


if __name__ == '__main__':
    unittest.main()
