"""GPU export failures must preserve original media and complete cut semantics."""
import os
import subprocess
import unittest
from unittest.mock import patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from instant_replay import encoding
from lib.media_jobs import MediaJobCancelled


class EncodingTests(unittest.TestCase):
    prefix = ['ffmpeg', '-y', '-ss', '1.3', '-i', 'original.mkv', '-t', '1.5',
              '-map', '0:v:0', '-map', '0:a?', '-map_metadata', '0']
    suffix = ['-c:a', 'aac', '-b:a', '192k', '-f', 'matroska', 'cut.partial']

    def run_cut(self):
        return encoding.run_cut(self.prefix, self.suffix, kind='replay-cut', timeout=60, text=True)

    def test_nvenc_preserves_range_audio_mapping_and_bounded_admission(self):
        with patch.dict(os.environ, {'HUB_REPLAY_VIDEO_ENCODER': 'nvenc'}), \
             patch.object(encoding.jobs, 'run', return_value=subprocess.CompletedProcess([], 0, '', '')) as run:
            self.assertEqual(self.run_cut().returncode, 0)
        command = run.call_args.args[0]
        i = command.index('-hwaccel')
        self.assertEqual(command[i:i + 4], ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'])
        self.assertEqual((command[:i] + command[i + 4:])[:len(self.prefix)], self.prefix)
        self.assertEqual(command[-len(self.suffix):], self.suffix)
        self.assertIn('h264_nvenc', command)
        self.assertEqual(run.call_args.kwargs['weight'], 2)

    def test_unavailable_gpu_retries_after_cleanup_with_same_cut_target(self):
        failed = subprocess.CompletedProcess([], 1, '', 'OpenEncodeSessionEx failed: out of memory')
        success = subprocess.CompletedProcess([], 0, '', '')
        with patch.dict(os.environ, {'HUB_REPLAY_VIDEO_ENCODER': 'nvenc'}), \
             patch.object(encoding.jobs, 'run', side_effect=[failed, success]) as run:
            self.assertIs(self.run_cut(), success)
        first, second = [c.args[0] for c in run.call_args_list]
        self.assertIn('h264_nvenc', first)
        self.assertIn('libx264', second)
        self.assertEqual(second[:len(self.prefix)], self.prefix)
        self.assertEqual(second[-len(self.suffix):], self.suffix)
        self.assertLessEqual(run.call_args_list[1].kwargs['timeout'], 60)

    def test_unsupported_decode_keeps_nvenc_before_software_fallback(self):
        results = [subprocess.CompletedProcess([], 1, '', 'Failed setup for format cuda: hwaccel initialisation returned error'),
                   subprocess.CompletedProcess([], 1, '', 'OpenEncodeSessionEx failed: unsupported device'),
                   subprocess.CompletedProcess([], 0, '', '')]
        with patch.dict(os.environ, {'HUB_REPLAY_VIDEO_ENCODER': 'nvenc'}), \
             patch.object(encoding.jobs, 'run', side_effect=results) as run:
            self.assertEqual(self.run_cut().returncode, 0)
        first, second, third = [c.args[0] for c in run.call_args_list]
        self.assertIn('-hwaccel', first)
        self.assertNotIn('-hwaccel', second)
        self.assertIn('h264_nvenc', second)
        self.assertIn('libx264', third)

    def test_decode_fallback_cancellation_does_not_try_software(self):
        with patch.dict(os.environ, {'HUB_REPLAY_VIDEO_ENCODER': 'nvenc'}), \
             patch.object(encoding.jobs, 'run', side_effect=[subprocess.CompletedProcess([], 1, '', 'Failed setup for format cuda'),
                                                           MediaJobCancelled('shutdown')]) as run:
            with self.assertRaises(MediaJobCancelled):
                self.run_cut()
        self.assertEqual(run.call_count, 2)

    def test_missing_ffmpeg_nvenc_and_unsupported_dimensions_fall_back(self):
        for error in (b"Unknown encoder 'h264_nvenc'", b'Width 64 is less than the minimum supported width 145'):
            with self.subTest(error=error), patch.dict(os.environ, {'HUB_REPLAY_VIDEO_ENCODER': 'nvenc'}), \
                 patch.object(encoding.jobs, 'run', side_effect=[subprocess.CompletedProcess([], 1, b'', error),
                                                                subprocess.CompletedProcess([], 0, b'', b'')]) as run:
                self.assertEqual(self.run_cut().returncode, 0)
                self.assertEqual(run.call_count, 2)

    def test_source_disk_and_audio_errors_are_not_retried(self):
        for error in ('Invalid data found when processing input', 'No space left on device',
                      "Unknown encoder 'aac'", 'Permission denied'):
            failure = subprocess.CompletedProcess([], 1, '', error)
            with self.subTest(error=error), patch.dict(os.environ, {'HUB_REPLAY_VIDEO_ENCODER': 'nvenc'}), \
                 patch.object(encoding.jobs, 'run', return_value=failure) as run:
                self.assertIs(self.run_cut(), failure)
                run.assert_called_once()

    def test_cancellation_and_timeout_never_restart_a_job(self):
        for error in (MediaJobCancelled('shutdown'), subprocess.TimeoutExpired([], 60)):
            with self.subTest(error=type(error)), patch.dict(os.environ, {'HUB_REPLAY_VIDEO_ENCODER': 'nvenc'}), \
                 patch.object(encoding.jobs, 'run', side_effect=error) as run:
                with self.assertRaises(type(error)):
                    self.run_cut()
                run.assert_called_once()

    def test_software_override_does_not_try_gpu(self):
        with patch.dict(os.environ, {'HUB_REPLAY_VIDEO_ENCODER': 'software'}), \
             patch.object(encoding.jobs, 'run', return_value=subprocess.CompletedProcess([], 1, '', 'No space left on device')) as run:
            self.run_cut()
        self.assertIn('libx264', run.call_args.args[0])
        self.assertNotIn('h264_nvenc', run.call_args.args[0])
        run.assert_called_once()

    def test_fallback_cannot_extend_the_original_deadline(self):
        failure = subprocess.CompletedProcess([], 1, '', 'OpenEncodeSessionEx failed')
        with patch.dict(os.environ, {'HUB_REPLAY_VIDEO_ENCODER': 'nvenc'}), \
             patch.object(encoding.time, 'monotonic', side_effect=[0, 0, 65]), \
             patch.object(encoding.jobs, 'run', return_value=failure) as run:
            with self.assertRaises(subprocess.TimeoutExpired):
                self.run_cut()
        run.assert_called_once()


if __name__ == '__main__':
    unittest.main()
