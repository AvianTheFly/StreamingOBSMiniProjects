"""Replay export encoding policy; process lifetime belongs to media_jobs.

HUB_REPLAY_VIDEO_ENCODER=nvenc opts into CUDA decode and GPU H.264 encoding.
Unsupported decoding retries CPU decode/NVENC; an unavailable encoder retries
the existing software preset, after its process has closed.
Cut boundaries, stream mapping and atomic output publication stay with callers.
"""
from __future__ import annotations

import os
import subprocess
import time

from lib.media_jobs import jobs


_SOFTWARE = ('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '2')
_NVIDIA = ('-c:v', 'h264_nvenc', '-preset', 'p5', '-tune', 'hq',
           '-rc', 'vbr', '-cq', '24', '-b:v', '0', '-threads', '2')
_DECODE = ('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda')
_UNAVAILABLE = ('cannot load nvcuda', 'cannot load libcuda',
                'cannot load nvencodeapi', 'cannot load libnvidia-encode',
                'no nvenc capable devices', 'no capable devices found',
                'driver does not support', 'required nvenc api',
                'openencodesessionex failed', 'initializeencoder failed',
                'unsupported device', 'too many concurrent sessions',
                "unknown encoder 'h264_nvenc'", 'no device available',
                'less than the minimum supported', '10 bit encode not supported',
                "doesn't support required nvenc features", 'yuv444p not supported')
_DECODE_UNAVAILABLE = ('hwaccel initialisation', 'hwaccel initialization',
                       'failed setup for format cuda', 'cannot load libnvcuvid',
                       'cannot load nvcuvid', 'cuvidcreatedecoder',
                       'required nvdec features', 'no device available for decoder',
                       'impossible to convert between the formats')


def _error_text(result):
    error = result.stderr or ''
    if isinstance(error, bytes):
        error = error.decode('utf-8', errors='replace')
    return error.lower()


def run_cut(prefix, suffix, *, kind, timeout=1800, text=False):
    """Encode through the existing bounded budget; never retry cancelled work."""
    mode = os.environ.get('HUB_REPLAY_VIDEO_ENCODER', 'software').strip().lower()
    if mode not in {'software', 'nvenc'}:
        raise ValueError('HUB_REPLAY_VIDEO_ENCODER must be software or nvenc')
    deadline = time.monotonic() + timeout
    def attempt(input_args, codec):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise subprocess.TimeoutExpired([*input_args, *codec, *suffix], timeout)
        return jobs.run([*input_args, *codec, *suffix], kind=kind, weight=2,
                        priority=0, timeout=remaining, text=text)

    if mode == 'software':
        return attempt(prefix, _SOFTWARE)
    # These two callers export one unfiltered full-resolution video. Keep all
    # stream mappings and exact input seek options; CUDA options precede -i.
    use_decode = prefix.count('-i') == 1 and not any(
        flag in prefix or flag in suffix for flag in ('-vf', '-filter_complex'))
    if use_decode:
        i = prefix.index('-i')
        gpu_prefix = [*prefix[:i], *_DECODE, *prefix[i:]]
    else:
        gpu_prefix = prefix
    result = attempt(gpu_prefix, _NVIDIA)
    error = _error_text(result)
    if use_decode and result.returncode and any(term in error for term in _DECODE_UNAVAILABLE):
        print('[instant_replay] CUDA decoder unavailable; retaining NVENC with CPU decoding.')
        result = attempt(prefix, _NVIDIA)
        error = _error_text(result)
    if result.returncode and any(term in error for term in _UNAVAILABLE):
        # The same .partial target is overwritten by the caller's -y option.
        # A second admission still checks Hub shutdown/cancellation. Invalid
        # media, permissions and disk errors are returned without a retry.
        print('[instant_replay] NVENC unavailable; retrying this cut with bounded software encoding.')
        result = attempt(prefix, _SOFTWARE)
    return result
