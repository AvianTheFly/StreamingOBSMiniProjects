"""Shared voice ownership and routing, without a microphone or real inference."""
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from voice.service import VoiceService
from voice.ptt import VoicePTT


class VoiceServiceTests(unittest.TestCase):
    def setUp(self):
        self.backend = Mock()
        self.backend.is_ready.return_value = True
        self.backend.start_recording.return_value = True
        self.backend.diagnostics.return_value = {"ready": True}
        self.backend.capture_activity.return_value = {}
        self.service = VoiceService(self.backend)
        self.callback = Mock()
        self.done = threading.Event()
        self.client = self.service.register("music", 2, self.callback,
            completion=lambda text: self.done.set(), lockout=0)
        self.other = self.service.register("replay", 2, Mock(), lockout=0)
        self.timers = patch("voice.service.threading.Timer")
        self.timers.start()
        self.addCleanup(self.timers.stop)
        self.addCleanup(self.service.cancel)

    def infer(self, text="", error=""):
        call = self.backend.stop_and_transcribe.call_args
        if text:
            call.args[0](text)
        if error:
            call.kwargs["on_error"](error)
        call.kwargs["on_complete"]()

    def test_only_one_owner_and_foreign_stop_cannot_capture_its_audio(self):
        self.assertTrue(self.service.begin(self.client))
        self.assertFalse(self.service.begin(self.other))
        self.assertFalse(self.service.finish(self.other))
        self.assertFalse(self.service.cancel(self.other))
        self.assertEqual(self.service.state(self.client), "listening")
        self.backend.stop_and_transcribe.assert_not_called()
        self.backend.cancel_recording.assert_not_called()

    def test_silence_releases_session_and_notifies_completion_without_command(self):
        self.service.begin(self.client)
        self.service.finish(self.client)
        self.infer()
        self.assertTrue(self.done.wait(2))
        self.callback.assert_not_called()
        self.assertEqual(self.service.diagnostics()["history"][0]["outcome"], "empty")
        self.assertTrue(self.service.begin(self.other))

    def test_cancel_during_inference_discards_text_and_does_not_free_model_early(self):
        self.service.begin(self.client)
        self.service.finish(self.client)
        self.service.cancel(self.client)
        self.assertEqual(self.service.state(self.client), "cancelling")
        self.assertFalse(self.service.begin(self.other))
        self.infer("play song")
        self.callback.assert_not_called()
        self.assertEqual(self.service.diagnostics()["history"][0]["outcome"], "cancelled")
        self.assertTrue(self.service.begin(self.other))

    def test_cancel_recording_never_runs_inference(self):
        self.service.begin(self.client)
        self.assertTrue(self.service.cancel(self.client))
        self.backend.cancel_recording.assert_called_once_with("music")
        self.backend.stop_and_transcribe.assert_not_called()
        self.assertEqual(self.service.state(self.client), "idle")

    def test_late_timeout_and_ui_actions_cannot_stop_next_session(self):
        self.service.begin(self.client)
        old_id = self.service.diagnostics()["session_id"]
        self.service.cancel(self.client)
        self.service.begin(self.client)
        self.assertFalse(self.service.finish(self.client, old_id))
        self.assertFalse(self.service.cancel(session_id=old_id))
        self.assertEqual(self.service.state(self.client), "listening")

    def test_model_errors_are_visible_and_release_ownership(self):
        self.service.begin(self.client)
        self.service.finish(self.client)
        self.infer(error="inference failed")
        self.assertEqual(self.service.state(self.client), "idle")
        record = self.service.diagnostics()["history"][0]
        self.assertEqual(record["outcome"], "error")
        self.assertEqual(record["error"], "inference failed")
        self.callback.assert_not_called()

    def test_slow_consumer_does_not_hold_microphone_or_inference(self):
        entered = threading.Event()
        release = threading.Event()
        def callback(text):
            entered.set()
            release.wait(2)
        self.client.callback = callback
        self.addCleanup(release.set)
        self.service.begin(self.client)
        self.service.finish(self.client)
        self.infer("hello")
        self.assertTrue(entered.wait(2))
        self.assertTrue(self.service.begin(self.other))
        release.set()
        self.assertTrue(self.done.wait(2))

    def test_cancelled_queued_delivery_is_suppressed(self):
        threads = []
        def thread(**kwargs):
            threads.append(kwargs["target"])
            return Mock()
        self.service.begin(self.client)
        self.service.finish(self.client)
        with patch("voice.service.threading.Thread", side_effect=thread):
            self.infer("obsolete")
        self.service.cancel(self.client)
        threads[0]()
        self.callback.assert_not_called()

    def test_replacing_consumer_cancels_old_capture_and_delivery(self):
        self.service.begin(self.client)
        replacement = self.service.register("music", 2, Mock(), lockout=0)
        self.assertFalse(self.service.begin(self.client))
        self.assertTrue(self.service.begin(replacement))
        self.assertEqual(len(self.service.diagnostics()["consumers"]), 2)

    def test_timer_failure_releases_audio(self):
        with patch("voice.service.threading.Timer") as timer:
            timer.return_value.start.side_effect = RuntimeError("timer failed")
            with self.assertRaises(RuntimeError):
                self.service.begin(self.client)
        self.assertEqual(self.service.state(self.client), "idle")
        self.backend.cancel_recording.assert_called_once_with("music")

    def test_editor_uses_same_backend_and_cleans_temporary_audio(self):
        def transcribe(path):
            self.assertEqual(Path(path).read_bytes(), b"audio")
            self.upload_path = path
            self.assertFalse(self.service.begin(self.client))
            return "training phrase"
        self.backend.transcribe_file.side_effect = transcribe
        self.assertEqual(self.service.transcribe_upload(b"audio", "audio/wav"), "training phrase")
        self.assertFalse(Path(self.upload_path).exists())
        self.assertEqual(self.service.diagnostics()["history"][0]["owner"], "hotkey_editor")
        self.assertTrue(self.service.begin(self.client))

    def test_timed_upload_keeps_exclusive_model_and_returns_structured_result(self):
        result=dict(text='Where',words=[dict(text='Where',start=.4,end=.8)],segments=[])
        def transcribe(path,**options):
            self.assertTrue(options['word_timestamps'])
            self.assertFalse(self.service.begin(self.client))
            self.upload_path=path
            return result
        self.backend.transcribe_file.side_effect=transcribe
        self.assertEqual(self.service.transcribe_upload(b'audio','audio/mpeg',word_timestamps=True),result)
        self.assertFalse(Path(self.upload_path).exists())
        self.assertEqual(self.service.diagnostics()['state'],'idle')

    def test_timed_upload_failure_releases_temporary_file_and_session(self):
        def transcribe(path,**options):
            self.upload_path=path
            raise RuntimeError('alignment failed')
        self.backend.transcribe_file.side_effect=transcribe
        with self.assertRaises(RuntimeError):self.service.transcribe_upload(b'audio','audio/wav',word_timestamps=True)
        self.assertFalse(Path(self.upload_path).exists())
        self.assertEqual(self.service.diagnostics()['state'],'idle')

    def test_editor_busy_and_failure_leave_session_correct(self):
        self.service.begin(self.client)
        with self.assertRaises(RuntimeError):
            self.service.transcribe_upload(b"audio")
        self.assertEqual(self.service.state(self.client), "listening")
        self.service.cancel(self.client)
        self.backend.transcribe_file.side_effect = RuntimeError("decode failed")
        with self.assertRaises(RuntimeError):
            self.service.transcribe_upload(b"audio")
        self.assertEqual(self.service.diagnostics()["state"], "idle")
        self.assertEqual(self.service.diagnostics()["history"][0]["error"], "decode failed")

    def test_history_bounded_and_clearable(self):
        for _ in range(60):
            self.service.begin(self.client)
            self.service.cancel(self.client)
        self.assertEqual(len(self.service.diagnostics()["history"]), 50)
        self.service.clear_history()
        self.assertEqual(self.service.diagnostics()["history"], [])

    def test_summary_keeps_session_state_without_copying_history(self):
        self.service.begin(self.client)
        summary = self.service.diagnostics(include_details=False)
        self.assertEqual(summary['owner'], 'music')
        self.assertEqual(summary['state'], 'listening')
        self.assertNotIn('history', summary)
        self.assertNotIn('consumers', summary)
        self.service.finish(self.client)
        self.infer('private phrase')
        self.assertTrue(self.done.wait(2))
        self.assertEqual(self.service.diagnostics()['history'][0]['text'], 'private phrase')

    def test_startup_rejection_is_immediate(self):
        self.backend.is_ready.return_value = False
        self.assertFalse(self.service.begin(self.client))
        self.backend.start_recording.assert_not_called()

    def test_ptt_is_adapter_over_service_and_double_trigger_finishes(self):
        ptt = VoicePTT(2, Mock(), tag="adapter", voice_service=self.service)
        ptt._on_trigger_sync()
        self.assertTrue(ptt.is_recording)
        ptt._on_trigger_sync()
        self.assertEqual(ptt.state, "processing")
        self.infer()
        self.assertEqual(ptt.state, "idle")

    def test_speech_can_continue_past_old_two_second_deadline(self):
        with patch('voice.service.time.monotonic', return_value=100):
            self.service.begin(self.client)
        session = self.service._active
        self.backend.capture_activity.return_value = dict(speech_detected=True, last_speech_at=103)
        with patch('voice.service.time.monotonic', return_value=103.2):
            self.assertTrue(self.service._check_endpoint(session))
        self.backend.stop_and_transcribe.assert_not_called()
        self.assertEqual(self.service.state(self.client), 'listening')

    def test_quiet_pause_finishes_once_and_preserves_original_replay_cutoff(self):
        self.client.timed_callback = Mock()
        with patch('voice.service.time.monotonic', return_value=100):
            self.service.begin(self.client)
        session = self.service._active
        self.backend.capture_activity.return_value = dict(speech_detected=True, last_speech_at=101)
        with patch('voice.service.time.monotonic', return_value=102.9):
            self.assertTrue(self.service._check_endpoint(session))
        with patch('voice.service.time.monotonic', return_value=103.1):
            self.assertFalse(self.service._check_endpoint(session))
            self.assertFalse(self.service._check_endpoint(session))
        self.backend.stop_and_transcribe.assert_called_once()
        self.infer('save dragon')
        self.assertTrue(self.done.wait(2))
        self.client.timed_callback.assert_called_once_with('save dragon', session.started_at)
        self.assertEqual(self.service.diagnostics()['history'][0]['finish_reason'], 'quiet pause after speech')

    def test_five_second_cap_even_while_speaking(self):
        with patch('voice.service.time.monotonic', return_value=100):
            self.service.begin(self.client)
        session = self.service._active
        self.backend.capture_activity.return_value = dict(speech_detected=True, last_speech_at=105)
        with patch('voice.service.time.monotonic', return_value=105):
            self.assertFalse(self.service._check_endpoint(session))
        self.assertEqual(self.service.state(self.client), 'processing')
        self.assertEqual(session.finish_reason, 'five-second safety limit')

    def test_no_speech_releases_capture_without_inference_and_completes_consumer(self):
        with patch('voice.service.time.monotonic', return_value=100):
            self.service.begin(self.client)
        session = self.service._active
        with patch('voice.service.time.monotonic', return_value=102.1):
            self.assertTrue(self.service._check_endpoint(session))
        with patch('voice.service.time.monotonic', return_value=105):
            self.assertFalse(self.service._check_endpoint(session))
        self.assertTrue(self.done.wait(2))
        self.callback.assert_not_called()
        self.backend.stop_and_transcribe.assert_not_called()
        self.backend.cancel_recording.assert_called_once_with('music')
        self.assertEqual(self.service.diagnostics()['history'][0]['outcome'], 'empty')

    def test_failed_detector_remains_bounded_and_never_automatically_delivers_audio(self):
        with patch('voice.service.time.monotonic', return_value=100):
            self.service.begin(self.client)
        session = self.service._active
        self.backend.capture_activity.return_value = dict(speech_detected=True,
            last_speech_at=101, endpoint_error='detector failed')
        with patch('voice.service.time.monotonic', return_value=104):
            self.assertTrue(self.service._check_endpoint(session))
        with patch('voice.service.time.monotonic', return_value=105):
            self.assertFalse(self.service._check_endpoint(session))
        self.backend.stop_and_transcribe.assert_not_called()

    def test_activity_read_failure_does_not_disable_safety_limit(self):
        with patch('voice.service.time.monotonic', return_value=100):
            self.service.begin(self.client)
        session = self.service._active
        self.backend.capture_activity.side_effect = RuntimeError('device unavailable')
        with patch('voice.service.time.monotonic', return_value=103):
            self.assertTrue(self.service._check_endpoint(session))
        with patch('voice.service.time.monotonic', return_value=105):
            self.assertFalse(self.service._check_endpoint(session))
        self.backend.cancel_recording.assert_called_once_with('music')

    def test_stale_watchdog_and_delayed_finish_cannot_restart_or_stop_new_capture(self):
        ptt = VoicePTT(2, Mock(), tag='adapter', voice_service=self.service, lockout_seconds=0)
        ptt.begin()
        old = self.service._active
        tasks = []
        def thread(**kwargs):
            tasks.append(lambda: kwargs['target'](*kwargs['args']))
            return Mock()
        with patch('voice.ptt.threading.Thread', side_effect=thread):
            ptt.on_trigger()
            ptt.on_trigger()  # Already reserved: no second worker.
        self.assertEqual(len(tasks), 1)
        self.service.cancel(ptt.consumer)
        ptt.begin()
        self.assertFalse(self.service._check_endpoint(old))
        tasks[0]()
        self.assertTrue(ptt.is_recording)
        self.backend.stop_and_transcribe.assert_not_called()

    def test_normal_rearm_guard_prevents_finish_press_reopening_capture(self):
        ptt = VoicePTT(2, Mock(), tag='adapter', voice_service=self.service)
        with patch('voice.service.time.monotonic', return_value=100):
            ptt.begin()
            ptt.stop()
            self.infer()
            self.assertFalse(ptt.begin())
        with patch('voice.service.time.monotonic', return_value=101.1):
            self.assertTrue(ptt.begin())


if __name__ == "__main__":
    unittest.main()
