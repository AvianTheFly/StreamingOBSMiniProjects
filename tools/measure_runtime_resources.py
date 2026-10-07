"""Finite read-only Hub/OBS resource capture; no scene, media or output commands."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import statistics
import sys
import time
import psutil

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib.paths import load_project_env

NAMES = {'python.exe','pythonw.exe','obs64.exe','obs-browser-page.exe',
         'obs-ffmpeg-mux.exe','ffmpeg.exe','ffprobe.exe','league of legends.exe'}


def measure(seconds):
    load_project_env()
    from obs import get_obs
    client=get_obs()
    tracked={}
    rows=[]
    psutil.cpu_percent()
    def discover():
        for process in psutil.process_iter(['pid','name','ppid','create_time']):
            if process.pid==psutil.Process().pid or process.info['name'].lower() not in NAMES:
                continue
            identity=(process.pid,process.info['create_time'])
            if identity not in tracked:
                try:
                    process.cpu_percent()
                    tracked[identity]=process
                except psutil.Error:pass
    discover()
    initial=client.get_stats()
    for second in range(seconds):
        time.sleep(1)
        processes=[]
        for identity,process in list(tracked.items()):
            try:
                processes.append(dict(pid=process.pid,name=process.info['name'],
                                      parent=process.info['ppid'],
                                      cpu=process.cpu_percent()/(psutil.cpu_count() or 1),
                                      rss_mb=process.memory_info().rss/1048576,
                                      threads=process.num_threads()))
            except psutil.Error:tracked.pop(identity,None)
        stats=client.get_stats()
        rows.append(dict(time=datetime.now(timezone.utc).isoformat(),system_cpu=psutil.cpu_percent(),
                         processes=processes,obs_fps=stats.active_fps,
                         render_ms=stats.average_frame_render_time,
                         skipped=stats.render_skipped_frames-initial.render_skipped_frames))
        if second%5==4:discover()
    names=sorted({p['name'] for r in rows for p in r['processes']})
    summary={name:dict(mean_cpu=round(statistics.mean(sum(p['cpu'] for p in r['processes'] if p['name']==name) for r in rows),3)) for name in names}
    return dict(seconds=seconds,scene=client.get_scene_list().current_program_scene_name,
                mean_system_cpu=statistics.mean(r['system_cpu'] for r in rows),
                mean_obs_render_ms=statistics.mean(r['render_ms'] for r in rows),
                render_skips=rows[-1]['skipped'],summary=summary,samples=rows)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seconds',type=int,default=30)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if not 1<=args.seconds<=300:parser.error('--seconds must be between 1 and 300')
    data=measure(args.seconds)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in data.items() if k!='samples'},indent=2))
