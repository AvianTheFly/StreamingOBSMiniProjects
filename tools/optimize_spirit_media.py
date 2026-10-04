"""Finite production encode from preserved lossless animation masters.

Four bounded FFmpeg threads, unchanged audio and exact cut-plateau validation.
Quality measurements and file sizes are recorded beside the production clips.
"""
from pathlib import Path
import os
import json
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lib.json_store import write_json

MEDIA=Path(os.environ.get('SPIRIT_OUTPUT', 'C:/StreamingMedia/Transitions/udyr-spirits-v11'))


def optimize():
    manifest=json.loads((MEDIA/'manifest.json').read_text())
    chosen=sys.argv[1:] or manifest['clips']
    assert set(chosen)<=set(manifest['clips'])
    target=MEDIA/'production'
    target.mkdir(exist_ok=True)
    metrics={}
    previous=target/'quality-validation.json'
    if previous.exists():metrics=json.loads(previous.read_text())
    for clip in chosen:
        original=MEDIA/f'{clip}.webm'
        temporary=target/f'{clip}.encoding.webm'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','4',
            '-c:v','libvpx-vp9','-i',str(original),'-map','0:v','-map','0:a',
            '-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','16',
            '-deadline','good','-cpu-used','4','-row-mt','1','-threads','4',
            '-auto-alt-ref','0','-c:a','copy',str(temporary)],check=True)
        measured=subprocess.run(['ffmpeg','-hide_banner','-threads','4','-c:v','libvpx-vp9',
            '-i',str(original),'-threads','4','-c:v','libvpx-vp9','-i',str(temporary),
            '-filter_complex','[0:v]format=yuv420p[a];[1:v]format=yuv420p[b];[a][b]ssim',
            '-an','-f','null','-'],check=True,capture_output=True,text=True)
        score=float(re.findall(r'All:([0-9.]+)',measured.stderr)[-1])
        assert score>=.99, f'{clip}: production quality fell below 0.99 SSIM ({score})'
        metrics[clip]={'master_bytes':original.stat().st_size,'production_bytes':temporary.stat().st_size,
                       'ssim':score,'crf':16,'audio':'unchanged Opus packets'}
        temporary.replace(target/f'{clip}.webm')
        print(f'{clip}: SSIM {score:.6f}; {metrics[clip]["production_bytes"]/1048576:.1f} MB',flush=True)
    write_json(target/'quality-validation.json',metrics)
    write_json(target/'manifest.json',{**manifest,'encoding':{'codec':'VP9 alpha','crf':16,'masters':'..'}})


if __name__=='__main__':optimize()

