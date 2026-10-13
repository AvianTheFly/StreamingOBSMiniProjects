"""Finite offline owner for the explicitly requested OBS browser GPU setting.

Requires OBS closed. Preserve every unrelated INI byte and retain an external
backup; no profile, scene, output, source or Hub runtime policy is changed.
"""
import argparse
from datetime import datetime
import os
from pathlib import Path
import re
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))


def patch_acceleration(payload, enabled):
    pattern=rb'(?m)^(BrowserHWAccel=)(true|false)(\r?)$'
    if len(re.findall(pattern,payload))!=1:
        raise ValueError('Expected exactly one existing BrowserHWAccel value')
    return re.sub(pattern,lambda m:m[1]+(b'true' if enabled else b'false')+m[3],payload)


def apply(enabled):
    import psutil
    if any((p.info['name'] or '').lower()=='obs64.exe' for p in psutil.process_iter(['name'])):
        raise RuntimeError('Close OBS cleanly before changing its browser renderer')
    from lib.settings_backups import SettingsBackups
    SettingsBackups().snapshot()
    target=Path(os.environ['APPDATA'])/'obs-studio/global.ini'
    before=target.read_bytes();after=patch_acceleration(before,enabled)
    folder=Path(os.environ['LOCALAPPDATA'])/'StreamingHub/diagnostics'/('browser-gpu-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
    folder.mkdir(parents=True,exist_ok=False)
    (folder/'global.ini.before').write_bytes(before)
    if before!=after:
        temporary=target.with_name('global.ini.browser-gpu.tmp')
        temporary.write_bytes(after);temporary.replace(target)
    (folder/'global.ini.after').write_bytes(target.read_bytes())
    if target.read_bytes()!=after:raise RuntimeError('OBS renderer setting did not persist')
    return {'enabled':enabled,'changed':before!=after,'backup':str(folder)}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--enable',action='store_true')
    parser.add_argument('--disable',action='store_true')
    args=parser.parse_args()
    if args.enable==args.disable:parser.error('Choose --enable or --disable')
    print(apply(args.enable))
