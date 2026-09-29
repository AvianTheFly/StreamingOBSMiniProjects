"""Use the existing full-canvas League input; preserve transforms, filters and audio."""
import time
import obs
from lib.settings_backups import SettingsBackups

SOURCE='League API Alerts'


def repair_overlay(service, existing_only=False):
    client=obs.get_obs()
    inputs=client.send('GetInputList',{},raw=True)['inputs']
    existing=next((row for row in inputs if row['inputName']==SOURCE),None)
    if not existing and existing_only:
        return False
    if existing and existing['inputKind']!='browser_source':
        raise ValueError('The League input name belongs to another source type')
    SettingsBackups().snapshot()
    settings={'url':'http://127.0.0.1:7431/overlay','width':1920,'height':1080,
              'fps':30,'fps_custom':True,'shutdown':False,'restart_when_active':False}
    if not existing:
        obs.create_scene_if_missing('League API')
        client.send('CreateInput',{'sceneName':'League API','inputName':SOURCE,'inputKind':'browser_source',
                    'inputSettings':{**settings,'reroute_audio':True},'sceneItemEnabled':True},raw=True)
    else:
        client.send('SetInputSettings',{'inputName':SOURCE,'inputSettings':settings,'overlay':True},raw=True)
        if not existing_only:
            obs.create_scene_if_missing('League API')
            items=client.send('GetSceneItemList',{'sceneName':'League API'},raw=True)['sceneItems']
            if not any(item['sourceName']==SOURCE for item in items):
                client.send('CreateSceneItem',{'sceneName':'League API','sourceName':SOURCE,'sceneItemEnabled':True},raw=True)
    client.send('PressInputPropertiesButton',{'inputName':SOURCE,'propertyName':'refreshnocache'},raw=True)
    return True


def recover_overlay(service):
    while not service.parent_stop.is_set() and not service.stop_event.is_set():
        if time.monotonic()-service.last_overlay>12:
            try: repair_overlay(service,existing_only=True)
            except Exception: pass
        service.stop_event.wait(15)
