"""Measure hidden, muted OBS decoder starts without touching personal sources.

Run with explicit asset paths. Creates a uniquely named temporary input in the
current scene, keeps it hidden and muted, and removes it after each measurement.
This measures decoder startup, not visible composition or a full gaming load.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import load_project_env
from lib.settings_backups import SettingsBackups


def output_state(client):
    return dict(scene=client.get_current_program_scene().current_program_scene_name,
                stream=client.get_stream_status().output_active,
                record=client.get_record_status().output_active,
                replay=client.get_replay_buffer_status().output_active)


def gpu_sample():
    fields = ('utilization.gpu', 'utilization.encoder', 'utilization.decoder',
              'memory.used', 'power.draw')
    try:
        proc = subprocess.run(
            ['nvidia-smi', '--query-gpu=' + ','.join(fields),
             '--format=csv,noheader,nounits'], capture_output=True, text=True,
            timeout=2, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        return dict(zip(fields, [float(v.strip()) for v in proc.stdout.splitlines()[0].split(',')]))
    except (OSError, ValueError, IndexError, subprocess.SubprocessError):
        return {}


def sample(client, process):
    import psutil
    stats = client.get_stats()
    return dict(gpu=gpu_sample(), system_cpu=psutil.cpu_percent(),
                obs_process_cpu=process.cpu_percent(),
                obs_rss_mb=round(process.memory_info().rss / 1048576, 1),
                obs_threads=process.num_threads(),
                render_ms=stats.average_frame_render_time,
                render_skipped=stats.render_skipped_frames,
                output_skipped=stats.output_skipped_frames)


def measure(client, process, scene, path, hardware, seconds):
    name = 'Hub decoder measurement ' + uuid.uuid4().hex
    created = False
    samples = []
    try:
        client.create_input(scene, name, 'ffmpeg_source', dict(is_local_file=True,
                            restart_on_activate=False, close_when_inactive=False,
                            hw_decode=hardware, looping=False), False)
        created = True
        client.set_input_mute(name, True)
        client.set_input_audio_monitor_type(name, 'OBS_MONITORING_TYPE_NONE')
        client.set_input_audio_tracks(name, {str(i): False for i in range(1, 7)})
        baseline = sample(client, process)
        started = time.monotonic()
        client.set_input_settings(name, {'local_file': str(path)}, overlay=True)
        progress = None
        while time.monotonic() - started < seconds:
            status = client.get_media_input_status(name)
            elapsed = time.monotonic() - started
            if progress is None and status.media_cursor is not None and status.media_cursor > 0:
                progress = elapsed
            row = sample(client, process)
            row.update(seconds=round(elapsed, 3), state=status.media_state,
                       cursor_ms=status.media_cursor)
            samples.append(row)
            time.sleep(.1)
        return dict(asset=path.name, bytes=path.stat().st_size, hardware=hardware,
                    first_progress_seconds=round(progress, 3) if progress is not None else None,
                    baseline=baseline, samples=samples)
    finally:
        if created:
            try:
                client.trigger_media_input_action(name, 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP')
            finally:
                client.remove_input(name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('assets', nargs='+', type=Path)
    parser.add_argument('--seconds', type=float, default=3)
    args = parser.parse_args()
    paths = [p.resolve(strict=True) for p in args.assets]
    if not 1 <= args.seconds <= 10:
        parser.error('--seconds must be between 1 and 10')
    load_project_env()
    import obs
    import psutil
    from lib.performance_monitor import find_obs_process
    from obs.obs_config import OBS_PORT
    client = obs.get_obs()
    process = find_obs_process(psutil, int(OBS_PORT))
    if process is None:
        raise RuntimeError('OBS is not running')
    before = output_state(client)
    SettingsBackups().snapshot()
    process.cpu_percent()
    psutil.cpu_percent()
    measurements = []
    try:
        for path in paths:
            for hardware in (True, False):
                measurements.append(measure(client, process, before['scene'], path,
                                            hardware, args.seconds))
                time.sleep(.5)
    finally:
        after = output_state(client)
        folder = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'StreamingHub/diagnostics'
        folder.mkdir(parents=True, exist_ok=True)
        output = folder / ('decoder-profile-' + time.strftime('%Y%m%d-%H%M%S') + '.json')
        output.write_text(json.dumps(dict(before=before, after=after,
                                         measurements=measurements), indent=2), encoding='utf-8')
        print('Saved', output)
        if before != after:
            print('Output state changed during measurement:', before, after)
    for row in measurements:
        print(row['asset'], 'hardware' if row['hardware'] else 'software',
              'first progress', row['first_progress_seconds'],
              'peak system CPU', max(r['system_cpu'] for r in row['samples']),
              'peak OBS CPU', max(r['obs_process_cpu'] for r in row['samples']),
              'peak GPU', max((r['gpu'].get('utilization.gpu', 0) for r in row['samples']), default=0))


if __name__ == '__main__':
    main()
