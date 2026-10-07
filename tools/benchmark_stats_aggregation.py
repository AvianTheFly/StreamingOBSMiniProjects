"""Compare covered archive metrics against a specified rollback commit."""
import argparse
import copy
import json
from pathlib import Path
import random
import statistics
import subprocess
import sys
import time
import types

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def benchmark(reference):
    from lib.paths import ensure_import_paths
    from tools.offline_test_resources import configure_test_process
    configure_test_process();ensure_import_paths()
    from league_stats import analytics
    source=subprocess.run(['git','show',f'{reference}:mini projects/league_stats/analytics.py'],
                          cwd=ROOT,check=True,capture_output=True,text=True).stdout
    old=types.ModuleType('league_stats.reference_analytics');old.__package__='league_stats'
    exec(compile(source,'reference_analytics.py','exec'),old.__dict__)
    rng=random.Random(271)
    fields=['kills','deaths','assists','cs','damage_champions','gold_earned','vision_score',
            'team_kills','team_damage_champions','gold_spent','dead_seconds','wards_placed',
            'largest_multi_kill','level','healing','damage_taken','team_gold_earned']
    def record(i):
        return dict(id=str(i),state=rng.choice(['complete','complete','live','partial']),
                    duration=rng.choice([0,200,1200,1800]),win=rng.choice([True,False,None]),
                    metrics={k:rng.randrange(300) for k in fields if rng.random()<.8})
    cases=[[],*[ [record(i) for i in range(rng.randrange(100))] for _ in range(100)]]
    archive=[record(i) for i in range(1200)];cases.append(archive)
    preserved=copy.deepcopy(cases)
    for records in cases:
        assert old.aggregate(records)==analytics.aggregate(records), 'Changed an aggregate or coverage value'
    assert cases==preserved, 'Aggregation mutated source records'
    results={}
    for name,fn in [('before',old.aggregate),('after',analytics.aggregate)]:
        times=[]
        for _ in range(7):
            began=time.process_time()
            for _ in range(50): fn(archive)
            times.append((time.process_time()-began)*1000/50)
        results[name]={'cpu_ms':statistics.median(times)}
    return dict(reference=reference,identical_cases=len(cases),matches=len(archive),**results,
                reduction_percent=100*(1-results['after']['cpu_ms']/results['before']['cpu_ms']))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--reference',required=True)
    parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    data=benchmark(args.reference);args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,indent=2),encoding='utf8');print(json.dumps(data,indent=2))
