"""Spotify browser attachment and recovery after its presentation worker is ready."""
from urllib.parse import urlsplit

PORT = 7447
SOURCE = 'Hub Spotify Visualizer'
SCENE = 'Spotify Overlay'


def managed_url(value):
    try:
        url = urlsplit(value)
        return (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1')
                and url.port == PORT and url.path in ('/', '/overlay'))
    except (TypeError, ValueError):
        return False


def attach_obs(*, refresh_existing=False):
    import obs
    from lib.settings_backups import SettingsBackups
    client = obs.get_obs()
    existing = next((i for i in client.send('GetInputList', {}, raw=True)['inputs'] if i['inputName'] == SOURCE), None)
    if existing:
        if existing['inputKind'] != 'browser_source':
            raise ValueError(f'{SOURCE} is already used by another source kind')
        if refresh_existing:
            settings = client.send('GetInputSettings', {'inputName': SOURCE}, raw=True)['inputSettings']
            if managed_url(settings.get('url', '')):
                client.send('PressInputPropertiesButton', dict(inputName=SOURCE, propertyName='refreshnocache'), raw=True)
        return  # URL, dimensions, placement, filters and visibility stay personal.
    SettingsBackups().snapshot()
    current = client.send('GetCurrentProgramScene', {}, raw=True)['currentProgramSceneName']
    obs.create_scene_if_missing(SCENE)
    client.send('CreateInput', dict(sceneName=SCENE, inputName=SOURCE, inputKind='browser_source',
        inputSettings=dict(url=f'http://127.0.0.1:{PORT}/overlay', width=400, height=300,
                           fps=30, fps_custom=True, shutdown=False, restart_when_active=False),
        sceneItemEnabled=True), raw=True)
    canvas = client.send('GetVideoSettings', {}, raw=True)
    obs.set_source_transform(SCENE, SOURCE, dict(positionX=max(0, canvas['baseWidth']-420),
                                                positionY=max(0, canvas['baseHeight']-320)))
    if current != SCENE:
        items = client.send('GetSceneItemList', {'sceneName': current}, raw=True)['sceneItems']
        if not any(i['sourceName'] == SCENE for i in items):
            client.send('CreateSceneItem', dict(sceneName=current, sourceName=SCENE, sceneItemEnabled=True), raw=True)


class OBSPresentation:
    def __init__(self):
        self.attached_token = None

    def sync(self, state):
        token = state.presentation_token()
        if token is None or token is self.attached_token:
            return False
        attach_obs(refresh_existing=True)
        # A replacing worker cannot inherit an older worker's successful attach.
        if state.presentation_token() is token:
            self.attached_token = token
        return True
