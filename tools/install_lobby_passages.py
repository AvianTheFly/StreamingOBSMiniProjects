"""Finite off-air installer; preserve the active collection and every source.

OBS owns native scene-item transitions. This adapter installs one OBS-lifetime
script, without introducing a Hub worker or changing program-scene ownership.
Run with the correct Hub stopped; OBS must remain open and off-air.
"""
import configparser
import json
import os
import re
from pathlib import Path
import sys
import time
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lib.paths import ensure_import_paths, load_project_env
from lib.scene_transitions.installation import select_collection_file
from lib.settings_backups import SettingsBackups
from lib.json_store import write_json
ensure_import_paths()
from scene_voice_switcher.passage_installation import patch_collection


def observed_filename(collection):
    """OBS's switch log disambiguates cached duplicate collection names."""
    folder=Path(os.environ['APPDATA'])/'obs-studio/logs'
    logs=list(folder.glob('*.txt'))
    if not logs:return None
    log=max(logs,key=lambda p:p.stat().st_mtime)
    matches=re.findall(r"Switched to scene collection '(.+)' \(([^\r\n]+)\)",
                       log.read_text(encoding='utf-8',errors='replace'))
    if matches and matches[-1][0]==collection:return matches[-1][1]
    return None


def install(*, style=None, duration=None, collection_file=None):
    import psutil
    for process in psutil.process_iter(['cmdline','cwd']):
        try:
            if (any(Path(arg).name.casefold()=='hub.py' for arg in process.info['cmdline'] or []) and
                    Path(process.info['cwd'] or '').resolve()==ROOT):
                raise RuntimeError('Stop this checkout’s Hub before switching OBS collections')
        except (psutil.NoSuchProcess,psutil.AccessDenied):
            continue
    load_project_env()
    import obs
    client=obs.get_obs()
    for request in ('GetStreamStatus','GetRecordStatus'):
        if client.send(request,{},raw=True)['outputActive']:
            raise RuntimeError('Install while streaming and recording are inactive')
    original=client.send('GetSceneCollectionList',{},raw=True)['currentSceneCollectionName']
    scene=client.send('GetSceneList',{},raw=True)['currentProgramSceneName']
    folder=Path(os.environ['APPDATA'])/'obs-studio/basic/scenes'
    config=configparser.ConfigParser(interpolation=None)
    config.read(folder.parents[1]/'user.ini',encoding='utf-8-sig')
    configured=collection_file or observed_filename(original) or (config.get('Basic','SceneCollectionFile',fallback=None) if config.get('Basic','SceneCollection',fallback=None)==original else None)
    files={p.name:json.loads(p.read_text(encoding='utf-8')).get('name') for p in folder.glob('*.json')}
    file=folder/select_collection_file(files,original,configured)
    history=SettingsBackups();history.snapshot()
    staging='Hub Spirit Setup'
    collections=client.send('GetSceneCollectionList',{},raw=True)['sceneCollections']
    if staging not in collections:client.send('CreateSceneCollection',{'sceneCollectionName':staging},raw=True)
    else:client.send('SetCurrentSceneCollection',{'sceneCollectionName':staging},raw=True)
    time.sleep(.5)
    before=file.read_bytes()
    backup=history.backup_root/'_lobby_passages'/str(time.time_ns())
    backup.mkdir(parents=True);(backup/file.name).write_bytes(before)
    try:
        preserved=json.loads(before)
        data=patch_collection(preserved,ROOT/'mini projects/scene_voice_switcher/passages.lua',style=style,duration=duration)
        for key,value in preserved.items():
            if key!='modules':assert data[key]==value,f'Unexpected change: {key}'
        write_json(file,data)
        client.send('SetCurrentSceneCollection',{'sceneCollectionName':original},raw=True)
        time.sleep(1)
        loaded=observed_filename(original)
        if loaded and loaded!=file.name:
            raise RuntimeError('OBS reloaded a different cached collection file; original data will be restored')
        if client.send('GetSceneList',{},raw=True)['currentProgramSceneName']!=scene:
            raise RuntimeError('Program scene changed; refusing a stale restore')
        print(f'Installed lobby passages in {original}; backup {backup}')
    except BaseException:
        if client.send('GetSceneCollectionList',{},raw=True)['currentSceneCollectionName']!=staging:
            client.send('SetCurrentSceneCollection',{'sceneCollectionName':staging},raw=True)
        file.write_bytes(before)
        client.send('SetCurrentSceneCollection',{'sceneCollectionName':original},raw=True)
        raise


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--style',choices=['dissolve','iris','gates','embers'])
    parser.add_argument('--duration',type=int)
    parser.add_argument('--collection-file',help='Observed active OBS filename, for duplicate collection names')
    options=parser.parse_args()
    install(style=options.style,duration=options.duration,collection_file=options.collection_file)
