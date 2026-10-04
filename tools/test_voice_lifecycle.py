"""Voice recording races exercised without a microphone or Whisper inference."""
import queue
import sys
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np
from voice import listener


class VoiceLifecycleTests(unittest.TestCase):
    def test_word_upload_consumes_owned_model_without_speech_vad(self):
        word=SimpleNamespace(start=.4,end=.8,word=' Where',probability=.92)
        model=Mock();model.transcribe.return_value=(iter([SimpleNamespace(start=.4,end=.8,text=' Where',words=[word])]),None)
        with patch.object(listener,'_model',model),patch.object(listener,'note_media_load'):
            result=listener.transcribe_file('song.mp3',word_timestamps=True)
        self.assertEqual(result['words'][0],dict(start=.4,end=.8,text='Where',probability=.92))
        self.assertFalse(model.transcribe.call_args.kwargs['vad_filter'])
        self.assertTrue(model.transcribe.call_args.kwargs['word_timestamps'])
        self.assertFalse(listener._transcription_busy)

    def test_lazy_inference_is_marked_until_segments_are_consumed(self):
        phase = []
        def segments():
            self.assertEqual(phase, [('voice:inference', 'running')])
            yield SimpleNamespace(text='private phrase')
            self.assertEqual(phase, [('voice:inference', 'running')])
        model = Mock()
        model.transcribe.return_value = (segments(), None)
        with patch.object(listener, '_model', model), \
             patch.object(listener, 'note_media_load', side_effect=lambda *args: phase.append(args)):
            self.assertEqual(listener._infer_text('private-file.wav'), 'private phrase')
        self.assertEqual(phase, [('voice:inference', 'running'), ('voice:inference', 'released')])
        self.assertNotIn('private', str(phase))

    def test_failed_lazy_upload_releases_diagnostic_activity_and_voice_ownership(self):
        def segments():
            yield SimpleNamespace(text='partial')
            raise RuntimeError('decoder failed')
        model = Mock()
        model.transcribe.return_value = (segments(), None)
        with patch.object(listener, '_model', model), patch.object(listener, 'note_media_load') as activity:
            with self.assertRaisesRegex(RuntimeError, 'decoder failed'):
                listener.transcribe_file('sample.wav')
        self.assertFalse(listener._transcription_busy)
        self.assertEqual([call.args for call in activity.call_args_list],
                         [('voice:inference', 'running'), ('voice:inference', 'released')])

    def setUp(self):
        values = {'_audio_q': queue.Queue(maxsize=128), '_buffer': [],
                  '_recording': False, '_recording_owner': '',
                  '_recording_generation': 0, '_transcription_busy': False,
                  '_recording_started': time.monotonic(), '_startup_error': None,
                  '_ready_event': threading.Event()}
        for name, value in values.items():
            setting = patch.object(listener, name, value)
            setting.start()
            self.addCleanup(setting.stop)
        listener._ready_event.set()

    def test_cancelled_chunks_cannot_enter_next_recording(self):
        listener.start_recording('first')
        listener._capture_audio(np.ones((512, 1), dtype=np.float32))
        late = listener._audio_q.get_nowait()
        listener.cancel_recording('first')
        listener.start_recording('second')
        with listener._rec_lock:
            listener._append_audio_locked(late)
        self.assertEqual(listener._buffer, [])
        listener._capture_audio(np.zeros((512, 1), dtype=np.float32))
        with listener._rec_lock:
            listener._flush_audio_queue_locked()
        self.assertEqual(len(listener._buffer), 1)
        self.assertTrue(np.all(listener._buffer[0] == 0))

    def test_callback_in_flight_during_cancel_is_tagged_with_old_session(self):
        listener.start_recording('first')
        class LateInput:
            def __getitem__(self, _):
                listener.cancel_recording('first')
                listener.start_recording('second')
                return np.ones(512, dtype=np.float32)
        listener._capture_audio(LateInput())
        with listener._rec_lock:
            listener._flush_audio_queue_locked()
        self.assertEqual(listener._buffer, [])
        self.assertEqual(listener._recording_owner, 'second')

    def test_stop_retains_already_queued_audio(self):
        listener.start_recording('test')
        listener._capture_audio(np.ones((512, 1), dtype=np.float32))
        def thread(**kwargs):
            return Mock(start=kwargs['target'])
        with patch.object(listener.threading, 'Thread', side_effect=thread), \
             patch.object(listener, '_transcribe_and_send') as transcribe:
            listener.stop_and_transcribe(Mock(), 'test')
        self.assertEqual(len(transcribe.call_args.args[0]), 1)
        self.assertTrue(np.all(transcribe.call_args.args[0][0] == 1))
        self.assertTrue(listener._audio_q.empty())
        self.assertFalse(listener._transcription_busy)

    def test_idle_callback_does_not_copy_or_enqueue_audio(self):
        data = Mock()
        listener._capture_audio(data)
        self.assertTrue(listener._audio_q.empty())
        data.assert_not_called()

    def test_audio_capture_queue_stays_bounded(self):
        listener.start_recording('test')
        for _ in range(256):
            listener._capture_audio(np.zeros((512, 1), dtype=np.float32))
        self.assertEqual(listener._audio_q.qsize(), 128)

    def test_safety_timeout_discards_pending_audio_instead_of_transcribing(self):
        listener.start_recording('test')
        listener._recording_started = time.monotonic() - listener.MAX_RECORDING_SECONDS - 1
        listener._capture_audio(np.ones((512, 1), dtype=np.float32))
        with patch.object(listener, '_transcribe_and_send') as transcribe:
            listener.stop_and_transcribe(Mock(), 'test')
        transcribe.assert_not_called()
        self.assertFalse(listener._recording)
        self.assertFalse(listener._transcription_busy)

    def test_repeated_start_keeps_one_listener(self):
        with patch.object(listener, '_listener_thread', None), \
             patch.object(listener.threading, 'Thread') as thread:
            thread.return_value.is_alive.return_value = True
            listener.start(threading.Event())
            listener.start(threading.Event())
            thread.assert_called_once()
            thread.return_value.start.assert_called_once()

    def test_failed_listener_start_can_retry(self):
        with patch.object(listener, '_listener_thread', None), \
             patch.object(listener.threading, 'Thread') as thread:
            thread.return_value.start.side_effect = [RuntimeError('no thread'), None]
            with self.assertRaises(RuntimeError):
                listener.start(threading.Event())
            self.assertIsNone(listener._listener_thread)
            listener.start(threading.Event())
            self.assertEqual(thread.call_count, 2)

    def test_mic_retry_reuses_loaded_whisper_model(self):
        factory = Mock()
        sounddevice = SimpleNamespace(query_devices=Mock(side_effect=RuntimeError('mic unavailable')))
        with patch.object(listener, '_model', None), \
             patch.dict(sys.modules, {'faster_whisper': SimpleNamespace(WhisperModel=factory),
                                      'sounddevice': sounddevice}):
            listener._init_and_drain(threading.Event())
            listener._init_and_drain(threading.Event())
        factory.assert_called_once()
        self.assertEqual(sounddevice.query_devices.call_count, 2)

    def test_shutdown_during_model_load_never_opens_microphone(self):
        stop = threading.Event()
        factory = Mock(side_effect=lambda *args, **kwargs: stop.set() or Mock())
        sounddevice = Mock()
        with patch.object(listener, '_model', None), \
             patch.dict(sys.modules, {'faster_whisper': SimpleNamespace(WhisperModel=factory),
                                      'sounddevice': sounddevice}):
            listener._init_and_drain(stop)
        sounddevice.query_devices.assert_not_called()


if __name__ == '__main__':
    unittest.main()
