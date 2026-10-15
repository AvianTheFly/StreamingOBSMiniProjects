"""Finite additive recap-source installation; never chooses the program scene."""
from lib.settings_backups import SettingsBackups
from lib.display_capture import CAPTURE_SCENE
from lib.coordination.lobby_layout import transform_matches

SOURCE = 'League Match Chronicle'
SCENE = 'League Match Chronicle'
URL = 'http://127.0.0.1:7420/league-stats/postgame.html'


def install(client, between_games_scene):
    scenes = {s['sceneName'] for s in client.get_scene_list().scenes}
    if between_games_scene not in scenes:
        raise ValueError('The configured between-game scene is missing')
    inputs = {i['inputName']:i for i in client.send('GetInputList', {}, raw=True)['inputs']}
    for name in (SOURCE + ' Auto', SOURCE + ' Review'):
        if name in inputs and inputs[name]['inputKind'] != 'browser_source':
            raise ValueError('Recap source name belongs to a different input type')
    SettingsBackups().snapshot()
    if SCENE not in scenes:
        client.send('CreateScene', {'sceneName':SCENE}, raw=True)
    # The shared display's parent items already carry each room's saved frame.
    # A transparent automatic report overlays its media, with no per-room copy.
    automatic_scene = CAPTURE_SCENE if CAPTURE_SCENE in scenes else between_games_scene
    for scene, suffix, query in ((automatic_scene, ' Auto', '?stream=1'), (SCENE, ' Review', '')):
        name = SOURCE + suffix
        items = client.send('GetSceneItemList', {'sceneName':scene}, raw=True)['sceneItems']
        if name not in inputs:
            client.send('CreateInput', dict(sceneName=scene,inputName=name,inputKind='browser_source',
                        inputSettings=dict(url=URL+query,width=960,height=540,fps=15,fps_custom=True,
                                           shutdown=True,restart_when_active=True),sceneItemEnabled=True), raw=True)
        elif not any(i['sourceName']==name for i in items):
            client.send('CreateSceneItem', dict(sceneName=scene,sourceName=name,sceneItemEnabled=True), raw=True)
        settings=client.send('GetInputSettings',dict(inputName=name),raw=True)['inputSettings']
        legacy=settings.get('width')==1920 and settings.get('height')==1080
        if settings.get('url')==URL+query and legacy:
            client.send('SetInputSettings',dict(inputName=name,inputSettings=dict(width=960,height=540),overlay=True),raw=True)
        # Migrate only our untouched original full-screen placement. Later
        # user adjustments remain authoritative across reinstallations.
        if name not in inputs or legacy:
            current=client.send('GetSceneItemList',dict(sceneName=scene),raw=True)['sceneItems']
            item=next(i for i in current if i['sourceName']==name)
            transform=item['sceneItemTransform']
            if all(abs(transform.get(k,default)-default)<0.01 for k,default in
                   [('positionX',0),('positionY',0),('scaleX',1),('scaleY',1)]):
                placement=dict(positionX=60,positionY=180,scaleX=896/960,scaleY=504/540) if suffix==' Auto' else dict(positionX=0,positionY=0,scaleX=2,scaleY=2)
                client.send('SetSceneItemTransform',dict(sceneName=scene,sceneItemId=item['sceneItemId'],
                            sceneItemTransform=placement),raw=True)
        if suffix == ' Auto' and scene == CAPTURE_SCENE:
            current = client.send('GetSceneItemList', dict(sceneName=scene), raw=True)['sceneItems']
            item = next(i for i in current if i['sourceName'] == name)
            placement = dict(positionX=0, positionY=0, alignment=5, rotation=0,
                             scaleX=1, scaleY=1, cropTop=0, cropBottom=0, cropLeft=0, cropRight=0,
                             cropToBounds=False, boundsType='OBS_BOUNDS_SCALE_INNER',
                             boundsWidth=1920, boundsHeight=1080, boundsAlignment=0)
            if not transform_matches(item.get('sceneItemTransform', {}), placement):
                client.send('SetSceneItemTransform', dict(sceneName=scene, sceneItemId=item['sceneItemId'],
                            sceneItemTransform=placement), raw=True)
            if not item.get('sceneItemEnabled'):
                client.send('SetSceneItemEnabled', dict(sceneName=scene, sceneItemId=item['sceneItemId'], sceneItemEnabled=True), raw=True)
            if not item.get('sceneItemLocked'):
                client.send('SetSceneItemLocked', dict(sceneName=scene, sceneItemId=item['sceneItemId'], sceneItemLocked=True), raw=True)
            if item.get('sceneItemIndex') != len(current)-1:
                client.send('SetSceneItemIndex', dict(sceneName=scene, sceneItemId=item['sceneItemId'], sceneItemIndex=len(current)-1), raw=True)
    if automatic_scene != between_games_scene:
        # Retain the old personal placement as a hidden reference for recovery.
        rows = client.send('GetSceneItemList', dict(sceneName=between_games_scene), raw=True)['sceneItems']
        for item in rows:
            if item['sourceName'] == SOURCE+' Auto' and item.get('sceneItemEnabled'):
                client.send('SetSceneItemEnabled', dict(sceneName=between_games_scene,
                            sceneItemId=item['sceneItemId'], sceneItemEnabled=False), raw=True)
    return dict(automatic_scene=automatic_scene,review_scene=SCENE,url=URL)
