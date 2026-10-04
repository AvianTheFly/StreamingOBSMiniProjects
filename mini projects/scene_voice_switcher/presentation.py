"""Explicit layout repair for owned lobby layers; no program-scene writes."""
from lib.display_capture import CAPTURE_SCENE
from . import settings
from .layouts import ART, LAYOUTS, FLAT_LOCATIONS
from lib.coordination.lobby_layout import apply_layout, transform_matches
from lib.coordination.lobbies import lobby_catalog
from .motion import layer as motion_layer
from obs.containers import container_items

lock = lobby_catalog.presentation_lock
CAMERA_SOURCE = 'FaceCamWithProps'

def chat_source(name):
    return name+' Chat'

def chat_settings(rect):
    return {'url':'http://127.0.0.1:7420/chat/overlay.html?lobby=1',
            'width':round(rect[2]),'height':round(rect[3]),
            'shutdown':True,'restart_when_active':False}

def transform(rect, *, stretch=False, fill=False):
    x,y,w,h=rect
    return dict(positionX=x,positionY=y,
        alignment=5,rotation=0,scaleX=1,scaleY=1,cropTop=0,cropBottom=0,cropLeft=0,cropRight=0,
        cropToBounds=fill,boundsType='OBS_BOUNDS_STRETCH' if stretch else
        'OBS_BOUNDS_SCALE_OUTER' if fill else 'OBS_BOUNDS_SCALE_INNER',
        boundsWidth=w,boundsHeight=h,boundsAlignment=0)

def place(client, owner, item_id, rect, *, stretch=False, fill=False):
    client.set_scene_item_transform(owner,item_id,transform(rect,stretch=stretch,fill=fill))
    client.set_scene_item_locked(owner,item_id,True)

def plan(name, data=None):
    """Publish feature policy as complete data, never callbacks into this package."""
    spec=settings.location(name,data); stem=LAYOUTS[name][0]
    layers=[]
    if name == 'Spirit Afterparty':
        layers.append({'source':'Hub Spirit Afterparty','transform':transform((0,0,1920,1080),stretch=True)})
    else:
        layers.append({'source':name+' Base','kind':'image_source',
                       'settings':{'file':str(ART/f'{stem}-base.png')},
                       'transform':transform((0,0,1920,1080),stretch=True)})
    layers.append({'source':CAPTURE_SCENE,'transform':transform(spec['screen'])})
    camera=transform(spec['camera'],fill=True)
    if name == 'Spirit Afterparty':
        camera.update(cropLeft=370,cropRight=370,cropToBounds=False,boundsType='OBS_BOUNDS_SCALE_INNER')
    layers.append({'source':CAMERA_SOURCE,'transform':camera})
    if name == 'Spirit Afterparty':
        layers.append({'source':'Hub Spirit Afterparty Foreground','transform':transform((0,0,1920,1080),stretch=True)})
    elif name not in FLAT_LOCATIONS:
        layers.append({'source':name+' Foreground','kind':'image_source',
                       'settings':{'file':str(ART/f'{stem}-foreground-cutout.png')},
                       'transform':transform((0,0,1920,1080),stretch=True)})
    animated=motion_layer(name,spec)
    if animated:
        layers.append({**animated,'transform':transform((0,0,1920,1080),stretch=True)})
    layers.append({'source':chat_source(name),'kind':'browser_source','configure':True,
                   'settings':chat_settings(spec['chat']),'transform':transform(spec['chat'],stretch=True)})
    return {'layers':layers,'hide':['Hub Lobby Chat'],
            'link_transform':transform((0,0,1920,1080),stretch=True)}

def restore(client,name):
    """Apply saved placement only to published layers; preserve other items/filters."""
    if name not in LAYOUTS: raise ValueError('This lobby has no authored layout')
    spec=settings.location(name)
    apply_layout(client,name,plan(name))
    links=client.get_scene_item_list('Lobbies').scene_items
    link=next((r for r in links if r['sourceName']==name),None)
    if link: place(client,'Lobbies',link['sceneItemId'],(0,0,1920,1080),stretch=True)
    return spec

def describe(client,name):
    if name not in LAYOUTS:
        return {'source':name,'label':name,'managed':False,'rotation':True}
    spec=settings.location(name)
    rows=container_items(client,name).scene_items
    indexed={r['sourceName']:r for r in rows}
    blueprint=plan(name)
    expected=[layer['source'] for layer in blueprint['layers']]
    missing=[s for s in expected if s not in indexed]
    hidden=[s for s in expected if s in indexed and not indexed[s]['sceneItemEnabled']]
    misplaced=[]
    for layer in blueprint['layers']:
        source=layer['source']
        if source not in indexed: continue
        transform=indexed[source].get('sceneItemTransform',{})
        if not transform_matches(transform,layer['transform']):
            misplaced.append(source)
    return {'source':name,'label':LAYOUTS[name][1],'description':LAYOUTS[name][2],
            'managed':True,'rotation':bool(spec['rotation']),'layout':spec,
            'art_url':('/api/projects/scene_voice_switcher/artwork?source='+name) if LAYOUTS[name][0] else '/spirit-lobby/art/clubhouse-clean.webp',
            'ready':not missing and not hidden and not misplaced,'missing':missing,
            'hidden':hidden,'misplaced':misplaced}
