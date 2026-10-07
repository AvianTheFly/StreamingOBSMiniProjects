"""Compare full desk and viewer snapshot costs using a disposable match archive."""
import argparse
import json
from pathlib import Path
import statistics
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def benchmark():
    from lib.paths import ensure_import_paths
    from tools.offline_test_resources import configure_test_process
    configure_test_process()
    ensure_import_paths()
    from league_stats.service import Tracker
    from league_stats.store import Store
    with tempfile.TemporaryDirectory() as folder:
        root = Path(folder)
        tracker = Tracker(Store(root/'history.db'), root/'settings.json', clock=lambda: 1700000000)
        tracker.account = 'p'
        tracker.records = {f'p:{i}':dict(id=f'p:{i}',account='p',champion='Jinx',state='complete',
            queue=420,started_at=1700000000+i,win=bool(i%2),duration=1200,
            metrics=dict(kills=i%12,deaths=i%7,assists=i%15,cs=160+i%50,damage_champions=15000+i),
            items=[dict(id=1001,name='Boots')],matchups=dict(enemy_adc='Caitlyn',ally_support='Lulu')) for i in range(1200)}
        rows = {}
        for overlay in (False, True):
            times=[]
            for _ in range(6):
                started=time.process_time()
                # Batch samples so Windows' CPU-time tick is small relative to
                # each measured interval, rather than rounding individual reads.
                for _ in range(10):
                    value=tracker.snapshot(overlay=overlay,period='all')
                    payload=json.dumps(value)
                times.append((time.process_time()-started)*100)
            rows['overlay' if overlay else 'full']=dict(cpu_ms=statistics.median(times),json_bytes=len(payload.encode()))
        return dict(matches=len(tracker.records),**rows,
                    reduction_percent=100*(1-rows['overlay']['cpu_ms']/rows['full']['cpu_ms']))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    result=benchmark()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
