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
