"""Settings-preserving assembly of the feature-owned OBS browser source."""
from .config import PORT, SOURCE


def attach_obs():
    import obs
    from lib.settings_backups import SettingsBackups
    SettingsBackups().snapshot()
    client = obs.get_obs()
    scene = obs.get_current_scene()
    existing = next((x for x in client.send('GetInputList',{},raw=True)['inputs'] if x['inputName']==SOURCE),None)
    if existing and existing['inputKind'] != 'browser_source': raise ValueError('Source name already belongs to another input')
    if not existing:
        client.send('CreateInput',dict(sceneName=scene,inputName=SOURCE,inputKind='browser_source',sceneItemEnabled=True,
            inputSettings=dict(url=f'http://127.0.0.1:{PORT}/overlay',width=1920,height=1080,fps=30,fps_custom=True,
                               reroute_audio=True,shutdown=False,restart_when_active=False)),raw=True)
    else:
        settings = client.send('GetInputSettings',dict(inputName=SOURCE),raw=True)['inputSettings']
        expected = dict(url=f'http://127.0.0.1:{PORT}/overlay', width=1920,height=1080,
                        fps=30,fps_custom=True,reroute_audio=True,shutdown=False,restart_when_active=False)
        patch = {key:value for key,value in expected.items() if settings.get(key) != value}
        if patch:
            client.send('SetInputSettings',dict(inputName=SOURCE,inputSettings=patch,overlay=True),raw=True)
        items = client.send('GetSceneItemList',{'sceneName':scene},raw=True)['sceneItems']
        if not any(x['sourceName']==SOURCE for x in items):
            client.send('CreateSceneItem',dict(sceneName=scene,sourceName=SOURCE,sceneItemEnabled=True),raw=True)
    # Existing sources also need the current stream track after an OBS profile change.
    # This helper adds that track without resetting faders or other track selections.
    obs.ensure_input_on_stream_track(SOURCE)
    return scene
