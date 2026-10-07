"""Finite off-air repair of the missing custom-FPS flag on owned living worlds.

Default is read-only. --apply snapshots settings and changes only fps_custom
when an installed known-world URL still has the intended 24 FPS value. It does
not reinstall layouts, reload profiles or select a program scene.
"""
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env


def run(apply=False):
    ensure_import_paths();load_project_env()
    from scene_voice_switcher.motion import WORLDS
    from lib.settings_backups import SettingsBackups
    from obs import get_obs
    client=get_obs()
    if apply and (client.get_stream_status().output_active or client.get_record_status().output_active):
        raise RuntimeError('Run the frame-cap repair off air, with recording stopped')
    existing={row['inputName']:row['inputKind'] for row in client.get_input_list().inputs}
    targets=[]
    for scene,world in WORLDS.items():
        name=scene+' Living World'
        if existing.get(name)!='browser_source':continue
        settings=client.get_input_settings(name).input_settings
        url=urlsplit(settings.get('url',''))
        if (url.hostname not in {'localhost','127.0.0.1'} or url.path!='/lobby-motion/index.html'
                or parse_qs(url.query).get('world')!=[world] or settings.get('fps')!=24):
            raise ValueError('Preserve nonstandard browser settings: '+name)
        if not settings.get('fps_custom'):
            targets.append(dict(name=name,before=settings))
    folder=None
    if apply and targets:
        SettingsBackups().snapshot()
        folder=Path(os.environ['LOCALAPPDATA'])/'StreamingHub'/'diagnostics'/('frame-caps-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
        folder.mkdir(parents=True,exist_ok=False)
        (folder/'before.json').write_text(json.dumps(targets,indent=2),encoding='utf-8')
        for target in targets:
            # Overlay one setting; personal URLs, filters, levels and placements stay owned.
            client.set_input_settings(target['name'],{'fps_custom':True},True)
            target['after']=client.get_input_settings(target['name']).input_settings
            expected={**target['before'],'fps_custom':True}
            if target['after']!=expected:
                raise RuntimeError('Unexpected input change; inspect saved evidence: '+target['name'])
        (folder/'after.json').write_text(json.dumps(targets,indent=2),encoding='utf-8')
    return dict(applied=apply,targets=[t['name'] for t in targets],backup=str(folder) if folder else None)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    print(json.dumps(run(args.apply),indent=2))
