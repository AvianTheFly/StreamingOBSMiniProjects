"""Install only feature-owned sources, preserving later personal placement."""
import obs
from .config import SCENE, STAGE, OVERLAY, MEDIA, CLIP_BOX
from lib.settings_backups import SettingsBackups
from . import layouts


def attach(port):
    client = obs.get_obs()
    scenes = obs.list_scenes()
    inputs = {v['inputName']: v['inputKind'] for v in client.get_input_list().inputs}
    for name, kind in ((OVERLAY, 'browser_source'), (MEDIA, 'ffmpeg_source')):
        if name in inputs and inputs[name] != kind:
            raise ValueError(name + ' is already used by another source kind.')
    SettingsBackups().snapshot()
    if SCENE not in scenes:
        client.create_scene(SCENE)
    if STAGE not in scenes:
        client.create_scene(STAGE)
    items = obs.list_sources(SCENE)
    stage_items = obs.list_sources(STAGE)
    canvas = client.get_video_settings()
    scale_x, scale_y = canvas.base_width / 1920, canvas.base_height / 1080
    for name, kind, props in (
        (OVERLAY, 'browser_source', dict(url=f'http://127.0.0.1:{port}/starting-soon/overlay.html',
          width=1920, height=1080, fps=30, fps_custom=True, shutdown=False, restart_when_active=False)),
        (MEDIA, 'ffmpeg_source', dict(is_local_file=True, local_file='', looping=False,
          restart_on_activate=False, close_when_inactive=True, clear_on_media_end=True))):
        created = name not in inputs
        destination = STAGE if name == MEDIA else SCENE
        added = name not in (stage_items if name == MEDIA else items)
        original = None
        if name == MEDIA and added and name in items:
            original = client.get_scene_item_transform(SCENE,items[name]).scene_item_transform
        if created:
            client.create_input(destination, name, kind, props, name == OVERLAY)
        elif added:
            obs.create_scene_item(destination, name, name == OVERLAY)
        if created or added:
            x, y, width, height = CLIP_BOX if name == MEDIA else (0, 0, 1920, 1080)
            obs.set_source_transform(destination, name, original or dict(positionX=x*scale_x, positionY=y*scale_y,
                boundsType='OBS_BOUNDS_SCALE_INNER', boundsWidth=width*scale_x,
                boundsHeight=height*scale_y, alignment=5, boundsAlignment=0))
    if STAGE not in items:
        obs.create_scene_item(SCENE,STAGE,True)
        obs.set_source_transform(SCENE,STAGE,dict(positionX=0,positionY=0,alignment=5,
            boundsType='OBS_BOUNDS_SCALE_INNER',boundsWidth=canvas.base_width,boundsHeight=canvas.base_height))
    if MEDIA in items:
        obs.hide_source(SCENE,MEDIA)
    # OBS can have loaded an error page before the Hub was available. Refresh
    # this dedicated renderer when explicitly checking/opening the scene.
    client.send('PressInputPropertiesButton', dict(inputName=OVERLAY,
        propertyName='refreshnocache'), raw=True)
    return True


def placement(config, path=''):
    """Only explicit settings move existing inputs; preserve reads their placement."""
    client = obs.get_obs()
    canvas = client.get_video_settings()
    sx, sy = canvas.base_width/1920, canvas.base_height/1080
    desired = layouts.box(config, path)
    if desired is None:
        item = client.get_scene_item_id(STAGE, MEDIA).scene_item_id
        t = client.get_scene_item_transform(STAGE, item).scene_item_transform
        width = t.get('boundsWidth') or t.get('width') or CLIP_BOX[2]*sx
        height = t.get('boundsHeight') or t.get('height') or CLIP_BOX[3]*sy
        return [t['positionX']/sx, t['positionY']/sy, width/sx, height/sy]
    place_box(desired)
    return desired


def prepare_stage():
    # Studio Mode copies top-level items. A nested stage keeps clip visibility
    # and per-asset placement live while its parent stays on program.
    obs.configure_media_source_properties(MEDIA, clear_on_media_end=True)
    obs.stop_media(MEDIA)
    obs.show_source(SCENE, STAGE)


def place_box(desired):
    canvas = obs.get_obs().get_video_settings()
    sx, sy = canvas.base_width/1920, canvas.base_height/1080
    x,y,width,height = desired
    obs.set_source_transform(STAGE, MEDIA, dict(positionX=x*sx,positionY=y*sy,
        boundsType='OBS_BOUNDS_SCALE_INNER',boundsWidth=width*sx,boundsHeight=height*sy,
        alignment=5,boundsAlignment=0))
