"""Idempotent full-canvas attachment. Existing placement, filters and faders survive."""
import obs
from lib.settings_backups import SettingsBackups

PORT = 7444


def source_name(project):
    return f'Hub {project.title()} Effects'


def attach(project, scene, monitor, tracks):
    client = obs.get_obs()
    name = source_name(project)
    inputs = client.send('GetInputList', {}, raw=True)['inputs']
    existing = next((x for x in inputs if x['inputName'] == name), None)
    if existing and existing['inputKind'] != 'browser_source':
        raise ValueError(f'{name} already belongs to another source kind')
    settings = dict(url=f'http://127.0.0.1:{PORT}/overlay/{project}', width=1920,
                    height=1080, fps=30, reroute_audio=True, shutdown=False, restart_when_active=False)
    if not existing:
        SettingsBackups().snapshot()
        obs.create_scene_if_missing(scene)
        client.send('CreateInput', dict(sceneName=scene, inputName=name, inputKind='browser_source',
                                       inputSettings=settings, sceneItemEnabled=True), raw=True)
        obs.set_input_audio_monitor_type(name, monitor)
        if tracks:
            obs.set_input_audio_tracks(name, tracks)
        else:
            obs.ensure_input_on_stream_track(name)
        # New canvases fill the OBS base resolution; never overwrite later edits.
        canvas = client.send('GetVideoSettings', {}, raw=True)
        obs.set_source_transform(scene, name, dict(positionX=0, positionY=0,
            scaleX=canvas['baseWidth']/1920, scaleY=canvas['baseHeight']/1080))
    else:
        current = client.send('GetInputSettings', {'inputName':name}, raw=True)['inputSettings']
        patch = {key: value for key, value in settings.items() if current.get(key) != value}
        if patch:
            SettingsBackups().snapshot()
            client.send('SetInputSettings', dict(inputName=name, inputSettings=patch, overlay=True), raw=True)
        items = client.send('GetSceneItemList', {'sceneName':scene}, raw=True)['sceneItems']
        if not any(x['sourceName'] == name for x in items):
            SettingsBackups().snapshot()
            client.send('CreateSceneItem', dict(sceneName=scene, sourceName=name, sceneItemEnabled=True), raw=True)
    obs.show_source(scene, name)
    return name
