"""Process-wide native CPU defaults, applied before feature imports at startup.

Whisper's cpu_threads controls inference, not NumPy's independent BLAS pool or
other native import/initialization work. Children inherit these defaults. Never
resize live pools around individual calls: that races with other Hub workers.
"""
import os


def configure_native_threads():
    """Leave CPU headroom for OBS/gameplay; explicit deployment values win."""
    for name in ('OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'OMP_NUM_THREADS'):
        os.environ.setdefault(name, '2')


def restore_media_metadata():
    """Use the existing metadata owner for an external, disposable startup cache."""
    from pathlib import Path
    from lib.media_metadata import configure_metadata_cache
    path = None
    if os.environ.get('HUB_METADATA_CACHE', '1') != '0':
        path = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'StreamingHub' / 'media-metadata-v1.json'
    configure_metadata_cache(path)
