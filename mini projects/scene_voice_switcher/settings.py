"""Lossless lobby rotation and per-location layout preferences."""
import json
import math
from pathlib import Path
from lib.json_store import update_json
from .layouts import defaults

PATH = Path(__file__).with_name('lobbies.json')
DEFAULT_ROTATION = {'Spirit Afterparty': False}

def read(path=None):
    path = Path(path or PATH)
    data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    if not isinstance(data,dict) or not isinstance(data.get('locations',{}),dict):
        raise ValueError('Preserve malformed lobby preferences; repair them explicitly')
    return data

def location(name, data=None):
    data = read() if data is None else data
    saved = data.get('locations',{}).get(name,{})
    if not isinstance(saved,dict):
        raise ValueError('Malformed preferences for '+name)
    return {**defaults(name), 'rotation': DEFAULT_ROTATION.get(name,True), **saved}

def rotation(names, data=None):
    data = read() if data is None else data
    chosen = [n for n in names if data.get('locations',{}).get(n,{}).get('rotation',DEFAULT_ROTATION.get(n,True))]
    if not chosen:
        raise ValueError('Keep at least one location in lobby rotation')
    return chosen

def validate_rect(rect):
    if not isinstance(rect,(list,tuple)) or len(rect)!=4 or any(
        isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in rect):
        raise ValueError('Placement must contain four finite numbers: x, y, width, height')
    x,y,w,h=rect
    if x<0 or y<0 or w<32 or h<32 or x+w>1920 or y+h>1080:
        raise ValueError('Placement must fit inside the 1920 × 1080 canvas')
    return list(rect)

def save(name, changes, names, *, path=None):
    if not isinstance(changes,dict): raise ValueError('Lobby changes must be an object')
    if name not in names:
        raise ValueError('Lobby is not installed: '+name)
    clean={}
    for key,value in changes.items():
        if key in ('screen','camera','chat'):
            clean[key]=validate_rect(value)
        elif key=='rotation':
            if not isinstance(value,bool): raise ValueError('Rotation must be true or false')
            clean[key]=value
        else:
            raise ValueError('Unknown lobby control: '+key)
    def update(data):
        if not isinstance(data,dict) or not isinstance(data.get('locations',{}),dict):
            raise ValueError('Preserve malformed lobby preferences')
        locations=dict(data.get('locations',{})); old=locations.get(name,{})
        if not isinstance(old,dict): raise ValueError('Preserve malformed location preferences')
        locations[name]={**old,**clean}; result={**data,'locations':locations}
        rotation(names,result)
        return result
    return update_json(path or PATH,update,default={})
