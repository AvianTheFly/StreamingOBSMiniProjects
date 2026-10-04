"""Saved visual looks; applying a look never owns scenes or starts playback."""
import math
from pathlib import Path
from .layouts import validate_choice

FIELDS=('title','subtitle','show_message','show_footer','artwork','rotation_seconds',
        'rotate_artwork','highlights_enabled','transition_style','motion','layout','custom_box')


def validate(items):
    if not isinstance(items,list) or len(items)>30:
        raise ValueError('Keep at most 30 saved looks.')
    ids,names=set(),set()
    for item in items:
        if not isinstance(item,dict):
            raise ValueError('Malformed saved look; original data is untouched.')
        identifier,name=item.get('id'),item.get('name')
        if not isinstance(identifier,str) or not identifier or len(identifier)>80 or identifier in ids:
            raise ValueError('Each saved look needs a unique ID.')
        if not isinstance(name,str) or not name.strip() or len(name)>80 or name.strip().casefold() in names:
            raise ValueError('Give each saved look a unique name (up to 80 characters).')
        values=item.get('settings')
        if not isinstance(values,dict) or not values:
            raise ValueError('A saved look needs its visual settings.')
        for key in ('title','subtitle'):
            if key in values and (not isinstance(values[key],str) or len(values[key])>180):
                raise ValueError('Saved-look messages must be text up to 180 characters.')
        for key in ('show_message','show_footer','rotate_artwork','highlights_enabled'):
            if key in values and not isinstance(values[key],bool):
                raise ValueError('Saved-look switches must be true or false.')
        if 'rotation_seconds' in values:
            n=values['rotation_seconds']
            if isinstance(n,bool) or not isinstance(n,(int,float)) or not math.isfinite(n) or not 10<=n<=600:
                raise ValueError('Saved-look rotation must be between 10 and 600 seconds.')
        if 'artwork' in values:
            art=values['artwork']
            if not isinstance(art,list) or not art or len(art)>100 or any(not isinstance(v,str) or v!=Path(v).name for v in art):
                raise ValueError('A saved look needs valid artwork filenames.')
        if 'transition_style' in values and values['transition_style'] not in ('dissolve','portal','gates','embers'):
            raise ValueError('Saved-look transition is unavailable.')
        if 'motion' in values and values['motion'] not in ('still','drift'):
            raise ValueError('Saved-look motion is unavailable.')
        if 'layout' in values:
            validate_choice(values)
        ids.add(identifier);names.add(name.strip().casefold())
