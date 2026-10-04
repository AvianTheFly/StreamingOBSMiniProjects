"""Pure installation policy for the native OBS lobby passage script."""
import copy
from pathlib import Path
from .layouts import LAYOUTS


def patch_collection(current, script, *, style=None, duration=None):
    if style is not None and style not in ('dissolve','iris','gates','embers'):
        raise ValueError('Choose an available lobby passage')
    if duration is not None and (isinstance(duration,bool) or not isinstance(duration,int) or not 250<=duration<=2000):
        raise ValueError('Lobby passage duration must be between 250 and 2000 ms')
    data=copy.deepcopy(current)
    path=Path(script).as_posix()
    scripts=data.setdefault('modules',{}).setdefault('scripts-tool',[])
    existing=next((s for s in scripts if s.get('path','').replace('\\','/')==path),None)
    if existing is None:
        existing={'path':path,'settings':{'style':'iris','duration':950,'locations':'|'.join(LAYOUTS)}}
        scripts.append(existing)
    settings=existing.setdefault('settings',{})
    locations=settings.get('locations','')
    if not isinstance(locations,str):
        raise ValueError('Saved lobby passage locations must be text; personal data was preserved')
    known=set(locations.split('|'))
    added=[name for name in LAYOUTS if name not in known]
    if added:
        settings['locations']=locations+('|' if locations else '')+'|'.join(added)
    if style is not None:existing.setdefault('settings',{})['style']=style
    if duration is not None:existing.setdefault('settings',{})['duration']=duration
    return data
