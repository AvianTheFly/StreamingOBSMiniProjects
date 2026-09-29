"""Recover an existing browser input without touching scenes or personalized edits."""
import obs
from lib.settings_backups import SettingsBackups
from .catalog import PORT, SOURCE


def attach_obs(bridge, *, existing_only=False):
    client = obs.get_obs()
    inputs = client.send('GetInputList', {}, raw=True)['inputs']
    existing = next((x for x in inputs if x['inputName'] == SOURCE), None)
    if not existing and existing_only:
        return False
    if existing and existing['inputKind'] != 'browser_source':
        raise RuntimeError('An unrelated OBS source uses the viewer effect source name.')
    SettingsBackups().snapshot()
    settings = dict(url=f'http://127.0.0.1:{PORT}/overlay?key={bridge.overlay_key}',
                    width=1920, height=1080, fps=30, fps_custom=True, shutdown=False, restart_when_active=False)
    if existing:
        client.send('SetInputSettings', dict(inputName=SOURCE, inputSettings=settings, overlay=True), raw=True)
    else:
        scene = obs.get_current_scene()
        client.send('CreateInput', dict(sceneName=scene, inputName=SOURCE, inputKind='browser_source',
                                      inputSettings=settings, sceneItemEnabled=True), raw=True)
        canvas = client.send('GetVideoSettings', {}, raw=True)
        item = client.send('GetSceneItemId', dict(sceneName=scene, sourceName=SOURCE), raw=True)
        client.send('SetSceneItemTransform', dict(sceneName=scene, sceneItemId=item['sceneItemId'],
                    sceneItemTransform={'scaleX': canvas['baseWidth']/1920, 'scaleY': canvas['baseHeight']/1080}), raw=True)
    # If OBS opened before the HTTP service, its error page has no heartbeat.
    client.send('PressInputPropertiesButton', dict(inputName=SOURCE, propertyName='refreshnocache'), raw=True)
    bridge.message = 'Viewer overlay refreshed. Waiting for its ready signal.'
    return True


def recover_overlay(bridge):
    """Retry on OBS restart; never create a source or change its scene placement."""
    while not bridge.stop.is_set():
        if bridge.clock() - bridge.last_browser >= 12:
            try:
                attach_obs(bridge, existing_only=True)
            except Exception:
                pass  # Offline OBS is normal; availability pauses our rewards.
        bridge.stop.wait(15)
