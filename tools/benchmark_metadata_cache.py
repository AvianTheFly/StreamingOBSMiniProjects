"""Measure real metadata reuse across simulated Hub starts, with disposable cache."""
import argparse
import json
from pathlib import Path
import sys
import tempfile
import time
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib import media_metadata as metadata


def run(folder, limit):
    paths=[]
    for file in folder.rglob('*'):
        if file.suffix.lower() in {'.mp4','.mkv','.webm','.mov'} and file.is_file():
            paths.append(file)
            if len(paths)>=limit:break
    if not paths:raise ValueError('No video files in this folder')
    before=[(p.stat().st_mtime_ns,p.stat().st_size) for p in paths]
    with tempfile.TemporaryDirectory(prefix='hub-metadata-benchmark-') as temporary:
        cache=Path(temporary)/'metadata.json'
        measurements=[]
        expected=None
        for phase in ('first_start','cached_restart'):
            metadata.configure_metadata_cache(None)
            metadata.clear_metadata_cache()
            metadata.configure_metadata_cache(cache)
            began,cpu=time.perf_counter(),time.process_time()
            with patch.object(metadata,'_read_metadata',wraps=metadata._read_metadata) as probe:
                values=[metadata.probe_media(p) for p in paths]
            metadata.flush_metadata_cache(force=True)
            measurements.append(dict(phase=phase,files=len(paths),probes=probe.call_count,
                                     wall_seconds=time.perf_counter()-began,
                                     python_cpu_seconds=time.process_time()-cpu))
            if expected is not None and values!=expected:raise AssertionError('Metadata changed')
            expected=values
        metadata.configure_metadata_cache(None)
    if [(p.stat().st_mtime_ns,p.stat().st_size) for p in paths]!=before:
        raise AssertionError('Source files changed during benchmark')
    return dict(measurements=measurements,identical_metadata=True,source_stat_unchanged=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder',type=Path)
    parser.add_argument('--limit',type=int,default=20)
    args=parser.parse_args()
    if not 1<=args.limit<=512:parser.error('--limit must be between 1 and 512')
    print(json.dumps(run(args.folder,args.limit),indent=2))
